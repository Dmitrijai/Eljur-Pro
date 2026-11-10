import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Rnd } from 'react-rnd';
import { AppState } from '../../types';
import { Button, Card, Modal } from '../../components/ui';
import * as H from '../../utils/helpers';
import * as DB from '../../services/db';
import { Type, Image as ImageIcon, Trash2, Move, RotateCw, Trash, FileText, ImagePlus } from 'lucide-react';
import * as mammoth from 'mammoth';
import DOMPurify from 'dompurify';

interface FloatingElement {
  id: string;
  type: 'image' | 'video' | 'text' | 'iframe';
  x: number;
  y: number;
  w: number | string;
  h: number | string;
  rotation?: number;
  content?: string;
  src?: string;
  style?: React.CSSProperties;
}

interface Snapshot {
  quillContent: string;
  elements: FloatingElement[];
  backgroundImage: string | null;
}

interface Props {
  state: AppState;
  onUpdate: (s: AppState) => void;
  lang: 'ru' | 'en';
  setHasUnsavedChanges?: (val: boolean) => void;
  mode?: 'eljur' | 'school';
  schoolId?: string;
}

export function EljurInfoEditor({ state, onUpdate, lang, setHasUnsavedChanges, mode = 'eljur', schoolId }: Props) {
  const [quillContent, setQuillContent] = useState('');
  const [elements, setElements] = useState<FloatingElement[]>([]);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [videoCursorPos, setVideoCursorPos] = useState<{x: number, y: number} | null>(null);
  const [customFonts, setCustomFonts] = useState<{name: string, displayName: string}[]>([]);
  const quillRef = useRef<ReactQuill>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadFonts = async () => {
      const assets = await DB.getAllAssets();
      const fonts = assets.filter(a => a.name.toLowerCase().endsWith('.ttf') || a.name.toLowerCase().endsWith('.woff') || a.name.toLowerCase().endsWith('.woff2'));
      
      const loadedFonts: {name: string, displayName: string}[] = [];
      const readBlobAsDataURL = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      };

      for (const font of fonts) {
        try {
          const dataUrl = await readBlobAsDataURL(font.blob);
          const fontName = `customfont_${font.id.replace(/[^a-zA-Z0-9]/g, '')}`;
          const fontFace = new FontFace(fontName, `url(${dataUrl})`);
          await fontFace.load();
          document.fonts.add(fontFace);
          loadedFonts.push({ name: fontName, displayName: font.name.replace(/\\.[^/.]+$/, "") });
        } catch (e) {
          console.error("Failed to load font", e);
        }
      }
      
      if (loadedFonts.length > 0) {
        const Font = ReactQuill.Quill.import('formats/font') as any;
        const baseFonts = [false, 'serif', 'monospace'];
        Font.whitelist = [...baseFonts, ...loadedFonts.map(f => f.name)];
        ReactQuill.Quill.register(Font, true);
        setCustomFonts(loadedFonts);
      }
    };
    loadFonts();
  }, []);

  // Global History state
  const pastRef = useRef<Snapshot[]>([]);
  const futureRef = useRef<Snapshot[]>([]);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const backgroundImageRef = useRef(backgroundImage);
  backgroundImageRef.current = backgroundImage;
  const quillContentRef = useRef(quillContent);
  quillContentRef.current = quillContent;

  const saveToPast = useCallback(() => {
    pastRef.current.push({
      quillContent: quillContentRef.current,
      elements: elementsRef.current,
      backgroundImage: backgroundImageRef.current
    });
    if (pastRef.current.length > 100) pastRef.current.shift();
    futureRef.current = [];
  }, []);

  const globalUndo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    const previous = pastRef.current.pop()!;
    futureRef.current.push({
      quillContent: quillContentRef.current,
      elements: elementsRef.current,
      backgroundImage: backgroundImageRef.current
    });
    setQuillContent(previous.quillContent);
    setElements(previous.elements);
    setBackgroundImage(previous.backgroundImage);
    if (setHasUnsavedChanges) setHasUnsavedChanges(true);
  }, [setHasUnsavedChanges]);

  const globalRedo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current.pop()!;
    pastRef.current.push({
      quillContent: quillContentRef.current,
      elements: elementsRef.current,
      backgroundImage: backgroundImageRef.current
    });
    setQuillContent(next.quillContent);
    setElements(next.elements);
    setBackgroundImage(next.backgroundImage);
    if (setHasUnsavedChanges) setHasUnsavedChanges(true);
  }, [setHasUnsavedChanges]);

  const globalUndoRef = useRef(globalUndo);
  globalUndoRef.current = globalUndo;
  const globalRedoRef = useRef(globalRedo);
  globalRedoRef.current = globalRedo;

  const isTypingRef = useRef(false);
  const snapshotTimeoutRef = useRef<any>(null);

  const handleQuillChange = (val: string, _delta?: any, source?: string) => {
    if (val === quillContentRef.current) return;

    // Ignore programmatic / initial normalization changes from ReactQuill on mount
    if (source && source !== 'user') {
      quillContentRef.current = val;
      setQuillContent(val);
      return;
    }

    if (!isTypingRef.current) {
      saveToPast();
      isTypingRef.current = true;
    }
    setQuillContent(val);
    if (setHasUnsavedChanges) setHasUnsavedChanges(true);

    clearTimeout(snapshotTimeoutRef.current);
    snapshotTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
    }, 1000);
  };

  const currentRawInfo = mode === 'school'
    ? H.getSchoolInfo(state, schoolId)
    : H.getSchoolEljurInfo(state, undefined);

  useEffect(() => {
    const info = mode === 'school'
      ? H.getSchoolInfo(state, schoolId)
      : H.getSchoolEljurInfo(state, undefined);
    try {
      const parsed = JSON.parse(info);
      if (parsed && parsed.isComplex) {
        const sanitized = H.sanitizeRichHtml(parsed.quillContent || '');
        quillContentRef.current = sanitized;
        setQuillContent(sanitized);
        setElements(Array.isArray(parsed.elements) ? parsed.elements : []);
        setBackgroundImage(H.sanitizeSafeUrl(parsed.backgroundImage, 'background') || null);
        if (setHasUnsavedChanges) setHasUnsavedChanges(false);
        return;
      }
    } catch (e) {
      // Not JSON, fallback to pure HTML
    }
    const sanitized = H.sanitizeRichHtml(info || '');
    quillContentRef.current = sanitized;
    setQuillContent(sanitized);
    setElements([]);
    setBackgroundImage(null);
    if (setHasUnsavedChanges) setHasUnsavedChanges(false);
  }, [mode, schoolId, currentRawInfo]);

  const handleSave = () => {
    const safeQuillContent = H.sanitizeRichHtml(quillContent);
    const complexData = {
      isComplex: true,
      quillContent: safeQuillContent,
      elements,
      backgroundImage: H.sanitizeSafeUrl(backgroundImage, 'background') || null
    };
    const serialized = JSON.stringify(complexData);
    if (mode === 'school') {
      const targetSid = schoolId && schoolId !== 'global' ? schoolId : 'school_1';
      H.setSchoolInfo(state, targetSid, serialized);
      const updatedSchools = (state.schools || []).map(s => s.id === targetSid ? { ...s, schoolInfo: serialized } : s);
      const nextState: AppState = {
        ...state,
        schools: updatedSchools
      };
      DB.saveSchoolMetadata(targetSid, { schoolInfo: serialized }).catch(() => {});
      DB.saveSchoolCache(targetSid, nextState).catch(() => {});
      onUpdate(nextState);
    } else {
      const updatedSchools = (state.schools || []).map(s => ({ ...s, eljurInfo: serialized }));
      DB.savePublicCreatorGate('school_1', {
        secretKey: state.settings.secretKey || 'Space',
        secretCount: state.settings.secretCount || 4,
        adminPasswordHash: state.settings.adminPasswordHash,
        adminPasswordSalt: state.settings.adminPasswordSalt,
        eljurInfo: serialized
      }).catch(() => {});
      onUpdate({
        ...state,
        schools: updatedSchools,
        settings: {
          ...state.settings,
          eljurInfo: serialized
        }
      });
    }
    setShowSuccess(true);
    if (setHasUnsavedChanges) setHasUnsavedChanges(false);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleClear = () => {
    saveToPast();
    setElements([]);
    setQuillContent('');
    setBackgroundImage(null);
    if (containerRef.current) containerRef.current.style.height = '';
    setShowClearConfirm(false);
    const complexData = { isComplex: true, quillContent: '', elements: [], backgroundImage: null };
    const serialized = JSON.stringify(complexData);
    if (mode === 'school') {
      const targetSid = schoolId && schoolId !== 'global' ? schoolId : 'school_1';
      H.setSchoolInfo(state, targetSid, serialized);
      const updatedSchools = (state.schools || []).map(s => s.id === targetSid ? { ...s, schoolInfo: serialized } : s);
      const nextState: AppState = {
        ...state,
        schools: updatedSchools
      };
      DB.saveSchoolMetadata(targetSid, { schoolInfo: serialized }).catch(() => {});
      DB.saveSchoolCache(targetSid, nextState).catch(() => {});
      onUpdate(nextState);
    } else {
      const updatedSchools = (state.schools || []).map(s => ({ ...s, eljurInfo: serialized }));
      DB.savePublicCreatorGate('school_1', {
        secretKey: state.settings.secretKey || 'Space',
        secretCount: state.settings.secretCount || 4,
        adminPasswordHash: state.settings.adminPasswordHash,
        adminPasswordSalt: state.settings.adminPasswordSalt,
        eljurInfo: serialized
      }).catch(() => {});
      onUpdate({
        ...state,
        schools: updatedSchools,
        settings: { ...state.settings, eljurInfo: serialized }
      });
    }
    if (setHasUnsavedChanges) setHasUnsavedChanges(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const getCursorPosition = () => {
    if (!quillRef.current) return { x: 50, y: 50 };
    const quill = quillRef.current.getEditor();
    const range = quill.getSelection();
    if (range) {
      const bounds = quill.getBounds(range.index);
      if (bounds) {
        return { x: bounds.left, y: bounds.top };
      }
    }
    return { x: 50, y: 50 };
  };

  const addTextShape = () => {
    const pos = getCursorPosition();
    const newEl: FloatingElement = {
      id: Date.now().toString(),
      type: 'text',
      x: pos.x,
      y: pos.y,
      w: 200,
      h: 100,
      rotation: 0,
      content: lang === 'ru' ? 'Новый текст' : 'New text'
    };
    saveToPast();
    setElements([...elementsRef.current, newEl]);
    setSelectedId(newEl.id);
  };

  const addTextShapeRef = useRef(addTextShape);
  addTextShapeRef.current = addTextShape;

  const handleWordUpload = () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', '.docx');
    input.click();
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          try {
            const result = await mammoth.convertToHtml({ arrayBuffer });
            saveToPast();
            setQuillContent(H.sanitizeRichHtml(result.value));
            if (setHasUnsavedChanges) setHasUnsavedChanges(true);
          } catch (err) {
            console.error('Error converting Word file:', err);
            setErrorMsg(lang === 'ru' ? 'Ошибка при конвертации файла' : 'Error converting file');
            setTimeout(() => setErrorMsg(null), 3500);
          }
        };
        reader.readAsArrayBuffer(file);
      }
    };
  };

  const handleBackgroundUpload = () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          saveToPast();
          setBackgroundImage(e.target?.result as string);
          if (setHasUnsavedChanges) setHasUnsavedChanges(true);
        };
        reader.readAsDataURL(file);
      }
    };
  };

  const handleRemoveBackground = () => {
    saveToPast();
    setBackgroundImage(null);
    if (setHasUnsavedChanges) setHasUnsavedChanges(true);
  };

  const addMediaHandler = (accept: string) => {
    const pos = getCursorPosition();
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', accept);
    input.click();
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const src = e.target?.result as string;
          const isVideo = file.type.startsWith('video/');
          const newEl: FloatingElement = {
            id: Date.now().toString(),
            type: isVideo ? 'video' : 'image',
            x: pos.x,
            y: pos.y,
            w: 300,
            h: 200,
            rotation: 0,
            src
          };
          saveToPast();
          setElements([...elementsRef.current, newEl]);
          setSelectedId(newEl.id);
        };
        reader.readAsDataURL(file);
      }
    };
  };

  const addMediaHandlerRef = useRef(addMediaHandler);
  addMediaHandlerRef.current = addMediaHandler;

  const addVideoLinkHandler = () => {
    setVideoCursorPos(getCursorPosition());
    setShowVideoModal(true);
  };

  const handleVideoSubmit = () => {
    if (!videoUrlInput) return;
    const pos = videoCursorPos || { x: 50, y: 50 };
    const url = videoUrlInput;
    let embedUrl = url;
    try {
      const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
      if (parsedUrl.hostname.includes('youtube.com') && parsedUrl.searchParams.has('v')) {
        embedUrl = `https://www.youtube.com/embed/${parsedUrl.searchParams.get('v')}`;
      } else if (parsedUrl.hostname.includes('youtu.be')) {
        embedUrl = `https://www.youtube.com/embed${parsedUrl.pathname}`;
      } else {
        embedUrl = parsedUrl.toString();
      }
    } catch (e) {
      // Fallback
      if (url.includes('youtube.com/watch?v=')) {
        embedUrl = url.replace('watch?v=', 'embed/');
      } else if (url.includes('youtu.be/')) {
        embedUrl = url.replace('youtu.be/', 'youtube.com/embed/');
      }
    }
    const safeEmbedUrl = H.sanitizeSafeUrl(embedUrl, 'iframe');
    if (!safeEmbedUrl) {
      setErrorMsg(lang === 'ru' ? 'Разрешены только защищенные ссылки https://' : 'Only secure https:// links are allowed');
      setTimeout(() => setErrorMsg(null), 3500);
      return;
    }
    const newEl: FloatingElement = {
      id: Date.now().toString(),
      type: 'iframe',
      x: pos.x,
      y: pos.y,
      w: 400,
      h: 225,
      rotation: 0,
      src: safeEmbedUrl
    };
    saveToPast();
    setElements([...elementsRef.current, newEl]);
    setSelectedId(newEl.id);
    setShowVideoModal(false);
    setVideoUrlInput('');
  };

  const addVideoLinkHandlerRef = useRef(addVideoLinkHandler);
  addVideoLinkHandlerRef.current = addVideoLinkHandler;

  const imageHandler = () => addMediaHandler('image/*,video/*');

  const modules = useMemo(() => {
    const fontOptions = [false, 'serif', 'monospace', ...customFonts.map(f => f.name)];
    return {
      toolbar: {
        container: [
          ['undo', 'redo'],
          [{ 'font': fontOptions }, { 'size': ['small', false, 'large', 'huge'] }],
          [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'color': [] }, { 'background': [] }],
          [{ 'script': 'sub'}, { 'script': 'super' }],
          ['blockquote', 'code-block'],
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
          [{ 'indent': '-1'}, { 'indent': '+1' }],
          [{ 'align': [] }],
          ['link', 'image', 'video', 'videoUpload'],
          ['addText'],
          ['clean']
        ],
        handlers: {
          undo: () => globalUndoRef.current(),
          redo: () => globalRedoRef.current(),
          addText: () => addTextShapeRef.current(),
          image: () => addMediaHandlerRef.current('image/*'),
          videoUpload: () => addMediaHandlerRef.current('video/*'),
          video: () => addVideoLinkHandlerRef.current()
        }
      },
      keyboard: {
        bindings: {
          undo: {
            key: 'Z',
            shortKey: true,
            handler: () => { globalUndoRef.current(); return false; }
          },
          redo: {
            key: 'Z',
            shortKey: true,
            shiftKey: true,
            handler: () => { globalRedoRef.current(); return false; }
          }
        }
      }
    };
  }, [customFonts]);

  useEffect(() => {
    const updateButtons = () => {
      if (!containerRef.current) return;
      const undoBtn = containerRef.current.querySelector('.ql-undo');
      if (undoBtn && !undoBtn.innerHTML.includes('svg')) {
        undoBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>`;
      }
      
      const redoBtn = containerRef.current.querySelector('.ql-redo');
      if (redoBtn && !redoBtn.innerHTML.includes('svg')) {
        redoBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>`;
      }
      
      const addTextBtn = containerRef.current.querySelector('.ql-addText');
      if (addTextBtn && !addTextBtn.innerHTML.includes('svg')) {
        addTextBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/></svg>`;
        addTextBtn.setAttribute('title', lang === 'ru' ? 'Добавить текст' : 'Add text');
      }

      const videoUploadBtn = containerRef.current.querySelector('.ql-videoUpload');
      if (videoUploadBtn && !videoUploadBtn.innerHTML.includes('svg')) {
        videoUploadBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>`;
        videoUploadBtn.setAttribute('title', lang === 'ru' ? 'Загрузить видео' : 'Upload video');
      }
    };

    updateButtons();
    const t1 = setTimeout(updateButtons, 50);
    const t2 = setTimeout(updateButtons, 200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [lang, customFonts, modules]);

  const updateElement = (id: string, updates: Partial<FloatingElement>) => {
    saveToPast();
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
    if (setHasUnsavedChanges) setHasUnsavedChanges(true);
  };

  const updateElementNoHistory = (id: string, updates: Partial<FloatingElement>) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const deleteElement = (id: string) => {
    saveToPast();
    setElements(prev => prev.filter(el => el.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (setHasUnsavedChanges) setHasUnsavedChanges(true);
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        globalRedo();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        globalUndo();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [globalUndo, globalRedo]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      globalRedo();
    } else if (e.ctrlKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      globalUndo();
    }
  };

  return (
    <Card className="p-3 sm:p-6">
      <style>{`
        .ql-toolbar {
          position: sticky;
          top: 0;
          z-index: 100 !important;
          background: white;
        }
        .dark .ql-toolbar {
          background: #0f172a;
          border-color: #334155;
        }
        
        /* Remove double borders */
        .ql-container.ql-snow {
          border: none !important;
        }
        .ql-toolbar.ql-snow {
          border: none !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }
        .dark .ql-toolbar.ql-snow {
          border-bottom: 1px solid #334155 !important;
        }
        
        /* Make Quill container stretch */
        .ql-container {
          height: auto !important;
          min-height: 100%;
          flex: 1;
          display: flex;
          flex-direction: column;
          background: transparent !important;
        }
        .ql-editor {
          min-height: 100%;
          flex: 1;
          overflow-y: visible !important;
          padding-bottom: 4px !important;
          background: transparent !important;
        }
        .ql-editor img {
          max-width: 100% !important;
          height: auto !important;
          display: block !important;
        }
        @media (max-width: 639px) {
          .ql-editor {
            font-size: 12px !important;
            line-height: 1.45 !important;
            padding: 10px 12px !important;
          }
          .ql-editor h1 { font-size: 1.3rem !important; line-height: 1.25 !important; }
          .ql-editor h2 { font-size: 1.1rem !important; line-height: 1.3 !important; }
          .ql-editor h3 { font-size: 0.95rem !important; line-height: 1.35 !important; }
        }
        
        /* Truncate font names in toolbar */
        .ql-picker.ql-font {
          width: 120px !important;
        }
        .ql-picker.ql-font .ql-picker-label {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          padding-right: 18px;
        }
        .ql-picker.ql-font .ql-picker-item {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        /* Custom Fonts CSS */
        ${customFonts.map(f => `
          .ql-font-${f.name} {
            font-family: "${f.name}", sans-serif;
          }
          .ql-picker.ql-font .ql-picker-label[data-value="${H.sanitizeCssIdentifier(f.name)}"]::before,
          .ql-picker.ql-font .ql-picker-item[data-value="${H.sanitizeCssIdentifier(f.name)}"]::before {
            content: "${H.sanitizeCssIdentifier(f.displayName)}";
            font-family: "${H.sanitizeCssIdentifier(f.name)}", sans-serif;
          }
        `).join('\n')}
      `}</style>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <h2 className="text-base sm:text-xl font-bold">
          {mode === 'school'
            ? (lang === 'ru' ? 'Информация о школе' : 'School Info')
            : (lang === 'ru' ? 'Информация об ЭлЖуре' : 'Eljur Info')}
        </h2>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <Button variant="outline" size="sm" onClick={handleWordUpload} className="flex items-center gap-1.5">
            <FileText size={14} />
            {lang === 'ru' ? 'Загрузить Word' : 'Upload Word'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleBackgroundUpload} className="flex items-center gap-1.5">
            <ImagePlus size={14} />
            {lang === 'ru' ? 'Загрузить фон' : 'Upload Background'}
          </Button>
          {backgroundImage && (
            <Button variant="outline" size="sm" onClick={handleRemoveBackground} className="flex items-center gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
              <Trash2 size={14} />
              {lang === 'ru' ? 'Удалить фон' : 'Remove Background'}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={addTextShape} className="flex items-center gap-1.5">
            <Type size={14} />
            {lang === 'ru' ? 'Добавить текст' : 'Add Text'}
          </Button>
          <Button variant="outline" size="sm" onClick={imageHandler} className="flex items-center gap-1.5">
            <ImageIcon size={14} />
            {lang === 'ru' ? 'Добавить медиа' : 'Add Media'}
          </Button>
          <Button variant="danger" size="sm" onClick={() => setShowClearConfirm(true)} className="flex items-center gap-1.5">
            <Trash size={14} />
            {lang === 'ru' ? 'Очистить холст' : 'Clear Canvas'}
          </Button>
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className="relative bg-white dark:bg-slate-900 text-black dark:text-white rounded-lg border border-slate-200 dark:border-slate-700 w-full max-w-3xl mx-auto flex flex-col min-h-[420px] sm:min-h-[800px]"
        style={backgroundImage ? {
          backgroundImage: `url(${backgroundImage})`,
          backgroundRepeat: 'repeat-y',
          backgroundSize: '100% auto',
          backgroundPosition: 'top center'
        } : {}}
        onClick={() => setSelectedId(null)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <ReactQuill 
          {...({ ref: quillRef } as any)}
          theme="snow" 
          value={quillContent} 
          onChange={handleQuillChange} 
          modules={modules}
          className="flex-1 flex flex-col pb-12"
        />
        
        {elements.map(el => (
          <Rnd
            key={el.id}
            size={{ width: el.w, height: el.h }}
            position={{ x: el.x, y: el.y }}
            onDragStop={(e, d) => updateElement(el.id, { x: d.x, y: d.y })}
            onResizeStop={(e, direction, ref, delta, position) => {
              updateElement(el.id, {
                w: ref.style.width,
                h: ref.style.height,
                ...position
              });
            }}
            bounds=".ql-container"
            cancel=".cancel-drag"
            onClick={(e: any) => { e.stopPropagation(); setSelectedId(el.id); }}
            className={`absolute z-10 group ${selectedId === el.id ? 'ring-2 ring-blue-500' : 'hover:ring-1 hover:ring-blue-300'}`}
          >
            {selectedId === el.id && (
              <div className="absolute -top-12 left-0 bg-white dark:bg-slate-800 shadow-lg rounded-lg flex items-center gap-2 px-3 py-2 z-30 cancel-drag border border-slate-200 dark:border-slate-700">
                <button onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }} className="text-red-500 hover:text-red-600 transition-colors" title={lang === 'ru' ? 'Удалить' : 'Delete'}>
                  <Trash2 size={16} />
                </button>
                <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                <RotateCw size={14} className="text-slate-500 dark:text-slate-400" />
                <input 
                  type="range" 
                  min="0" max="360" 
                  value={el.rotation || 0} 
                  onMouseDown={() => saveToPast()}
                  onTouchStart={() => saveToPast()}
                  onChange={(e) => updateElementNoHistory(el.id, { rotation: parseInt(e.target.value) })}
                  className="w-24 accent-blue-500"
                  title={lang === 'ru' ? 'Поворот' : 'Rotation'}
                />
                {el.type === 'text' && (
                  <>
                    <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                    <div className="flex items-center gap-1" title={lang === 'ru' ? 'Цвет текста' : 'Text Color'}>
                      <span className="text-xs font-medium text-slate-500">T</span>
                      <input 
                        type="color" 
                        value={el.style?.color || '#000000'}
                        onMouseDown={() => saveToPast()}
                        onChange={(e) => updateElementNoHistory(el.id, { style: { ...el.style, color: e.target.value } })}
                        className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center gap-1" title={lang === 'ru' ? 'Цвет фона' : 'Background Color'}>
                      <span className="text-xs font-medium text-slate-500">bg</span>
                      <input 
                        type="color" 
                        value={el.style?.backgroundColor || '#ffffff'}
                        onMouseDown={() => saveToPast()}
                        onChange={(e) => updateElementNoHistory(el.id, { style: { ...el.style, backgroundColor: e.target.value } })}
                        className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
            
            {selectedId === el.id && (
              <div className="absolute -top-3 -left-3 bg-blue-500 text-white rounded-full p-1.5 shadow-md z-20 cursor-move">
                <Move size={14} />
              </div>
            )}
            
            <div style={{ transform: `rotate(${el.rotation || 0}deg)`, width: '100%', height: '100%' }}>
              {el.type === 'text' ? (
                <div 
                  contentEditable={selectedId === el.id}
                  suppressContentEditableWarning
                  onBlur={(e) => updateElement(el.id, { content: H.sanitizeRichHtml(e.currentTarget.innerHTML) })}
                  dangerouslySetInnerHTML={{ __html: H.sanitizeRichHtml(el.content || '') }}
                  style={{ color: el.style?.color, backgroundColor: el.style?.backgroundColor, borderColor: el.style?.backgroundColor ? 'transparent' : undefined }}
                  className={`w-full h-full p-2 sm:p-3 border border-slate-300 dark:border-slate-600 rounded shadow-sm overflow-auto outline-none text-xs sm:text-sm ${!el.style?.backgroundColor ? 'bg-white/90 dark:bg-slate-800/90' : ''} ${selectedId === el.id ? 'cancel-drag cursor-text' : 'cursor-move'}`}
                />
              ) : el.type === 'iframe' ? (
                <>
                  <iframe
                    src={H.sanitizeSafeUrl(el.src, 'iframe')}
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                    referrerPolicy="no-referrer"
                    className={`w-full h-full object-contain bg-black/5 rounded ${selectedId === el.id ? 'cancel-drag' : ''}`}
                    allowFullScreen
                  />
                  {selectedId !== el.id && <div className="absolute inset-0 z-10 cursor-move" />}
                </>
              ) : el.type === 'video' ? (
                <>
                  <video src={H.sanitizeSafeUrl(el.src, 'video')} controls={selectedId === el.id} className={`w-full h-full object-contain bg-black/5 rounded ${selectedId === el.id ? 'cancel-drag' : ''}`} />
                  {selectedId !== el.id && <div className="absolute inset-0 z-10 cursor-move" />}
                </>
              ) : (
                <img src={H.sanitizeSafeUrl(el.src, 'image')} alt="" className="w-full h-full object-contain rounded cursor-move" draggable={false} />
              )}
            </div>
          </Rnd>
        ))}
      </div>

      <div className="mt-4 flex justify-end items-center gap-4">
        {errorMsg && <span className="text-red-600 font-bold animate-in fade-in">{errorMsg}</span>}
        {showSuccess && <span className="text-green-600 font-bold animate-in fade-in">{lang === 'ru' ? 'Успешно сохранено!' : 'Successfully saved!'}</span>}
        <Button variant="primary" onClick={handleSave}>
          {lang === 'ru' ? 'Сохранить' : 'Save'}
        </Button>
      </div>

      {showClearConfirm && (
        <Modal isOpen={true} onClose={() => setShowClearConfirm(false)} title={lang === 'ru' ? 'Очистить холст' : 'Clear Canvas'}>
          <div className="p-6">
            <p className="mb-6 text-slate-700 dark:text-slate-300">
              {lang === 'ru' 
                ? 'Вы уверены, что хотите полностью очистить холст? Это действие удалит весь текст и все элементы, и оно будет автоматически сохранено.' 
                : 'Are you sure you want to completely clear the canvas? This will remove all text and elements, and will be automatically saved.'}
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowClearConfirm(false)}>
                {lang === 'ru' ? 'Отмена' : 'Cancel'}
              </Button>
              <Button variant="danger" onClick={handleClear}>
                {lang === 'ru' ? 'Очистить и сохранить' : 'Clear and Save'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {showVideoModal && (
        <Modal isOpen={true} onClose={() => setShowVideoModal(false)} title={lang === 'ru' ? 'Добавить видео' : 'Add Video'}>
          <div className="p-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {lang === 'ru' ? 'Ссылка на видео (YouTube, Vimeo и т.д.)' : 'Video URL (YouTube, Vimeo, etc.)'}
            </label>
            <input
              type="text"
              value={videoUrlInput}
              onChange={(e) => setVideoUrlInput(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white mb-6"
              placeholder="https://www.youtube.com/watch?v=..."
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowVideoModal(false)}>
                {lang === 'ru' ? 'Отмена' : 'Cancel'}
              </Button>
              <Button variant="primary" onClick={handleVideoSubmit}>
                {lang === 'ru' ? 'Добавить' : 'Add'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}
