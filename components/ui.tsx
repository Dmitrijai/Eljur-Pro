import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as DB from '../services/db';
import * as H from '../utils/helpers';
import { Search, X, ChevronDown, Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

// --- BUTTON ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}
export const Button: React.FC<ButtonProps> = ({ variant = 'secondary', size = 'md', className = '', ...props }) => {
  const baseStyle = "inline-flex items-center justify-center font-semibold rounded-lg sm:rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]";
  
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 focus:ring-blue-500 border border-transparent dark:bg-blue-600 dark:hover:bg-blue-500",
    danger: "bg-white text-red-600 hover:bg-red-50 border border-red-200 focus:ring-red-500 dark:bg-slate-800 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20",
    secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-xs focus:ring-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-750",
    outline: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-xs focus:ring-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-750",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200",
  };
  
  const sizes = {
    sm: "text-[11px] sm:text-xs px-2 py-1 sm:px-3 sm:py-1.5",
    md: "text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2.5",
    lg: "text-xs sm:text-base px-3.5 py-2 sm:px-6 sm:py-3",
  };

  return (
    <button className={`${baseStyle} ${variants[variant] || variants.secondary} ${sizes[size]} ${className}`} {...props} />
  );
};

// --- INPUT ---
export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', onChange, maxLength, ...props }) => {
  const hasWidth = /\bw-\w+/.test(className);
  const effectiveMaxLength = maxLength !== undefined ? maxLength : (props.type === 'number' ? 10 : 200);
  const handleSafeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      if (typeof e.target.value === 'string') {
        if (/<\s*\/?\s*(script|iframe|object|embed)|\bon[a-z]+\s*=|(?:javascript|vbscript)\s*:/i.test(e.target.value)) {
          e.target.value = H.sanitizeInputText(e.target.value);
        }
        if (effectiveMaxLength > 0 && e.target.value.length > effectiveMaxLength) {
          e.target.value = e.target.value.slice(0, effectiveMaxLength);
        }
      }
      onChange(e);
    }
  };
  return (
    <input 
      className={`block ${hasWidth ? '' : 'w-full'} rounded-lg border-slate-300 bg-white text-slate-900 shadow-xs focus:border-blue-500 focus:ring-blue-500 text-xs sm:text-sm py-1.5 px-2.5 sm:py-2.5 sm:px-3 border transition-colors dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-400 ${className}`} 
      maxLength={effectiveMaxLength}
      onChange={handleSafeChange}
      {...props} 
    />
  );
};

// --- SELECT ---
interface ParsedSelectOption {
  value: string;
  label: React.ReactNode;
  textLabel: string;
  disabled?: boolean;
  group?: string;
}

const extractNodeText = (node: React.ReactNode): string => {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractNodeText).join('');
  if (React.isValidElement(node)) {
    return extractNodeText((node.props as any)?.children);
  }
  return '';
};

