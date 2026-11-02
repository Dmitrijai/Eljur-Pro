import React, { useState, useEffect, useRef } from 'react';
import { AppState, User } from '../../types';
import * as H from '../../utils/helpers';
import { Button } from '../../components/ui';
import { Printer, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

export const StudentSchedule = ({ state, user }: { state: AppState, user: User }) => {
    const classKey = `${user.class}_${user.letter}`;
    const schedule = H.getSchoolClassSchedule(state, user.schoolId, classKey);
    const scheduleSettings = H.getSchoolScheduleSettings(state, user.schoolId);
    const lang = state.settings.language || 'ru';
    const t = (k: string) => H.t(k, lang);
    const systemNow = new Date(Date.now() + (state.settings.systemTimeOffset || 0));
    const defaultWeekIso = H.dateToIso(H.getStartOfWeek(systemNow));
    const [scheduleWeekIso, setScheduleWeekIso] = H.useSyncedState<string>(`eljur_st_sched_week_${user.id}`, defaultWeekIso);
    const scheduleWeekStart = new Date(scheduleWeekIso || defaultWeekIso);

    const goPrevWeek = () => setScheduleWeekIso(H.dateToIso(H.addDays(scheduleWeekStart, -7)));
    const goNextWeek = () => setScheduleWeekIso(H.dateToIso(H.addDays(scheduleWeekStart, 7)));
    const goCurrentWeek = () => setScheduleWeekIso(H.dateToIso(H.getStartOfWeek(new Date(Date.now() + (state.settings.systemTimeOffset || 0)))));

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
            if (dx > 0) goPrevWeek();
            else goNextWeek();
        }
    };

    const scheduleDays = Object.values(schedule).filter(d => H.isDateInWeek(d.date, scheduleWeekStart)).sort((a,b) => a.date.localeCompare(b.date));
    const scheduleDates = scheduleDays.map(d => d.date);
    const scheduleVacation = H.getVacationForWeek(scheduleWeekStart, scheduleSettings, scheduleDates);

    return (
        <div className="space-y-3 sm:space-y-6" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            <div className="hidden print:block p-3 mb-3 border-b-2 border-black text-center">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-600">{H.getSchool(state, user.schoolId)?.name || 'ЭлЖур'}</div>
                <div className="text-xl font-bold text-black mt-0.5">{t('schedule')} — {user.fio} ({user.class}{user.letter})</div>
                <div className="text-xs text-slate-600 mt-1">{t('week')}: {H.getWeekRangeString(scheduleWeekStart)}</div>
            </div>
            <div className="flex flex-wrap justify-between items-center gap-2 bg-white p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs dark:bg-slate-900 dark:border-slate-800 no-print">
               <h3 className="font-bold text-sm sm:text-xl text-slate-800 dark:text-white sm:ml-1">{t('schedule')}</h3>
               <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                 <Button variant="ghost" onClick={goCurrentWeek} size="sm" className="px-2 py-1 text-xs h-7 sm:h-8"><Calendar size={14} className="mr-1"/> {t('current')}</Button>
                 <Button variant="secondary" onClick={() => window.print()} size="sm" className="px-2 py-1 text-xs h-7 sm:h-8"><Printer size={14} className="sm:mr-1.5"/><span className="hidden sm:inline">{t('print')}</span></Button>
               </div>
               <div className="flex items-center justify-between w-full sm:w-auto gap-2 bg-slate-50 p-0.5 sm:p-1 rounded-lg sm:rounded-xl border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                   <Button variant="ghost" onClick={goPrevWeek} className="px-2 h-7 sm:h-8"><ChevronLeft size={16}/></Button>
                   <div className="text-center px-1.5">
                      <div className="font-bold text-slate-700 dark:text-white text-xs sm:text-sm whitespace-nowrap">{H.getWeekRangeString(scheduleWeekStart)}</div>
                   </div>
                   <Button variant="ghost" onClick={goNextWeek} className="px-2 h-7 sm:h-8"><ChevronRight size={16}/></Button>
               </div>
            </div>
            {scheduleVacation && scheduleVacation.isFullWeek && (<div className="bg-green-100 text-green-800 text-center py-2.5 sm:py-3 rounded-xl font-bold border border-green-200 uppercase tracking-widest shadow-xs text-xs sm:text-sm dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">{scheduleVacation.emoji} {scheduleVacation.title} ({scheduleVacation.range}) {scheduleVacation.emoji}</div>)}
            {scheduleDays.length === 0 && <p className="text-center text-slate-400 py-8 text-xs sm:text-sm">{t('no_schedule')}</p>}
            {scheduleDays.map(day => {
               const holidayInfo = H.isHoliday(day.date, scheduleSettings);
               const vacForDay = H.getVacationForDay(day.date, scheduleSettings);
               const isVacationDay = !!vacForDay;
               const isHolidayDay = !!holidayInfo;
               let borderClass = 'border-slate-200 dark:border-slate-800';
               let bgClass = 'bg-white dark:bg-slate-900';
               if (isHolidayDay) { borderClass = 'border-red-200 dark:border-red-900/50'; } else if (isVacationDay) { borderClass = 'border-green-200 dark:border-green-900/50'; bgClass = 'bg-green-50/20 dark:bg-green-900/10'; }
               return (
               <div key={day.id} className={`border rounded-xl shadow-xs overflow-hidden break-inside-avoid ${borderClass} ${bgClass}`}>
                  {(isHolidayDay || (isVacationDay && !scheduleVacation?.isFullWeek)) && (<div className={`text-center py-1 text-[10px] sm:text-xs font-bold uppercase tracking-widest border-b ${isHolidayDay ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400' : 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:border-green-900/30 dark:text-green-400'}`}>{holidayInfo ? holidayInfo.title : vacForDay?.title}</div>)}
                  <div className={`flex justify-between items-center px-3 sm:px-4 py-2 sm:py-3.5 border-b ${isHolidayDay ? 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30' : (isVacationDay ? 'bg-green-50/50 border-green-100 dark:bg-green-900/10 dark:border-green-900/30' : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700')}`}><span className="font-bold text-xs sm:text-base text-slate-800 dark:text-white flex items-center gap-1.5 sm:gap-2">{day.title || H.getDayOfWeek(day.date, lang as 'ru' | 'en')} <span className="text-slate-500 text-xs font-normal">({H.formatDateDDMMYYYY(day.date)})</span></span><span className="hidden sm:inline-block text-xs font-medium text-slate-500 bg-white px-2.5 py-0.5 rounded border border-slate-200 dark:bg-slate-900 dark:border-slate-600 dark:text-slate-400">{H.formatDateDDMMYYYY(day.date)}</span></div>
                  {/* Mobile Card List (Compact, No horizontal scroll) */}
                  <div className="md:hidden print:hidden divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {day.lessons.map((l, idx) => {
                      let displaySubject = l.lesson;
                      let displayRoom = l.room;
                      let teacherId = l.teacherId;
                      let displayTeacherLabel = l.teacherLabel;
                      let isUnassigned = false;
                      if (l.subgroups && l.subgroups.length > 0) {
                        const studentGroup = H.getSchoolStudentGroups(state, user.schoolId, classKey).find(g => g.studentIds.includes(user.id));
                        if (studentGroup) {
                          const subgroupLesson = l.subgroups.find(sg => sg.groupId === studentGroup.id);
                          if (subgroupLesson) {
                            displaySubject = subgroupLesson.subject;
                            displayRoom = subgroupLesson.room;
                            teacherId = subgroupLesson.teacherId;
                            displayTeacherLabel = subgroupLesson.teacherLabel;
                          } else {
                            isUnassigned = true;
                          }
                        } else {
                          isUnassigned = true;
                        }
                        if (isUnassigned) {
                          displaySubject = l.lesson;
                          displayRoom = l.room || '-';
                          displayTeacherLabel = t('unassigned_subgroup');
                        }
                      }
                      const teacher = state.users.find(u => u.id === teacherId);
                      const displayTeacherName = teacher ? H.formatShortName(teacher.fio) : (teacherId ? t('unknown') : (isUnassigned ? '—' : '-'));
                      return (
                        <div key={l.id} className="p-2.5 flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-[10px] font-bold shrink-0">{idx + 1}</span>
                              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">{l.timeRange}</span>
                            </div>
                            <div className="font-bold text-xs text-slate-800 dark:text-slate-100 break-words leading-snug">
                              {displaySubject || '—'}
                              {displayTeacherLabel && (
                                <span className={`text-[10px] font-bold ml-1 ${isUnassigned ? 'text-amber-500' : 'text-amber-600'}`}>
                                  ({displayTeacherLabel})
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {t('teacher')}: <span className="font-medium text-slate-700 dark:text-slate-300">{displayTeacherName}</span>
                            </div>
                          </div>
                          {displayRoom && displayRoom !== '-' && (
                            <div className="shrink-0 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-[11px] font-bold text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700">
                              {t('cabinet')}: {displayRoom}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {day.lessons.length === 0 && (
                      <div className="p-3 text-center text-xs text-slate-400 italic">{t('no_schedule')}</div>
                    )}
                  </div>
                  {/* Desktop & Print Table */}
                  <div className="hidden md:block print:block p-0 bg-white/50 dark:bg-slate-900/50 overflow-x-auto print:overflow-visible">
                    <table className="w-full text-sm table-fixed min-w-[500px] print:min-w-0">
                      <colgroup>
                        <col className="w-[18%]" />
                        <col className="w-[42%]" />
                        <col className="w-[15%]" />
                        <col className="w-[25%]" />
                      </colgroup>
                      <thead className="bg-white border-b border-slate-100 text-slate-500 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400">
                        <tr>
                          <th className="p-3 w-[18%] text-center border-r border-slate-100 dark:border-slate-800">{t('time')}</th>
                          <th className="p-3 w-[42%] text-center">{t('subject')}</th>
                          <th className="p-3 w-[15%] text-center border-l border-slate-100 dark:border-slate-800">{t('cabinet')}</th>
                          <th className="p-3 w-[25%] text-center border-l border-slate-100 dark:border-slate-800">{t('teacher')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {day.lessons.map(l => {
                            let displaySubject = l.lesson;
                            let displayRoom = l.room;
                            let teacherId = l.teacherId;
                            let displayTeacherLabel = l.teacherLabel;
                            let isUnassigned = false;
                            if (l.subgroups && l.subgroups.length > 0) {
                                const studentGroup = H.getSchoolStudentGroups(state, user.schoolId, classKey).find(g => g.studentIds.includes(user.id));
                                if (studentGroup) { 
                                    const subgroupLesson = l.subgroups.find(sg => sg.groupId === studentGroup.id); 
                                    if (subgroupLesson) { 
                                        displaySubject = subgroupLesson.subject; 
                                        displayRoom = subgroupLesson.room; 
                                        teacherId = subgroupLesson.teacherId; 
                                        displayTeacherLabel = subgroupLesson.teacherLabel; 
                                    } else { 
                                        isUnassigned = true; 
                                    } 
                                } else { 
                                    isUnassigned = true; 
                                }
                                if (isUnassigned) {
                                    displaySubject = l.lesson;
                                    displayRoom = l.room || '-';
                                    displayTeacherLabel = t('unassigned_subgroup');
                                }
                            }
                            const teacher = state.users.find(u => u.id === teacherId);
                            const displayTeacherName = teacher ? H.formatShortName(teacher.fio) : (teacherId ? t('unknown') : (isUnassigned ? '—' : '-'));
                            return (
                                <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <td className="p-3 w-[18%] text-center font-mono text-xs text-slate-500 border-r border-slate-50 dark:text-slate-400 dark:border-slate-800">{l.timeRange}</td>
                                    <td className="p-3 w-[42%] text-center font-semibold text-slate-800 dark:text-slate-200">
                                        {displaySubject}
                                        {displayTeacherLabel && (
                                            <div className={`text-[10px] font-bold mt-0.5 ${isUnassigned ? 'text-amber-500' : 'text-amber-600'}`}>
                                                ({displayTeacherLabel})
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3 w-[15%] text-center text-slate-600 border-l border-slate-50 dark:text-slate-400 dark:border-slate-800">{displayRoom}</td>
                                    <td className="p-3 w-[25%] text-center text-slate-600 border-l border-slate-50 dark:text-slate-400 dark:border-slate-800">{displayTeacherName}</td>
                                </tr>
                            );
                        })}
                      </tbody>
                    </table>
                  </div>
               </div>
            )})}
         </div>
    );
};
