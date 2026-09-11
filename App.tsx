
import React, { useEffect, useState, useRef } from 'react';
import * as DB from './services/db';
import { AppState, User, School, COEFFICIENT_TYPES } from './types';
import Login from './views/Login';
import DirectorDashboard from './views/DirectorDashboard';
import TeacherDashboard from './views/TeacherDashboard';
import StudentDashboard from './views/StudentDashboard';
import CreatorDashboard from './views/CreatorDashboard';
import EmployeeDashboard from './views/EmployeeDashboard';
import Settings from './views/Settings';
import { Settings as SettingsIcon, LogOut } from 'lucide-react';
import * as H from './utils/helpers';
import { Modal, Button } from './components/ui';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import DOMPurify from 'dompurify';

const defaultSchool: School = {
  id: 'school_1',
  name: 'Школа №1',
  directorId: 'u_dir',
  classes: [{ class: '10', letter: 'А', headmasterId: 'u_teacher' }],
  subjects: [
    'Математика', 'Русский язык', 'Физика', 'Литература', 'История',
    'Химия', 'Биология', 'География', 'Английский язык', 'Физкультура', 'Информатика'
  ]
};

export const defaultState: AppState = {
  schools: [defaultSchool],
  // Creator is NOT in the default user list until initialized or logged in via secret
  users: [
    {id:'u_creator', schoolId: 'global', fio: 'Создатель', role: 'creator', login: 'creator', password: 'admin123'},
    {id:'u_dir', schoolId: 'school_1', fio:'Иванов Иван',role:'director',login:'director',password:'dir123'},
    {id:'u_teacher', schoolId: 'school_1', fio:'Петров Пётр',role:'teacher',login:'teacher',password:'teach123', subjects:['Математика', 'Физика'], classes:['10_А']},
    {id:'s_1', schoolId: 'school_1', fio:'Кузнецов Алексей',role:'student',login:'s10a_1',password:'pass123', class: '10', letter: 'А'},
    {id:'u_emp', schoolId: 'school_1', fio:'Сидоров Сидр', role:'employee', customRole:'Лаборант', login:'emp', password:'emp123'}
  ],
  userOrder: ['u_dir', 'u_teacher', 'u_emp', 's_1'],
  classes: [{ class: '10', letter: 'А', headmasterId: 'u_teacher' }],
  subjects: [
    'Математика', 'Русский язык', 'Физика', 'Литература', 'История',
    'Химия', 'Биология', 'География', 'Английский язык', 'Физкультура', 'Информатика'
  ],
  schedules: {},
  homework: [],
  messages: [],
  announcements: [],
  grades: {},
  finalGrades: {}, 
  teacherAssignments: [
    { id: 'ta_1', teacherId: 'u_teacher', subject: 'Математика', classId: '10_А', schoolId: 'school_1' },
    { id: 'ta_2', teacherId: 'u_teacher', subject: 'Физика', classId: '10_А', schoolId: 'school_1' }
  ], // New
  studentGroups: [], // New
  // Default Grading Settings
  gradingSystem: {
      minGrade: 2,
      maxGrade: 5,
      useWeights: true,
      minWeight: 1,
      maxWeight: 10
  },
  gradeTypes: [], // Initialized in useEffect logic below
  subjectRequirements: {},
  quarters: {Q1:[],Q2:[],Q3:[],Q4:[]},
  settings: {
    theme: 'light', 
    language: 'ru', 
    showSeasonalAnimations: true,
    secretKey: 'Space',
    secretCount: 4,
    adminPasswordHash: '',
    adminPasswordSalt: ''
  },
  scheduleSettings: {
      daysToAddBatch: 1,
      skippedWeekDays: [0], // Default skip Sunday
      holidays: [],
      vacations: [],
      quarterDefinitions: {
          'Q1': { start: '', end: '' },
          'Q2': { start: '', end: '' },
          'Q3': { start: '', end: '' },
          'Q4': { start: '', end: '' }
      }
  }
};

