
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppState } from '../../types';
import * as H from '../../utils/helpers';
import { Button, Select, Card } from '../../components/ui';
import { Printer, ChevronUp, ChevronDown } from 'lucide-react';

export const StudentRating = ({ state, schoolId, isGlobal = false }: { state: AppState, schoolId?: string, isGlobal?: boolean }) => {
    const [selectedProfile, setSelectedProfile] = useState('');
    const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
    const [filterSchool, setFilterSchool] = useState(schoolId || '');
    const [filterClass, setFilterClass] = useState('');
    
    // Custom filter dropdown states
    const [showSubjects, setShowSubjects] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [showClassDropdown, setShowClassDropdown] = useState(false);
    const classDropdownRef = useRef<HTMLDivElement>(null);
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    const profileDropdownRef = useRef<HTMLDivElement>(null);

    const lang = state.settings.language || 'ru';
    const t = (k: string) => H.t(k, lang);
    const useWeights = state.gradingSystem?.useWeights ?? true;
    const gradeTypes = state.gradeTypes || [];

    const profiles = [
        { label: t('profile_phys_math'), subjects: ['Математика', 'Физика'] },
        { label: t('profile_inf_tech'), subjects: ['Математика', 'Информатика'] },
        { label: t('profile_soc_econ'), subjects: ['Обществознание', 'Математика', 'География', 'Английский'] },
        { label: t('profile_soc_hum'), subjects: ['История', 'Обществознание'] },
        { label: t('profile_legal'), subjects: ['История', 'Обществознание', 'Английский'] },
        { label: t('profile_ling'), subjects: ['Литература', 'Английский'] },
        { label: t('profile_chem_bio'), subjects: ['Химия', 'Биология'] }
    ];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setShowSubjects(false);
            if (classDropdownRef.current && !classDropdownRef.current.contains(event.target as Node)) setShowClassDropdown(false);
            if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) setShowProfileDropdown(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const students = state.users.filter(u => {
        if (u.role !== 'student') return false;
        if (isGlobal) { if (filterSchool && u.schoolId !== filterSchool) return false; } else { if (schoolId && u.schoolId !== schoolId) return false; }
        if (filterClass) { if (`${u.class}_${u.letter}` !== filterClass) return false; }
        return true;
    });

    const ratingListRaw = students.map(s => {
        const classKey = `${s.class}_${s.letter}`;
        const allGrades = H.getSchoolClassGrades(state, s.schoolId, classKey);
        let totalWeighted = 0;
        let totalWeights = 0;
        let subjectsToCount = new Set<string>();
        
        const currentProfile = profiles.find(p => p.label === selectedProfile);
        const profileSubjs = currentProfile ? currentProfile.subjects : [];
        
        if (selectedProfile) profileSubjs.forEach(s => subjectsToCount.add(s));
        if (selectedSubjects.length > 0) selectedSubjects.forEach(s => subjectsToCount.add(s));
        if (!selectedProfile && selectedSubjects.length === 0) H.getSchoolSubjects(state, s.schoolId).forEach(s => subjectsToCount.add(s));
        
        const subjectArray = Array.from(subjectsToCount);
        Object.entries(allGrades).forEach(([subjName, grades]) => {
            if (subjectArray.length > 0 && !subjectArray.includes(subjName)) return;
            grades.forEach(g => {
                if (g.studentId === s.id) {
                    const val = parseFloat(g.value as string);
                    if (!isNaN(val)) {
                        // Dynamic Weight Lookup Logic
                        let weight = 1;
                        if (useWeights) {
                            const typeDef = gradeTypes.find(t => t.key === g.type);
                            if (typeDef) {
                                if (typeDef.isNoWeight) weight = 0;
                                else if (typeDef.isDynamicWeight) weight = g.weight || 1;
                                else weight = typeDef.weight;
                            }
                        }
                        
                        totalWeighted += val * weight;
                        totalWeights += weight;
                    }
                }
            });
        });
        const avgVal = totalWeights > 0 ? (totalWeighted / totalWeights) : 0;
        return {
            id: s.id, fio: s.fio, class: `${s.class}${s.letter}`, school: state.schools.find(sch => sch.id === s.schoolId)?.name || '?',
            avgNum: avgVal, avg: avgVal.toFixed(2)
        };
    }).filter(s => s.avgNum > 0).sort((a,b) => b.avgNum - a.avgNum);

    const ratingListWithRanks = useMemo(() => {
        let currentRank = 0;
        let lastScore = -1;
        return ratingListRaw.map((student) => {
            if (student.avgNum !== lastScore) { currentRank++; lastScore = student.avgNum; }
            return { ...student, rank: currentRank };
        });
    }, [ratingListRaw]);

    return (
        <Card className="p-6 !overflow-visible">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white font-heading">{t('student_rating_title')}</h3>
                <Button onClick={() => window.print()} variant="secondary" className="no-print"><Printer className="w-4 h-4 mr-2"/> {t('print')}</Button>
            </div>
            <div className="flex flex-col gap-4 mb-6 no-print">
                <div className="flex flex-wrap gap-4 items-center">
                    {isGlobal && <Select value={filterSchool} onChange={e => setFilterSchool(e.target.value)} className="w-48 text-xs"><option value="">{t('all_schools')}</option>{state.schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>}
                    
                    {/* CUSTOM CLASS FILTER */}
                    <div className="relative w-32" ref={classDropdownRef}>
                        <Button variant="secondary" size="sm" className="w-full text-xs h-[42px] px-4 border-slate-300 dark:border-slate-700 flex justify-center items-center relative" onClick={() => setShowClassDropdown(!showClassDropdown)}>
                            <span className="truncate">{filterClass ? filterClass.replace('_', '') : t('all_classes')}</span>
                            {showClassDropdown ? <ChevronUp size={14} className="absolute right-3 text-slate-400"/> : <ChevronDown size={14} className="absolute right-3 text-slate-400"/>}
                        </Button>
                        {showClassDropdown && (
                            <div className="absolute top-full left-0 mt-2 z-50 w-full bg-white border border-slate-200 rounded-xl shadow-xl p-1 dark:bg-slate-900 dark:border-slate-700 flex flex-col animate-in fade-in slide-in-from-top-2 max-h-60 overflow-y-auto custom-scrollbar">
                                <button onClick={() => { setFilterClass(''); setShowClassDropdown(false); }} className={`text-left w-full px-3 py-2 rounded-lg text-sm transition-colors ${filterClass === '' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{t('all_classes')}</button>
                                {H.getSchoolClasses(state, isGlobal ? filterSchool : schoolId).map(c => (
                                    <button 
                                        key={`${c.class}_${c.letter}`}
                                        onClick={() => { setFilterClass(`${c.class}_${c.letter}`); setShowClassDropdown(false); }}
                                        className={`text-left w-full px-3 py-2 rounded-lg text-sm transition-colors ${filterClass === `${c.class}_${c.letter}` ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                                    >
                                        {c.class}{c.letter}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* CUSTOM PROFILE FILTER */}
                    <div className="relative w-64" ref={profileDropdownRef}>
                        <Button variant="secondary" size="sm" className="w-full text-xs h-[42px] px-4 border-slate-300 dark:border-slate-700 flex justify-center items-center relative" onClick={() => setShowProfileDropdown(!showProfileDropdown)}>
                            <span className="truncate max-w-[85%]">{selectedProfile || t('profile_all')}</span>
                             {showProfileDropdown ? <ChevronUp size={14} className="absolute right-3 text-slate-400"/> : <ChevronDown size={14} className="absolute right-3 text-slate-400"/>}
                        </Button>
                        {showProfileDropdown && (
                            <div className="absolute top-full left-0 mt-2 z-50 w-full bg-white border border-slate-200 rounded-xl shadow-xl p-1 dark:bg-slate-900 dark:border-slate-700 flex flex-col animate-in fade-in slide-in-from-top-2 max-h-60 overflow-y-auto custom-scrollbar">
                                 <button onClick={() => { setSelectedProfile(''); setShowProfileDropdown(false); }} className={`text-left w-full px-3 py-2 rounded-lg text-sm transition-colors ${selectedProfile === '' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{t('profile_all')}</button>
                                {profiles.map(p => (
                                    <button 
                                        key={p.label}
                                        onClick={() => { setSelectedProfile(p.label); setShowProfileDropdown(false); }}
                                        className={`text-left w-full px-3 py-2 rounded-lg text-sm transition-colors ${selectedProfile === p.label ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {/* Fixed Filter Container with Direct Checkboxes */}
                    <div className="relative w-80" ref={dropdownRef}>
                        <Button variant="secondary" size="sm" className="w-full text-xs h-[42px] px-4 border-slate-300 dark:border-slate-700 flex justify-center items-center relative" onClick={() => setShowSubjects(!showSubjects)}>
                            <span>{t('subjects')} {selectedSubjects.length > 0 ? `(${selectedSubjects.length})` : ''}</span>
                            {showSubjects ? <ChevronUp size={14} className="absolute right-3 text-slate-400"/> : <ChevronDown size={14} className="absolute right-3 text-slate-400"/>}
                        </Button>
                        {showSubjects && (
                            <div className="absolute top-full left-0 mt-2 z-50 w-full bg-white border border-slate-200 rounded-xl shadow-xl p-3 dark:bg-slate-900 dark:border-slate-700 flex flex-col animate-in fade-in slide-in-from-top-2">
                                <div className="max-h-[400px] overflow-y-auto custom-scrollbar flex-1 space-y-1">
                                    {H.getSchoolSubjects(state, isGlobal ? filterSchool : schoolId).map(subj => (
                                        <label key={subj} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors dark:hover:bg-slate-800">
                                            <input 
                                                type="checkbox" 
                                                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-slate-300 cursor-pointer"
                                                checked={selectedSubjects.includes(subj)}
                                                onChange={() => {
                                                    if (selectedSubjects.includes(subj)) setSelectedSubjects(selectedSubjects.filter(s => s !== subj));
                                                    else setSelectedSubjects([...selectedSubjects, subj]);
                                                }}
                                            />
                                            <span className="text-sm text-slate-700 dark:text-slate-200">{subj}</span>
                                        </label>
                                    ))}
                                    {H.getSchoolSubjects(state, isGlobal ? filterSchool : schoolId).length === 0 && <div className="text-slate-400 text-sm text-center py-4">{t('list_empty')}</div>}
                                </div>
                                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
                                    <button onClick={() => setShowSubjects(false)} className="text-sm text-blue-600 font-bold hover:underline">{t('done')}</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><tr><th className="p-3 text-center">{t('place')}</th><th className="p-3 text-left">{t('student')}</th><th className="p-3 text-center">{t('class')}</th>{isGlobal && <th className="p-3 text-center">{t('school')}</th>}<th className="p-3 text-center">{t('avg_score')}</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{ratingListWithRanks.map((item) => (<tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50"><td className="p-3 text-center font-bold text-blue-600 dark:text-blue-400">{item.rank}</td><td className="p-3 font-semibold text-slate-700 dark:text-slate-200">{item.fio}</td><td className="p-3 text-center">{item.class}</td>{isGlobal && <td className="p-3 text-center text-xs text-slate-500">{item.school}</td>}<td className="p-3 text-center font-bold text-slate-800 dark:text-white text-lg">{item.avg}</td></tr>))}{ratingListWithRanks.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">{t('no_rating_data')}</td></tr>}</tbody></table></div>
        </Card>
    );
};
