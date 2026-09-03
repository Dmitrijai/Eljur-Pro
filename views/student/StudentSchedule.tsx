
import React, { useState, useEffect } from 'react';
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
    const [scheduleWeekStart, setScheduleWeekStart] = useState<Date>(H.getStartOfWeek(systemNow));

    useEffect(() => {
        setScheduleWeekStart(H.getStartOfWeek(new Date(Date.now() + (state.settings.systemTimeOffset || 0))));
    }, [state.settings.systemTimeOffset]);

    const goPrevWeek = () => setScheduleWeekStart(d => H.addDays(d, -7));
    const goNextWeek = () => setScheduleWeekStart(d => H.addDays(d, 7));
    const goCurrentWeek = () => setScheduleWeekStart(H.getStartOfWeek(new Date(Date.now() + (state.settings.systemTimeOffset || 0))));

    const scheduleDays = Object.values(schedule).filter(d => H.isDateInWeek(d.date, scheduleWeekStart)).sort((a,b) => a.date.localeCompare(b.date));
    const scheduleDates = scheduleDays.map(d => d.date);
    const scheduleVacation = H.getVacationForWeek(scheduleWeekStart, scheduleSettings, scheduleDates);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-800 no-print">
               <h3 className="font-bold text-xl text-slate-800 dark:text-white ml-2">{t('schedule')}</h3>
               <div className="flex items-center gap-4 bg-slate-50 p-1 rounded-xl border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                   <Button variant="ghost" onClick={goPrevWeek} className="px-3 h-8"><ChevronLeft size={18}/></Button>
                   <div className="text-center px-2">
                      <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{t('week')}</div>
                      <div className="font-bold text-slate-700 dark:text-white text-sm whitespace-nowrap">{H.getWeekRangeString(scheduleWeekStart)}</div>
                   </div>
                   <Button variant="ghost" onClick={goNextWeek} className="px-3 h-8"><ChevronRight size={18}/></Button>
               </div>
               <div className="flex gap-2">
                 <Button variant="ghost" onClick={goCurrentWeek} size="sm"><Calendar size={16} className="mr-2"/> {t('current')}</Button>
                 <Button variant="secondary" onClick={() => window.print()} size="sm"><Printer size={16} className="mr-2"/> {t('print')}</Button>
               </div>
            </div>
            {scheduleVacation && scheduleVacation.isFullWeek && (<div className="bg-green-100 text-green-800 text-center py-3 rounded-xl font-bold border border-green-200 uppercase tracking-widest shadow-sm dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">{scheduleVacation.emoji} {scheduleVacation.title} ({scheduleVacation.range}) {scheduleVacation.emoji}</div>)}
            {scheduleDays.length === 0 && <p className="text-center text-slate-400 py-10">{t('no_schedule')}</p>}
            {scheduleDays.map(day => {
               const holidayInfo = H.isHoliday(day.date, scheduleSettings);
               const vacForDay = H.getVacationForDay(day.date, scheduleSettings);
               const isVacationDay = !!vacForDay;
               const isHolidayDay = !!holidayInfo;
               let borderClass = 'border-slate-300 dark:border-slate-700';
               let bgClass = 'bg-white dark:bg-slate-900';
               if (isHolidayDay) { borderClass = 'border-red-200 dark:border-red-900/50'; } else if (isVacationDay) { borderClass = 'border-green-200 dark:border-green-900/50'; bgClass = 'bg-green-50/20 dark:bg-green-900/10'; }
               return (
               <div key={day.id} className={`border rounded-xl shadow-sm overflow-hidden break-inside-avoid ${borderClass} ${bgClass}`}>
                  {(isHolidayDay || (isVacationDay && !scheduleVacation?.isFullWeek)) && (<div className={`text-center py-1.5 text-xs font-bold uppercase tracking-widest border-b ${isHolidayDay ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400' : 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:border-green-900/30 dark:text-green-400'}`}>{holidayInfo ? holidayInfo.title : vacForDay?.title}</div>)}
                  <div className={`flex justify-between items-center p-4 border-b ${isHolidayDay ? 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30' : (isVacationDay ? 'bg-green-50/50 border-green-100 dark:bg-green-900/10 dark:border-green-900/30' : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700')}`}><span className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">{day.title} <span className="text-slate-500 text-sm font-normal">({H.formatDateDDMMYYYY(day.date)})</span></span><span className="text-sm font-medium text-slate-500 bg-white px-3 py-1 rounded border border-slate-200 dark:bg-slate-900 dark:border-slate-600 dark:text-slate-400">{H.formatDateDDMMYYYY(day.date)}</span></div>
                  <div className="p-0 bg-white/50 dark:bg-slate-900/50 overflow-x-auto">
                    <table className="w-full text-sm min-w-[500px]"><thead className="bg-white border-b border-slate-100 text-slate-500 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400"><tr><th className="p-3 w-32 text-center border-r border-slate-100 dark:border-slate-800">{t('time')}</th><th className="p-3 text-center">{t('subject')}</th><th className="p-3 w-32 text-center border-l border-slate-100 dark:border-slate-800">{t('cabinet')}</th><th className="p-3 text-center border-l border-slate-100 dark:border-slate-800">{t('teacher')}</th></tr></thead>
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
                                    displayTeacherLabel = 'Не распределен в подгруппу';
                                }
                            }
                            const teacher = state.users.find(u => u.id === teacherId);
                            const displayTeacherName = teacher ? H.formatShortName(teacher.fio) : (teacherId ? 'Unknown' : (isUnassigned ? '—' : '-'));
                            return (
                                <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <td className="p-3 text-center font-mono text-xs text-slate-500 border-r border-slate-50 dark:text-slate-400 dark:border-slate-800">{l.timeRange}</td>
                                    <td className="p-3 text-center font-semibold text-slate-800 dark:text-slate-200">
                                        {displaySubject}
                                        {displayTeacherLabel && (
                                            <div className={`text-[10px] font-bold mt-0.5 ${isUnassigned ? 'text-amber-500' : 'text-amber-600'}`}>
                                                ({displayTeacherLabel})
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3 text-center text-slate-600 border-l border-slate-50 dark:text-slate-400 dark:border-slate-800">{displayRoom}</td>
                                    <td className="p-3 text-center text-slate-600 border-l border-slate-50 dark:text-slate-400 dark:border-slate-800">{displayTeacherName}</td>
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
