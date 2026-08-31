import React, { useState, useEffect, useMemo } from 'react';
import { AppState, User, Grade, FinalGradeEntry } from '../../types';
import * as H from '../../utils/helpers';
import { Button, Select, Modal } from '../../components/ui';
import { Printer, ChevronDown, ChevronUp } from 'lucide-react';

export const StudentGrades = ({ state, user }: { state: AppState, user: User }) => {
    const classKey = `${user.class}_${user.letter}`;
    const lang = state.settings.language || 'ru';
    const t = (k: string) => H.t(k, lang);
    
    const gradingSystem = H.getSchoolGradingSystem(state, user.schoolId);
    const minGrade = gradingSystem?.minGrade ?? 2;
    const maxGrade = gradingSystem?.maxGrade ?? 5;
    const useWeights = gradingSystem?.useWeights ?? true;
    const gradeTypes = H.getSchoolGradeTypes(state, user.schoolId);
    const scheduleSettings = H.getSchoolScheduleSettings(state, user.schoolId);
    const subjects = H.getSchoolSubjects(state, user.schoolId);
    const classGrades = H.getSchoolClassGrades(state, user.schoolId, classKey);
    const classFinalGrades = H.getSchoolClassFinalGrades(state, user.schoolId, classKey);
    
    const [currentQuarter, setCurrentQuarter] = useState<any>('Q1');
    const [isFinalGradesOpen, setIsFinalGradesOpen] = useState(false);
    const [selectedGradeDetails, setSelectedGradeDetails] = useState<{grade: Grade, subject: string} | null>(null);

    useEffect(() => {
        // 1. Try to find if the current day falls into a defined quarter
        if (scheduleSettings.quarterDefinitions) {
            const nowIso = H.dateToIso(new Date(Date.now() + (state.settings.systemTimeOffset || 0)));
            for (const [key, def] of Object.entries(scheduleSettings.quarterDefinitions)) {
               if (def.start && def.end && nowIso >= def.start && nowIso <= def.end) { 
                   setCurrentQuarter(key); 
                   return; 
               }
            }
        }

        // 2. Fallback: Find the latest grade date for this student
        let maxDate = '';
        Object.values(classGrades || {}).forEach(grades => { 
            grades.forEach(g => { 
                if (g.studentId === user.id && g.date > maxDate) maxDate = g.date; 
            }); 
        });

        // If a grade exists, use its quarter
        if (maxDate) { 
            if (scheduleSettings.quarterDefinitions) {
                for (const [key, def] of Object.entries(scheduleSettings.quarterDefinitions)) {
                   if (def.start && def.end && maxDate >= def.start && maxDate <= def.end) { 
                       setCurrentQuarter(key); 
                       return; 
                   }
                }
            }
            setCurrentQuarter(H.getQuarterFromDate(maxDate)); 
            return;
        }
        
        // Final fallback
        setCurrentQuarter('Q1');
    }, [classGrades, classKey, user.id, scheduleSettings, state.settings.systemTimeOffset]);

    const quarterDates = useMemo(() => {
        const def = scheduleSettings.quarterDefinitions?.[currentQuarter];
        const qStart = def?.start || '0000-00-00';
        const qEnd = def?.end || '9999-99-99';
        const dates = new Set<string>();
        subjects.forEach(subj => {
            const grades = classGrades[subj] || [];
            grades.forEach(g => { if (g.studentId === user.id && g.date >= qStart && g.date <= qEnd) { dates.add(g.date); } });
        });
        return Array.from(dates).sort();
    }, [classGrades, classKey, user.id, currentQuarter, scheduleSettings, subjects]);

    // Helper to get weight dynamically
    const getEffectiveWeight = (g: Grade) => {
        if (!useWeights) return 1;
        const typeDef = gradeTypes.find(t => t.key === g.type);
        if (!typeDef) return 1;
        if (typeDef.isNoWeight) return 0;
        if (typeDef.isDynamicWeight) return g.weight || 1;
        return typeDef.weight; // Use Global Config Weight
    };

    const playGradeSound = (gradeValue: string | number) => {
        try {
            const val = parseFloat(String(gradeValue));
            if (isNaN(val)) return;
            
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) return;
            
            const ctx = new AudioContextClass();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            let normalized = (val - minGrade) / (maxGrade - minGrade);
            if (maxGrade === minGrade) normalized = 1;
            normalized = Math.max(0, Math.min(1, normalized));
            
            const startFreq = 150 + (450) * normalized;
            
            if (normalized >= 0.8) {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
                osc.frequency.setValueAtTime(startFreq * 1.25, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                osc.start();
                osc.stop(ctx.currentTime + 0.3);
            } else if (normalized >= 0.4) {
                osc.type = normalized >= 0.6 ? 'sine' : 'triangle';
                osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                osc.start();
                osc.stop(ctx.currentTime + 0.3);
            } else {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(startFreq * 0.7, ctx.currentTime + 0.3);
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
                osc.start();
                osc.stop(ctx.currentTime + 0.4);
            }
        } catch (e) {
            console.error("Audio play failed", e);
        }
    };

    const classHeadmaster = H.getClassHeadmaster(state, user.schoolId, user.class || '', user.letter || '');

    return (
        <div className="space-y-6">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
                <div>
                    <h3 className="font-bold text-xl text-slate-800 dark:text-white">{t('current_performance')}</h3>
                    <div className="text-xs text-slate-500 mt-0.5">
                        {lang === 'ru' ? `Класс: ${user.class}${user.letter}` : `Class: ${user.class}${user.letter}`}
                        {classHeadmaster && (
                            <span className="ml-2 pl-2 border-l border-slate-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 font-medium">
                                {lang === 'ru' ? 'Классный руководитель: ' : 'Class Teacher: '}
                                <span className="font-bold">{classHeadmaster.fio}</span>
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    <Select value={currentQuarter} onChange={e => setCurrentQuarter(e.target.value)} className="w-32 bg-white border-slate-300 shadow-sm">
                        <option value="Q1">1 {t('quarter')}</option>
                        <option value="Q2">2 {t('quarter')}</option>
                        <option value="Q3">3 {t('quarter')}</option>
                        <option value="Q4">4 {t('quarter')}</option>
                    </Select>
                    <Button variant="secondary" onClick={() => window.print()} className="bg-white">
                        <Printer size={16} className="mr-2"/> {t('print')}
                    </Button>
                </div>
             </div>

             <div className="bg-white rounded-2xl border border-slate-200 shadow-soft overflow-hidden dark:bg-slate-900 dark:border-slate-800">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[800px]">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                            <tr>
                                <th className="p-4 text-left font-bold w-48 sticky left-0 bg-slate-50 z-10 border-r border-slate-200 dark:bg-slate-800 dark:border-slate-700">{t('subject')}</th>
                                {quarterDates.map(d => (
                                    <th key={d} className="p-2 min-w-[50px] text-center border-r border-slate-100 dark:border-slate-800 font-normal text-xs text-slate-500">
                                        {H.formatDateDDMMYYYY(d).slice(0,5)}
                                    </th>
                                ))}
                                <th className="p-4 text-center font-bold bg-blue-50 text-blue-800 min-w-[80px] dark:bg-blue-900/30 dark:text-blue-300">{t('avg_score')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {subjects.map(subj => {
                                const grades = classGrades[subj] || [];
                                const def = scheduleSettings.quarterDefinitions?.[currentQuarter];
                                const qStart = def?.start || '0000-00-00';
                                const qEnd = def?.end || '9999-99-99';
                                const currentGrades = grades.filter(g => g.studentId === user.id && g.date >= qStart && g.date <= qEnd);
                                if (currentGrades.length === 0) return null;
                                let wSum = 0, wCount = 0;
                                currentGrades.forEach(g => { 
                                    const val = parseFloat(String(g.value)); 
                                    if (!isNaN(val)) { 
                                        const weight = getEffectiveWeight(g); 
                                        wSum += val * weight; 
                                        wCount += weight; 
                                    } 
                                });
                                const avg = wCount > 0 ? (wSum / wCount).toFixed(2) : '-';
                                const avgNum = parseFloat(avg as string);
                                let avgColor = 'text-blue-600';
                                if (!isNaN(avgNum)) { 
                                    if (avgNum >= 4.5) avgColor = 'text-green-600'; 
                                    else if (avgNum >= 3.5) avgColor = 'text-blue-600'; 
                                    else if (avgNum >= 2.5) avgColor = 'text-amber-600'; 
                                    else avgColor = 'text-red-600'; 
                                }
                                return (
                                    <tr key={subj} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="p-4 text-left font-bold text-slate-700 sticky left-0 bg-white border-r border-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800">{subj}</td>
                                        {quarterDates.map(d => { 
                                            const g = currentGrades.find(gr => gr.date === d); 
                                            return (
                                                <td key={d} className="p-2 text-center border-r border-slate-50 dark:border-slate-800">
                                                    {g ? (
                                                        <div className="flex flex-col items-center cursor-pointer group" onClick={() => { setSelectedGradeDetails({grade: g, subject: subj}); playGradeSound(g.value); }}>
                                                            <span className={`font-bold ${H.getGradeColorClass(String(g.value), minGrade, maxGrade)}`}>{g.value}</span>
                                                            {useWeights && getEffectiveWeight(g) > 1 && <span className="text-[8px] text-slate-400">x{getEffectiveWeight(g)}</span>}
                                                        </div>
                                                    ) : <span className="text-slate-200">-</span>}
                                                </td>
                                            );
                                        })}
                                        <td className={`p-4 text-center font-bold bg-blue-50/30 ${avgColor} dark:bg-blue-900/10`}>{avg}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
             </div>

             <div className="pt-6">
                <div onClick={() => setIsFinalGradesOpen(!isFinalGradesOpen)} className="flex items-center gap-2 mb-4 cursor-pointer">
                    {isFinalGradesOpen ? <ChevronUp size={20} className="text-slate-500"/> : <ChevronDown size={20} className="text-slate-500"/>}
                    <h3 className="font-bold text-xl text-slate-800 dark:text-white">{t('final_grades')}</h3>
                </div>
                {isFinalGradesOpen && (
                    <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-sm dark:bg-slate-900 dark:border-slate-800 animate-in slide-in-from-top-2">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-center min-w-[600px]">
                                <thead className="bg-slate-100 text-slate-600 font-bold dark:bg-slate-800 dark:text-slate-300">
                                    <tr>
                                        <th className="p-4 text-left">{t('subject')}</th>
                                        <th className="p-4 text-slate-500 font-normal">1 {t('quarter')}</th>
                                        <th className="p-4 text-slate-500 font-normal">2 {t('quarter')}</th>
                                        <th className="p-4 text-slate-500 font-normal">3 {t('quarter')}</th>
                                        <th className="p-4 text-slate-500 font-normal">4 {t('quarter')}</th>
                                        <th className="p-4 bg-amber-50 text-amber-900 font-bold dark:bg-amber-900/20 dark:text-amber-400">{t('exam')}</th>
                                        <th className="p-4 bg-green-50 text-green-800 font-bold dark:bg-green-900/20 dark:text-green-400">{t('year')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                                    {subjects.map(s => {
                                        const entry = classFinalGrades[s]?.find(e => e.studentId === user.id) || {} as FinalGradeEntry;
                                        const showQ1 = entry.isQ1Confirmed ? entry.q1 : '—'; 
                                        const showQ2 = entry.isQ2Confirmed ? entry.q2 : '—'; 
                                        const showQ3 = entry.isQ3Confirmed ? entry.q3 : '—'; 
                                        const showQ4 = entry.isQ4Confirmed ? entry.q4 : '—'; 
                                        const showExam = entry.isExamConfirmed ? entry.exam : '—'; 
                                        const showYear = entry.isYearConfirmed ? entry.year : '—';
                                        return (
                                            <tr key={s} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="p-4 text-left font-bold text-slate-700 dark:text-slate-200">{s}</td>
                                                <td className="p-4 font-medium text-slate-600 dark:text-slate-400">{showQ1 || '—'}</td>
                                                <td className="p-4 font-medium text-slate-600 dark:text-slate-400">{showQ2 || '—'}</td>
                                                <td className="p-4 font-medium text-slate-600 dark:text-slate-400">{showQ3 || '—'}</td>
                                                <td className="p-4 font-medium text-slate-600 dark:text-slate-400">{showQ4 || '—'}</td>
                                                <td className="p-4 font-bold bg-amber-50/30 text-amber-700 dark:bg-amber-900/10 dark:text-amber-400">{showExam || '—'}</td>
                                                <td className="p-4 font-bold bg-green-50/30 text-green-700 dark:bg-green-900/10 dark:text-green-400">{showYear || '—'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
             </div>

             <Modal isOpen={!!selectedGradeDetails} onClose={() => setSelectedGradeDetails(null)} title={t('grade_details')}>
                {selectedGradeDetails && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="text-sm text-slate-500 uppercase font-bold tracking-wider mb-1">{t('subject')}</div>
                                <div className="text-xl font-bold text-slate-800 dark:text-white">{selectedGradeDetails.subject}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm text-slate-500 uppercase font-bold tracking-wider mb-1">{t('date')}</div>
                                <div className="font-mono bg-slate-100 px-2 py-1 rounded dark:bg-slate-800">{H.formatDateDDMMYYYY(selectedGradeDetails.grade.date)}</div>
                            </div>
                        </div>
                        <div className="flex items-center justify-center py-8">
                            <div className={`text-6xl font-bold ${H.getGradeColorClass(String(selectedGradeDetails.grade.value), minGrade, maxGrade)}`}>
                                {selectedGradeDetails.grade.value}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
                            <div>
                                <div className="text-xs font-bold text-slate-400 uppercase mb-1">{t('type_work')}</div>
                                <div className="font-semibold text-slate-700 dark:text-slate-200">{gradeTypes.find(t => t.key === selectedGradeDetails.grade.type)?.name || t('other')}</div>
                            </div>
                            {(!gradeTypes.find(t => t.key === selectedGradeDetails.grade.type)?.isNoWeight) && (
                                <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">{t('weight')}</div>
                                    <div className="font-semibold text-slate-700 dark:text-slate-200">x{getEffectiveWeight(selectedGradeDetails.grade)}</div>
                                </div>
                            )}
                        </div>
                        {selectedGradeDetails.grade.comment && (
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 dark:bg-blue-900/20 dark:border-blue-900/30">
                                <div className="text-xs font-bold text-blue-800 uppercase mb-2 dark:text-blue-300">{t('teacher_comment')}</div>
                                <p className="text-sm text-slate-700 dark:text-slate-300 italic">{selectedGradeDetails.grade.comment}</p>
                            </div>
                        )}
                        <div className="flex justify-end pt-2">
                            <Button onClick={() => setSelectedGradeDetails(null)} variant="secondary">{t('close')}</Button>
                        </div>
                    </div>
                )}
             </Modal>
        </div>
    );
};
