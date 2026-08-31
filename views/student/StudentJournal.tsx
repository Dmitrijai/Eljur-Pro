
import React, { useState, useEffect } from 'react';
import { AppState, User, Grade } from '../../types';
import * as H from '../../utils/helpers';
import { Button, FileDisplay, Modal } from '../../components/ui';
import { ChevronLeft, ChevronRight, Calendar, Printer } from 'lucide-react';

export const StudentJournal = ({ state, user }: { state: AppState, user: User }) => {
    const classKey = `${user.class}_${user.letter}`;
    const schedule = H.getSchoolClassSchedule(state, user.schoolId, classKey);
    const lang = state.settings.language || 'ru';
    const t = (k: string) => H.t(k, lang);
    const gradingSystem = H.getSchoolGradingSystem(state, user.schoolId);
    const minGrade = gradingSystem?.minGrade ?? 2;
    const maxGrade = gradingSystem?.maxGrade ?? 5;
    const useWeights = gradingSystem?.useWeights ?? true;
    const gradeTypes = H.getSchoolGradeTypes(state, user.schoolId);
    const scheduleSettings = H.getSchoolScheduleSettings(state, user.schoolId);
    
    const systemNow = new Date(Date.now() + (state.settings.systemTimeOffset || 0));
    const [journalWeekStart, setJournalWeekStart] = useState<Date>(H.getStartOfWeek(systemNow));
    const journalDays = Object.values(schedule).filter(d => H.isDateInWeek(d.date, journalWeekStart)).sort((a,b) => a.date.localeCompare(b.date));
    const [selectedGradeDetails, setSelectedGradeDetails] = useState<{grade: Grade, subject: string} | null>(null);

    useEffect(() => { setJournalWeekStart(H.getStartOfWeek(new Date(Date.now() + (state.settings.systemTimeOffset || 0)))); }, [state.settings.systemTimeOffset]);
    const goPrevJournalWeek = () => setJournalWeekStart(d => H.addDays(d, -7));
    const goNextJournalWeek = () => setJournalWeekStart(d => H.addDays(d, 7));
    const goCurrentJournalWeek = () => setJournalWeekStart(H.getStartOfWeek(new Date(Date.now() + (state.settings.systemTimeOffset || 0))));
    
    const journalDates = journalDays.map(d => d.date);
    const journalVacation = H.getVacationForWeek(journalWeekStart, scheduleSettings, journalDates);

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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-2 rounded-2xl border border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-800 no-print">
               <h3 className="font-bold text-xl text-slate-800 dark:text-white ml-2">{t('diary')}</h3>
               <div className="flex items-center gap-4 bg-slate-50 p-1 rounded-xl border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                   <Button variant="ghost" onClick={goPrevJournalWeek} className="px-3 h-8"><ChevronLeft size={18}/></Button>
                   <div className="text-center px-2">
                      <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{t('week')}</div>
                      <div className="font-bold text-slate-700 dark:text-white text-sm whitespace-nowrap">{H.getWeekRangeString(journalWeekStart)}</div>
                   </div>
                   <Button variant="ghost" onClick={goNextJournalWeek} className="px-3 h-8"><ChevronRight size={18}/></Button>
               </div>
               <div className="flex gap-2">
                 <Button variant="ghost" onClick={goCurrentJournalWeek} size="sm"><Calendar size={16} className="mr-2"/> {t('current')}</Button>
                 <Button variant="secondary" onClick={() => window.print()} size="sm"><Printer size={16} className="mr-2"/> {t('print')}</Button>
               </div>
            </div>
            {journalVacation && journalVacation.isFullWeek && (<div className="bg-green-100 text-green-800 text-center py-4 rounded-2xl font-bold border border-green-200 uppercase tracking-widest shadow-sm text-lg dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">{journalVacation.emoji} {journalVacation.title} ({journalVacation.range}) {journalVacation.emoji}</div>)}
            {journalDays.length === 0 && <p className="text-center text-slate-400 py-10 border-2 border-dashed border-slate-200 rounded-2xl dark:border-slate-800">{t('no_schedule')}</p>}
            <div className="space-y-6">
              {journalDays.map(day => {
                  const dayDate = day.date;
                  const holidayInfo = H.isHoliday(dayDate, scheduleSettings);
                  const vacForDay = H.getVacationForDay(dayDate, scheduleSettings);
                  const isVacationDay = !!vacForDay;
                  const isHolidayDay = !!holidayInfo;
                  let headerClass = 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200';
                  if (isHolidayDay) headerClass = 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-300';
                  else if (isVacationDay) headerClass = 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-900/30 dark:text-green-300';
                  return (
                      <div key={day.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800">
                         <div className={`px-6 py-4 border-b flex justify-between items-center ${headerClass}`}><div className="font-bold flex items-center gap-2 text-lg">{day.title} <span className="text-slate-400 font-normal">{H.formatDateDDMMYYYY(day.date)}</span>{(isHolidayDay || isVacationDay) && <span className="text-xs uppercase px-2 py-0.5 rounded bg-white/50 border border-black/5 ml-2 font-bold">{holidayInfo ? holidayInfo.title : vacForDay?.title}</span>}</div></div>
                         <div className="overflow-x-auto">
                           <table className="w-full text-sm min-w-[500px]"><thead className="bg-white border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider dark:bg-slate-900 dark:border-slate-800 dark:text-slate-500"><tr><th className="p-4 w-32 text-center border-r border-slate-100 dark:border-slate-800">{t('time')}</th><th className="p-4 w-1/4 text-center border-r border-slate-100 dark:border-slate-800">{t('subject')}</th><th className="p-4 text-center border-r border-slate-100 dark:border-slate-800">{t('homework')}</th><th className="p-4 w-24 text-center">{t('grade')}</th></tr></thead>
                               <tbody className="divide-y divide-slate-50 dark:divide-slate-800">{
                                   (() => {
                                       const subjectCounts: Record<string, number> = {};
                                       const totalSubjectOccurrences: Record<string, number> = {};
                                       day.lessons.forEach(l => {
                                           let sub = l.lesson; 
                                           if (l.subgroups && l.subgroups.length > 0) { 
                                               const studentGroup = state.studentGroups.find(g => g.classId === classKey && g.studentIds.includes(user.id)); 
                                               if (studentGroup) { 
                                                   const sg = l.subgroups.find(s => s.groupId === studentGroup.id); 
                                                   if (sg) sub = sg.subject;
                                               } 
                                           }
                                           if (!totalSubjectOccurrences[sub]) totalSubjectOccurrences[sub] = 0;
                                           totalSubjectOccurrences[sub]++;
                                       });

                                       return day.lessons.map((l, index) => {
                                           let subject = l.lesson; let teacherLabel = l.teacherLabel; let isHidden = false;
                                           if (l.subgroups && l.subgroups.length > 0) { const studentGroup = state.studentGroups.find(g => g.classId === classKey && g.studentIds.includes(user.id)); if (studentGroup) { const sg = l.subgroups.find(s => s.groupId === studentGroup.id); if (sg) { subject = sg.subject; teacherLabel = sg.teacherLabel; } else { isHidden = true; } } else { isHidden = true; } }
                                           if (isHidden) return null;
                                           
                                           // Calculate subject occurrence index to match with Gradebook's lessonIndex
                                           if (!subjectCounts[subject]) subjectCounts[subject] = 0;
                                           const subjIndex = subjectCounts[subject]++;
                                           
                                           const hwList = H.getSchoolHomework(state, user.schoolId, classKey).filter(h => { if (h.subject !== subject) return false; if (h.date !== day.date) return false; if ((h.lessonIndex || 0) > 0 && h.lessonIndex !== subjIndex) return false; return true; });
                                           const allClassGrades = H.getSchoolClassGrades(state, user.schoolId, classKey);
                                           const grades = (allClassGrades[subject] || []).filter(g => {
                                               if (g.studentId !== user.id || g.date !== day.date) return false;
                                               const isLast = subjIndex === (totalSubjectOccurrences[subject] - 1);
                                               const gIndex = g.lessonIndex || 0;
                                               if (gIndex === subjIndex) return true;
                                               if (isLast && gIndex > subjIndex) return true;
                                               return false;
                                           });
                                           return (<tr key={l.id} className="hover:bg-slate-50 transition-colors dark:hover:bg-slate-800/30"><td className="p-4 font-mono text-xs text-slate-500 text-center border-r border-slate-50 dark:text-slate-400 dark:border-slate-800">{l.timeRange}</td><td className="p-4 font-bold text-slate-800 text-center border-r border-slate-50 dark:text-white dark:border-slate-800">{subject}{teacherLabel && <div className="text-[10px] text-amber-600 mt-1 font-normal">({teacherLabel})</div>}</td><td className="p-4 text-center text-slate-600 border-r border-slate-50 dark:text-slate-300 dark:border-slate-800">{hwList.length > 0 ? (<div className="space-y-2">{hwList.map(h => (<div key={h.id}>{h.text}{((h.attachments && h.attachments.length > 0) || h.attachmentId) && (<div className="mt-2 flex flex-col items-center gap-1">{h.attachmentId && <FileDisplay id={h.attachmentId} name={h.attachmentName} lang={lang as 'ru'|'en'} />}{(h.attachments || []).map(att => (<FileDisplay key={att.id} id={att.id} name={att.name} lang={lang as 'ru'|'en'} />))}</div>)}</div>))}</div>) : <span className="text-slate-300">-</span>}</td><td className="p-4 text-center align-middle">{grades.length > 0 ? (<div className="flex flex-col items-center gap-1">{grades.map(g => (<div key={g.id} className="cursor-pointer group" onClick={() => { setSelectedGradeDetails({grade: g, subject}); playGradeSound(g.value); }}><div className={`text-xl font-bold ${H.getGradeColorClass(String(g.value), minGrade, maxGrade)}`}>{g.value}</div>{g.type && (<div className="text-[9px] bg-slate-100 text-slate-500 px-1 rounded uppercase font-bold dark:bg-slate-800">{gradeTypes.find(t => t.key === g.type)?.name} {useWeights && getEffectiveWeight(g) > 1 && `X${getEffectiveWeight(g)}`}</div>)}</div>))}</div>) : <span className="text-slate-200">-</span>}</td></tr>);
                                       });
                                   })()
                               }
                               {day.lessons.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-400 italic">Нет уроков</td></tr>}
                               </tbody>
                           </table>
                         </div>
                      </div>
                  )
              })}
            </div>
            <Modal isOpen={!!selectedGradeDetails} onClose={() => setSelectedGradeDetails(null)} title={t('grade_details')}>{selectedGradeDetails && (<div className="space-y-6"><div className="flex justify-between items-start"><div><div className="text-sm text-slate-500 uppercase font-bold tracking-wider mb-1">{t('subject')}</div><div className="text-xl font-bold text-slate-800 dark:text-white">{selectedGradeDetails.subject}</div></div><div className="text-right"><div className="text-sm text-slate-500 uppercase font-bold tracking-wider mb-1">{t('date')}</div><div className="font-mono bg-slate-100 px-2 py-1 rounded dark:bg-slate-800">{H.formatDateDDMMYYYY(selectedGradeDetails.grade.date)}</div></div></div><div className="flex items-center justify-center py-8"><div className={`text-6xl font-bold ${H.getGradeColorClass(String(selectedGradeDetails.grade.value), minGrade, maxGrade)}`}>{selectedGradeDetails.grade.value}</div></div><div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 dark:bg-slate-800 dark:border-slate-700"><div><div className="text-xs font-bold text-slate-400 uppercase mb-1">{t('type_work')}</div><div className="font-semibold text-slate-700 dark:text-slate-200">{gradeTypes.find(t => t.key === selectedGradeDetails.grade.type)?.name || t('other')}</div></div>{(!gradeTypes.find(t=>t.key===selectedGradeDetails.grade.type)?.isNoWeight) && (<div><div className="text-xs font-bold text-slate-400 uppercase mb-1">{t('weight')}</div><div className="font-semibold text-slate-700 dark:text-slate-200">x{getEffectiveWeight(selectedGradeDetails.grade)}</div></div>)}</div>{selectedGradeDetails.grade.comment && (<div className="bg-blue-50 p-4 rounded-xl border border-blue-100 dark:bg-blue-900/20 dark:border-blue-900/30"><div className="text-xs font-bold text-blue-800 uppercase mb-2 dark:text-blue-300">{t('teacher_comment')}</div><p className="text-sm text-slate-700 dark:text-slate-300 italic">{selectedGradeDetails.grade.comment}</p></div>)}<div className="flex justify-end pt-2"><Button onClick={() => setSelectedGradeDetails(null)} variant="secondary">{t('close')}</Button></div></div>)}</Modal>
        </div>
    );
};