const parseSelectChildren = (children: React.ReactNode, currentGroup?: string): ParsedSelectOption[] => {
  const result: ParsedSelectOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const type = child.type;
    const props = child.props as any;
    if (type === React.Fragment) {
      result.push(...parseSelectChildren(props.children, currentGroup));
    } else if (type === 'optgroup') {
      const groupLabel = props.label || '';
      result.push(...parseSelectChildren(props.children, groupLabel));
    } else if (type === 'option') {
      const textLabel = props.label !== undefined ? String(props.label) : extractNodeText(props.children);
      const val = props.value !== undefined ? String(props.value) : textLabel;
      result.push({
        value: val,
        label: props.children ?? textLabel,
        textLabel,
        disabled: !!props.disabled,
        group: currentGroup,
      });
    } else if (props?.children) {
      result.push(...parseSelectChildren(props.children, currentGroup));
    }
  });
  return result;
};

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({
  className = '',
  children,
  value,
  defaultValue,
  onChange,
  disabled,
  title,
  id,
  name,
  style,
  onClick,
}) => {
  const hasWidth = /\bw-\w+/.test(className);
  const [isOpen, setIsOpen] = useState(false);
  const [internalVal, setInternalVal] = useState<string>(() =>
    defaultValue !== undefined ? String(defaultValue) : ''
  );
  const [menuRect, setMenuRect] = useState<{
    top: number;
    bottom: number;
    left: number;
    width: number;
    openUp: boolean;
  } | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const options = React.useMemo(() => parseSelectChildren(children), [children]);

  const currentValue =
    value !== undefined
      ? String(value)
      : internalVal !== ''
      ? internalVal
      : options[0]?.value ?? '';

  const selectedOption =
    options.find((o) => o.value === currentValue) || options[0];

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const minWidth = Math.max(rect.width, 120);
    const maxLeft = Math.max(8, window.innerWidth - minWidth - 8);
    const left = Math.min(Math.max(8, rect.left), maxLeft);
    setMenuRect({
      top: rect.bottom + 4,
      bottom: window.innerHeight - rect.top + 4,
      left,
      width: minWidth,
      openUp,
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = (e: Event) => {
      if (menuRef.current && e.target && menuRef.current.contains(e.target as Node)) {
        return;
      }
      updatePosition();
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside, { passive: true });
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen]);

  const handleSelectOption = (opt: ParsedSelectOption, e: React.MouseEvent) => {
    e.stopPropagation();
    if (opt.disabled) return;
    if (value === undefined) {
      setInternalVal(opt.value);
    }
    setIsOpen(false);
    if (onChange) {
      const syntheticEvent = {
        target: { value: opt.value, name: name || '', id: id || '' },
        currentTarget: { value: opt.value, name: name || '', id: id || '' },
        preventDefault: () => {},
        stopPropagation: () => {},
      } as unknown as React.ChangeEvent<HTMLSelectElement>;
      onChange(syntheticEvent);
    }
  };

  const hasGroups = options.some((o) => !!o.group);

  return (
    <>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        title={title}
        style={style}
        onClick={(e) => {
          if (onClick) onClick(e as any);
          if (disabled) return;
          if (!isOpen) updatePosition();
          setIsOpen((prev) => !prev);
        }}
        className={`relative flex items-center justify-between text-left ${hasWidth ? '' : 'w-full'} rounded-lg border-slate-300 bg-white text-slate-900 shadow-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs sm:text-sm py-0.5 sm:py-1 pl-2 sm:pl-2.5 pr-6 sm:pr-7 leading-normal min-h-[32px] sm:min-h-[36px] border cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-400 ${className}`}
      >
        <span className="block truncate">
          {selectedOption ? selectedOption.label : ''}
        </span>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1.5 sm:pr-2 text-slate-400">
          <ChevronDown
            size={14}
            className={`transition-transform duration-150 ${isOpen ? 'rotate-180 text-blue-500' : ''}`}
          />
        </span>
      </button>

      {isOpen &&
        menuRect &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            data-select-portal="true"
            style={{
              position: 'fixed',
              left: `${menuRect.left}px`,
              width: `${menuRect.width}px`,
              maxWidth: 'calc(100vw - 16px)',
              ...(menuRect.openUp
                ? { bottom: `${menuRect.bottom}px` }
                : { top: `${menuRect.top}px` }),
              zIndex: 99999,
            }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto overscroll-contain py-1 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-400 text-center">—</div>
            ) : hasGroups ? (
              (() => {
                const groups: { name: string; items: ParsedSelectOption[] }[] = [];
                options.forEach((opt) => {
                  const gName = opt.group || '';
                  let grp = groups.find((g) => g.name === gName);
                  if (!grp) {
                    grp = { name: gName, items: [] };
                    groups.push(grp);
                  }
                  grp.items.push(opt);
                });
                return groups.map((g, gIdx) => (
                  <div key={`${g.name}_${gIdx}`}>
                    {g.name && (
                      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/80 dark:bg-slate-800/60 dark:text-slate-500">
                        {g.name}
                      </div>
                    )}
                    {g.items.map((opt, idx) => {
                      const isSelected = opt.value === currentValue;
                      return (
                        <button
                          key={`${opt.value}_${idx}`}
                          type="button"
                          disabled={opt.disabled}
                          onClick={(e) => handleSelectOption(opt, e)}
                          className={`w-full text-left px-3 py-2 text-xs sm:text-sm flex items-center justify-between gap-2 transition-colors ${
                            opt.disabled
                              ? 'opacity-40 cursor-not-allowed text-slate-400'
                              : isSelected
                              ? 'bg-blue-50 text-blue-600 font-bold dark:bg-blue-900/30 dark:text-blue-400'
                              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span className="truncate">{opt.label}</span>
                          {isSelected && <Check size={14} className="shrink-0 text-blue-600 dark:text-blue-400" />}
                        </button>
                      );
                    })}
                  </div>
                ));
              })()
            ) : (
              options.map((opt, idx) => {
                const isSelected = opt.value === currentValue;
                return (
                  <button
                    key={`${opt.value}_${idx}`}
                    type="button"
                    disabled={opt.disabled}
                    onClick={(e) => handleSelectOption(opt, e)}
                    className={`w-full text-left px-3 py-2 text-xs sm:text-sm flex items-center justify-between gap-2 transition-colors ${
                      opt.disabled
                        ? 'opacity-40 cursor-not-allowed text-slate-400'
                        : isSelected
                        ? 'bg-blue-50 text-blue-600 font-bold dark:bg-blue-900/30 dark:text-blue-400'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check size={14} className="shrink-0 text-blue-600 dark:text-blue-400" />}
                  </button>
                );
              })
            )}
          </div>,
          document.body
        )}
    </>
  );
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

export const SearchableSelect: React.FC<SearchableSelectProps> = ({ options, value, onChange, placeholder, className = '', multi = false, lang = 'ru' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  const t = (k: string) => H.t(k, lang as 'ru' | 'en');
  const displayPlaceholder = placeholder || t('select');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleDropdown = () => {
    if (!isOpen && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setOpenUpwards(spaceBelow < 250 && spaceAbove > spaceBelow);
    }
    setIsOpen(prev => !prev);
    if (!isOpen) setSearch('');
  };

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
       if (value.length === 0) return displayPlaceholder;
       return value.map(v => options.find(o => o.value === v)?.label).join(', ');
    }
    return options.find(o => o.value === value)?.label || displayPlaceholder;
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
        onClick={toggleDropdown}
        className={`block w-full rounded-lg border-slate-300 bg-white text-slate-900 shadow-xs border py-1 px-2 sm:py-2.5 sm:px-3 cursor-pointer flex justify-between items-center dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 min-h-[30px] sm:min-h-[42px] text-xs sm:text-sm transition-all ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
      >
        <span className={(!value || (Array.isArray(value) && value.length === 0)) ? 'text-slate-400' : 'truncate pr-2'}>{getLabel()}</span>
        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
      </div>
      
      {isOpen && (
        <div className={`absolute z-50 w-full ${openUpwards ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} bg-white border border-slate-200 rounded-xl shadow-2xl max-h-52 sm:max-h-60 overflow-y-auto custom-scrollbar dark:bg-slate-900 dark:border-slate-700 animate-in ${openUpwards ? 'slide-in-from-bottom-2' : 'slide-in-from-top-1'}`}>
          <div className="p-1.5 sm:p-2 sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 z-10">
             <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 sm:w-3.5 sm:h-3.5 sm:left-3" />
                <input 
                  autoFocus
                  maxLength={100}
                  value={search} 
                  onChange={e => setSearch(e.target.value.slice(0, 100))} 
                  placeholder={t('search_placeholder')} 
                  className="w-full text-xs sm:text-sm pl-7 sm:pl-9 pr-2.5 sm:pr-3 py-1 sm:py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
             </div>
          </div>
          <div className="py-0.5 sm:py-1">
            {Object.entries(groupedOptions).map(([group, opts]) => (
               <div key={group}>
                  <div className="px-2.5 py-1 sm:px-4 sm:py-1.5 text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/50 dark:text-slate-500">{group}</div>
                  {opts.map(opt => {
                    const isSelected = multi && Array.isArray(value) ? value.includes(opt.value) : value === opt.value;
                    return (
                      <div 
                        key={opt.value} 
                        onClick={() => handleSelect(opt.value)}
                        className={`px-2.5 py-1.5 sm:px-4 sm:py-2.5 text-xs sm:text-sm cursor-pointer flex justify-between items-center transition-colors hover:bg-blue-50 dark:hover:bg-slate-800 ${isSelected ? 'bg-blue-50/70 text-blue-700 font-semibold dark:bg-blue-900/20 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}
                      >
                        <span className="truncate pr-2">{opt.label}</span>
                        {isSelected && <Check size={12} className="text-blue-500 shrink-0 sm:w-3.5 sm:h-3.5" />}
                      </div>
                    );
                  })}
               </div>
            ))}
          </div>
          {filteredOptions.length === 0 && <div className="p-4 sm:p-8 text-center text-[11px] sm:text-xs text-slate-400 italic">{t('nothing_found')}</div>}
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
export const MultiSelect: React.FC<MultiSelectProps> = ({ options, selected, onChange, label, placeholder, lang = 'ru' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const t = (k: string) => H.t(k, lang as 'ru' | 'en');
  const displayPlaceholder = placeholder || t('select');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleDropdown = () => {
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setOpenUpwards(spaceBelow < 250 && spaceAbove > spaceBelow);
    }
    setIsOpen(prev => !prev);
  };

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
        onClick={toggleDropdown}
        className={`min-h-[30px] sm:min-h-[42px] w-full border border-slate-300 rounded-lg bg-white dark:bg-slate-950 dark:border-slate-700 p-1 sm:p-1.5 flex flex-wrap gap-1 cursor-pointer items-center text-xs sm:text-sm transition-all ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:border-slate-400'}`}
      >
        {selected.length === 0 && <span className="text-slate-400 text-xs sm:text-sm px-1.5">{displayPlaceholder}</span>}
        {selected.map(s => (
          <div key={s} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md text-[10px] sm:text-xs font-bold border border-blue-100 flex items-center gap-1 animate-in zoom-in-95 duration-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
            {label ? label.replace('%s', s.replace('_','')) : s.replace('_','')}
            <button onClick={(e) => removeTag(s, e)} className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-200">
              <X size={10} strokeWidth={3} className="sm:w-3 sm:h-3" />
            </button>
          </div>
        ))}
        <div className="ml-auto pr-1">
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className={`absolute z-50 w-full ${openUpwards ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} bg-white border border-slate-200 rounded-xl shadow-2xl max-h-52 sm:max-h-60 overflow-y-auto custom-scrollbar dark:bg-slate-900 dark:border-slate-700 animate-in ${openUpwards ? 'slide-in-from-bottom-2' : 'slide-in-from-top-1'}`}>
          <div className="py-0.5 sm:py-1">
            {options.map(opt => {
              const isSelected = selected.includes(opt);
              return (
                <div 
                  key={opt}
                  onClick={(e) => toggle(opt, e)}
                  className={`px-2.5 py-1.5 sm:px-4 sm:py-2.5 text-xs sm:text-sm cursor-pointer flex justify-between items-center transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${isSelected ? 'text-blue-600 font-bold dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}
                >
                  <span>{label ? label.replace('%s', opt.replace('_','')) : opt.replace('_','')}</span>
                  {isSelected && <Check size={12} className="text-blue-500 sm:w-3.5 sm:h-3.5" />}
                </div>
              );
            })}
            {options.length === 0 && <div className="p-3 sm:p-4 text-center text-[11px] sm:text-xs text-slate-400">{t('no_options')}</div>}
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
export const FileDisplay: React.FC<{ id?: string; name?: string, schoolId?: string, lang?: 'ru'|'en' }> = ({ id, name, schoolId, lang = 'ru' }) => {
  const t = (k:string) => H.t(k, lang as 'ru'|'en');
  const [previewState, setPreviewState] = useState<{
    isOpen: boolean;
    fileName: string;
    fileType: string;
    fileSize: number;
    textContent?: string;
    imageUrl?: string;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (previewState?.imageUrl && previewState.imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewState.imageUrl);
      }
    };
  }, [previewState]);

  if (!id || !name) return null;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const asset = await DB.getAsset(id, schoolId);
      if (!asset) return alert(t('file_not_found'));
      const url = URL.createObjectURL(asset.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = asset.name || name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      alert(t('download_error'));
    }
  };

  const handleOpen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const asset = await DB.getAsset(id, schoolId);
      if (!asset) return alert(t('file_not_found'));
      const fileName = asset.name || name || 'document.txt';
      const mime = (asset.type || asset.blob.type || '').toLowerCase();
      const lowerName = fileName.toLowerCase();

      const isImage = mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lowerName);
      const isTextLike =
        mime.startsWith('text/') ||
        mime.includes('json') ||
        mime.includes('xml') ||
        /\.(txt|md|csv|json|log|html|htm|doc)$/i.test(lowerName);

      if (isImage) {
        if (mime.includes('svg') || lowerName.endsWith('.svg')) {
          const rawSvg = await asset.blob.text();
          // Strip scripts and event handlers from SVG before previewing as data URL
          const safeSvg = H.sanitizeInputText(rawSvg);
          const svgDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(safeSvg)}`;
          setPreviewState({
            isOpen: true,
            fileName,
            fileType: mime || 'image/svg+xml',
            fileSize: asset.blob.size,
            imageUrl: svgDataUrl
          });
        } else {
          const url = URL.createObjectURL(asset.blob);
          setPreviewState({
            isOpen: true,
            fileName,
            fileType: mime || 'image/png',
            fileSize: asset.blob.size,
            imageUrl: url
          });
        }
      } else if (isTextLike) {
        const rawText = await asset.blob.text();
        setPreviewState({
          isOpen: true,
          fileName,
          fileType: mime || 'text/plain',
          fileSize: asset.blob.size,
          textContent: H.sanitizeInputText(rawText)
        });
      } else {
        setPreviewState({
          isOpen: true,
          fileName,
          fileType: mime || 'application/octet-stream',
          fileSize: asset.blob.size,
          textContent: lang === 'ru'
            ? `Бинарный файл «${fileName}» (${(asset.blob.size / 1024).toFixed(1)} КБ).\nНажмите кнопку «Скачать», чтобы сохранить файл на устройство.`
            : `Binary file "${fileName}" (${(asset.blob.size / 1024).toFixed(1)} KB).\nClick "Download" to save the file.`
        });
      }
    } catch (e) {
      alert(t('open_error'));
    }
  };

  return (
    <>
      <div className="mt-1.5 mr-1.5 sm:mt-2 sm:mr-2 inline-flex items-center gap-1.5 sm:gap-2.5 p-1.5 sm:p-2.5 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl text-xs sm:text-sm hover:bg-blue-50/70 hover:border-blue-300 transition-all shadow-xs dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-800/80 dark:hover:border-blue-800 max-w-full">
        <div className="bg-white p-1 sm:p-1.5 rounded-md sm:rounded-lg text-blue-600 shadow-xs border border-slate-100 text-xs sm:text-sm shrink-0 dark:bg-slate-700 dark:border-slate-600 dark:text-blue-400">📎</div>
        <div className="flex flex-col min-w-0">
          <span className="font-semibold text-slate-800 max-w-[145px] sm:max-w-[260px] truncate text-[11px] sm:text-xs dark:text-slate-200" title={name}>{name}</span>
          <div className="flex gap-2.5 sm:gap-3 mt-0.5 text-[10px] sm:text-[11px] text-blue-600 font-semibold dark:text-blue-400">
            <button type="button" onClick={handleOpen} className="hover:underline cursor-pointer">{t('open')}</button>
            <button type="button" onClick={handleDownload} className="hover:underline cursor-pointer">{t('download')}</button>
          </div>
        </div>
      </div>

      {previewState?.isOpen && (
        <Modal
          isOpen={previewState.isOpen}
          onClose={() => {
            if (previewState.imageUrl && previewState.imageUrl.startsWith('blob:')) {
              URL.revokeObjectURL(previewState.imageUrl);
            }
            setPreviewState(null);
          }}
          title={previewState.fileName}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-300">
              <span>
                {lang === 'ru' ? 'Размер файла:' : 'File size:'}{' '}
                <strong>{Math.max(0.1, previewState.fileSize / 1024).toFixed(1)} KB</strong>
              </span>
              <Button size="sm" variant="primary" onClick={handleDownload}>
                ⬇ {t('download')}
              </Button>
            </div>

            {previewState.imageUrl && (
              <div className="flex justify-center items-center bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 overflow-auto max-h-[65vh]">
                <img
                  src={previewState.imageUrl}
                  alt={previewState.fileName}
                  className="max-w-full max-h-[58vh] object-contain rounded-lg shadow-sm"
                />
              </div>
            )}

            {previewState.textContent !== undefined && (
              <pre className="p-4 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-mono whitespace-pre-wrap break-words max-h-[60vh] overflow-y-auto leading-relaxed">
                {previewState.textContent}
              </pre>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};

// --- MULTI FILE UPLOADER ---
interface MultiFileUploaderProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  lang?: 'ru' | 'en';
}
export const MultiFileUploader: React.FC<MultiFileUploaderProps> = ({ files, onFilesChange, lang = 'ru' }) => {
  const ref = useRef<HTMLInputElement>(null);
  const t = (k:string) => H.t(k, lang as 'ru'|'en');
  const [localPreview, setLocalPreview] = useState<{ name: string; text?: string; imgUrl?: string; file: File } | null>(null);

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

  const openLocal = async (f: File) => {
    const mime = (f.type || '').toLowerCase();
    const lower = f.name.toLowerCase();
    if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lower)) {
      const url = URL.createObjectURL(f);
      setLocalPreview({ name: f.name, imgUrl: url, file: f });
    } else {
      const txt = await f.text().catch(() => '');
      setLocalPreview({ name: f.name, text: H.sanitizeInputText(txt || f.name), file: f });
    }
  };
  
  const downloadLocal = (f: File) => {
      const url = URL.createObjectURL(f);
      const a = document.createElement('a'); 
      a.href = url; 
      a.download = f.name; 
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  return (
    <div className="space-y-1.5 sm:space-y-2.5">
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
       
       {files.length > 0 && (
         <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {files.map((f, idx) => (
            <div key={idx} className="flex items-center gap-1.5 sm:gap-2 bg-slate-100 text-slate-700 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-slate-200 text-[11px] sm:text-xs font-medium dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
              <div className="flex flex-col min-w-0">
                  <span className="truncate max-w-[110px] sm:max-w-[140px]" title={f.name}>{f.name}</span>
                  <div className="flex gap-2 text-[10px] text-blue-500">
                      <span className="cursor-pointer hover:underline" onClick={()=>openLocal(f)}>{t('open')}</span>
                      <span className="cursor-pointer hover:underline" onClick={()=>downloadLocal(f)}>{t('download')}</span>
                  </div>
              </div>
              <button type="button" onClick={() => removeFile(idx)} className="text-slate-400 hover:text-red-500 font-bold ml-1 sm:ml-2 text-base sm:text-lg leading-none">&times;</button>
            </div>
          ))}
         </div>
       )}
       {localPreview && (
         <Modal
           isOpen={!!localPreview}
           onClose={() => {
             if (localPreview.imgUrl) URL.revokeObjectURL(localPreview.imgUrl);
             setLocalPreview(null);
           }}
           title={localPreview.name}
           maxWidth="max-w-2xl"
         >
           <div className="space-y-4">
             {localPreview.imgUrl && (
               <img src={localPreview.imgUrl} alt={localPreview.name} className="max-w-full max-h-[55vh] mx-auto rounded-lg" />
             )}
             {localPreview.text !== undefined && (
               <pre className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono whitespace-pre-wrap max-h-[55vh] overflow-y-auto">
                 {localPreview.text}
               </pre>
             )}
           </div>
         </Modal>
       )}
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
// Uses Portal for clean z-index hierarchy, stacked modal support, and strict background scroll/click lock
const activeModalStack: symbol[] = [];
const modalStackListeners = new Set<() => void>();

const syncModalScrollLock = () => {
  if (typeof document === 'undefined') return;
  if (activeModalStack.length > 0) {
    document.body.classList.add('modal-open');
    document.documentElement.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';
  } else {
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    document.body.style.overscrollBehavior = '';
    document.documentElement.style.overscrollBehavior = '';
  }
  modalStackListeners.forEach((fn) => fn());
};

export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; maxWidth?: string }> = ({ isOpen, onClose, title, children, maxWidth = 'max-w-lg' }) => {
  const modalIdRef = useRef<symbol>(Symbol('modal'));
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const zoomContentRef = useRef<HTMLDivElement>(null);
  const zoomScaleRef = useRef<number>(1);
  const baseSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const pinchStateRef = useRef<{
    startDist: number;
    startScale: number;
    contentX: number;
    contentY: number;
    baseWidth: number;
    baseHeight: number;
  } | null>(null);
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [stackState, setStackState] = useState<{ index: number; isTop: boolean }>({ index: 0, isTop: true });

  const applyZoomStyles = React.useCallback((scale: number, bw?: number, bh?: number) => {
    const sizer = sizerRef.current;
    const zoomEl = zoomContentRef.current;
    if (!sizer || !zoomEl) return;
    const width = bw || baseSizeRef.current.width || zoomEl.offsetWidth;
    const height = bh || baseSizeRef.current.height || Math.max(zoomEl.scrollHeight, zoomEl.offsetHeight);
    if (scale > 1.01 && width > 0 && height > 0) {
      sizer.style.width = `${Math.round(width * scale)}px`;
      sizer.style.height = `${Math.round(height * scale)}px`;
      sizer.style.overflow = 'hidden';
      zoomEl.style.width = `${width}px`;
      zoomEl.style.transformOrigin = '0 0';
      zoomEl.style.transform = `scale(${scale})`;
    } else {
      sizer.style.width = '100%';
      sizer.style.height = 'auto';
      sizer.style.overflow = '';
      zoomEl.style.width = '100%';
      zoomEl.style.transformOrigin = '0 0';
      zoomEl.style.transform = 'none';
    }
  }, []);

  const resetZoom = React.useCallback(() => {
    zoomScaleRef.current = 1;
    pinchStateRef.current = null;
    setZoomPercent(100);
    applyZoomStyles(1);
  }, [applyZoomStyles]);

  React.useEffect(() => {
    if (!isOpen) {
      zoomScaleRef.current = 1;
      pinchStateRef.current = null;
      baseSizeRef.current = { width: 0, height: 0 };
      setZoomPercent(100);
      return;
    }
    const id = modalIdRef.current;
    const updateStackState = () => {
      const idx = activeModalStack.indexOf(id);
      setStackState({
        index: Math.max(0, idx),
        isTop: activeModalStack[activeModalStack.length - 1] === id,
      });
    };
    modalStackListeners.add(updateStackState);

    if (!activeModalStack.includes(id)) {
      activeModalStack.push(id);
    }
    syncModalScrollLock();

    const canElementScroll = (startEl: HTMLElement | null, boundaryEl: HTMLElement | null): boolean => {
      let el: HTMLElement | null = startEl;
      while (el && boundaryEl && boundaryEl.contains(el)) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        const overflowX = style.overflowX;
        const canScrollY = (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1;
        const canScrollX = (overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1;
        if (canScrollY || canScrollX) return true;
        if (el === boundaryEl) break;
        el = el.parentElement;
      }
      return false;
    };

    const preventBackgroundScroll = (e: Event) => {
      // Only the topmost modal handles scroll containment
      if (activeModalStack[activeModalStack.length - 1] !== id) return;
      // Never block multi-touch pinch-to-zoom or trackpad zoom gestures
      if ('touches' in e && (e as TouchEvent).touches && (e as TouchEvent).touches.length > 1) return;
      if ('ctrlKey' in e && (e as WheelEvent).ctrlKey) return;
      if (typeof window !== 'undefined' && window.visualViewport && window.visualViewport.scale > 1.01) return;
      if (zoomScaleRef.current > 1.01) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-select-portal="true"]')) return;
      if (!contentRef.current || !contentRef.current.contains(target)) {
        e.preventDefault();
        return;
      }
      if (!canElementScroll(target, contentRef.current)) {
        e.preventDefault();
      }
    };

    window.addEventListener('wheel', preventBackgroundScroll, { passive: false });
    window.addEventListener('touchmove', preventBackgroundScroll, { passive: false });

    return () => {
      window.removeEventListener('wheel', preventBackgroundScroll);
      window.removeEventListener('touchmove', preventBackgroundScroll);
      modalStackListeners.delete(updateStackState);
      const idx = activeModalStack.indexOf(id);
      if (idx > -1) {
        activeModalStack.splice(idx, 1);
      }
      syncModalScrollLock();
    };
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const bodyEl = bodyScrollRef.current;
    const zoomEl = zoomContentRef.current;
    if (!bodyEl || !zoomEl) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        if (dist < 8) return;

        const currentScale = zoomScaleRef.current;
        if (currentScale <= 1.01 || baseSizeRef.current.width <= 0) {
          baseSizeRef.current = {
            width: zoomEl.offsetWidth || bodyEl.clientWidth,
            height: Math.max(zoomEl.scrollHeight, zoomEl.offsetHeight)
          };
        } else {
          baseSizeRef.current = {
            width: baseSizeRef.current.width,
            height: Math.max(baseSizeRef.current.height, zoomEl.scrollHeight, zoomEl.offsetHeight)
          };
        }

        const rect = bodyEl.getBoundingClientRect();
        const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY = (t1.clientY + t2.clientY) / 2 - rect.top;
        const contentX = (bodyEl.scrollLeft + midX) / currentScale;
        const contentY = (bodyEl.scrollTop + midY) / currentScale;

        pinchStateRef.current = {
          startDist: dist,
          startScale: currentScale,
          contentX,
          contentY,
          baseWidth: baseSizeRef.current.width,
          baseHeight: baseSizeRef.current.height
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStateRef.current) {
        e.preventDefault();
        e.stopPropagation();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const { startDist, startScale, contentX, contentY, baseWidth, baseHeight } = pinchStateRef.current;
        const nextScale = Math.min(4, Math.max(1, startScale * (dist / startDist)));
        zoomScaleRef.current = nextScale;

        applyZoomStyles(nextScale, baseWidth, baseHeight);

        const rect = bodyEl.getBoundingClientRect();
        const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY = (t1.clientY + t2.clientY) / 2 - rect.top;
        bodyEl.scrollLeft = Math.max(0, contentX * nextScale - midX);
        bodyEl.scrollTop = Math.max(0, contentY * nextScale - midY);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2 && pinchStateRef.current) {
        pinchStateRef.current = null;
        if (zoomScaleRef.current < 1.03) {
          zoomScaleRef.current = 1;
          setZoomPercent(100);
          applyZoomStyles(1);
        } else {
          setZoomPercent(Math.round(zoomScaleRef.current * 100));
        }
      }
    };

    bodyEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    bodyEl.addEventListener('touchmove', handleTouchMove, { passive: false });
    bodyEl.addEventListener('touchend', handleTouchEnd, { passive: true });
    bodyEl.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        if (zoomScaleRef.current <= 1.01) {
          baseSizeRef.current = {
            width: zoomEl.offsetWidth || bodyEl.clientWidth,
            height: Math.max(zoomEl.scrollHeight, zoomEl.offsetHeight)
          };
        } else if (sizerRef.current) {
          const newBaseH = Math.max(zoomEl.scrollHeight, zoomEl.offsetHeight);
          if (newBaseH > 0 && Math.abs(newBaseH - baseSizeRef.current.height) > 2) {
            baseSizeRef.current.height = newBaseH;
            sizerRef.current.style.height = `${Math.round(newBaseH * zoomScaleRef.current)}px`;
          }
        }
      });
      ro.observe(zoomEl);
    }

    return () => {
      bodyEl.removeEventListener('touchstart', handleTouchStart);
      bodyEl.removeEventListener('touchmove', handleTouchMove);
      bodyEl.removeEventListener('touchend', handleTouchEnd);
      bodyEl.removeEventListener('touchcancel', handleTouchEnd);
      if (ro) ro.disconnect();
    };
  }, [isOpen, applyZoomStyles]);

  if (!isOpen) return null;
  const computedZIndex = 9000 + stackState.index * 20;

  return createPortal(
    <div
      ref={wrapperRef}
      style={{ zIndex: computedZIndex }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className={`modal-print-wrapper fixed inset-0 w-screen h-screen flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200 overscroll-none print:static print:h-auto print:w-full print:block print:bg-white print:p-0 ${
        stackState.isTop ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      <div
        ref={contentRef}
        className={`modal-print-content bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[90vh] sm:max-h-[92vh] ${
          stackState.isTop ? 'overflow-hidden pointer-events-auto' : 'overflow-hidden pointer-events-none select-none'
        } overscroll-contain flex flex-col dark:bg-slate-900 dark:border dark:border-slate-700 relative print:max-w-none print:max-h-none print:overflow-visible print:shadow-none print:border-none print:rounded-none`}
      >
        <div className="flex justify-between items-center px-3 py-2.5 sm:p-5 border-b border-slate-100 bg-slate-50/50 rounded-t-xl sm:rounded-t-2xl shrink-0 z-20 dark:bg-slate-800 dark:border-slate-700 print:static print:bg-transparent print:border-b-2 print:border-black gap-2">
          <h3 className="text-sm sm:text-lg font-bold text-slate-800 dark:text-slate-100 truncate">{title}</h3>
          <div className="flex items-center gap-1.5 flex-shrink-0 no-print">
            {zoomPercent > 102 && (
              <button
                type="button"
                onClick={resetZoom}
                className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300 transition"
                title="Сбросить масштаб"
              >
                {zoomPercent}% ✕
              </button>
            )}
            <button type="button" onClick={onClose} className="text-xl sm:text-2xl leading-none text-slate-400 hover:text-slate-600 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition dark:hover:bg-slate-700 dark:hover:text-slate-300 flex-shrink-0">&times;</button>
          </div>
        </div>
        <div
          ref={bodyScrollRef}
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}
          className="modal-print-body flex-1 min-h-0 overflow-auto overscroll-contain dark:text-slate-300"
        >
          <div ref={sizerRef} className="w-full">
            <div ref={zoomContentRef} className="p-3 sm:p-6 w-full">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// --- SIDE NAV DRAWER (Smooth Slide + Left-Edge Touch Swipe) ---
export interface NavTabItem {
  id: string;
  label: string;
  badgeCount?: number;
}

export const SideNavDrawer: React.FC<{
  items: NavTabItem[];
  activeId: string;
  onSelect: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  onTabMetaChange?: (label: string, totalBadges: number) => void;
  userFio?: string;
  userRoleLabel?: string;
  schoolName?: string;
  lang?: 'ru' | 'en';
}> = ({ items, activeId, onSelect, isOpen, onClose, onOpen, onTabMetaChange, userFio, userRoleLabel, schoolName, lang = 'ru' }) => {
  const activeItem = items.find(i => i.id === activeId) || items[0];
  const totalBadges = items.reduce((acc, item) => acc + (item.badgeCount || 0), 0);
  const touchStartRef = useRef<{ x: number; y: number; fromLeftEdge: boolean } | null>(null);
  const drawerLockIdRef = useRef<symbol>(Symbol('drawer'));

  useEffect(() => {
    if (onTabMetaChange && activeItem) {
      onTabMetaChange(activeItem.label, totalBadges);
    }
  }, [activeId, activeItem?.label, totalBadges]);

  useEffect(() => {
    const id = drawerLockIdRef.current;
    if (isOpen) {
      if (!activeModalStack.includes(id)) activeModalStack.push(id);
      syncModalScrollLock();
    }
    return () => {
      const idx = activeModalStack.indexOf(id);
      if (idx > -1) {
        activeModalStack.splice(idx, 1);
        syncModalScrollLock();
      }
    };
  }, [isOpen]);

  // Global touch listener on mobile (< 768px): swipe right from left edge to open, swipe left when open to close
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (window.innerWidth >= 768) return;
      if (!isOpen && activeModalStack.length > 0) return;
      const t = e.touches[0];
      if (!t) return;
      touchStartRef.current = {
        x: t.clientX,
        y: t.clientY,
        fromLeftEdge: t.clientX <= 32
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (window.innerWidth >= 768 || !touchStartRef.current) return;
      if (!isOpen && activeModalStack.length > 0) {
        touchStartRef.current = null;
        return;
      }
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - touchStartRef.current.x;
      const dy = t.clientY - touchStartRef.current.y;
      const isHorizontalSwipe = Math.abs(dx) > Math.abs(dy) * 1.25;

      if (!isOpen && touchStartRef.current.fromLeftEdge && isHorizontalSwipe && dx > 48) {
        onOpen?.();
      } else if (isOpen && isHorizontalSwipe && dx < -45) {
        onClose();
      }
      touchStartRef.current = null;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isOpen, onOpen, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      aria-hidden={!isOpen}
      className={`md:hidden fixed inset-0 z-[9998] no-print transition-all duration-300 ${
        isOpen ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      {/* Smooth Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-slate-950/50 backdrop-blur-[2px] transition-opacity duration-300 ease-out ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Left Edge Invisible Swipe Hint Handle when closed */}
      {!isOpen && (
        <div
          className="fixed top-1/3 left-0 w-1.5 h-20 rounded-r-full bg-blue-500/20 pointer-events-none z-[9997]"
          aria-hidden="true"
        />
      )}

      {/* Sliding Drawer Panel */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-10 w-[256px] max-w-[78vw] bg-white dark:bg-slate-900 h-full shadow-2xl border-r border-slate-200/80 dark:border-slate-800 flex flex-col transform transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Compact Branded Header */}
        <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-600/8 via-indigo-600/5 to-transparent dark:from-blue-950/40 dark:to-slate-900">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <img
                src={`${import.meta.env.BASE_URL}assets/icon.png`}
                alt="ЭлЖур"
                draggable={false}
                className="w-7 h-7 object-contain shrink-0 select-none"
              />
              <div className="text-xs font-extrabold text-slate-800 dark:text-white truncate leading-tight">
                {lang === 'ru' ? 'Меню разделов' : 'Navigation'}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-100/80 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition shrink-0"
              aria-label={lang === 'ru' ? 'Закрыть меню' : 'Close menu'}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Section Title */}
        <div className="px-3.5 pt-2.5 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {lang === 'ru' ? 'Разделы' : 'Sections'}
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-2.5 pb-3 space-y-1 custom-scrollbar">
          {items.map(item => {
            const active = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelect(item.id);
                  onClose();
                }}
                className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold transition-all flex items-center justify-between gap-2 group ${
                  active
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/25'
                    : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 transition-transform ${
                      active ? 'bg-white scale-125' : 'bg-slate-300 dark:bg-slate-600 group-hover:bg-blue-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                    <span
                      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] ${item.badgeCount > 9 ? 'px-1' : 'w-[18px] px-0'} text-[10px] font-bold rounded-full leading-none shrink-0 ${
                        active ? 'bg-white text-blue-600' : 'bg-red-500 text-white'
                      }`}
                    >
                      {item.badgeCount > 99 ? '99+' : item.badgeCount}
                    </span>
                  )}
                  <ChevronRight
                    size={13}
                    className={active ? 'text-white/90' : 'text-slate-300 dark:text-slate-600'}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Subtle Swipe Hint Footer */}
        <div className="px-3.5 py-2 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 text-[10px] text-slate-400 dark:text-slate-500 text-center">
          {lang === 'ru' ? 'Свайп влево для закрытия • вправо от края для открытия' : 'Swipe left to close • swipe right from edge to open'}
        </div>
      </aside>
    </div>,
    document.body
  );
};

// --- DESKTOP SYNCHRONIZED SCROLLABLE TABLE WRAPPER ---
export const ScrollableTableWrapper: React.FC<{
  children: React.ReactNode;
  className?: string;
  maxHeightClass?: string;
  lang?: 'ru' | 'en';
}> = ({ children, className = '', maxHeightClass = 'max-h-none !overflow-y-visible', lang = 'ru' }) => {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);
  const isSyncingLeft = useRef(false);
  const isSyncingRight = useRef(false);

  const measureOverflow = () => {
    const el = tableContainerRef.current;
    if (!el) return;
    const sw = el.scrollWidth;
    const cw = el.clientWidth;
    setScrollWidth(sw);
    setHasOverflow(sw > cw + 8);
  };

  useEffect(() => {
    measureOverflow();
    const el = tableContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measureOverflow());
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    window.addEventListener('resize', measureOverflow);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measureOverflow);
    };
  });

  const handleTopScroll = () => {
    if (isSyncingLeft.current) {
      isSyncingLeft.current = false;
      return;
    }
    if (topScrollRef.current && tableContainerRef.current) {
      isSyncingRight.current = true;
      tableContainerRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleTableScroll = () => {
    if (isSyncingRight.current) {
      isSyncingRight.current = false;
      return;
    }
    if (topScrollRef.current && tableContainerRef.current) {
      isSyncingLeft.current = true;
      topScrollRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
    }
  };

  return (
    <div className={`border border-slate-200 rounded-xl sm:rounded-2xl bg-white shadow-soft overflow-hidden print:overflow-visible print:border-none print:rounded-none print:shadow-none print:bg-transparent dark:bg-slate-900 dark:border-slate-800 ${className}`}>
      {/* Desktop Top Horizontal Scroll Bar */}
      {hasOverflow && (
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 no-print">
          <div
            ref={topScrollRef}
            onScroll={handleTopScroll}
            className="flex-1 overflow-x-auto overflow-y-hidden h-3.5 rounded bg-slate-200/70 dark:bg-slate-950/60"
          >
            <div style={{ width: `${scrollWidth}px`, height: '1px' }} />
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0 hidden lg:inline">
            {lang === 'ru' ? 'Shift + колесо мыши' : 'Shift + wheel'}
          </span>
        </div>
      )}

      {/* Main Scrollable Viewport (Full vertical height on PC, horizontal scrolling preserved) */}
      <div
        ref={tableContainerRef}
        onScroll={handleTableScroll}
        className={`overflow-x-auto ${maxHeightClass} print:max-h-none print:overflow-visible`}
      >
        {children}
      </div>
    </div>
  );
};


