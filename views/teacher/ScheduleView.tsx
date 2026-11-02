import React, { useState, useMemo, useEffect } from 'react';
import { AppState, User } from '../../types';
import * as H from '../../utils/helpers';
import { Button, Select } from '../../components/ui';
import { Printer, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

export const ScheduleView = ({ state, user, lang }: { state: AppState, user: User, lang: 'ru' | 'en' }) => {
    const [highlightClass, setHighlightClass] = useState('');
    const t = (k: string) => H.t(k, lang);

    const systemNow = new Date(Date.now() + (state.settings.systemTimeOffset || 0));
    const [weekStart, setWeekStart] = useState<Date>(H.getStartOfWeek(systemNow));

    useEffect(() => {
        setWeekStart(H.getStartOfWeek(new Date(Date.now() + (state.settings.systemTimeOffset || 0))));
    }, [state.settings.systemTimeOffset]);

    const goPrevWeek = () => setWeekStart(d => H.addDays(d, -7));
    const goNextWeek = () => setWeekStart(d => H.addDays(d, 7));
    const goCurrentWeek = () => setWeekStart(H.getStartOfWeek(new Date(Date.now() + (state.settings.systemTimeOffset || 0))));

    const schoolClasses = H.getSchoolClasses(state, user.schoolId);
    const scheduleSettings = H.getSchoolScheduleSettings(state, user.schoolId);

    const myClasses = useMemo(() => {
        const assignedClasses = new Set(user.classes || []);
        (state.teacherAssignments || []).forEach(a => {
            if (a.teacherId === user.id && a.classId && (!a.schoolId || !user.schoolId || a.schoolId === user.schoolId)) {
                assignedClasses.add(a.classId);
            }
        });
        H.getUserLeadingClasses(state, user.schoolId, user.id).forEach(c => {
            assignedClasses.add(`${c.class}_${c.letter}`);
        });
        schoolClasses.forEach(c => {
            const classKey = `${c.class}_${c.letter}`;
            const classSchedule = H.getSchoolClassSchedule(state, user.schoolId, classKey);
            Object.values(classSchedule).forEach(day => {
                day.lessons.forEach(l => {
                    if (l.teacherId === user.id) { assignedClasses.add(classKey); }
                    if (l.subgroups) { l.subgroups.forEach(sg => { if (sg.teacherId === user.id) { assignedClasses.add(classKey); } }); }
                });
            });
        });
        return schoolClasses.filter(c => assignedClasses.has(`${c.class}_${c.letter}`));
    }, [schoolClasses, user.classes, state, user.schoolId, user.id]);

    const mySchedule: Record<string, { date: string, title: string, lessons: { time: string, subject: string, class: string, groupName?: string, room: string, id: string, teacherLabel?: string, originalClassKey?: string }[] }> = {};

    myClasses.forEach(c => {
        const classKey = `${c.class}_${c.letter}`;
        const classSchedule = H.getSchoolClassSchedule(state, user.schoolId, classKey);
        Object.values(classSchedule).forEach(day => {
            if (!H.isDateInWeek(day.date, weekStart)) return;
            day.lessons.forEach(l => {
                const addIfMine = (teacherId: string, subject: string, room: string, groupId?: string, teacherLabel?: string) => {
                    if (teacherId === user.id) {
                        if (!mySchedule[day.date]) { mySchedule[day.date] = { date: day.date, title: H.getDayOfWeek(day.date, lang), lessons: [] }; }
                        let groupNameStr = '';
                        if (groupId) { 
                            const groupObj = H.getSchoolStudentGroups(state, user.schoolId).find(g => g.id === groupId); 
                            groupNameStr = groupObj?.name || ''; 
                        }
                        mySchedule[day.date].lessons.push({ 
                            id: l.id + (groupId ? `_${groupId}` : '') + '_' + classKey, 
                            time: l.timeRange, 
                            subject: subject, 
                            class: `${c.class}${c.letter}`, 
                            groupName: groupNameStr, 
                            room: room, 
                            teacherLabel: teacherLabel 
                        });
                    }
                };
                if (l.subgroups && l.subgroups.length > 0) { 
                    l.subgroups.forEach(sg => addIfMine(sg.teacherId, sg.subject, sg.room, sg.groupId, sg.teacherLabel)); 
                } else { 
                    addIfMine(l.teacherId, l.lesson, l.room, undefined, l.teacherLabel); 
                }
            });
        });
    });

    Object.values(mySchedule).forEach(day => { day.lessons.sort((a,b) => a.time.localeCompare(b.time)); });
    const sortedDays = Object.values(mySchedule).sort((a,b) => a.date.localeCompare(b.date));
    const scheduleDates = sortedDays.map(d => d.date);
    const vacationInfo = H.getVacationForWeek(weekStart, scheduleSettings, scheduleDates);

    return (
        <div className="space-y-3 sm:space-y-6">
            <div className="hidden print:block p-3 mb-3 border-b-2 border-black text-center">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-600">{H.getSchool(state, user.schoolId)?.name || 'ЭлЖур'}</div>
                <div className="text-xl font-bold text-black mt-0.5">{t('my_schedule')} — {user.fio}</div>
                <div className="text-xs text-slate-600 mt-1">{t('week')}: {H.getWeekRangeString(weekStart)}</div>
            </div>
            <div className="flex flex-wrap justify-between items-center gap-2 bg-white p-2.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs dark:bg-slate-900 dark:border-slate-800 no-print">
                <div className="flex items-center gap-2 flex-1 sm:flex-initial min-w-[140px] sm:w-48">
                    <Select value={highlightClass} onChange={e => setHighlightClass(e.target.value)} className="text-xs h-8 sm:h-9">
                        <option value="">{t('all_classes')}</option>
                        {myClasses.map(c => <option key={`${c.class}_${c.letter}`} value={`${c.class}${c.letter}`}>{c.class}{c.letter}</option>)}
                    </Select>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="ghost" onClick={goCurrentWeek} size="sm" className="px-2 py-1 text-xs h-8"><Calendar size={14} className="mr-1"/> {t('current')}</Button>
                    <Button onClick={() => window.print()} variant="secondary" size="sm" className="px-2 py-1 text-xs h-8"><Printer size={14} className="sm:mr-1.5"/><span className="hidden sm:inline">{t('print')}</span></Button>
                </div>
                <div className="flex items-center justify-between w-full sm:w-auto gap-2 bg-slate-50 p-0.5 sm:p-1 rounded-lg sm:rounded-xl border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                    <Button variant="ghost" onClick={goPrevWeek} className="px-2 h-7 sm:h-8"><ChevronLeft size={16}/></Button>
                    <div className="text-center px-1.5">
                       <div className="font-bold text-slate-700 dark:text-white text-xs sm:text-sm whitespace-nowrap">{H.getWeekRangeString(weekStart)}</div>
                    </div>
                    <Button variant="ghost" onClick={goNextWeek} className="px-2 h-7 sm:h-8"><ChevronRight size={16}/></Button>
                </div>
            </div>
            {vacationInfo && vacationInfo.isFullWeek && (
                <div className="bg-green-100 text-green-800 text-center py-2.5 sm:py-3 rounded-xl font-bold border border-green-200 uppercase tracking-widest shadow-xs text-xs sm:text-sm dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">
                    {vacationInfo.emoji} {vacationInfo.title} ({vacationInfo.range}) {vacationInfo.emoji}
                </div>
            )}
            <div className="space-y-3 sm:space-y-6">
                {sortedDays.length === 0 && (<p className="text-center text-slate-400 py-8 text-xs sm:text-sm">{t('no_lessons')}</p>)}
                {sortedDays.map(day => {
                    const holidayInfo = H.isHoliday(day.date, scheduleSettings);
                    const vacForDay = H.getVacationForDay(day.date, scheduleSettings);
                    const isVacationDay = !!vacForDay;
                    const isHolidayDay = !!holidayInfo;
                    let borderClass = 'border-slate-200 dark:border-slate-800';
                    let bgClass = 'bg-white dark:bg-slate-900';
                    if (isHolidayDay) { borderClass = 'border-red-200 dark:border-red-900/50'; } 
                    else if (isVacationDay) { borderClass = 'border-green-200 dark:border-green-900/50'; bgClass = 'bg-green-50/20 dark:bg-green-900/10'; }
                    return (
                    <div key={day.date} className={`border rounded-xl shadow-xs overflow-hidden break-inside-avoid ${borderClass} ${bgClass}`}>
                        {(isHolidayDay || (isVacationDay && !vacationInfo?.isFullWeek)) && (
                            <div className={`text-center py-1 text-[10px] sm:text-xs font-bold uppercase tracking-widest border-b ${isHolidayDay ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400' : 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:border-green-900/30 dark:text-green-400'}`}>
                                {holidayInfo ? holidayInfo.title : vacForDay?.title}
                            </div>
                        )}
                        <div className={`flex justify-between items-center px-3 sm:px-4 py-2 sm:py-3.5 border-b ${isHolidayDay ? 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30' : (isVacationDay ? 'bg-green-50/50 border-green-100 dark:bg-green-900/10 dark:border-green-900/30' : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700')}`}>
                            <span className="font-bold text-xs sm:text-base text-slate-800 dark:text-white flex items-center gap-1.5 sm:gap-2">
                                {day.title || H.getDayOfWeek(day.date, lang as 'ru' | 'en')} <span className="text-slate-500 text-xs font-normal">({H.formatDateDDMMYYYY(day.date)})</span>
                            </span>
                            <span className="hidden sm:inline-block text-xs font-medium text-slate-500 bg-white px-2.5 py-0.5 rounded border border-slate-200 dark:bg-slate-900 dark:border-slate-600 dark:text-slate-400">
                                {H.formatDateDDMMYYYY(day.date)}
                            </span>
                        </div>
                        {/* Mobile Card List (Compact, No horizontal scroll) */}
                        <div className="md:hidden print:hidden divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                            {day.lessons.map((l, idx) => {
                                const isHighlighted = !highlightClass || l.class === highlightClass;
                                return (
                                    <div key={l.id} className={`p-2.5 flex items-start justify-between gap-2 transition-opacity ${isHighlighted ? 'opacity-100' : 'opacity-25'}`}>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-[10px] font-bold shrink-0">{idx + 1}</span>
                                                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">{l.time}</span>
                                            </div>
                                            <div className="font-bold text-xs text-slate-800 dark:text-slate-100 break-words leading-snug">
                                                {l.subject}
                                                {l.teacherLabel && <span className="text-[10px] text-amber-600 font-bold ml-1">({l.teacherLabel})</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <div className="flex flex-col items-end">
                                                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md text-[11px] font-bold dark:bg-blue-900/30 dark:text-blue-300">
                                                    {l.class}
                                                </span>
                                                {l.groupName && <span className="text-[9px] text-slate-400 font-bold mt-0.5 uppercase">{l.groupName}</span>}
                                            </div>
                                            {l.room && (
                                                <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-[11px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700">
                                                    {t('cabinet')}: {l.room}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {/* Desktop & Print Table */}
                        <div className="hidden md:block print:block p-0 bg-white/50 dark:bg-slate-900/50 overflow-x-auto">
                            <table className="w-full text-sm table-fixed min-w-[500px]">
                                <thead className="bg-white border-b border-slate-100 text-slate-500 dark:bg-slate-900 dark:border-slate-800">
                                    <tr>
                                        <th className="p-3 text-center w-32 border-r border-slate-100 dark:border-slate-800">{t('time')}</th>
                                        <th className="p-3 text-center">{t('subject')}</th>
                                        <th className="p-3 text-center w-32 border-l border-slate-100 dark:border-slate-800">{t('class')}</th>
                                        <th className="p-3 text-center w-24 border-l border-slate-100 dark:border-slate-800">{t('cabinet')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {day.lessons.map(l => { 
                                        const isHighlighted = !highlightClass || l.class === highlightClass; 
                                        return (
                                            <tr key={l.id} className={`transition-opacity duration-200 print:opacity-100 ${isHighlighted ? 'opacity-100 hover:bg-slate-50 dark:hover:bg-slate-800/50' : 'opacity-25'}`}>
                                                <td className="p-3 font-mono text-xs text-slate-500 text-center border-r border-slate-50 dark:text-slate-400 dark:border-slate-800">{l.time}</td>
                                                <td className="p-3 font-semibold text-center text-slate-800 dark:text-slate-200">{l.subject}{l.teacherLabel && <div className="text-[10px] text-amber-600 font-bold">({l.teacherLabel})</div>}</td>
                                                <td className="p-3 text-slate-600 text-center font-bold border-l border-slate-50 dark:text-slate-400 dark:border-slate-800">
                                                    <div className="flex flex-col items-center">
                                                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded dark:bg-blue-900/30 dark:text-blue-300">{l.class}</span>
                                                        {l.groupName && <span className="text-[10px] text-slate-400 font-bold mt-1 uppercase">{l.groupName}</span>}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-slate-600 text-center border-l border-slate-50 dark:text-slate-400 dark:border-slate-800">{l.room}</td>
                                            </tr>
                                        ); 
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )})}
            </div>
        </div>
    );
};