// Memoized background component to prevent re-renders when inputs change
const SeasonalBackground = React.memo(({ enabled, timeOffset }: { enabled: boolean, timeOffset?: number }) => {
    if (!enabled) return null;

    // Honor prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return null;
    }

    // Use Virtual Time for seasonal effects
    const now = new Date(Date.now() + (timeOffset || 0));
    const month = now.getMonth(); // 0-11
    
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const particleCount = isMobile ? 12 : 24;
    
    // Helper for random numbers
    const random = (min: number, max: number) => Math.random() * (max - min) + min;

    // Winter: Dec (11), Jan (0), Feb (1)
    if (month === 11 || month === 0 || month === 1) {
        const snow = Array.from({ length: particleCount }).map((_, i) => ({
            id: i,
            left: `${random(0, 100)}vw`,
            duration: `${random(10, 20)}s`,
            delay: `${random(-20, 0)}s`,
            size: `${random(10, 20)}px`
        }));
        
        return (
            <>
                {snow.map(s => (
                    <div key={`s-${s.id}`} className="season-element season-snowflake" style={{ left: s.left, animationDuration: s.duration, animationDelay: s.delay, fontSize: s.size, willChange: 'transform' }}>❄</div>
                ))}
            </>
        );
    }
    
    // Spring: Mar (2), Apr (3), May (4)
    if (month >= 2 && month <= 4) {
        const petals = Array.from({ length: particleCount }).map((_, i) => ({
            id: i,
            left: `${random(0, 100)}vw`,
            duration: `${random(10, 20)}s`,
            delay: `${random(-20, 0)}s`,
            width: `${random(8, 15)}px`,
            height: `${random(10, 18)}px`
        }));

        return (
            <>
                {petals.map(p => (
                    <div key={`p-${p.id}`} className="season-petal" style={{ left: p.left, animationDuration: p.duration, animationDelay: p.delay, width: p.width, height: p.height, willChange: 'transform' }}></div>
                ))}
            </>
        );
    }

    // Summer: Jun (5), Jul (6), Aug (7)
    if (month >= 5 && month <= 7) {
        const summerElements = Array.from({ length: particleCount }).map((_, i) => ({
            id: i,
            left: `${random(0, 100)}vw`,
            duration: `${random(12, 25)}s`,
            delay: `${random(-20, 0)}s`,
            size: `${random(6, 14)}px`,
            isLeaf: Math.random() > 0.5
        }));

        return (
            <>
                {summerElements.map(p => (
                    <div key={`sum-${p.id}`} className={p.isLeaf ? "season-summer-leaf" : "season-pollen"} style={{ left: p.left, animationDuration: p.duration, animationDelay: p.delay, width: p.size, height: p.size, willChange: 'transform' }}></div>
                ))}
            </>
        );
    }

    // Autumn: Sep (8), Oct (9), Nov (10)
    if (month >= 8 && month <= 10) {
        const colors = [
            ['#fb923c', '#ea580c'], // orange
            ['#fcd34d', '#d97706'], // yellow-orange
            ['#f87171', '#dc2626'], // red
            ['#b45309', '#78350f']  // brown
        ];
        const leaves = Array.from({ length: Math.min(particleCount, 16) }).map((_, i) => {
            const colorPair = colors[Math.floor(random(0, colors.length))];
            return {
                id: i,
                left: `${random(0, 90)}vw`,
                duration: `${random(12, 22)}s`,
                delay: `${random(-15, 0)}s`,
                size: `${random(8, 14)}px`,
                color1: colorPair[0],
                color2: colorPair[1]
            };
        });

        return (
            <>
                {leaves.map(l => (
                    <div key={`la-${l.id}`} className="season-autumn-leaf" style={{ 
                        left: l.left, 
                        animationDuration: l.duration, 
                        animationDelay: l.delay, 
                        width: l.size, 
                        height: l.size,
                        willChange: 'transform',
                        '--leaf-color-1': l.color1,
                        '--leaf-color-2': l.color2
                    } as React.CSSProperties}></div>
                ))}
            </>
        );
    }

    return null;
});

