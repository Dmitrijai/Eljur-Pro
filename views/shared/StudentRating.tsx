import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppState } from '../../types';
import * as H from '../../utils/helpers';
import { Button, Select, Card } from '../../components/ui';
import { Printer, ChevronUp, ChevronDown, Scale, RotateCcw, Search, X } from 'lucide-react';

const isSubjectMatching = (subjName: string, targetSubj: string): boolean => {
    const s1 = subjName.toLowerCase().trim().replace(/ё/g, 'е');
    const s2 = targetSubj.toLowerCase().trim().replace(/ё/g, 'е');
    if (s1 === s2) return true;

    const synonyms: Record<string, string[]> = {
        'математика': ['математика', 'алгебра', 'геометрия', 'math', 'mathematics'],
        'алгебра': ['алгебра', 'математика'],
        'геометрия': ['геометрия', 'математика'],
        'информатика': ['информатика', 'информатика и икт', 'computer science', 'программирование'],
        'английский': ['английский', 'английский язык', 'english', 'иностранный язык'],
        'английский язык': ['английский', 'английский язык', 'english', 'иностранный язык'],
        'иностранный язык': ['иностранный язык', 'английский язык', 'английский', 'немецкий язык', 'французский язык'],
        'русский': ['русский', 'русский язык', 'russian'],
        'русский язык': ['русский', 'русский язык', 'russian'],
        'физика': ['физика', 'physics'],
        'химия': ['химия', 'chemistry'],
        'биология': ['биология', 'biology'],
        'история': ['история', 'история россии', 'всеобщая история', 'history'],
        'обществознание': ['обществознание', 'общество', 'social studies', 'право', 'экономика'],
        'литература': ['литература', 'русская литература', 'literature'],
        'география': ['география', 'geography']
    };

    for (const [key, list] of Object.entries(synonyms)) {
        const targetMatchesGroup = s2 === key || list.includes(s2);
        const subjMatchesGroup = s1 === key || list.includes(s1);
        if (targetMatchesGroup && subjMatchesGroup) {
            return true;
        }
    }
    return false;
};

