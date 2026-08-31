

import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as DB from '../services/db';
import * as H from '../utils/helpers';
import { Attachment } from '../types';
import { Search, X, ChevronDown, Check } from 'lucide-react';

// --- BUTTON ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}
export const Button: React.FC<ButtonProps> = ({ variant = 'secondary', size = 'md', className = '', ...props }) => {
  const baseStyle = "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]";
  
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 focus:ring-blue-500 border border-transparent dark:bg-blue-600 dark:hover:bg-blue-500",
    danger: "bg-white text-red-600 hover:bg-red-50 border border-red-200 focus:ring-red-500 dark:bg-slate-800 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20",
    secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm focus:ring-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-750",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200",
  };
  
  const sizes = {
    sm: "text-xs px-3 py-1.5",
    md: "text-sm px-5 py-2.5",
    lg: "text-base px-6 py-3",
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />
  );
};

// --- INPUT ---
export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => {
  const hasWidth = /\bw-\w+/.test(className);
  return <input className={`block ${hasWidth ? '' : 'w-full'} rounded-lg border-slate-300 bg-white text-slate-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2.5 px-3 border transition-colors dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-400 ${className}`} {...props} />;
};

// --- SELECT ---
export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = '', ...props }) => {
  const hasWidth = /\bw-\w+/.test(className);
  return <select className={`block ${hasWidth ? '' : 'w-full'} rounded-lg border-slate-300 bg-white text-slate-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2.5 px-3 border cursor-pointer transition-colors dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-400 ${className}`} {...props} />;
};

// --- SEARCHABLE SELECT ---
interface SearchableSelectProps {
  options: { value: string, label: string, group?: string }[];
  value: string | string[]; // Single or Multi
  onChange: (val: any) => void;
  placeholder?: string;
  className?: string;
  multi?: boolean;
  lang?: 'ru' | 'en';
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({ options, value, onChange, placeholder = "Выберите...", className = '', multi = false, lang = 'ru' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  const t = (k: string) => H.t(k, lang as 'ru' | 'en');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase())
  );
  
  // Grouping
  const groupedOptions: Record<string, typeof options> = {};
  filteredOptions.forEach(opt => {
    const g = opt.group || t('other');
    if (!groupedOptions[g]) groupedOptions[g] = [];
    groupedOptions[g].push(opt);
  });

  const getLabel = () => {
    if (multi && Array.isArray(value)) {
       if (value.length === 0) return placeholder;
       return value.map(v => options.find(o => o.value === v)?.label).join(', ');
    }
    return options.find(o => o.value === value)?.label || placeholder;
  };
  
  const handleSelect = (val: string) => {
    if (multi && Array.isArray(value)) {
       if (value.includes(val)) onChange(value.filter(v => v !== val));
       else onChange([...value, val]);
    } else {
       onChange(val);
       setIsOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div 
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) setSearch(''); }}
        className={`block w-full rounded-lg border-slate-300 bg-white text-slate-900 shadow-sm border py-2.5 px-3 cursor-pointer flex justify-between items-center dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 min-h-[42px] transition-all ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
      >
        <span className={(!value || (Array.isArray(value) && value.length === 0)) ? 'text-slate-400' : 'truncate pr-2'}>{getLabel()}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar dark:bg-slate-900 dark:border-slate-700 animate-in slide-in-from-top-1">
          <div className="p-2 sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 z-10">
             <div className="relative">
                <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                <input 
                  autoFocus
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                  placeholder={t('search_placeholder')} 
                  className="w-full text-sm pl-9 pr-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
             </div>
          </div>
          <div className="py-1">
            {Object.entries(groupedOptions).map(([group, opts]) => (
               <div key={group}>
                  <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/50 dark:text-slate-500">{group}</div>
                  {opts.map(opt => {
                    const isSelected = multi && Array.isArray(value) ? value.includes(opt.value) : value === opt.value;
                    return (
                      <div 
                        key={opt.value} 
                        onClick={() => handleSelect(opt.value)}
                        className={`px-4 py-2.5 text-sm cursor-pointer flex justify-between items-center transition-colors hover:bg-blue-50 dark:hover:bg-slate-800 ${isSelected ? 'bg-blue-50/70 text-blue-700 font-semibold dark:bg-blue-900/20 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}
                      >
                        <span className="truncate">{opt.label}</span>
                        {isSelected && <Check size={14} className="text-blue-500" />}
                      </div>
                    );
                  })}
               </div>
            ))}
          </div>
          {filteredOptions.length === 0 && <div className="p-8 text-center text-xs text-slate-400 italic">{t('nothing_found')}</div>}
        </div>
      )}
    </div>
  );
};