export default function App() {
  const [appState, setAppState] = useState<AppState>(defaultState);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'dashboard' | 'settings'>('dashboard');
  const [showEljurInfo, setShowEljurInfo] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [customFonts, setCustomFonts] = useState<{name: string, displayName: string}[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);

  // Subscribe to database error notifications
  useEffect(() => {
    DB.setDatabaseErrorListener((msg) => {
      setDbError(msg);
      setTimeout(() => setDbError(null), 6000);
    });
    return () => DB.setDatabaseErrorListener(null);
  }, []);

  // Ensure Firebase Auth session syncs UID mapping automatically
  useEffect(() => {
    const unsubAuth = DB.auth.onAuthStateChanged((fbUser) => {
      if (fbUser && currentUser) {
        DB.syncUserAuthUidMap(currentUser.schoolId || 'school_1', currentUser.id, currentUser.role, fbUser.uid).catch(() => {});
      }
    });
    return () => unsubAuth();
  }, [currentUser?.id, currentUser?.schoolId, currentUser?.role]);

  // Initialize Data with instant cache fast-path and Firestore real-time sync
  useEffect(() => {
    let unsubscribe: any;
    let isFirstSync = true;

    // Instant fast-path: restore cached state from IndexedDB if available
    const activeSchoolId = (currentUser?.schoolId && currentUser.schoolId !== 'global')
      ? currentUser.schoolId
      : (localStorage.getItem('eljur_active_school_id') || 'school_1');

    DB.getSchoolCache(activeSchoolId).then((cached) => {
      if (cached) {
        setAppState(prev => ({
          ...defaultState,
          ...cached,
          schools: (Array.isArray(cached.schools) && cached.schools.length > 0) ? cached.schools : defaultState.schools,
          classes: (Array.isArray(cached.classes) && cached.classes.length > 0) ? cached.classes : defaultState.classes,
          subjects: (Array.isArray(cached.subjects) && cached.subjects.length > 0) ? cached.subjects : defaultState.subjects,
        }));
        setLoading(false);
      }
    }).catch((e) => console.warn('IndexedDB cache load failed:', e));

    const sessionStr = localStorage.getItem('eljur_session');
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        if (session.expires > Date.now()) {
          const u = defaultState.users.find((user: any) => user.id === session.userId);
          if (u && (!u.blockedUntil || new Date(u.blockedUntil) <= new Date())) {
            setCurrentUser(u);
            if (session.viewMode) setViewMode(session.viewMode);
            if (DB.auth.currentUser) {
              DB.syncUserAuthUidMap(u.schoolId || activeSchoolId, u.id, u.role, DB.auth.currentUser.uid).catch(() => {});
            }
          }
        }
      } catch (e) {
        console.warn('Session parse failed:', e);
      }
    }

    // Safety timeout: ensure loading state never hangs indefinitely
    const safetyTimer = setTimeout(() => {
      setLoading(false);
      setAppState(prev => prev || defaultState);
    }, 2500);

    let unsubSchool: (() => void) | null = null;
    let unsubAllSchools: (() => void) | null = null;

    if (currentUser) {
      if (currentUser.role === 'creator') {
        unsubAllSchools = DB.subscribeToAllSchools((schools) => {
          if (schools && schools.length > 0) {
            setAppState(prev => {
              const cur = prev || defaultState;
              return {
                ...cur,
                schools: schools.map((s: any) => ({
                  id: s.id,
                  name: s.name,
                  directorId: s.directorId,
                  classes: s.classes || []
                }))
              };
            });
          }
        });
      }

      unsubSchool = DB.subscribeToSchool(activeSchoolId, (schoolUpdate) => {
        clearTimeout(safetyTimer);
        setAppState(prev => {
          const cur = prev || defaultState;
          const incomingUsers = (schoolUpdate.users && schoolUpdate.users.length > 0)
            ? schoolUpdate.users
            : (cur.users && cur.users.length > 0 ? cur.users : defaultState.users);

          const fullClasses = (schoolUpdate.classes && schoolUpdate.classes.length > 0)
            ? schoolUpdate.classes
            : (cur.classes && cur.classes.length > 0 ? cur.classes : defaultState.classes);

          const fullSubjects = (schoolUpdate.subjects && schoolUpdate.subjects.length > 0)
            ? schoolUpdate.subjects
            : (cur.subjects && cur.subjects.length > 0 ? cur.subjects : defaultState.subjects);

          const fullAssignments = (schoolUpdate.teacherAssignments && schoolUpdate.teacherAssignments.length > 0)
            ? schoolUpdate.teacherAssignments
            : (cur.teacherAssignments && cur.teacherAssignments.length > 0 ? cur.teacherAssignments : defaultState.teacherAssignments);

          const fullSchools = (schoolUpdate.schools && schoolUpdate.schools.length > 0)
            ? schoolUpdate.schools.map((s: any) => ({
                ...s,
                subjects: (s.subjects && s.subjects.length > 0) ? s.subjects : fullSubjects,
                classes: (s.classes && s.classes.length > 0) ? s.classes : fullClasses
              }))
            : (cur.schools && cur.schools.length > 0 ? cur.schools : [defaultSchool]);

          const updated: AppState = {
            ...cur,
            ...schoolUpdate,
            schools: fullSchools,
            classes: fullClasses,
            subjects: fullSubjects,
            users: incomingUsers,
            teacherAssignments: fullAssignments,
            schedules: { ...cur.schedules, ...(schoolUpdate.schedules || {}) },
            grades: { ...cur.grades, ...(schoolUpdate.grades || {}) },
            finalGrades: { ...cur.finalGrades, ...(schoolUpdate.finalGrades || {}) },
            homework: schoolUpdate.homework || cur.homework || [],
            messages: schoolUpdate.messages || cur.messages || [],
            announcements: schoolUpdate.announcements || cur.announcements || [],
            studentGroups: schoolUpdate.studentGroups || cur.studentGroups || [],
            settings: schoolUpdate.settings ? { ...cur.settings, ...schoolUpdate.settings } : cur.settings,
            gradingSystem: schoolUpdate.gradingSystem || cur.gradingSystem,
            gradeTypes: schoolUpdate.gradeTypes || cur.gradeTypes,
            scheduleSettings: schoolUpdate.scheduleSettings || cur.scheduleSettings
          };

          DB.saveSchoolCache(activeSchoolId, updated);

          return updated;
        });
      });
    } else {
      clearTimeout(safetyTimer);
      setLoading(false);
    }

    return () => {
      clearTimeout(safetyTimer);
      if (unsubSchool) unsubSchool();
      if (unsubAllSchools) unsubAllSchools();
    };
  }, [currentUser?.id, currentUser?.schoolId, currentUser?.role]);

  // Effect to toggle body class for theme
  useEffect(() => {
    if (appState?.settings?.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [appState?.settings?.theme]);

  // Effect to set HTML lang for native input localization
  useEffect(() => {
    if (appState?.settings?.language) {
      document.documentElement.lang = appState.settings.language;
    }
  }, [appState?.settings?.language]);

  // Effect to Apply Fonts
  useEffect(() => {
    const readBlobAsDataURL = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const applyFonts = async () => {
        if (!appState?.settings) return;
        const { bodyFontId, headingFontId } = appState.settings;
        const root = document.documentElement;

        // Reset to default first
        root.style.setProperty('--font-body', 'Inter');
        root.style.setProperty('--font-heading', 'Inter');

        if (bodyFontId) {
            try {
                const asset = await DB.getAsset(bodyFontId);
                if (asset && asset.blob) {
                    const dataUrl = await readBlobAsDataURL(asset.blob);
                    const fontFace = new FontFace('CustomBodyFont', `url(${dataUrl})`);
                    await fontFace.load();
                    document.fonts.add(fontFace);
                    // Add quotes to ensure CSS variable parses correctly
                    root.style.setProperty('--font-body', '"CustomBodyFont"');
                }
            } catch (e) { console.error("Failed to load body font", e); }
        }

        if (headingFontId) {
            try {
                const asset = await DB.getAsset(headingFontId);
                if (asset && asset.blob) {
                    const dataUrl = await readBlobAsDataURL(asset.blob);
                    const fontFace = new FontFace('CustomHeadingFont', `url(${dataUrl})`);
                    await fontFace.load();
                    document.fonts.add(fontFace);
                    // Add quotes to ensure CSS variable parses correctly
                    root.style.setProperty('--font-heading', '"CustomHeadingFont"');
                }
            } catch (e) { console.error("Failed to load heading font", e); }
        }
    };
    applyFonts();
  }, [appState?.settings?.bodyFontId, appState?.settings?.headingFontId]);

  // Effect to load custom fonts for Eljur Info
  useEffect(() => {
    if (!appState) return;
    const loadCustomFonts = async () => {
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
          loadedFonts.push({ name: fontName, displayName: font.name.replace(/\.[^/.]+$/, "") });
        } catch (e) {
          console.error("Failed to load custom font", e);
        }
      }
      setCustomFonts(loadedFonts);
    };
    loadCustomFonts();
  }, [appState?.settings?.eljurInfo]);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingStateRef = useRef<AppState | null>(null);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pendingStateRef.current) {
        const targetSchoolId = currentUser?.schoolId && currentUser.schoolId !== 'global'
          ? currentUser.schoolId
          : (pendingStateRef.current.schools[0]?.id || 'school_1');
        DB.saveSchoolState(targetSchoolId, pendingStateRef.current);
        DB.saveSchoolCache(targetSchoolId, pendingStateRef.current);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [currentUser?.schoolId]);

  const handleUpdateState = (newState: AppState) => {
    // Pure immutable state update without JSON.parse(JSON.stringify(newState))
    setAppState(newState);
    pendingStateRef.current = newState;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      if (pendingStateRef.current) {
        const targetSchoolId = currentUser?.schoolId && currentUser.schoolId !== 'global'
          ? currentUser.schoolId
          : (pendingStateRef.current.schools[0]?.id || 'school_1');
        DB.saveSchoolState(targetSchoolId, pendingStateRef.current);
        DB.saveSchoolCache(targetSchoolId, pendingStateRef.current);
        pendingStateRef.current = null;
      }
    }, 250);
  };

  const handleLogin = (u: User) => {
    setCurrentUser(u);
    setViewMode('dashboard');
    if (u.theme) {
        try { localStorage.setItem('eljur_theme', u.theme); } catch (_) {}
        if (appState) {
            appState.settings.theme = u.theme;
            setAppState({ ...appState });
        }
    }
    if (u.language) {
        try { localStorage.setItem('eljur_lang', u.language); } catch (_) {}
        if (appState) {
            appState.settings.language = u.language;
            setAppState({ ...appState });
        }
    }
    
    const expires = Date.now() + 60 * 60 * 1000;
    localStorage.setItem('eljur_session', JSON.stringify({ userId: u.id, expires, viewMode: 'dashboard' }));
    
    const school = appState?.schools.find(s => s.id === u.schoolId);
    if (school) {
        localStorage.setItem('eljur_last_school_name', school.name);
    }
  };
  const handleLogout = () => {
    setCurrentUser(null);
    setViewMode('dashboard');
    localStorage.removeItem('eljur_session');
  };

  const currentSchool = appState?.schools.find(s => s.id === currentUser?.schoolId);
  const lang = appState?.settings?.language || 'ru';
  const t = (k: string) => H.t(k, lang);

  // Render loading state
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-blue-600 font-medium dark:bg-slate-900">{H.t('loading', 'ru')}</div>;
  if (!appState) return <div className="p-10 text-red-600">{H.t('error_state', 'ru')}</div>;

  const showAnimations = appState.settings.showSeasonalAnimations !== false; // Default to true

  const renderEljurInfo = () => {
    const info = appState?.settings?.eljurInfo || (lang === 'ru' ? '<p>Информация отсутствует.</p>' : '<p>No information available.</p>');
    try {
      const parsed = JSON.parse(info);
      if (parsed.isComplex) {
        return (
          <div 
            className="relative bg-white dark:bg-slate-900 text-black dark:text-white rounded-lg border border-slate-200 dark:border-slate-700 w-full max-w-3xl mx-auto flex flex-col min-h-[800px]"
            style={parsed.backgroundImage ? {
              backgroundImage: `url(${parsed.backgroundImage})`,
              backgroundRepeat: 'repeat-y',
              backgroundSize: '100% auto',
              backgroundPosition: 'top center'
            } : {}}
          >
            <style>{`
              ${customFonts.map(f => `
                .ql-font-${f.name} {
                  font-family: "${f.name}", sans-serif;
                }
              `).join('\n')}
              .custom-eljur-info .ql-container.ql-snow {
                border: none !important;
                height: auto !important;
                min-height: 100%;
                flex: 1;
                display: flex;
                flex-direction: column;
                background: transparent !important;
              }
              .custom-eljur-info .ql-editor {
                min-height: 100%;
                flex: 1;
                overflow-y: visible !important;
                padding-bottom: 4px !important;
                background: transparent !important;
              }
              .custom-eljur-info .ql-toolbar {
                opacity: 0;
                pointer-events: none;
                position: sticky;
                top: 0;
                z-index: -1;
              }
            `}</style>
            <ReactQuill 
              theme="snow" 
              value={parsed.quillContent} 
              readOnly={true}
              modules={{
                toolbar: {
                  container: [
                    ['undo', 'redo'],
                    [{ 'font': [false, 'serif', 'monospace', ...customFonts.map(f => f.name)] }, { 'size': ['small', false, 'large', 'huge'] }],
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
                    undo: () => {},
                    redo: () => {},
                    videoUpload: () => {},
                    addText: () => {}
                  }
                }
              }}
              className="custom-eljur-info flex-1 flex flex-col pb-12"
            />
            {parsed.elements.map((el: any) => (
              <div key={el.id} style={{ position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h, ...el.style }} className="z-10">
                <div style={{ transform: `rotate(${el.rotation || 0}deg)`, width: '100%', height: '100%' }}>
                  {el.type === 'text' ? (
                    <div 
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(el.content || '') }}
                      className="w-full h-full p-3 bg-white/90 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-600 rounded shadow-sm overflow-auto"
                    />
                  ) : el.type === 'iframe' ? (
                    <iframe src={el.src} className="w-full h-full object-contain bg-black/5 rounded" allowFullScreen />
                  ) : el.type === 'video' ? (
                    <video src={el.src} controls className="w-full h-full object-contain bg-black/5 rounded" />
                  ) : (
                    <img src={el.src} alt="" className="w-full h-full object-contain rounded" draggable={false} />
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      }
    } catch (e) {
      // Fallback to normal HTML
    }
    return (
      <div className="ql-snow">
        <div className="ql-editor p-0" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(info) }} />
      </div>
    );
  };

  return (
    <div className={`min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-300 font-sans`}>
      {/* Seasonal Background is rendered here, at the top level, to persist across Login/Dashboard views and avoid reset */}
      <SeasonalBackground enabled={showAnimations} timeOffset={appState.settings.systemTimeOffset} />

      {!currentUser ? (
        <Login 
          users={(appState?.users && appState.users.length > 0) ? appState.users : defaultState.users} 
          onLogin={handleLogin} 
          schoolName={localStorage.getItem('eljur_last_school_name') || 'ЭлЖур'} 
          settings={appState?.settings || defaultState.settings} 
          onShowInfo={() => setShowEljurInfo(true)} 
        />
      ) : (
        <>
          {/* Header */}
          <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 no-print shadow-sm dark:bg-slate-900/80 dark:border-slate-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-18 items-center py-3">
                <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setViewMode('dashboard')}>
                  <div 
                    onClick={(e) => { e.stopPropagation(); setShowEljurInfo(true); }}
                    className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/40 transition-all transform group-hover:scale-105 font-heading"
                  >
                    {lang === 'ru' ? 'Э' : 'E'}
                  </div>
                  <div className="hidden sm:block">
                    <h1 className="text-lg font-bold text-slate-800 leading-tight dark:text-white font-heading">
                      {currentUser.role === 'creator' ? t('creator_panel') : (currentSchool?.name || t('footer_text'))}
                    </h1>
                    <p className="text-xs text-slate-500 font-medium dark:text-slate-400">v7 Release</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden md:block">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{currentUser.fio}</p>
                    <div className="flex justify-end mt-0.5">
                       <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full inline-block dark:bg-slate-800 dark:text-slate-400">
                         {currentUser.role === 'director' ? t('director') : currentUser.role === 'teacher' ? t('teacher') : currentUser.role === 'student' ? t('student') : currentUser.role === 'employee' ? (currentUser.customRole || t('employee')) : t('creator')}
                       </p>
                    </div>
                  </div>
                  
                  <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>

                  <button 
                    onClick={() => setViewMode(viewMode === 'settings' ? 'dashboard' : 'settings')}
                    className={`p-2.5 rounded-xl transition-all ${viewMode === 'settings' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'}`}
                    title={t('settings')}
                  >
                    <SettingsIcon size={20} />
                  </button>

                  <button 
                    onClick={() => setShowLogoutConfirm(true)} 
                    className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 font-semibold bg-red-50 hover:bg-red-100 px-4 py-2.5 rounded-xl transition-colors dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
                    title={t('exit')}
                  >
                    <LogOut size={16} />
                    <span className="hidden sm:inline">{t('exit')}</span>
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-2 duration-500 relative z-10">
            {viewMode === 'settings' ? (
              <Settings state={appState} onUpdate={handleUpdateState} onBack={() => setViewMode('dashboard')} user={currentUser} />
            ) : (
              <>
                {currentUser.role === 'creator' && (
                  <CreatorDashboard state={appState} onUpdate={handleUpdateState} user={currentUser} />
                )}
                {currentUser.role === 'director' && (
                  <DirectorDashboard state={appState} onUpdate={handleUpdateState} user={currentUser} />
                )}
                {currentUser.role === 'teacher' && (
                  <TeacherDashboard state={appState} onUpdate={handleUpdateState} user={currentUser} />
                )}
                {currentUser.role === 'student' && (
                  <StudentDashboard state={appState} onUpdate={handleUpdateState} user={currentUser} />
                )}
                {currentUser.role === 'employee' && (
                  <EmployeeDashboard state={appState} onUpdate={handleUpdateState} user={currentUser} />
                )}
              </>
            )}
          </main>
          
          <footer className="py-8 text-center text-slate-400 text-xs no-print border-t border-slate-200 mt-auto bg-white dark:bg-slate-900 dark:border-slate-800 relative z-10">
            &copy; {new Date().getFullYear()} {t('footer_text')}.
          </footer>
          
        </>
      )}

      <Modal isOpen={showEljurInfo} onClose={() => setShowEljurInfo(false)} title={t('info_eljur')} maxWidth="max-w-5xl w-full">
        {renderEljurInfo()}
      </Modal>

      <Modal 
        isOpen={showLogoutConfirm} 
        onClose={() => setShowLogoutConfirm(false)} 
        title={t('confirm_exit_title')}
      >
        <div className="space-y-4 p-1">
          <p className="text-slate-700 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
            {t('confirm_exit_msg')}
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" onClick={() => setShowLogoutConfirm(false)}>
              {t('cancel')}
            </Button>
            <Button 
              variant="primary" 
              onClick={() => {
                setShowLogoutConfirm(false);
                handleLogout();
              }} 
              className="bg-red-600 hover:bg-red-700 text-white border-none shadow-md shadow-red-500/20"
            >
              <LogOut size={16} className="mr-1.5" />
              {t('confirm_exit_btn')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Visual error feedback for database save/read issues */}
      {dbError && (
        <div id="db-error-toast" className="fixed bottom-6 right-6 z-50 bg-red-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-bounce">
          <span className="text-lg">⚠️</span>
          <span className="font-medium text-sm">{dbError}</span>
          <button 
            id="dismiss-db-error-btn"
            onClick={() => setDbError(null)} 
            className="ml-2 hover:opacity-80 text-white font-bold p-1 leading-none"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