export const StudentRating = ({ state, schoolId, isGlobal = false }: { state: AppState, schoolId?: string, isGlobal?: boolean }) => {
    const scopeKey = isGlobal ? 'global' : (schoolId || 'school_1');
    const [selectedProfile, setSelectedProfile] = H.useSyncedState<string>(`eljur_rating_prof_${scopeKey}`, '');
    const [selectedSubjects, setSelectedSubjects] = H.useSyncedState<string[]>(`eljur_rating_subj_${scopeKey}`, []);
    const [filterSchool, setFilterSchool] = H.useSyncedState<string>(`eljur_rating_sch_${scopeKey}`, schoolId || '');
    const [filterClass, setFilterClass] = H.useSyncedState<string>(`eljur_rating_cls_${scopeKey}`, '');
    const [searchFio, setSearchFio] = H.useSyncedState<string>(`eljur_rating_fio_${scopeKey}`, '');
    
    // Custom filter dropdown states
    const [showSubjects, setShowSubjects] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [showClassDropdown, setShowClassDropdown] = useState(false);
    const classDropdownRef = useRef<HTMLDivElement>(null);
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    const profileDropdownRef = useRef<HTMLDivElement>(null);

    const lang = state.settings.language || 'ru';
    const t = (k: string) => H.t(k, lang);

    const profiles = useMemo(() => [
        { label: t('profile_phys_math'), subjects: ['Математика', 'Алгебра', 'Геометрия', 'Физика'] },
        { label: t('profile_inf_tech'), subjects: ['Математика', 'Алгебра', 'Информатика'] },
        { label: t('profile_soc_econ'), subjects: ['Обществознание', 'Математика', 'Алгебра', 'География', 'Английский язык'] },
        { label: t('profile_soc_hum'), subjects: ['История', 'Обществознание', 'Русский язык'] },
        { label: t('profile_legal'), subjects: ['История', 'Обществознание', 'Английский язык'] },
        { label: t('profile_ling'), subjects: ['Русский язык', 'Литература', 'Английский язык', 'Иностранный язык'] },
        { label: t('profile_chem_bio'), subjects: ['Химия', 'Биология'] }
    ], [lang]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setShowSubjects(false);
            if (classDropdownRef.current && !classDropdownRef.current.contains(event.target as Node)) setShowClassDropdown(false);
            if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) setShowProfileDropdown(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Compute effective grading scale per school using self-healing getSchoolGradingSystem
    const effectiveSchoolScales = useMemo(() => {
        const map: Record<string, { minGrade: number; maxGrade: number }> = {};
        const schoolIds = new Set<string>(['school_1', ...(state.schools || []).map(s => s.id)]);
        schoolIds.forEach(sId => {
            const gs = H.getSchoolGradingSystem(state, sId);
            map[sId] = { minGrade: gs?.minGrade ?? 2, maxGrade: gs?.maxGrade ?? 5 };
        });
        return map;
    }, [state]);

    const availableSubjectsForFilter = useMemo(() => {
        const base = H.getSchoolSubjects(state, isGlobal ? filterSchool : schoolId);
        const priority = [
            'Математика', 'Алгебра', 'Геометрия', 'Русский язык', 'Литература',
            'Физика', 'Информатика', 'Химия', 'Биология', 'История',
            'Обществознание', 'География', 'Английский язык'
        ];
        return [...base].sort((a, b) => {
            const ia = priority.indexOf(a);
            const ib = priority.indexOf(b);
            if (ia !== -1 && ib !== -1) return ia - ib;
            if (ia !== -1) return -1;
            if (ib !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [state, isGlobal, filterSchool, schoolId]);

    const students = useMemo(() => state.users.filter(u => {
        if (u.role !== 'student') return false;
        if (isGlobal) {
            if (filterSchool && u.schoolId !== filterSchool) return false;
        } else {
            if (schoolId && u.schoolId !== schoolId) return false;
        }
        if (filterClass) {
            if (`${u.class}_${u.letter}` !== filterClass) return false;
        }
        return true;
    }), [state.users, isGlobal, filterSchool, schoolId, filterClass]);

    const activeFilterTargets = useMemo(() => {
        const targets: string[] = [];
        if (selectedSubjects.length > 0) {
            selectedSubjects.forEach(s => {
                if (!targets.includes(s)) targets.push(s);
            });
        } else if (selectedProfile) {
            const currentProfile = profiles.find(p => p.label === selectedProfile);
            if (currentProfile) {
                currentProfile.subjects.forEach(s => {
                    if (!targets.includes(s)) targets.push(s);
                });
            }
        }
        return targets;
    }, [selectedProfile, selectedSubjects, profiles]);

    const ratingListRaw = useMemo(() => {
        return students.map(s => {
            const classKey = `${s.class}_${s.letter}`;
            const allGrades: Record<string, any[]> = H.getSchoolClassGrades(state, s.schoolId, classKey);

            const schoolGradingSystem = H.getSchoolGradingSystem(state, s.schoolId);
            const effScale = effectiveSchoolScales[s.schoolId || 'school_1'];
            const minGrade = effScale?.minGrade ?? schoolGradingSystem?.minGrade ?? 2;
            const maxGrade = effScale?.maxGrade ?? schoolGradingSystem?.maxGrade ?? 5;
            const schoolGradeTypes = H.getSchoolGradeTypes(state, s.schoolId);
            const useWeights = schoolGradingSystem?.useWeights ?? true;

            let totalWeighted = 0;
            let totalWeights = 0;
            let gradesCount = 0;
            const matchedSubjects = new Set<string>();

            Object.entries(allGrades).forEach(([subjName, grades]) => {
                if (!Array.isArray(grades)) return;
                if (activeFilterTargets.length > 0) {
                    const matches = activeFilterTargets.some(target => isSubjectMatching(subjName, target));
                    if (!matches) return;
                }
                grades.forEach(g => {
                    if (g && g.studentId === s.id) {
                        const val = H.getEffectiveGradeValue(g, minGrade, state.settings?.systemTimeOffset);
                        if (val !== null && !isNaN(val)) {
                            const weight = H.getEffectiveGradeWeight(g, schoolGradeTypes, useWeights);
                            if (weight > 0) {
                                totalWeighted += val * weight;
                                totalWeights += weight;
                                gradesCount++;
                                matchedSubjects.add(subjName);
                            }
                        }
                    }
                });
            });

            const rawAvg = totalWeights > 0 ? (totalWeighted / totalWeights) : 0;
            // Percentage scale (0%..100%) for Creator's unified rating across schools with any scale
            const percentAvg = totalWeights > 0 ? Math.min(100, Math.max(0, (rawAvg / Math.max(1, maxGrade)) * 100)) : 0;

            // Creator (isGlobal) always ranks and displays by Percentage scale;
            // School ratings (!isGlobal) always rank and display by the school's native scale.
            const displayNum = isGlobal ? percentAvg : rawAvg;
            const displayStr = isGlobal ? `${percentAvg.toFixed(1)}%` : rawAvg.toFixed(2);

            return {
                id: s.id,
                fio: H.formatShortName(s.fio),
                fullFio: s.fio,
                class: `${s.class}${s.letter}`,
                schoolId: s.schoolId,
                school: state.schools.find(sch => sch.id === s.schoolId)?.name || '?',
                minGrade,
                maxGrade,
                rawAvg,
                percentAvg,
                gradesCount,
                subjectsCount: matchedSubjects.size,
                avgNum: Number(displayNum.toFixed(4)),
                avg: displayStr
            };
        }).filter(s => s.gradesCount > 0).sort((a, b) => b.avgNum - a.avgNum || b.rawAvg - a.rawAvg);
    }, [students, state, activeFilterTargets, isGlobal, effectiveSchoolScales]);

    const ratingListWithRanks = useMemo(() => {
        let currentRank = 0;
        let lastScore = -1;
        return ratingListRaw.map((student) => {
            const roundedKey = Math.round(student.avgNum * (isGlobal ? 10 : 100)) / (isGlobal ? 10 : 100);
            if (roundedKey !== lastScore) {
                currentRank++;
                lastScore = roundedKey;
            }
            return { ...student, rank: currentRank };
        });
    }, [ratingListRaw, isGlobal]);

    const displayedRatingList = useMemo(() => {
        const q = searchFio.trim().toLowerCase();
        if (!q) return ratingListWithRanks;
        return ratingListWithRanks.filter(item =>
            (item.fullFio && item.fullFio.toLowerCase().includes(q)) ||
            item.fio.toLowerCase().includes(q)
        );
    }, [ratingListWithRanks, searchFio]);

    const hasActiveFilters = Boolean(selectedProfile || selectedSubjects.length > 0 || filterClass || searchFio.trim() || (isGlobal && filterSchool));
    const currentSchoolScale = !isGlobal && schoolId ? (effectiveSchoolScales[schoolId] || { minGrade: 2, maxGrade: 5 }) : null;

    return (
        <Card className="p-3 sm:p-6 !overflow-visible">
            <div className="hidden print:block p-3 mb-3 border-b-2 border-black text-center">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-600">{!isGlobal && schoolId ? (H.getSchool(state, schoolId)?.name || 'ЭлЖур') : 'ЭлЖур'}</div>
                <div className="text-xl font-bold text-black mt-0.5">{t('student_rating_title')}</div>
                <div className="text-xs text-slate-600 mt-1">
                    {filterClass ? `${t('class')}: ${filterClass.replace('_', '')} • ` : ''}
                    {selectedProfile ? `${selectedProfile} • ` : ''}
                    {selectedSubjects.length > 0 ? `${t('subjects')}: ${selectedSubjects.join(', ')} • ` : ''}
                    {t('date')}: {H.formatDateDDMMYYYY(H.dateToIso(H.getSchoolNow(state, schoolId)))}
                </div>
            </div>
            <div className="mb-3 sm:mb-5">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-sm sm:text-lg text-slate-800 dark:text-white font-heading leading-tight truncate">{t('student_rating_title')}</h3>
                    <div className="flex items-center gap-1.5 no-print shrink-0">
                        {hasActiveFilters && (
                            <Button
                                onClick={() => {
                                    setSelectedProfile('');
                                    setSelectedSubjects([]);
                                    setFilterClass('');
                                    setSearchFio('');
                                    if (isGlobal) setFilterSchool('');
                                }}
                                variant="ghost"
                                size="sm"
                                className="text-xs text-slate-600 dark:text-slate-300 px-2 py-1"
                            >
                                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                {lang === 'ru' ? 'Сброс' : 'Reset'}
                            </Button>
                        )}
                        <Button onClick={() => window.print()} variant="secondary" size="sm" className="w-auto px-2.5 py-1.5 text-xs">
                            <Printer className="w-3.5 h-3.5 sm:mr-1.5"/>
                            <span className="hidden sm:inline">{t('print')}</span>
                        </Button>
                    </div>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {isGlobal
                        ? (lang === 'ru'
                            ? 'Единая процентная шкала (0–100%) для объективного сравнения школ с любыми системами оценивания'
                            : 'Unified percentage scale (0–100%) to compare schools across any grading system')
                        : currentSchoolScale
                        ? (lang === 'ru'
                            ? `Шкала оценивания школы: от ${currentSchoolScale.minGrade} до ${currentSchoolScale.maxGrade} баллов`
                            : `School grading scale: ${currentSchoolScale.minGrade} to ${currentSchoolScale.maxGrade}`)
                        : null}
                </p>
            </div>

            <div className="flex flex-col gap-2 sm:gap-3 mb-3 sm:mb-5 no-print">
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3 items-center">
                    {isGlobal && (
                        <Select
                            value={filterSchool}
                            onChange={e => {
                                setFilterSchool(e.target.value);
                                setFilterClass('');
                            }}
                            className="col-span-2 sm:w-52 text-xs h-8 sm:h-[38px]"
                        >
                            <option value="">{t('all_schools')}</option>
                            {state.schools.map(s => {
                                const sc = effectiveSchoolScales[s.id] || H.getSchoolGradingSystem(state, s.id);
                                const maxG = sc?.maxGrade ?? 5;
                                return (
                                    <option key={s.id} value={s.id}>
                                        {s.name} ({maxG}-{lang === 'ru' ? 'б.' : 'pt'})
                                    </option>
                                );
                            })}
                        </Select>
                    )}
                    
                    {/* CUSTOM CLASS FILTER */}
                    <div className="relative w-full sm:w-32" ref={classDropdownRef}>
                        <Button variant="secondary" size="sm" className="w-full text-xs h-8 sm:h-[38px] px-2.5 sm:px-3 border-slate-300 dark:border-slate-700 flex justify-between items-center" onClick={() => setShowClassDropdown(!showClassDropdown)}>
                            <span className="truncate">{filterClass ? filterClass.replace('_', '') : t('all_classes')}</span>
                            {showClassDropdown ? <ChevronUp size={13} className="text-slate-400 shrink-0 ml-1"/> : <ChevronDown size={13} className="text-slate-400 shrink-0 ml-1"/>}
                        </Button>
                        {showClassDropdown && (
                            <div className="absolute top-full left-0 mt-1.5 z-50 w-full min-w-[130px] bg-white border border-slate-200 rounded-xl shadow-xl p-1 dark:bg-slate-900 dark:border-slate-700 flex flex-col animate-in fade-in slide-in-from-top-2 max-h-60 overflow-y-auto custom-scrollbar">
                                <button onClick={() => { setFilterClass(''); setShowClassDropdown(false); }} className={`text-left w-full px-2.5 py-1.5 rounded-lg text-xs transition-colors ${filterClass === '' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{t('all_classes')}</button>
                                {H.getSchoolClasses(state, isGlobal ? filterSchool : schoolId).map(c => (
                                    <button 
                                        key={`${c.class}_${c.letter}`}
                                        onClick={() => { setFilterClass(`${c.class}_${c.letter}`); setShowClassDropdown(false); }}
                                        className={`text-left w-full px-2.5 py-1.5 rounded-lg text-xs transition-colors ${filterClass === `${c.class}_${c.letter}` ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                                    >
                                        {c.class}{c.letter}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* CUSTOM PROFILE FILTER */}
                    <div className="relative w-full sm:w-56" ref={profileDropdownRef}>
                        <Button
                            variant="secondary"
                            size="sm"
                            className={`w-full text-xs h-8 sm:h-[38px] px-2.5 sm:px-3 border flex justify-between items-center ${
                                selectedProfile
                                    ? 'border-blue-500 bg-blue-50/60 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-600'
                                    : 'border-slate-300 dark:border-slate-700'
                            }`}
                            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                        >
                            <span className="truncate">{selectedProfile || t('profile_all')}</span>
                            {showProfileDropdown ? <ChevronUp size={13} className="text-slate-400 shrink-0 ml-1"/> : <ChevronDown size={13} className="text-slate-400 shrink-0 ml-1"/>}
                        </Button>
                        {showProfileDropdown && (
                            <div className="absolute top-full right-0 sm:left-0 sm:right-auto mt-1.5 z-50 w-52 sm:w-64 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-xl shadow-xl p-1 dark:bg-slate-900 dark:border-slate-700 flex flex-col animate-in fade-in slide-in-from-top-2 max-h-72 overflow-y-auto custom-scrollbar">
                                <button
                                    onClick={() => {
                                        setSelectedProfile('');
                                        setShowProfileDropdown(false);
                                    }}
                                    className={`text-left w-full px-2.5 py-1.5 rounded-lg text-xs transition-colors ${selectedProfile === '' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                                >
                                    {t('profile_all')}
                                </button>
                                {profiles.map(p => (
                                    <button 
                                        key={p.label}
                                        onClick={() => {
                                            setSelectedProfile(p.label);
                                            setSelectedSubjects([]);
                                            setShowProfileDropdown(false);
                                        }}
                                        className={`text-left w-full px-2.5 py-1.5 rounded-lg text-xs transition-colors ${selectedProfile === p.label ? 'bg-blue-50 text-blue-700 font-bold dark:bg-blue-950/60 dark:text-blue-300' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                                    >
                                        <div className="font-semibold">{p.label}</div>
                                        <div className="text-[10px] text-slate-400 truncate">{p.subjects.join(', ')}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {/* SUBJECTS MULTI-SELECT DROPDOWN */}
                    <div className="relative col-span-2 sm:w-56" ref={dropdownRef}>
                        <Button
                            variant="secondary"
                            size="sm"
                            className={`w-full text-xs h-8 sm:h-[38px] px-2.5 sm:px-3 border flex justify-between items-center ${
                                selectedSubjects.length > 0
                                    ? 'border-blue-500 bg-blue-50/60 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-600'
                                    : 'border-slate-300 dark:border-slate-700'
                            }`}
                            onClick={() => setShowSubjects(!showSubjects)}
                        >
                            <span className="truncate">
                                {selectedSubjects.length > 0
                                    ? `${t('subjects')}: ${selectedSubjects.length}`
                                    : t('subjects')}
                            </span>
                            {showSubjects ? <ChevronUp size={13} className="text-slate-400 shrink-0 ml-1"/> : <ChevronDown size={13} className="text-slate-400 shrink-0 ml-1"/>}
                        </Button>
                        {showSubjects && (
                            <div className="absolute top-full left-0 mt-1.5 z-50 w-full sm:w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-2.5 dark:bg-slate-900 dark:border-slate-700 flex flex-col animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 dark:border-slate-800 text-xs">
                                    <span className="font-bold text-slate-500">{lang === 'ru' ? 'Предметы:' : 'Subjects:'}</span>
                                    {selectedSubjects.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedSubjects([])}
                                            className="text-red-500 hover:underline font-semibold"
                                        >
                                            {lang === 'ru' ? 'Очистить' : 'Clear'}
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-[260px] overflow-y-auto custom-scrollbar flex-1 space-y-0.5">
                                    {availableSubjectsForFilter.map(subj => (
                                        <label key={subj} className="flex items-center gap-2.5 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors dark:hover:bg-slate-800">
                                            <input 
                                                type="checkbox" 
                                                className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 border-slate-300 cursor-pointer"
                                                checked={selectedSubjects.includes(subj)}
                                                onChange={() => {
                                                    setSelectedProfile('');
                                                    if (selectedSubjects.includes(subj)) {
                                                        setSelectedSubjects(selectedSubjects.filter(s => s !== subj));
                                                    } else {
                                                        setSelectedSubjects([...selectedSubjects, subj]);
                                                    }
                                                }}
                                            />
                                            <span className="text-xs text-slate-700 dark:text-slate-200">{subj}</span>
                                        </label>
                                    ))}
                                    {availableSubjectsForFilter.length === 0 && <div className="text-slate-400 text-xs text-center py-3">{t('list_empty')}</div>}
                                </div>
                                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                                    <button onClick={() => setShowSubjects(false)} className="text-xs text-blue-600 font-bold hover:underline">{t('done')}</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SEARCH BY FIO */}
                    <div className="relative col-span-2 sm:w-56">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            maxLength={100}
                            value={searchFio}
                            onChange={e => setSearchFio(e.target.value.slice(0, 100))}
                            placeholder={lang === 'ru' ? 'Поиск по ФИО...' : 'Search by name...'}
                            className="w-full h-8 sm:h-[38px] pl-7 pr-7 text-xs sm:text-sm rounded-lg border border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100"
                        />
                        {searchFio && (
                            <button
                                type="button"
                                onClick={() => setSearchFio('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Active Filter Pills */}
                {activeFilterTargets.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
                        <span className="font-semibold text-slate-500 dark:text-slate-400">
                            {selectedProfile
                                ? `${lang === 'ru' ? 'Профиль' : 'Profile'} «${selectedProfile}»:`
                                : `${lang === 'ru' ? 'Предметы' : 'Subjects'}:`}
                        </span>
                        {activeFilterTargets.map(subj => (
                            <span
                                key={subj}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800 font-medium"
                            >
                                {subj}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Mobile Card List (Compact, No horizontal scroll) */}
            <div className="md:hidden print:hidden divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
                {displayedRatingList.map((item) => (
                    <div key={`${item.schoolId}_${item.id}`} className="py-2 px-1 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center font-black text-[10px] shrink-0 ${
                                item.rank === 1
                                    ? 'bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300'
                                    : item.rank === 2
                                    ? 'bg-slate-200 text-slate-700 border border-slate-300 dark:bg-slate-700 dark:text-slate-200'
                                    : item.rank === 3
                                    ? 'bg-orange-100 text-orange-700 border border-orange-300 dark:bg-orange-900/40 dark:text-orange-300'
                                    : 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                            }`}>
                                #{item.rank}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">{item.fio}</div>
                                <div className="flex flex-wrap items-center gap-x-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">{item.class}</span>
                                    <span>•</span>
                                    <span>{lang === 'ru' ? `Оц.: ${item.gradesCount} (${item.subjectsCount} пр.)` : `Gr.: ${item.gradesCount} (${item.subjectsCount})`}</span>
                                </div>
                                {isGlobal && (
                                    <div className="text-[10px] text-slate-400 truncate">
                                        {item.school} ({item.minGrade}–{item.maxGrade})
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                            <div className="font-black text-sm text-blue-600 dark:text-blue-400 leading-tight">{item.avg}</div>
                            {isGlobal ? (
                                <div className="text-[9px] font-medium text-slate-400">
                                    {item.rawAvg.toFixed(2)} {lang === 'ru' ? 'из' : '/'} {item.maxGrade}
                                </div>
                            ) : (item.maxGrade !== 5 || item.minGrade !== 2) ? (
                                <div className="text-[9px] font-medium text-slate-400">
                                    {lang === 'ru' ? `из ${item.maxGrade}` : `/ ${item.maxGrade}`}
                                </div>
                            ) : null}
                        </div>
                    </div>
                ))}
                {displayedRatingList.length === 0 && (
                    <div className="p-4 text-center text-slate-400 text-xs">{t('no_rating_data')}</div>
                )}
            </div>

            {/* Desktop & Print Table */}
            <div className="hidden md:block print:block overflow-x-auto max-h-[70vh] overflow-y-auto custom-scrollbar">
                <table className="w-full text-sm">
                    <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 sticky top-0 z-10">
                        <tr>
                            <th className="p-3 text-center">{t('place')}</th>
                            <th className="p-3 text-left">{t('student')}</th>
                            <th className="p-3 text-center">{t('class')}</th>
                            {isGlobal && <th className="p-3 text-center">{t('school')}</th>}
                            <th className="p-3 text-center">{lang === 'ru' ? 'Оценок (предм.)' : 'Grades (subj.)'}</th>
                            <th className="p-3 text-center">{isGlobal ? (lang === 'ru' ? 'Рейтинг (%)' : 'Rating (%)') : t('avg_score')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {displayedRatingList.map((item) => (
                            <tr key={`${item.schoolId}_${item.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="p-3 text-center font-bold text-blue-600 dark:text-blue-400">{item.rank}</td>
                                <td className="p-3 font-semibold text-slate-700 dark:text-slate-200">{item.fio}</td>
                                <td className="p-3 text-center">{item.class}</td>
                                {isGlobal && (
                                    <td className="p-3 text-center text-xs text-slate-500">
                                        <div>{item.school}</div>
                                        <div className="text-[10px] text-slate-400">
                                            {lang === 'ru' ? `Шкала ${item.minGrade}–${item.maxGrade}` : `Scale ${item.minGrade}–${item.maxGrade}`}
                                        </div>
                                    </td>
                                )}
                                <td className="p-3 text-center text-xs text-slate-500 dark:text-slate-400">
                                    {item.gradesCount} ({item.subjectsCount})
                                </td>
                                <td className="p-3 text-center">
                                    <div className="font-bold text-slate-800 dark:text-white text-lg leading-tight">
                                        {item.avg}
                                    </div>
                                    {isGlobal ? (
                                        <div className="text-[10px] font-medium text-slate-400">
                                            {lang === 'ru'
                                                ? `Ср. балл: ${item.rawAvg.toFixed(2)} из ${item.maxGrade}`
                                                : `Avg: ${item.rawAvg.toFixed(2)} / ${item.maxGrade}`}
                                        </div>
                                    ) : (item.maxGrade !== 5 || item.minGrade !== 2) ? (
                                        <div className="text-[10px] font-medium text-slate-400">
                                            {lang === 'ru' ? `из ${item.maxGrade}` : `of ${item.maxGrade}`}
                                        </div>
                                    ) : null}
                                </td>
                            </tr>
                        ))}
                        {displayedRatingList.length === 0 && (
                            <tr>
                                <td colSpan={isGlobal ? 6 : 5} className="p-6 text-center text-slate-400">
                                    {t('no_rating_data')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};
