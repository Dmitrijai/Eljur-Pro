import React, { useState, useEffect, useMemo } from 'react';
import { AppState, User, Grade, FinalGradeEntry } from '../../types';
import * as H from '../../utils/helpers';
import { Button, Select, Modal, ScrollableTableWrapper } from '../../components/ui';
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
    
    const defaultStudentQuarter = useMemo(() => {
        if (scheduleSettings.quarterDefinitions) {
            const nowIso = H.dateToIso(H.getSchoolNow(state, user.schoolId));
            for (const [key, def] of Object.entries(scheduleSettings.quarterDefinitions)) {
               if (def.start && def.end && nowIso >= def.start && nowIso <= def.end) { 
                   return key; 
               }
            }
        }

        let maxDate = '';
        Object.values(classGrades || {}).forEach(grades => { 
            grades.forEach(g => { 
                if (g.studentId === user.id && g.date > maxDate) maxDate = g.date; 
            }); 
        });

        if (maxDate) { 
            if (scheduleSettings.quarterDefinitions) {
                for (const [key, def] of Object.entries(scheduleSettings.quarterDefinitions)) {
                   if (def.start && def.end && maxDate >= def.start && maxDate <= def.end) { 
                       return key; 
                   }
                }
            }
            return H.getQuarterFromDate(maxDate); 
        }
        
        return 'Q1';
    }, [user.id, user.schoolId, state.settings.systemTimeOffset, scheduleSettings.quarterDefinitions]);

    const [currentQuarter, setCurrentQuarter] = H.useSyncedState<string>(`eljur_st_grades_q_${user.id}`, defaultStudentQuarter);
    const [isFinalGradesOpen, setIsFinalGradesOpen] = H.useSyncedState<boolean>(`eljur_st_final_open_${user.id}`, false);
    const [printSection, setPrintSection] = useState<'current' | 'final'>('current');
    const [selectedGradeDetails, setSelectedGradeDetails] = useState<{grade: Grade, subject: string} | null>(null);

    const handlePrintCurrent = () => {
        setPrintSection('current');
        setTimeout(() => window.print(), 30);
    };

    const handlePrintFinal = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsFinalGradesOpen(true);
        setPrintSection('final');
        setTimeout(() => window.print(), 40);
    };

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

    const getEffectiveWeight = (g: Grade) => H.getEffectiveGradeWeight(g, gradeTypes, useWeights);
    const getTypeLabel = (typeKey?: string) => H.getGradeTypeDisplayName(typeKey, gradeTypes, lang);

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
        <div className="space-y-3 sm:space-y-6">
             <div className="hidden print:block p-3 mb-3 border-b-2 border-black text-center">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-600">{H.getSchool(state, user.schoolId)?.name || 'ЭлЖур'}</div>
                <div className="text-xl font-bold text-black mt-0.5">
                    {printSection === 'final' ? t('final_grades') : t('current_performance')} — {H.formatShortName(user.fio)} ({user.class}{user.letter})
                </div>
                <div className="text-xs text-slate-600 mt-1">
                    {printSection === 'final'
                        ? (classHeadmaster ? `${lang === 'ru' ? 'Классный руководитель' : 'Class Teacher'}: ${H.formatShortName(classHeadmaster.fio)}` : '')
                        : `${currentQuarter.replace('Q', '')} ${t('quarter')}${classHeadmaster ? ` • ${lang === 'ru' ? 'Классный руководитель' : 'Class Teacher'}: ${H.formatShortName(classHeadmaster.fio)}` : ''}`}
                </div>
             </div>
             <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs no-print">
                <div className="min-w-0">
                    <h3 className="font-bold text-sm sm:text-xl text-slate-800 dark:text-white leading-tight">{t('current_performance')}</h3>
                    <div className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                        {lang === 'ru' ? `Класс: ${user.class}${user.letter}` : `Class: ${user.class}${user.letter}`}
                        {classHeadmaster && (
                            <span className="ml-1.5 pl-1.5 border-l border-slate-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 font-medium">
                                {lang === 'ru' ? 'Клас. рук.: ' : 'Class Teacher: '}
                                <span className="font-bold">{H.formatShortName(classHeadmaster.fio)}</span>
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <Select value={currentQuarter} onChange={e => setCurrentQuarter(e.target.value)} className="w-20 sm:w-24 text-xs bg-white border-slate-300 shadow-xs">
                        <option value="Q1">1 {t('q_short')}</option>
                        <option value="Q2">2 {t('q_short')}</option>
                        <option value="Q3">3 {t('q_short')}</option>
                        <option value="Q4">4 {t('q_short')}</option>
                    </Select>
                    <Button variant="secondary" size="sm" onClick={handlePrintCurrent} className="w-auto px-2.5 py-1.5 text-xs">
                        <Printer size={14} className="sm:mr-1.5"/><span className="hidden sm:inline">{t('print')}</span>
                    </Button>
                </div>
             </div>

             {/* Mobile Subject Cards for Current Quarter (Compact, No horizontal scroll) */}
             <div className="md:hidden print:hidden space-y-2">
                {subjects.map(subj => {
                    const grades = classGrades[subj] || [];
                    const def = scheduleSettings.quarterDefinitions?.[currentQuarter];
                    const qStart = def?.start || '0000-00-00';
                    const qEnd = def?.end || '9999-99-99';
                    const currentGrades = grades
                        .filter(g => g.studentId === user.id && g.date >= qStart && g.date <= qEnd)
                        .sort((a, b) => a.date.localeCompare(b.date));
                    let wSum = 0, wCount = 0;
                    currentGrades.forEach(g => {
                        const val = H.getEffectiveGradeValue(g, minGrade, state.settings.systemTimeOffset);
                        if (val !== null && !isNaN(val)) {
                            const weight = getEffectiveWeight(g);
                            if (weight > 0) {
                                wSum += val * weight;
                                wCount += weight;
                            }
                        }
                    });
                    const avg = wCount > 0 ? (wSum / wCount).toFixed(2) : '-';
                    const avgColor = avg !== '-' ? H.getGradeColorClass(avg, minGrade, maxGrade) : 'text-slate-400';
                    return (
                        <div key={subj} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-xs space-y-1.5">
                            <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1">
                                <span className="font-bold text-xs text-slate-800 dark:text-white break-words">{subj}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">{t('avg_score')}:</span>
                                    <span className={`font-black text-xs sm:text-sm ${avgColor}`}>{avg}</span>
                                </div>
                            </div>
                            {currentGrades.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                    {currentGrades.map((g, gIdx) => {
                                        const isExpiredNU = H.isGradeExpiredNU(g, state.settings.systemTimeOffset);
                                        const typeName = getTypeLabel(g.type);
                                        const effWeight = getEffectiveWeight(g);
                                        return (
                                            <button
                                                key={g.id || gIdx}
                                                type="button"
                                                onClick={() => { setSelectedGradeDetails({ grade: g, subject: subj }); playGradeSound(isExpiredNU ? minGrade : g.value); }}
                                                className="flex flex-col items-center px-1.5 py-0.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 active:scale-95 transition"
                                            >
                                                <span className="text-[8px] font-mono text-slate-400 leading-none">{H.formatDateDDMMYYYY(g.date).slice(0, 5)}</span>
                                                <span className={`text-xs font-black leading-tight mt-0.5 ${isExpiredNU ? 'text-red-600' : H.getGradeColorClass(String(g.value), minGrade, maxGrade)}`}>
                                                    {isExpiredNU ? `${minGrade} (Н/У)` : g.value}
                                                </span>
                                                {(typeName || (useWeights && effWeight > 1)) && (
                                                    <span className="text-[8px] text-slate-500 dark:text-slate-400 font-bold leading-none">
                                                        {typeName}{useWeights && effWeight > 1 ? ` ×${effWeight}` : ''}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-[11px] text-slate-400 italic">—</div>
                            )}
                        </div>
                    );
                })}
             </div>

             {/* Desktop & Print Matrix Table */}
             <div className={`hidden md:block ${printSection === 'current' ? 'print:block' : 'print:hidden'}`}>
                <ScrollableTableWrapper lang={lang} maxHeightClass="max-h-none !overflow-y-visible">
                    <table className="w-full text-sm min-w-[800px] print:min-w-0">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                            <tr>
                                <th className="p-3.5 print:p-1 text-left font-bold w-48 print:w-auto sticky top-0 left-0 bg-slate-50 z-30 border-r border-slate-200 dark:bg-slate-800 dark:border-slate-700">{t('subject')}</th>
                                {quarterDates.map(d => (
                                    <th key={d} className="p-2 print:p-0.5 min-w-[54px] print:min-w-0 print:w-auto text-center sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 border-r border-slate-100 dark:border-slate-700 font-normal text-xs print:text-[7pt] text-slate-500 whitespace-nowrap">
                                        {H.formatDateDDMMYYYY(d).slice(0,5)}
                                    </th>
                                ))}
                                <th className="p-3.5 print:p-1 text-center font-bold sticky top-0 z-20 bg-blue-50 text-blue-800 min-w-[80px] print:min-w-0 print:w-auto dark:bg-blue-950 dark:text-blue-300">{t('avg_score')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {subjects.map(subj => {
                                const grades = classGrades[subj] || [];
                                const def = scheduleSettings.quarterDefinitions?.[currentQuarter];
                                const qStart = def?.start || '0000-00-00';
                                const qEnd = def?.end || '9999-99-99';
                                const currentGrades = grades.filter(g => g.studentId === user.id && g.date >= qStart && g.date <= qEnd);
                                let wSum = 0, wCount = 0;
                                currentGrades.forEach(g => { 
                                    const val = H.getEffectiveGradeValue(g, minGrade, state.settings.systemTimeOffset); 
                                    if (val !== null && !isNaN(val)) { 
                                        const weight = getEffectiveWeight(g); 
                                        if (weight > 0) {
                                            wSum += val * weight; 
                                            wCount += weight; 
                                        }
                                    } 
                                });
                                const avg = wCount > 0 ? (wSum / wCount).toFixed(2) : '-';
                                const avgColor = avg !== '-' ? H.getGradeColorClass(avg, minGrade, maxGrade) : 'text-slate-400';
                                return (
                                    <tr key={subj} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="p-3.5 print:p-1 text-left font-bold text-slate-700 sticky left-0 z-10 bg-white border-r border-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800">{subj}</td>
                                        {quarterDates.map(d => { 
                                            const dayGrades = currentGrades.filter(gr => gr.date === d); 
                                            return (
                                                <td key={d} className="p-2 print:p-0.5 text-center border-r border-slate-50 dark:border-slate-800">
                                                    {dayGrades.length > 0 ? (
                                                        <div className="flex flex-wrap items-center justify-center gap-2 print:gap-0.5">
                                                            {dayGrades.map((g, gIdx) => {
                                                                const isExpiredNU = H.isGradeExpiredNU(g, state.settings.systemTimeOffset);
                                                                const effWeight = getEffectiveWeight(g);
                                                                return (
                                                                <div key={g.id || gIdx} className="inline-flex items-baseline gap-0.5 cursor-pointer group hover:scale-110 transition-transform" onClick={() => { setSelectedGradeDetails({grade: g, subject: subj}); playGradeSound(isExpiredNU ? minGrade : g.value); }}>
                                                                    <span className={`font-bold ${isExpiredNU ? 'text-red-600' : H.getGradeColorClass(String(g.value), minGrade, maxGrade)}`} title={isExpiredNU ? `${t('deadline_expired_msg')} (${minGrade})` : undefined}>{isExpiredNU ? `${minGrade} (Н/У)` : g.value}</span>
                                                                    {useWeights && effWeight >= 1 && <span className="text-[10px] print:text-[6.5pt] text-slate-400 font-medium leading-none">×{effWeight}</span>}
                                                                </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : <span className="text-slate-200 dark:text-slate-700 print:hidden">-</span>}
                                                </td>
                                            );
                                        })}
                                        <td className={`p-3.5 print:p-1 text-center font-bold bg-blue-50/30 ${avgColor} dark:bg-blue-900/10`}>{avg}</td>
                                    </tr>
                                );
                            })}
                            {quarterDates.length === 0 && (
                                <tr>
                                    <td colSpan={2} className="p-8 text-center text-slate-400 italic">
                                        {lang === 'ru' ? 'В выбранной четверти пока нет выставленных оценок.' : 'No grades recorded for the selected quarter yet.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </ScrollableTableWrapper>
             </div>

             <div className="pt-2 sm:pt-4">
                <div className="flex items-center justify-between gap-2 mb-3 no-print">
                    <div onClick={() => setIsFinalGradesOpen(!isFinalGradesOpen)} className="flex items-center gap-2 cursor-pointer">
                        {isFinalGradesOpen ? <ChevronUp size={18} className="text-slate-500"/> : <ChevronDown size={18} className="text-slate-500"/>}
                        <h3 className="font-bold text-sm sm:text-xl text-slate-800 dark:text-white">{t('final_grades')}</h3>
                    </div>
                    <Button variant="secondary" size="sm" onClick={handlePrintFinal} className="w-auto px-2.5 py-1.5 text-xs">
                        <Printer size={14} className="sm:mr-1.5"/><span className="hidden sm:inline">{t('print')}</span>
                    </Button>
                </div>
                {(isFinalGradesOpen || printSection === 'final') && (
                    <>
                        {/* Mobile Final Grades Cards */}
                        {isFinalGradesOpen && (
                        <div className="md:hidden print:hidden space-y-2 animate-in slide-in-from-top-2">
                            {subjects.map(s => {
                                const entry = classFinalGrades[s]?.find(e => e.studentId === user.id) || {} as FinalGradeEntry;
                                const showQ1 = entry.isQ1Confirmed ? entry.q1 : '—'; 
                                const showQ2 = entry.isQ2Confirmed ? entry.q2 : '—'; 
                                const showQ3 = entry.isQ3Confirmed ? entry.q3 : '—'; 
                                const showQ4 = entry.isQ4Confirmed ? entry.q4 : '—'; 
                                const showExam = entry.isExamConfirmed ? entry.exam : '—'; 
                                const showYear = entry.isYearConfirmed ? entry.year : '—';
                                return (
                                    <div key={s} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-bold text-xs text-slate-800 dark:text-slate-100">{s}</span>
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold dark:bg-amber-950/50 dark:text-amber-300">
                                                    {t('exam')}: {showExam || '—'}
                                                </span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-bold dark:bg-green-950/50 dark:text-green-300">
                                                    {t('year')}: {showYear || '—'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-4 gap-1 text-center text-[11px]">
                                            {[
                                                { label: '1 ч.', val: showQ1 },
                                                { label: '2 ч.', val: showQ2 },
                                                { label: '3 ч.', val: showQ3 },
                                                { label: '4 ч.', val: showQ4 }
                                            ].map((qItem, idx) => (
                                                <div key={idx} className="p-1 rounded-lg bg-slate-50 dark:bg-slate-800">
                                                    <div className="text-[9px] text-slate-400 font-bold">{qItem.label}</div>
                                                    <div className="font-bold text-slate-700 dark:text-slate-200">{qItem.val || '—'}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        )}
                        {/* Desktop & Print Final Grades Table */}
                        <div className={`${isFinalGradesOpen ? 'hidden md:block' : 'hidden'} ${printSection === 'final' ? 'print:block' : 'print:hidden'} bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden print:overflow-visible shadow-sm dark:bg-slate-900 dark:border-slate-800 animate-in slide-in-from-top-2`}>
                            <div className="overflow-x-auto print:overflow-visible">
                                <table className="w-full text-sm text-center min-w-[600px] print:min-w-0">
                                    <thead className="bg-slate-100 text-slate-600 font-bold dark:bg-slate-800 dark:text-slate-300">
                                        <tr>
                                            <th className="p-3.5 print:p-1.5 text-left">{t('subject')}</th>
                                            <th className="p-3.5 print:p-1.5 text-slate-500 font-normal">1 {t('quarter')}</th>
                                            <th className="p-3.5 print:p-1.5 text-slate-500 font-normal">2 {t('quarter')}</th>
                                            <th className="p-3.5 print:p-1.5 text-slate-500 font-normal">3 {t('quarter')}</th>
                                            <th className="p-3.5 print:p-1.5 text-slate-500 font-normal">4 {t('quarter')}</th>
                                            <th className="p-3.5 print:p-1.5 bg-amber-50 text-amber-900 font-bold dark:bg-amber-900/20 dark:text-amber-400">{t('exam')}</th>
                                            <th className="p-3.5 print:p-1.5 bg-green-50 text-green-800 font-bold dark:bg-green-900/20 dark:text-green-400">{t('year')}</th>
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
                                                    <td className="p-3.5 print:p-1.5 text-left font-bold text-slate-700 dark:text-slate-200">{s}</td>
                                                    <td className="p-3.5 print:p-1.5 font-medium text-slate-600 dark:text-slate-400">{showQ1 || '—'}</td>
                                                    <td className="p-3.5 print:p-1.5 font-medium text-slate-600 dark:text-slate-400">{showQ2 || '—'}</td>
                                                    <td className="p-3.5 print:p-1.5 font-medium text-slate-600 dark:text-slate-400">{showQ3 || '—'}</td>
                                                    <td className="p-3.5 print:p-1.5 font-medium text-slate-600 dark:text-slate-400">{showQ4 || '—'}</td>
                                                    <td className="p-3.5 print:p-1.5 font-bold bg-amber-50/30 text-amber-700 dark:bg-amber-900/10 dark:text-amber-400">{showExam || '—'}</td>
                                                    <td className="p-3.5 print:p-1.5 font-bold bg-green-50/30 text-green-700 dark:bg-green-900/10 dark:text-green-400">{showYear || '—'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
             </div>

             <Modal isOpen={!!selectedGradeDetails} onClose={() => setSelectedGradeDetails(null)} title={t('grade_details')}>
                {selectedGradeDetails && (
                    <div className="space-y-3 sm:space-y-5">
                        <div className="flex justify-between items-start gap-2">
                            <div>
                                <div className="text-[10px] sm:text-xs text-slate-500 uppercase font-bold tracking-wider mb-0.5 sm:mb-1">{t('subject')}</div>
                                <div className="text-sm sm:text-lg font-bold text-slate-800 dark:text-white">{selectedGradeDetails.subject}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] sm:text-xs text-slate-500 uppercase font-bold tracking-wider mb-0.5 sm:mb-1">{t('date')}</div>
                                <div className="font-mono text-[11px] sm:text-xs bg-slate-100 px-2 py-0.5 sm:py-1 rounded dark:bg-slate-800">{H.formatDateDDMMYYYY(selectedGradeDetails.grade.date)}</div>
                            </div>
                        </div>
                        <div className="flex items-center justify-center py-2.5 sm:py-6">
                            <div className={`text-3xl sm:text-5xl font-bold ${H.getGradeColorClass(String(selectedGradeDetails.grade.value), minGrade, maxGrade)}`}>
                                {selectedGradeDetails.grade.value}
                            </div>
                        </div>
                        {selectedGradeDetails.grade.value === 'Н/У' && (() => {
                            const deadlineIso = H.getNUDeadlineIso(selectedGradeDetails.grade);
                            const isExpired = H.isGradeExpiredNU(selectedGradeDetails.grade, state.settings.systemTimeOffset);
                            return (
                                <div className={`p-2 sm:p-3 rounded-xl border text-[11px] sm:text-xs font-medium text-center ${
                                    isExpired
                                        ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
                                }`}>
                                    {isExpired
                                        ? `${t('deadline_expired_msg')} (${H.formatDateDDMMYYYY(deadlineIso)}): ${minGrade}.`
                                        : `${t('deadline_until_msg')} ${H.formatDateDDMMYYYY(deadlineIso)}`}
                                </div>
                            );
                        })()}
                        <div className="grid grid-cols-2 gap-2 sm:gap-3 bg-slate-50 p-2.5 sm:p-3.5 rounded-xl border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
                            <div>
                                <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase mb-0.5 sm:mb-1">{t('type_work')}</div>
                                <div className="font-semibold text-xs sm:text-sm text-slate-700 dark:text-slate-200">{getTypeLabel(selectedGradeDetails.grade.type) || t('other')}</div>
                            </div>
                            {getEffectiveWeight(selectedGradeDetails.grade) > 0 && (
                                <div>
                                    <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase mb-0.5 sm:mb-1">{t('weight')}</div>
                                    <div className="font-semibold text-xs sm:text-sm text-slate-700 dark:text-slate-200">×{getEffectiveWeight(selectedGradeDetails.grade)}</div>
                                </div>
                            )}
                        </div>
                        {selectedGradeDetails.grade.comment && (
                            <div className="bg-blue-50 p-2.5 sm:p-3.5 rounded-xl border border-blue-100 dark:bg-blue-900/20 dark:border-blue-900/30">
                                <div className="text-[10px] sm:text-xs font-bold text-blue-800 uppercase mb-1 dark:text-blue-300">{t('teacher_comment')}</div>
                                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 italic whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{selectedGradeDetails.grade.comment}</p>
                            </div>
                        )}
                        <div className="flex justify-end pt-1">
                            <Button onClick={() => setSelectedGradeDetails(null)} variant="secondary" size="sm">{t('close')}</Button>
                        </div>
                    </div>
                )}
             </Modal>
        </div>
    );
};