// --- MULTI SELECT ---
interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  label?: string;
  placeholder?: string;
  lang?: 'ru' | 'en';
}
export const MultiSelect: React.FC<MultiSelectProps> = ({ options, selected, onChange, label, placeholder = "Выберите...", lang = 'ru' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const t = (k: string) => H.t(k, lang as 'ru' | 'en');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggle = (val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selected.includes(val)) {
      onChange(selected.filter(s => s !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const removeTag = (val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter(s => s !== val));
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`min-h-[42px] w-full border border-slate-300 rounded-lg bg-white dark:bg-slate-950 dark:border-slate-700 p-1.5 flex flex-wrap gap-1.5 cursor-pointer items-center transition-all ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:border-slate-400'}`}
      >
        {selected.length === 0 && <span className="text-slate-400 text-sm px-2">{placeholder}</span>}
        {selected.map(s => (
          <div key={s} className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-bold border border-blue-100 flex items-center gap-1.5 animate-in zoom-in-95 duration-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
            {label ? label.replace('%s', s.replace('_','')) : s.replace('_','')}
            <button onClick={(e) => removeTag(s, e)} className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-200">
              <X size={12} strokeWidth={3} />
            </button>
          </div>
        ))}
        <div className="ml-auto pr-1">
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar dark:bg-slate-900 dark:border-slate-700 animate-in slide-in-from-top-1">
          <div className="py-1">
            {options.map(opt => {
              const isSelected = selected.includes(opt);
              return (
                <div 
                  key={opt}
                  onClick={(e) => toggle(opt, e)}
                  className={`px-4 py-2.5 text-sm cursor-pointer flex justify-between items-center transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${isSelected ? 'text-blue-600 font-bold dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}
                >
                  <span>{label ? label.replace('%s', opt.replace('_','')) : opt.replace('_','')}</span>
                  {isSelected && <Check size={14} className="text-blue-500" />}
                </div>
              );
            })}
            {options.length === 0 && <div className="p-4 text-center text-xs text-slate-400">{t('no_options')}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

// --- CARD ---
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => (
  <div className={`bg-white rounded-2xl shadow-soft border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800 ${className}`} {...props}>
    {children}
  </div>
);

// --- FILE DISPLAY ---
export const FileDisplay: React.FC<{ id?: string; name?: string, lang?: 'ru'|'en' }> = ({ id, name, lang = 'ru' }) => {
  if (!id || !name) return null;
  const t = (k:string) => H.t(k, lang as 'ru'|'en');

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const asset = await DB.getAsset(id);
      if (!asset) return alert('Файл не найден');
      const url = URL.createObjectURL(asset.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = asset.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      alert('Ошибка скачивания');
    }
  };

  const handleOpen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const asset = await DB.getAsset(id);
      if (!asset) return alert('Файл не найден');
      const url = URL.createObjectURL(asset.blob);
      window.open(url, '_blank');
    } catch (e) {
      alert('Ошибка открытия');
    }
  };

  return (
    <div className="mt-2 inline-flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm hover:bg-blue-50 hover:border-blue-200 transition-all dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-800/80 dark:hover:border-blue-900">
      <div className="bg-white p-1.5 rounded-md text-blue-600 shadow-sm border border-slate-100 dark:bg-slate-700 dark:border-slate-600 dark:text-blue-400">📎</div>
      <div className="flex flex-col">
        <span className="font-semibold text-slate-800 max-w-[150px] truncate text-xs dark:text-slate-200" title={name}>{name}</span>
        <div className="flex gap-2 text-[10px] text-blue-600 font-medium dark:text-blue-400">
           <button onClick={handleOpen} className="hover:underline">{t('open')}</button>
           <button onClick={handleDownload} className="hover:underline">{t('download')}</button>
        </div>
      </div>
    </div>
  );
}

// --- MULTI FILE UPLOADER ---
interface MultiFileUploaderProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  lang?: 'ru' | 'en';
}
export const MultiFileUploader: React.FC<MultiFileUploaderProps> = ({ files, onFilesChange, lang = 'ru' }) => {
  const ref = useRef<HTMLInputElement>(null);
  const t = (k:string) => H.t(k, lang as 'ru'|'en');

  const handleAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      onFilesChange([...files, ...newFiles]);
    }
    e.target.value = ''; // Reset
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  // Helper to open local file preview
  const openLocal = (f: File) => {
      const url = URL.createObjectURL(f);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  
  const downloadLocal = (f: File) => {
      const url = URL.createObjectURL(f);
      const a = document.createElement('a'); a.href = url; a.download = f.name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-3">
       <input 
         type="file" 
         multiple
         ref={ref} 
         className="hidden" 
         onChange={handleAdd} 
       />
       <Button type="button" size="sm" onClick={() => ref.current?.click()}>
         📎 {t('attach_files')}
       </Button>
       
       <div className="flex flex-wrap gap-2">
         {files.map((f, idx) => (
           <div key={idx} className="flex items-center gap-2 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
             <div className="flex flex-col">
                 <span className="truncate max-w-[120px]" title={f.name}>{f.name}</span>
                 <div className="flex gap-2 text-[10px] text-blue-500">
                     <span className="cursor-pointer hover:underline" onClick={()=>openLocal(f)}>{t('open')}</span>
                     <span className="cursor-pointer hover:underline" onClick={()=>downloadLocal(f)}>{t('download')}</span>
                 </div>
             </div>
             <button onClick={() => removeFile(idx)} className="text-slate-400 hover:text-red-500 font-bold ml-2 text-lg">&times;</button>
           </div>
         ))}
       </div>
    </div>
  );
};

// --- FILE UPLOADER (Single - Legacy Wrapper) ---
interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  selectedFileName?: string;
  lang?: 'ru' | 'en';
}
export const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect, selectedFileName, lang = 'ru' }) => {
  const ref = useRef<HTMLInputElement>(null);
  const t = (k:string) => H.t(k, lang as 'ru'|'en');
  
  return (
    <div className="flex items-center gap-3">
       <input 
         type="file" 
         ref={ref} 
         className="hidden" 
         onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])} 
       />
       <Button type="button" size="sm" onClick={() => ref.current?.click()}>
         📎 {selectedFileName ? t('replace_file') : t('attach_file')}
       </Button>
       {selectedFileName && (
         <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg border border-green-200 text-xs font-medium dark:bg-green-900/30 dark:border-green-800 dark:text-green-400">
           <span>✓ {selectedFileName}</span>
         </div>
       )}
    </div>
  );
};

// --- MODAL ---
// Updated to use Portal for better z-index handling
export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; maxWidth?: string }> = ({ isOpen, onClose, title, children, maxWidth = 'max-w-lg' }) => {
  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999] w-screen h-screen flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto flex flex-col dark:bg-slate-900 dark:border dark:border-slate-700 relative`}>
        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl sticky top-0 z-10 dark:bg-slate-800 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          <button onClick={onClose} className="text-2xl leading-none text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition dark:hover:bg-slate-700 dark:hover:text-slate-300">&times;</button>
        </div>
        <div className="p-6 dark:text-slate-300">{children}</div>
      </div>
    </div>,
    document.body
  );
}