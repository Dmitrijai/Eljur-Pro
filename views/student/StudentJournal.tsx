import React, { useState, useEffect, useRef } from 'react';
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
    const defaultWeekIso = H.dateToIso(H.getStartOfWeek(systemNow));
    const [journalWeekIso, setJournalWeekIso] = H.useSyncedState<string>(`eljur_st_journal_week_${user.id}`, defaultWeekIso);
    const journalWeekStart = new Date(journalWeekIso || defaultWeekIso);
    const journalDays = Object.values(schedule).filter(d => H.isDateInWeek(d.date, journalWeekStart)).sort((a,b) => a.date.localeCompare(b.date));
    const [selectedGradeDetails, setSelectedGradeDetails] = useState<{grade: Grade, subject: string} | null>(null);

    const goPrevJournalWeek = () => setJournalWeekIso(H.dateToIso(H.addDays(journalWeekStart, -7)));
    const goNextJournalWeek = () => setJournalWeekIso(H.dateToIso(H.addDays(journalWeekStart, 7)));
    const goCurrentJournalWeek = () => setJournalWeekIso(H.dateToIso(H.getStartOfWeek(new Date(Date.now() + (state.settings.systemTimeOffset || 0)))));

    const touchStartRef = useRef<{ x: number; y: number } | null>(null);
    const handleTouchStart = (e: React.TouchEvent) => {
        if (typeof window !== 'undefined' && window.innerWidth >= 768) return;
        const target = e.target as HTMLElement | null;
        if (target?.closest('input, textarea, select, button, [data-no-swipe]')) {
            touchStartRef.current = null;
            return;
        }
        if (e.touches.length === 1) {
            touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStartRef.current || e.changedTouches.length === 0) return;
        const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
        const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
        touchStartRef.current = null;
        if (Math.abs(dx) >= 55 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            if (dx > 0) goPrevJournalWeek();
            else goNextJournalWeek();
        }
    };
    
    const journalDates = journalDays.map(d => d.date);
    const journalVacation = H.getVacationForWeek(journalWeekStart, scheduleSettings, journalDates);

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

    return (
        <div className="space-y-3 sm:space-y-6" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            <div className="hidden print:block p-3 mb-3 border-b-2 border-black text-center">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-600">{H.getSchool(state, user.schoolId)?.name || 'ЭлЖур'}</div>
                <div className="text-xl font-bold text-black mt-0.5">{t('diary')} — {user.fio} ({user.class}{user.letter})</div>
                <div className="text-xs text-slate-600 mt-1">{t('week')}: {H.getWeekRangeString(journalWeekStart)}</div>
            </div>
            <div className="flex flex-wrap justify-between items-center gap-2 bg-white p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs dark:bg-slate-900 dark:border-slate-800 no-print">
               <h3 className="font-bold text-sm sm:text-xl text-slate-800 dark:text-white sm:ml-1">{t('diary')}</h3>
               <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                 <Button variant="ghost" onClick={goCurrentJournalWeek} size="sm" className="px-2 py-1 text-xs h-7 sm:h-8"><Calendar size={14} className="mr-1"/> {t('current')}</Button>
                 <Button variant="secondary" onClick={() => window.print()} size="sm" className="px-2 py-1 text-xs h-7 sm:h-8"><Printer size={14} className="sm:mr-1.5"/><span className="hidden sm:inline">{t('print')}</span></Button>
               </div>
               <div className="flex items-center justify-between w-full sm:w-auto gap-2 bg-slate-50 p-0.5 sm:p-1 rounded-lg sm:rounded-xl border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                   <Button variant="ghost" onClick={goPrevJournalWeek} className="px-2 h-7 sm:h-8"><ChevronLeft size={16}/></Button>
                   <div className="text-center px-1.5">
                      <div className="font-bold text-slate-700 dark:text-white text-xs sm:text-sm whitespace-nowrap">{H.getWeekRangeString(journalWeekStart)}</div>
                   </div>
                   <Button variant="ghost" onClick={goNextJournalWeek} className="px-2 h-7 sm:h-8"><ChevronRight size={16}/></Button>
               </div>
            </div>
            {journalVacation && journalVacation.isFullWeek && (<div className="bg-green-100 text-green-800 text-center py-2.5 sm:py-4 rounded-xl sm:rounded-2xl font-bold border border-green-200 uppercase tracking-widest shadow-xs text-xs sm:text-lg dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">{journalVacation.emoji} {journalVacation.title} ({journalVacation.range}) {journalVacation.emoji}</div>)}
            {journalDays.length === 0 && <p className="text-center text-slate-400 py-8 border-2 border-dashed border-slate-200 rounded-2xl text-xs sm:text-sm dark:border-slate-800">{t('no_schedule')}</p>}
            <div className="space-y-3 sm:space-y-6">
              {journalDays.map(day => {
                  const dayDate = day.date;
                  const holidayInfo = H.isHoliday(dayDate, scheduleSettings);
                  const vacForDay = H.getVacationForDay(dayDate, scheduleSettings);
                  const isVacationDay = !!vacForDay;
                  const isHolidayDay = !!holidayInfo;
                  let headerClass = 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200';
                  if (isHolidayDay) headerClass = 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-300';
                  else if (isVacationDay) headerClass = 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-900/30 dark:text-green-300';
                  const resolvedLessons = (() => {
                      const subjectCounts: Record<string, number> = {};
                      const totalSubjectOccurrences: Record<string, number> = {};
                      day.lessons.forEach(l => {
                          let sub = l.lesson;
                          if (l.subgroups && l.subgroups.length > 0) {
                              const studentGroup = H.getSchoolStudentGroups(state, user.schoolId, classKey).find(g => g.studentIds.includes(user.id));
                              if (studentGroup) {
                                  const sg = l.subgroups.find(s => s.groupId === studentGroup.id);
                                  if (sg) sub = sg.subject;
                              }
                          }
                          if (!totalSubjectOccurrences[sub]) totalSubjectOccurrences[sub] = 0;
                          totalSubjectOccurrences[sub]++;
                      });

                      return day.lessons.map((l, idx) => {
                          let subject = l.lesson;
                          let teacherLabel = l.teacherLabel;
                          if (l.subgroups && l.subgroups.length > 0) {
                              const studentGroup = H.getSchoolStudentGroups(state, user.schoolId, classKey).find(g => g.studentIds.includes(user.id));
                              if (studentGroup) {
                                  const sg = l.subgroups.find(s => s.groupId === studentGroup.id);
                                  if (sg) {
                                      subject = sg.subject;
                                      teacherLabel = sg.teacherLabel;
                                  } else {
                                      teacherLabel = t('unassigned_subgroup');
                                  }
                              } else {
                                  teacherLabel = t('unassigned_subgroup');
                              }
                          }
                          if (!subjectCounts[subject]) subjectCounts[subject] = 0;
                          const subjIndex = subjectCounts[subject]++;
                          const hwList = H.getSchoolHomework(state, user.schoolId, classKey).filter(h => {
                              if (h.subject !== subject) return false;
                              if (h.date !== day.date) return false;
                              if ((h.lessonIndex || 0) > 0 && h.lessonIndex !== subjIndex) return false;
                              return true;
                          });
                          const allClassGrades = H.getSchoolClassGrades(state, user.schoolId, classKey);
                          const grades = (allClassGrades[subject] || []).filter(g => {
                              if (g.studentId !== user.id || g.date !== day.date) return false;
                              const isLast = subjIndex === (totalSubjectOccurrences[subject] - 1);
                              const gIndex = g.lessonIndex || 0;
                              if (gIndex === subjIndex) return true;
                              if (isLast && gIndex > subjIndex) return true;
                              return false;
                          });
                          return { l, idx, subject, teacherLabel, hwList, grades };
                      });
                  })();

                  return (
                      <div key={day.id} className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl shadow-xs overflow-hidden break-inside-avoid dark:bg-slate-900 dark:border-slate-800">
                         <div className={`px-3 sm:px-6 py-2 sm:py-3.5 border-b flex justify-between items-center ${headerClass}`}><div className="font-bold flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-base">{day.title || H.getDayOfWeek(day.date, lang as 'ru' | 'en')} <span className="text-slate-400 font-normal text-xs sm:text-sm">{H.formatDateDDMMYYYY(day.date)}</span>{(isHolidayDay || isVacationDay) && <span className="text-[10px] sm:text-xs uppercase px-1.5 py-0.5 rounded bg-white/50 border border-black/5 font-bold">{holidayInfo ? holidayInfo.title : vacForDay?.title}</span>}</div></div>
                         
                         {/* Mobile Card Layout (Compact, No horizontal scroll) */}
                         <div className="md:hidden print:hidden divide-y divide-slate-100 dark:divide-slate-800">
                           {resolvedLessons.map(({ l, idx, subject, teacherLabel, hwList, grades }) => (
                             <div key={l.id} className="p-2.5 space-y-1.5">
                               <div className="flex items-start justify-between gap-2">
                                 <div className="min-w-0 flex-1">
                                   <div className="flex items-center gap-1.5 mb-0.5">
                                     <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-[10px] font-bold shrink-0">{idx + 1}</span>
                                     <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">{l.timeRange}</span>
                                   </div>
                                   <div className="font-bold text-xs text-slate-800 dark:text-white break-words leading-snug">
                                     {subject}
                                     {teacherLabel && <span className="text-[10px] text-amber-600 font-normal ml-1">({teacherLabel})</span>}
                                   </div>
                                 </div>
                                 {grades.length > 0 && (
                                   <div className="flex flex-wrap items-center gap-1 shrink-0">
                                     {grades.map(g => {
                                       const isExpiredNU = H.isGradeExpiredNU(g, state.settings.systemTimeOffset);
                                       const typeName = getTypeLabel(g.type);
                                       const effWeight = getEffectiveWeight(g);
                                       return (
                                         <button
                                           key={g.id}
                                           type="button"
                                           onClick={() => { setSelectedGradeDetails({ grade: g, subject }); playGradeSound(g.value); }}
                                           className="flex flex-col items-center px-2 py-0.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 active:scale-95 transition"
                                         >
                                           <span className={`text-sm font-black leading-none ${isExpiredNU ? 'text-red-600' : H.getGradeColorClass(String(g.value), minGrade, maxGrade)}`}>
                                             {isExpiredNU ? `${minGrade} (Н/У)` : g.value}
                                           </span>
                                           {typeName && (
                                             <span className="text-[8px] text-slate-500 dark:text-slate-400 font-bold mt-0.5 leading-none">
                                               {typeName}{useWeights && effWeight > 1 ? ` ×${effWeight}` : ''}
                                             </span>
                                           )}
                                         </button>
                                       );
                                     })}
                                   </div>
                                 )}
                               </div>
                               {hwList.length > 0 ? (
                                 <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-2 text-[11px] text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800 space-y-1">
                                   <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{t('homework')}:</div>
                                   <div className="space-y-1 break-words whitespace-pre-line">
                                     {hwList.map(h => (
                                       <div key={h.id}>{h.text}</div>
                                     ))}
                                   </div>
                                   {hwList.some(h => (h.attachments && h.attachments.length > 0) || h.attachmentId) && (
                                     <div className="flex flex-wrap gap-1 pt-1">
                                       {hwList.map(h => (
                                         <React.Fragment key={`att_${h.id}`}>
                                           {h.attachmentId && <FileDisplay id={h.attachmentId} name={h.attachmentName} schoolId={h.schoolId || user.schoolId} lang={lang as 'ru'|'en'} />}
                                           {(h.attachments || []).map(att => (
                                             <FileDisplay key={att.id} id={att.id} name={att.name} schoolId={h.schoolId || user.schoolId} lang={lang as 'ru'|'en'} />
                                           ))}
                                         </React.Fragment>
                                       ))}
                                     </div>
                                   )}
                                 </div>
                               ) : (
                                 <div className="text-[10px] text-slate-400">{t('homework')}: —</div>
                               )}
                             </div>
                           ))}
                           {day.lessons.length === 0 && (
                             <div className="p-4 text-center text-slate-400 italic text-xs">{t('no_lessons_today')}</div>
                           )}
                         </div>

                         {/* Desktop & Print Table */}
                         <div className="hidden md:block print:block overflow-x-auto print:overflow-visible">
                           <table className="w-full text-sm table-fixed min-w-[500px] print:min-w-0">
                             <colgroup>
                               <col className="w-[16%]" />
                               <col className="w-[24%]" />
                               <col className="w-[45%]" />
                               <col className="w-[15%]" />
                             </colgroup>
                             <thead className="bg-white border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider dark:bg-slate-900 dark:border-slate-800 dark:text-slate-500">
                               <tr>
                                 <th className="p-3.5 w-[16%] text-center border-r border-slate-100 dark:border-slate-800">{t('time')}</th>
                                 <th className="p-3.5 w-[24%] text-center border-r border-slate-100 dark:border-slate-800">{t('subject')}</th>
                                 <th className="p-3.5 w-[45%] text-center border-r border-slate-100 dark:border-slate-800">{t('homework')}</th>
                                 <th className="p-3.5 w-[15%] text-center">{t('grade')}</th>
                               </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                               {resolvedLessons.map(({ l, subject, teacherLabel, hwList, grades }) => (
                                 <tr key={l.id} className="hover:bg-slate-50 transition-colors dark:hover:bg-slate-800/30"><td className="p-3.5 w-[16%] font-mono text-xs text-slate-500 text-center border-r border-slate-50 dark:text-slate-400 dark:border-slate-800">{l.timeRange}</td><td className="p-3.5 w-[24%] font-bold text-slate-800 text-center border-r border-slate-50 dark:text-white dark:border-slate-800">{subject}{teacherLabel && <div className="text-[10px] text-amber-600 mt-1 font-normal">({teacherLabel})</div>}</td><td className="p-3.5 w-[45%] text-center text-slate-600 border-r border-slate-50 dark:text-slate-300 dark:border-slate-800">{hwList.length > 0 ? (<div className="space-y-1.5"><div className="space-y-1 whitespace-pre-line">{hwList.map(h => (<div key={h.id}>{h.text}</div>))}</div>{hwList.some(h => (h.attachments && h.attachments.length > 0) || h.attachmentId) && (<div className="pt-1 flex flex-wrap justify-center gap-1.5">{hwList.map(h => (<React.Fragment key={`d_att_${h.id}`}>{h.attachmentId && <FileDisplay id={h.attachmentId} name={h.attachmentName} schoolId={h.schoolId || user.schoolId} lang={lang as 'ru'|'en'} />}{(h.attachments || []).map(att => (<FileDisplay key={att.id} id={att.id} name={att.name} schoolId={h.schoolId || user.schoolId} lang={lang as 'ru'|'en'} />))}</React.Fragment>))}</div>)}</div>) : <span className="text-slate-300">-</span>}</td><td className="p-3.5 w-[15%] text-center align-middle">{grades.length > 0 ? (<div className="flex flex-col items-center gap-1">{grades.map(g => { const isExpiredNU = H.isGradeExpiredNU(g, state.settings.systemTimeOffset); const typeName = getTypeLabel(g.type); const effWeight = getEffectiveWeight(g); return (<div key={g.id} className="cursor-pointer group" onClick={() => { setSelectedGradeDetails({grade: g, subject}); playGradeSound(isExpiredNU ? minGrade : g.value); }}><div className={`text-xl font-bold ${isExpiredNU ? 'text-red-600' : H.getGradeColorClass(String(g.value), minGrade, maxGrade)}`} title={isExpiredNU ? `${t('deadline_expired_msg')} (${minGrade})` : undefined}>{isExpiredNU ? `${minGrade} (Н/У)` : g.value}</div>{typeName && (<div className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold dark:bg-slate-800">{typeName}{useWeights && effWeight > 1 ? ` ×${effWeight}` : ''}</div>)}</div>); })}</div>) : <span className="text-slate-200">-</span>}</td></tr>
                               ))}
                               {day.lessons.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-400 italic">{t('no_lessons_today')}</td></tr>}
                             </tbody>
                           </table>
                         </div>
                      </div>
                  )
              })}
            </div>
            <Modal isOpen={!!selectedGradeDetails} onClose={() => setSelectedGradeDetails(null)} title={t('grade_details')}>{selectedGradeDetails && (<div className="space-y-3 sm:space-y-5"><div className="flex justify-between items-start gap-2"><div><div className="text-[10px] sm:text-xs text-slate-500 uppercase font-bold tracking-wider mb-0.5 sm:mb-1">{t('subject')}</div><div className="text-sm sm:text-lg font-bold text-slate-800 dark:text-white">{selectedGradeDetails.subject}</div></div><div className="text-right"><div className="text-[10px] sm:text-xs text-slate-500 uppercase font-bold tracking-wider mb-0.5 sm:mb-1">{t('date')}</div><div className="font-mono text-[11px] sm:text-xs bg-slate-100 px-2 py-0.5 sm:py-1 rounded dark:bg-slate-800">{H.formatDateDDMMYYYY(selectedGradeDetails.grade.date)}</div></div></div><div className="flex items-center justify-center py-2.5 sm:py-6"><div className={`text-3xl sm:text-5xl font-bold ${H.getGradeColorClass(String(selectedGradeDetails.grade.value), minGrade, maxGrade)}`}>{selectedGradeDetails.grade.value}</div></div>{selectedGradeDetails.grade.value === 'Н/У' && (() => { const sysNow = new Date(Date.now() + (state.settings.systemTimeOffset || 0)); const deadline = selectedGradeDetails.grade.deadline ? new Date(selectedGradeDetails.grade.deadline) : H.addDays(new Date(selectedGradeDetails.grade.date), 7); const isExpired = sysNow >= deadline; return (<div className={`p-2 sm:p-3 rounded-xl border text-[11px] sm:text-xs font-medium text-center ${isExpired ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'}`}>{isExpired ? `${t('deadline_expired_msg')} (${H.formatDateDDMMYYYY(H.dateToIso(deadline))}): ${minGrade}.` : `${t('deadline_until_msg')} ${H.formatDateDDMMYYYY(H.dateToIso(deadline))}`}</div>); })()}<div className="grid grid-cols-2 gap-2 sm:gap-3 bg-slate-50 p-2.5 sm:p-3.5 rounded-xl border border-slate-100 dark:bg-slate-800 dark:border-slate-700"><div><div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase mb-0.5 sm:mb-1">{t('type_work')}</div><div className="font-semibold text-xs sm:text-sm text-slate-700 dark:text-slate-200">{getTypeLabel(selectedGradeDetails.grade.type) || t('other')}</div></div>{getEffectiveWeight(selectedGradeDetails.grade) > 0 && (<div><div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase mb-0.5 sm:mb-1">{t('weight')}</div><div className="font-semibold text-xs sm:text-sm text-slate-700 dark:text-slate-200">×{getEffectiveWeight(selectedGradeDetails.grade)}</div></div>)}</div>{selectedGradeDetails.grade.comment && (<div className="bg-blue-50 p-2.5 sm:p-3.5 rounded-xl border border-blue-100 dark:bg-blue-900/20 dark:border-blue-900/30"><div className="text-[10px] sm:text-xs font-bold text-blue-800 uppercase mb-1 dark:text-blue-300">{t('teacher_comment')}</div><p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 italic">{selectedGradeDetails.grade.comment}</p></div>)}<div className="flex justify-end pt-1"><Button onClick={() => setSelectedGradeDetails(null)} variant="secondary" size="sm">{t('close')}</Button></div></div>)}</Modal>
        </div>
    );
};
