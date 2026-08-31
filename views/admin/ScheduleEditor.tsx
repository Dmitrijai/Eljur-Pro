
import React, { useState, useEffect } from 'react';
import { AppState, Lesson } from '../../types';
import * as H from '../../utils/helpers';
import { Button, Input, Select, Modal } from '../../components/ui';
import { ChevronLeft, ChevronRight, Calendar, Settings, Copy, BookOpen, Printer, Lock, Trash2, MoreVertical, X as XIcon, Type, AlertCircle, CalendarRange } from 'lucide-react';

export const ScheduleEditor = ({ state, onUpdate, user }: { state: AppState, onUpdate: (s: AppState) => void, user: import("../../types").User }) => {
  const schoolClasses = H.getSchoolClasses(state, user.schoolId);
  const schoolSubjects = H.getSchoolSubjects(state, user.schoolId);
  const [activeClass, setActiveClass] = useState(schoolClasses[0] ? `${schoolClasses[0].class}_${schoolClasses[0].letter}` : '');
  const [newSubj, setNewSubj] = useState('');
  const [showSubjModal, setShowSubjModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showBatchCopyModal, setShowBatchCopyModal] = useState(false);
  const [selectedClassesForCopy, setSelectedClassesForCopy] = useState<string[]>([]);
  
  const [labelModal, setLabelModal] = useState<{isOpen: boolean, dayId: string, lIndex: number, sgIdx: number | null, text: string, canGrade: boolean}>({isOpen: false, dayId: '', lIndex: -1, sgIdx: null, text: '', canGrade: false});
  const [confirmCopyModal, setConfirmCopyModal] = useState(false);
  const [openDaySettings, setOpenDaySettings] = useState<string | null>(null);
  
  const lang = state.settings.language || 'ru';
  const t = (k: string) => H.t(k, lang);
  const scheduleSettings = H.getSchoolScheduleSettings(state, user.schoolId);
  
  const systemNow = new Date(Date.now() + (state.settings.systemTimeOffset || 0));
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(H.getStartOfWeek(systemNow));
  
  useEffect(() => {
      setCurrentWeekStart(H.getStartOfWeek(new Date(Date.now() + (state.settings.systemTimeOffset || 0))));
  }, [state.settings.systemTimeOffset]);

  useEffect(() => {
      if (schoolClasses.length > 0) {
          const activeExists = schoolClasses.some(c => `${c.class}_${c.letter}` === activeClass);
          if (!activeExists) {
              setActiveClass(`${schoolClasses[0].class}_${schoolClasses[0].letter}`);
          }
      } else {
          setActiveClass('');
      }
  }, [schoolClasses, activeClass]);

  const todayIso = H.dateToIso(systemNow);
  const isDayInPast = (dateStr: string) => dateStr < todayIso;
  const currentWeekEnd = H.addDays(currentWeekStart, 6);
  const isPastWeek = H.dateToIso(currentWeekEnd) < todayIso;

  const targetScheduleKey = activeClass ? H.getSchoolClassKey(user.schoolId, activeClass) : '';
  if (targetScheduleKey && !state.schedules[targetScheduleKey]) { state.schedules[targetScheduleKey] = {}; }
  const schedule = targetScheduleKey ? (state.schedules[targetScheduleKey] || {}) : {};
  const classGroups = state.studentGroups.filter(g => g.classId === activeClass);
  const visibleDayKeys = Object.keys(schedule).filter(key => H.isDateInWeek(schedule[key].date, currentWeekStart)).sort((a,b) => schedule[a].date.localeCompare(schedule[b].date));
  
  const goPrevWeek = () => setCurrentWeekStart(d => H.addDays(d, -7));
  const goNextWeek = () => setCurrentWeekStart(d => H.addDays(d, 7));
  const goCurrentWeek = () => setCurrentWeekStart(H.getStartOfWeek(new Date(Date.now() + (state.settings.systemTimeOffset || 0))));

  let canAddMoreDaysToWeek = false;
  if (visibleDayKeys.length < 7 && !isPastWeek && targetScheduleKey) {
      let baseDate: Date;
      if (visibleDayKeys.length > 0) {
          const lastKey = visibleDayKeys[visibleDayKeys.length - 1];
          baseDate = new Date(schedule[lastKey].date);
      } else {
          baseDate = new Date(currentWeekStart);
          baseDate.setDate(baseDate.getDate() - 1);
      }
      const nextPossibleDate = H.getNextWorkingDate(baseDate, scheduleSettings.skippedWeekDays || []);
      if (H.isDateInWeek(H.dateToIso(nextPossibleDate), currentWeekStart)) { canAddMoreDaysToWeek = true; }
  }

  const getTeacherConflictDetails = (teacherId: string, date: string, timeRange: string, excludeClassKey: string, excludeLessonId: string): string | null => {
      if (!teacherId) return null;
      const normalizeClassKey = (k: string) => k.includes('__') ? k.split('__').pop() || k : k;
      const normExclude = normalizeClassKey(excludeClassKey);

      for (const [cKey, days] of Object.entries(state.schedules)) {
          const normCKey = normalizeClassKey(cKey);
          const day = Object.values(days).find(d => d.date === date);
          if (day) {
              const conflict = day.lessons.find(l => {
                  if (l.timeRange !== timeRange) return false;
                  if (normCKey === normExclude && l.id === excludeLessonId) return false;
                  if (l.teacherId === teacherId) return true;
                  if (l.subgroups && l.subgroups.some(sg => sg.teacherId === teacherId)) return true;
                  return false;
              });
              if (conflict) { return normCKey.replace('_', ''); }
          }
      }
      return null;
  };
  
  const copyScheduleBatch = () => {
    if (selectedClassesForCopy.length === 0) return alert(t('select_classes'));
    const prevWeekStart = H.addDays(currentWeekStart, -7);
    let updated = false;
    selectedClassesForCopy.forEach(clsKey => {
        const scopedKey = H.getSchoolClassKey(user.schoolId, clsKey);
        if (!state.schedules[scopedKey]) state.schedules[scopedKey] = {};
        const classSchedule = state.schedules[scopedKey];
        const prevWeekKeys = Object.keys(classSchedule).filter(key => H.isDateInWeek(classSchedule[key].date, prevWeekStart));
        if (prevWeekKeys.length === 0) return;
        prevWeekKeys.forEach(prevKey => {
            const prevDay = classSchedule[prevKey];
            const prevDate = new Date(prevDay.date);
            const newDate = H.addDays(prevDate, 7);
            const newDateStr = H.dateToIso(newDate);
            const exists = Object.values(classSchedule).some(d => d.date === newDateStr);
            if (!exists) {
                const newId = H.uid('day');
                const newLessons = prevDay.lessons.map(l => ({ ...l, id: H.uid('l'), subgroups: l.subgroups ? l.subgroups.map(sg => ({...sg})) : undefined }));
                state.schedules[scopedKey][newId] = { id: newId, title: prevDay.title, date: newDateStr, lessons: newLessons, showGroups: prevDay.showGroups };
                updated = true;
            }
        });
    });
    if (updated) { onUpdate(state); setShowBatchCopyModal(false); setSelectedClassesForCopy([]); } else { alert(t('confirm_copy_empty')); }
  };

  const copyScheduleForCurrentClass = () => {
      if (!targetScheduleKey) return;
      if (!state.schedules[targetScheduleKey]) state.schedules[targetScheduleKey] = {};
      const classSchedule = state.schedules[targetScheduleKey];
      const prevWeekStart = H.addDays(currentWeekStart, -7);
      const prevWeekKeys = Object.keys(classSchedule).filter(key => H.isDateInWeek(classSchedule[key].date, prevWeekStart));
      if (prevWeekKeys.length === 0) { alert(t('confirm_copy_no_prev')); setConfirmCopyModal(false); return; }
      let updated = false;
      prevWeekKeys.forEach(prevKey => {
            const prevDay = classSchedule[prevKey];
            const prevDate = new Date(prevDay.date);
            const newDate = H.addDays(prevDate, 7);
            const newDateStr = H.dateToIso(newDate);
            const exists = Object.values(classSchedule).some(d => d.date === newDateStr);
            if (!exists) {
                const newId = H.uid('day');
                const newLessons = prevDay.lessons.map(l => ({ ...l, id: H.uid('l'), subgroups: l.subgroups ? l.subgroups.map(sg => ({...sg})) : undefined }));
                state.schedules[targetScheduleKey][newId] = { id: newId, title: prevDay.title, date: newDateStr, lessons: newLessons, showGroups: prevDay.showGroups };
                updated = true;
            }
      });
      if (updated) { onUpdate(state); setConfirmCopyModal(false); } else { alert(t('confirm_copy_empty')); setConfirmCopyModal(false); }
  };
  
  const addDaysWithSettings = () => {
    if (isPastWeek || !targetScheduleKey) return;
    const settings = H.getSchoolScheduleSettings(state, user.schoolId);
    const batchSize = settings.daysToAddBatch || 1;
    const skippedDays = settings.skippedWeekDays || [];
    if (!state.schedules[targetScheduleKey]) state.schedules[targetScheduleKey] = {};
    const curSchedule = state.schedules[targetScheduleKey];
    const curVisibleKeys = Object.keys(curSchedule).filter(key => H.isDateInWeek(curSchedule[key].date, currentWeekStart)).sort((a,b) => curSchedule[a].date.localeCompare(curSchedule[b].date));
    let baseDate: Date;
    if (curVisibleKeys.length > 0) {
        const lastKey = curVisibleKeys[curVisibleKeys.length - 1];
        const lastDateStr = curSchedule[lastKey].date;
        baseDate = new Date(lastDateStr);
    } else {
        baseDate = new Date(currentWeekStart);
        baseDate.setDate(baseDate.getDate() - 1);
    }
    let addedCount = 0;
    let nextDate = new Date(baseDate);
    while (addedCount < batchSize) {
        nextDate = H.getNextWorkingDate(nextDate, skippedDays);
        if (!H.isDateInWeek(H.dateToIso(nextDate), currentWeekStart)) { break; }
        const dateStr = H.dateToIso(nextDate);
        const exists = Object.values(curSchedule).find(d => d.date === dateStr);
        if (!exists) {
            const dayName = H.getDayOfWeek(dateStr, lang);
            const newId = H.uid('day');
            const autoLessons = H.generateDefaultLessons(); 
            curSchedule[newId] = { id: newId, title: dayName, date: dateStr, lessons: autoLessons };
            addedCount++;
        }
    }
    if (addedCount > 0) onUpdate(state);
  };

  const deleteDay = (dayId: string) => { 
    if (!targetScheduleKey || !state.schedules[targetScheduleKey]?.[dayId]) return;
    if (isDayInPast(state.schedules[targetScheduleKey][dayId].date)) return; 
    if (!window.confirm(t('delete_day_confirm'))) return; 
    delete state.schedules[targetScheduleKey][dayId]; 
    onUpdate(state); 
  };
  const updateDayField = (dayId: string, field: string, val: any) => { 
    if (!targetScheduleKey || !state.schedules[targetScheduleKey]?.[dayId]) return;
    if (isDayInPast(state.schedules[targetScheduleKey][dayId].date)) return; 
    (state.schedules[targetScheduleKey][dayId] as any)[field] = val; 
    if (field === 'date') { 
        state.schedules[targetScheduleKey][dayId].title = H.getDayOfWeek(val, lang); 
    } 
    onUpdate(state); 
  };
  const updateLesson = (dayId: string, lIndex: number, field: keyof Lesson, val: string) => { 
    if (!targetScheduleKey || !state.schedules[targetScheduleKey]?.[dayId]?.lessons?.[lIndex]) return;
    if (isDayInPast(state.schedules[targetScheduleKey][dayId].date)) return; 
    (state.schedules[targetScheduleKey][dayId].lessons[lIndex] as any)[field] = val; 
    onUpdate(state); 
  };
  
  const toggleSubgroups = (dayId: string, lIndex: number) => { 
      if (!targetScheduleKey || !state.schedules[targetScheduleKey]?.[dayId]?.lessons?.[lIndex]) return;
      if (isDayInPast(state.schedules[targetScheduleKey][dayId].date)) return; 
      const lesson = state.schedules[targetScheduleKey][dayId].lessons[lIndex]; 
      if (lesson.subgroups && lesson.subgroups.length > 0) { 
          if (confirm(t('confirm_merge_groups'))) { lesson.subgroups = undefined; onUpdate(state); } 
      } else { 
          if (classGroups.length === 0) return alert(t('groups_not_created')); 
          lesson.subgroups = classGroups.map(g => ({ groupId: g.id, subject: lesson.lesson || '', teacherId: lesson.teacherId || '', room: lesson.room || '' })); 
          onUpdate(state); 
      } 
  };

  const updateSubgroup = (dayId: string, lIndex: number, groupIdx: number, field: keyof any, val: string) => {
      if (!targetScheduleKey || !state.schedules[targetScheduleKey]?.[dayId]?.lessons?.[lIndex]) return;
      if (isDayInPast(state.schedules[targetScheduleKey][dayId].date)) return;
      const day = state.schedules[targetScheduleKey][dayId];
      const lesson = day.lessons[lIndex];
      if (lesson.subgroups && lesson.subgroups[groupIdx]) {
          (lesson.subgroups[groupIdx] as any)[field] = val;
          const currentSg = lesson.subgroups[groupIdx];
          const tId = currentSg.teacherId;
          if (tId) {
              if (field === 'room' || field === 'subject') {
                  lesson.subgroups.forEach(sg => { if (sg.teacherId === tId) (sg as any)[field] = val; });
              }
              if (field === 'teacherId') {
                  const siblingSg = lesson.subgroups.find(sg => sg !== currentSg && sg.teacherId === tId);
                  if (siblingSg) { currentSg.room = siblingSg.room; currentSg.subject = siblingSg.subject; }
              }
          }
          onUpdate(state);
      }
  };
  const addLesson = (dayId: string) => { 
    if (!targetScheduleKey || !state.schedules[targetScheduleKey]?.[dayId]) return;
    if (isDayInPast(state.schedules[targetScheduleKey][dayId].date)) return; 
    const lessons = state.schedules[targetScheduleKey][dayId].lessons; 
    const lastLesson = lessons[lessons.length - 1]; 
    const prevTime = lastLesson ? lastLesson.timeRange : '08:30 - 09:15'; 
    const nextTime = lastLesson ? H.calculateNextTimeRange(prevTime) : '08:30 - 09:15'; 
    lessons.push({ id: H.uid('l'), timeRange: nextTime, lesson: '', teacherId: '', room: '' }); 
    onUpdate(state); 
  };
  const deleteLesson = (dayId: string, lIdx: number) => { 
    if (!targetScheduleKey || !state.schedules[targetScheduleKey]?.[dayId]?.lessons) return;
    if (isDayInPast(state.schedules[targetScheduleKey][dayId].date)) return; 
    if (!window.confirm(t('confirm_delete'))) return; 
    state.schedules[targetScheduleKey][dayId].lessons.splice(lIdx, 1); 
    onUpdate(state); 
  };
  const handleAddSubject = () => { 
    if (newSubj.trim()) { 
      const trimmed = newSubj.trim();
      const current = H.getSchoolSubjects(state, user.schoolId);
      if (!current.includes(trimmed)) {
        const updated = [...current, trimmed];
        H.setSchoolSubjects(state, user.schoolId, updated);
        onUpdate(state); 
        setNewSubj(''); 
      }
    } 
  };
  const deleteSubject = (s: string) => { 
    if(!window.confirm(`${t('confirm_delete')} "${s}"?`)) return; 
    const current = H.getSchoolSubjects(state, user.schoolId);
    const updated = current.filter(sub => sub !== s);
    H.setSchoolSubjects(state, user.schoolId, updated);
    onUpdate(state); 
  };
  
  const openTeacherLabelModal = (dayId: string, lIndex: number, sgIdx: number | null) => {
      if (!targetScheduleKey || !state.schedules[targetScheduleKey]?.[dayId]?.lessons?.[lIndex]) return;
      const day = state.schedules[targetScheduleKey][dayId];
      const lesson = day.lessons[lIndex];
      let currentLabel = '';
      let currentCanGrade = false;
      if (sgIdx !== null && lesson.subgroups && lesson.subgroups[sgIdx]) {
          currentLabel = lesson.subgroups[sgIdx].teacherLabel || '';
          currentCanGrade = !!lesson.subgroups[sgIdx].canGrade;
      } else {
          currentLabel = lesson.teacherLabel || '';
          currentCanGrade = !!lesson.canGrade;
      }
      setLabelModal({isOpen: true, dayId, lIndex, sgIdx, text: currentLabel, canGrade: currentCanGrade});
  };

  const saveTeacherLabel = () => {
      const { dayId, lIndex, sgIdx, text, canGrade } = labelModal;
      if (!targetScheduleKey || !state.schedules[targetScheduleKey]?.[dayId]?.lessons?.[lIndex]) return;
      const day = state.schedules[targetScheduleKey][dayId];
      const lesson = day.lessons[lIndex];
      if (sgIdx !== null && lesson.subgroups && lesson.subgroups[sgIdx]) {
          lesson.subgroups[sgIdx].teacherLabel = text;
          lesson.subgroups[sgIdx].canGrade = canGrade;
      } else {
          lesson.teacherLabel = text;
          lesson.canGrade = canGrade;
      }
      onUpdate(state);
      setLabelModal({...labelModal, isOpen: false});
  };

  const getTeacherDisplay = (u: any) => {
      const subjects = state.teacherAssignments.filter(a => a.teacherId === u.id).map(a => a.subject);
      const uniqueSubjs = Array.from(new Set(subjects));
      return `${u.fio}${uniqueSubjs.length > 0 ? ` (${uniqueSubjs.slice(0,2).join(', ')}${uniqueSubjs.length>2?'...':''})` : ''}`;
  };

  const handleQuarterDateChange = (q: string, type: 'start' | 'end', value: string) => {
    if (!state.scheduleSettings.quarterDefinitions) state.scheduleSettings.quarterDefinitions = {};
    if (!state.scheduleSettings.quarterDefinitions[q]) state.scheduleSettings.quarterDefinitions[q] = {start:'', end:''};
    state.scheduleSettings.quarterDefinitions[q][type] = value;
    const allScheduleDates = new Set<string>();
    Object.values(state.schedules).forEach(classDays => { Object.values(classDays).forEach(day => { if(day.date) allScheduleDates.add(day.date); }); });
    const quarterKeys = ['Q1', 'Q2', 'Q3', 'Q4'];
    quarterKeys.forEach(qKey => {
        const def = state.scheduleSettings.quarterDefinitions![qKey];
        if (!state.quarters[qKey]) state.quarters[qKey] = [];
        if (def && def.start && def.end) {
            state.quarters[qKey] = state.quarters[qKey].filter(d => d >= def.start && d <= def.end);
            allScheduleDates.forEach(date => { if (date >= def.start && date <= def.end) { if (!state.quarters[qKey].includes(date)) { state.quarters[qKey].push(date); } } });
            state.quarters[qKey].sort();
        }
    });
    onUpdate(state);
  };

  const visibleDates = visibleDayKeys.map(k => schedule[k].date);
  const vacationInfo = H.getVacationForWeek(currentWeekStart, state.scheduleSettings, visibleDates);
  const daysOfWeek = [t('days_sun_short'), t('days_mon_short'), t('days_tue_short'), t('days_wed_short'), t('days_thu_short'), t('days_fri_short'), t('days_sat_short')];

  return (
    <div className="space-y-8">
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft dark:bg-slate-900 dark:border-slate-800 no-print space-y-4 xl:space-y-0 xl:flex xl:gap-4 xl:items-end">
        <div className="w-full xl:w-64">
            <label className="block text-sm font-bold text-slate-700 mb-2 dark:text-slate-300">{t('choose_class')}</label>
            <Select value={activeClass} onChange={e => setActiveClass(e.target.value)} className="h-[42px]">
                 {schoolClasses.map(c => <option key={`${c.class}_${c.letter}`} value={`${c.class}_${c.letter}`}>{c.class}{c.letter}</option>)}
            </Select>
        </div>
        <div className="flex-1 flex items-end justify-center bg-slate-50 p-1 rounded-xl border border-slate-200 dark:bg-slate-800 dark:border-slate-700 h-[42px]">
             <Button variant="ghost" onClick={goPrevWeek} className="px-3 h-full"><ChevronLeft size={20}/></Button>
             <div className="flex-1 px-2 text-center flex flex-col justify-center h-full">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider leading-none">{t('week')}</div>
                <div className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight whitespace-nowrap">{H.getWeekRangeString(currentWeekStart)}</div>
             </div>
             <Button variant="ghost" onClick={goNextWeek} className="px-3 h-full"><ChevronRight size={20}/></Button>
        </div>
        <div className="w-full xl:w-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            <Button variant="secondary" onClick={goCurrentWeek} className="h-[42px] px-2 text-xs font-semibold justify-center bg-white border border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><Calendar size={14} className="mr-1.5 flex-shrink-0"/> {t('current')}</Button>
            <Button variant="secondary" onClick={() => setShowSettingsModal(true)} className="h-[42px] px-2 text-xs font-semibold justify-center bg-white border border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><Settings size={14} className="mr-1.5 flex-shrink-0"/> {t('setup_schedule')}</Button>
            <Button onClick={() => setShowBatchCopyModal(true)} variant="secondary" className="h-[42px] px-2 text-xs font-semibold justify-center bg-white border border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><Copy size={14} className="mr-1.5 flex-shrink-0"/> {t('copy_prev_week')}</Button>
            <Button onClick={() => setShowSubjModal(true)} variant="secondary" className="h-[42px] px-2 text-xs font-semibold justify-center bg-white border border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><BookOpen size={14} className="mr-1.5 flex-shrink-0"/> {t('subjects')}</Button>
            <Button onClick={() => window.print()} variant="secondary" className="h-[42px] px-2 text-xs font-semibold justify-center bg-white border border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><Printer size={14} className="mr-1.5 flex-shrink-0"/> {t('print')}</Button>
        </div>
      </div>
      <div className="space-y-6 print:space-y-6 print:block">
        <div className="hidden print:block text-2xl font-bold text-center mb-4">{t('schedule_for')}{activeClass.replace('_', '')}</div>
        {isPastWeek && <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex items-center gap-3 no-print"><Lock size={18} /><span className="text-sm font-semibold">{t('past_edit_forbidden')}</span></div>}
        {visibleDayKeys.length === 0 && (
          <div className="text-slate-400 p-12 border-2 border-dashed border-slate-200 rounded-2xl text-center bg-slate-50 dark:bg-slate-900 dark:border-slate-800">
            {t('empty_schedule_msg')} ({H.getWeekRangeString(currentWeekStart)})<br/>
            {!isPastWeek && <div className="mt-4"><Button onClick={() => setConfirmCopyModal(true)} variant="primary" className="bg-indigo-600 hover:bg-indigo-700"><Copy size={16} className="mr-2"/> {t('copy_prev_week')}</Button></div>}
            {!isPastWeek && visibleDayKeys.length === 0 && <span className="mt-2 inline-block ml-4 text-sm">{t('add_days_hint')}</span>}
          </div>
        )}
        {visibleDayKeys.map(dayKey => {
           const day = schedule[dayKey];
           const holidayInfo = H.isHoliday(day.date, state.scheduleSettings);
           const vacForDay = H.getVacationForDay(day.date, state.scheduleSettings);
           const isPast = isDayInPast(day.date);
           const isVacationDay = !!vacForDay;
           const isHolidayDay = !!holidayInfo;
           let borderClass = isPast ? 'border-slate-200 opacity-60' : 'border-slate-300 dark:border-slate-700';
           let bgClass = isPast ? 'bg-slate-50 dark:bg-slate-950' : 'bg-white dark:bg-slate-900';
           if (isHolidayDay) { borderClass = 'border-red-200 dark:border-red-900/50'; } else if (isVacationDay) { borderClass = 'border-green-200 dark:border-green-900/50'; bgClass = 'bg-green-50/20 dark:bg-green-900/10'; }
           const isGroupColVisible = day.showGroups === true; 
           return (
             <div key={dayKey} className={`border rounded-xl shadow-sm break-inside-avoid print:border-slate-400 overflow-hidden relative ${borderClass} ${bgClass}`}>
                {isPast && <div className="absolute top-4 right-4 no-print text-slate-400" title={t('past_day')}><Lock size={16} /></div>}
                {(isHolidayDay || (isVacationDay && !vacationInfo?.isFullWeek)) && <div className={`text-center py-1.5 text-xs font-bold uppercase tracking-widest border-b ${isHolidayDay ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400' : 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:border-green-900/30 dark:text-green-400'}`}>{holidayInfo ? holidayInfo.title : vacForDay?.title}</div>}
                <div className={`flex justify-between items-center p-4 border-b ${isHolidayDay ? 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30' : (isVacationDay ? 'bg-green-50/50 border-green-100 dark:bg-green-900/10 dark:border-green-900/30' : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700')} relative`}>
                   <div className="flex gap-4 items-center w-full justify-center">
                      <div className="flex flex-col items-center"><label className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 no-print">{t('day_of_week')}</label><div className="flex items-center gap-2"><Input disabled={isPast} className="font-bold text-lg w-48 border-slate-300 shadow-none bg-transparent hover:bg-white focus:bg-white px-2 py-1 h-auto text-center" value={day.title} onChange={e => updateDayField(dayKey, 'title', e.target.value)} /></div></div>
                      <div className="flex flex-col items-center"><label className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 no-print">{t('date')}</label><Input disabled={isPast} type="date" className="w-40 text-sm text-slate-600 font-medium border-slate-300 shadow-none bg-transparent hover:bg-white focus:bg-white px-2 py-1 h-auto text-center dark:text-slate-300" value={day.date} onChange={e => updateDayField(dayKey, 'date', e.target.value)} /></div>
                   </div>
                   <div className="flex items-center gap-2 absolute right-4 top-1/2 -translate-y-1/2 no-print">
                       {!isPast && <Button variant="danger" size="sm" onClick={() => deleteDay(dayKey)} className="no-print whitespace-nowrap"><Trash2 size={14} className="mr-1"/> {t('delete_day')}</Button>}
                       {!isPast && (
                           <div className="relative">
                               <button onClick={() => setOpenDaySettings(openDaySettings === dayKey ? null : dayKey)} className="p-2 hover:bg-slate-100 rounded-full transition dark:hover:bg-slate-800 text-slate-500"><MoreVertical size={20} /></button>
                               {openDaySettings === dayKey && (
                                   <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-4 dark:bg-slate-900 dark:border-slate-700 animate-in fade-in slide-in-from-top-2">
                                       <div className="flex justify-between items-center mb-3"><h4 className="font-bold text-sm text-slate-800 dark:text-white">{t('day_settings')}</h4><button onClick={() => setOpenDaySettings(null)}><XIcon size={16} className="text-slate-400"/></button></div>
                                       <label className={`flex items-center gap-3 mb-4 cursor-pointer ${classGroups.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                           <input type="checkbox" disabled={classGroups.length === 0} checked={day.showGroups === true && classGroups.length > 0} onChange={(e) => { const isChecked = e.target.checked; updateDayField(dayKey, 'showGroups', isChecked); if (!isChecked) { day.lessons.forEach(l => l.subgroups = undefined); onUpdate(state); } }} className="rounded text-blue-600 focus:ring-blue-500 w-5 h-5"/>
                                           <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('use_groups')}</span>
                                       </label>
                                       {classGroups.length === 0 && <p className="text-[10px] text-red-500 mb-2 italic">{t('no_groups_class')}</p>}
                                       {day.showGroups && classGroups.length > 0 && (<div className="space-y-2"><p className="text-xs text-slate-500 font-bold uppercase mb-2">{t('split_lessons')}</p><div className="max-h-40 overflow-y-auto custom-scrollbar border border-slate-100 rounded-lg p-1 dark:border-slate-800">{day.lessons.map((l, idx) => (<label key={l.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer dark:hover:bg-slate-800"><input type="checkbox" checked={!!(l.subgroups && l.subgroups.length > 0)} onChange={() => toggleSubgroups(dayKey, idx)} className="rounded text-blue-600"/><span className="text-xs text-slate-600 dark:text-slate-400">{idx + 1}. {l.timeRange.split(' - ')[0]}</span></label>))}</div></div>)}
                                   </div>
                               )}
                           </div>
                       )}
                   </div>
                </div>
                <div className="p-0 text-center-all bg-white/50 dark:bg-slate-900/50 overflow-x-auto">
                  <table className="w-full text-sm border-collapse min-w-[600px]">
                    <thead><tr className="text-center text-slate-500 border-b border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400"><th className="p-2 w-48 min-w-[150px] font-semibold text-center whitespace-nowrap">{t('time')}</th>{isGroupColVisible && <th className="p-2 w-20 font-semibold text-center border-l border-slate-100 dark:border-slate-800">{t('grp')}</th>}<th className="p-2 font-semibold text-center border-l border-slate-100 dark:border-slate-800">{t('subject')}</th><th className="p-2 font-semibold text-center border-l border-slate-100 dark:border-slate-800">{t('teacher')}</th><th className="p-2 w-24 font-semibold text-center border-l border-slate-100 dark:border-slate-800">{t('cabinet')}</th><th className="p-2 w-10 no-print"></th></tr></thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                      {day.lessons.map((lesson, idx) => {
                        const isSplit = lesson.subgroups && lesson.subgroups.length > 0;
                        return (
                        <tr key={lesson.id} className="hover:bg-slate-50/80 transition-colors dark:hover:bg-slate-800/50">
                          <td className="p-2 pl-4 text-center align-top"><Input disabled={isPast} value={lesson.timeRange} onChange={e => updateLesson(dayKey, idx, 'timeRange', e.target.value)} className="text-sm font-mono font-medium text-center" /></td>
                          {isGroupColVisible && (<td className="p-0 align-top border-l border-slate-50 dark:border-slate-800">{isSplit ? (<div className="divide-y divide-slate-100 dark:divide-slate-800">{lesson.subgroups?.map(sg => { const groupName = classGroups.find(g => g.id === sg.groupId)?.name || t('subgroup_label'); return (<div key={sg.groupId} className="min-h-[42px] h-auto flex items-center justify-center text-[9px] font-bold text-blue-600 dark:text-blue-400 px-1 truncate bg-blue-50/10" title={groupName}>{groupName}</div>); })}</div>) : (<div className="min-h-[42px] flex items-center justify-center text-slate-300">-</div>)}</td>)}
                          <td className="p-0 align-top border-l border-slate-50 dark:border-slate-800">{isSplit ? (<div className="divide-y divide-slate-100 dark:divide-slate-800">{lesson.subgroups?.map((sg, sgIdx) => (<div key={sg.groupId} className="min-h-[42px] h-auto flex items-center p-1 bg-blue-50/20 dark:bg-blue-900/10"><Select disabled={isPast} value={sg.subject} onChange={e => updateSubgroup(dayKey, idx, sgIdx, 'subject', e.target.value)} className="text-sm text-center border-blue-100 dark:border-slate-700 w-full"><option value="">-- {t('subject')} --</option>{schoolSubjects.map(s => <option key={s} value={s}>{s}</option>)}</Select></div>))}</div>) : (<div className="p-2"><Select disabled={isPast} value={lesson.lesson} onChange={e => updateLesson(dayKey, idx, 'lesson', e.target.value)} className="text-sm text-center"><option value="">-- {t('subject')} --</option>{schoolSubjects.map(s => <option key={s} value={s}>{s}</option>)}</Select></div>)}</td>
                          <td className="p-0 align-top border-l border-slate-50 dark:border-slate-800">{isSplit ? (<div className="divide-y divide-slate-100 dark:divide-slate-800">{lesson.subgroups?.map((sg, sgIdx) => (<div key={sg.groupId} className="min-h-[42px] h-auto flex flex-col justify-center p-1 bg-blue-50/20 dark:bg-blue-900/10 gap-0.5"><div className="flex gap-1 items-center w-full"><Select disabled={isPast} value={sg.teacherId} onChange={e => updateSubgroup(dayKey, idx, sgIdx, 'teacherId', e.target.value)} className="text-sm text-center border-blue-100 dark:border-slate-700 w-full"><option value="">-- {t('teacher')} --</option>{state.users.filter(u => u.role === 'teacher').map(u => { const conflictClass = getTeacherConflictDetails(u.id, day.date, lesson.timeRange, activeClass, lesson.id); return (<option key={u.id} value={u.id} disabled={!!conflictClass}>{getTeacherDisplay(u)} {conflictClass ? `🔒 (в ${conflictClass})` : ''}</option>); })}</Select>{!isPast && <button onClick={() => openTeacherLabelModal(dayKey, idx, sgIdx)} className="p-1 hover:bg-blue-200 rounded text-blue-500 flex-shrink-0" title={t('add_label')}><Type size={12}/></button>}</div>{sg.teacherLabel && <div className="text-[9px] text-red-500 font-bold text-center leading-none mt-0.5">{sg.teacherLabel}</div>}</div>))}</div>) : (<div className="p-2 flex flex-col gap-0.5"><div className="flex gap-1 items-center w-full"><Select disabled={isPast} value={lesson.teacherId} onChange={e => updateLesson(dayKey, idx, 'teacherId', e.target.value)} className="text-sm text-center w-full"><option value="">-- {t('teacher')} --</option>{state.users.filter(u => u.role === 'teacher').map(u => { const conflictClass = getTeacherConflictDetails(u.id, day.date, lesson.timeRange, activeClass, lesson.id); return (<option key={u.id} value={u.id} disabled={!!conflictClass}>{getTeacherDisplay(u)} {conflictClass ? `🔒 (в ${conflictClass})` : ''}</option>); })}</Select>{!isPast && <button onClick={() => openTeacherLabelModal(dayKey, idx, null)} className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-blue-500 flex-shrink-0" title={t('add_label')}><Type size={14}/></button>}</div>{lesson.teacherLabel && <div className="text-[10px] text-red-500 font-bold text-center">{lesson.teacherLabel}</div>}</div>)}</td>
                          <td className="p-0 align-top border-l border-slate-50 dark:border-slate-800">{isSplit ? (<div className="divide-y divide-slate-100 dark:divide-slate-800">{lesson.subgroups?.map((sg, sgIdx) => (<div key={sg.groupId} className="min-h-[42px] h-auto flex items-center p-1 bg-blue-50/20 dark:bg-blue-900/10"><Input disabled={isPast} value={sg.room} onChange={e => updateSubgroup(dayKey, idx, sgIdx, 'room', e.target.value)} className="text-sm w-full text-center border-blue-100 dark:border-slate-700" placeholder={t('room_placeholder')} /></div>))}</div>) : (<div className="p-2"><Input disabled={isPast} value={lesson.room} onChange={e => updateLesson(dayKey, idx, 'room', e.target.value)} className="text-sm w-full text-center" placeholder={t('room_placeholder')} /></div>)}</td>
                          <td className="p-2 no-print text-center align-middle">{!isPast && <button onClick={() => deleteLesson(dayKey, idx)} className="text-slate-300 hover:text-red-500 transition-colors dark:text-slate-600 dark:hover:text-red-400">&times;</button>}</td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                  {!isPast && <div className="p-3 text-center no-print bg-slate-50 border-t border-slate-100 dark:bg-slate-800/50 dark:border-slate-800"><Button disabled={isPastWeek} variant="ghost" size="sm" className="w-full border-dashed border-slate-300 text-slate-500 hover:text-blue-600 hover:border-blue-300 dark:border-slate-700 dark:hover:border-blue-500" onClick={() => addLesson(dayKey)}>+ {t('add_next_lesson')}</Button></div>}
                </div>
             </div>
           )
        })}
      </div>
      {canAddMoreDaysToWeek && !isPastWeek && <div className="flex justify-center no-print"><Button variant="primary" className="w-full py-4 text-lg border-2 border-blue-200 border-dashed bg-blue-50 text-blue-700 hover:bg-blue-100 shadow-none dark:bg-slate-900 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-slate-800" onClick={addDaysWithSettings}>+ {t('add_days')} ({scheduleSettings.daysToAddBatch} {t('pcs')})</Button></div>}
      <Modal isOpen={showBatchCopyModal} onClose={() => setShowBatchCopyModal(false)} title={t('copy_schedule_title')}><div className="space-y-4"><p className="text-sm text-slate-600 dark:text-slate-300">{t('copy_schedule_body')}</p><div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg p-2 dark:border-slate-700"><div className="flex justify-between mb-2 px-2"><button onClick={() => setSelectedClassesForCopy(schoolClasses.map(c => `${c.class}_${c.letter}`))} className="text-xs text-blue-600 font-bold hover:underline">{t('select_all')}</button><button onClick={() => setSelectedClassesForCopy([])} className="text-xs text-slate-400 hover:text-slate-600">{t('reset')}</button></div>{schoolClasses.map(c => { const key = `${c.class}_${c.letter}`; return (<label key={key} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer dark:hover:bg-slate-800"><input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500" checked={selectedClassesForCopy.includes(key)} onChange={(e) => { if (e.target.checked) setSelectedClassesForCopy([...selectedClassesForCopy, key]); else setSelectedClassesForCopy(selectedClassesForCopy.filter(k => k !== key)); }} /><span className="font-medium text-slate-700 dark:text-slate-200">{c.class}{c.letter}</span></label>); })}</div><div className="flex gap-2 justify-end"><Button variant="ghost" onClick={() => setShowBatchCopyModal(false)}>{t('cancel')}</Button><Button variant="primary" onClick={copyScheduleBatch}>{t('copy')}</Button></div></div></Modal>
      <Modal isOpen={confirmCopyModal} onClose={() => setConfirmCopyModal(false)} title={t('copy_schedule_short')}><div className="space-y-6"><div className="bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-100 flex items-start gap-3"><AlertCircle className="flex-shrink-0 mt-0.5" size={20}/><div><p className="font-bold mb-1">{t('copy_from_prev_q')}</p><p className="text-sm opacity-90">{t('copy_warning_msg').replace('%s', activeClass.replace('_', ''))}</p></div></div><div className="flex gap-3 justify-end"><Button variant="ghost" onClick={() => setConfirmCopyModal(false)}>{t('cancel')}</Button><Button variant="primary" onClick={copyScheduleForCurrentClass}>{t('confirm')}</Button></div></div></Modal>
      <Modal isOpen={labelModal.isOpen} onClose={() => setLabelModal({...labelModal, isOpen: false})} title={t('add_label_title')}><div className="space-y-4"><p className="text-sm text-slate-600 dark:text-slate-300">{t('add_label_desc')}</p><div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">{t('label_text')}</label><Input autoFocus value={labelModal.text} onChange={e => setLabelModal({...labelModal, text: e.target.value})} placeholder={t('label_placeholder')} /></div><div><label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${labelModal.canGrade ? 'bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700' : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}><div className="pt-0.5"><input type="checkbox" checked={labelModal.canGrade} onChange={e => setLabelModal({...labelModal, canGrade: e.target.checked})} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300" /></div><div><span className={`block text-sm font-bold mb-0.5 ${labelModal.canGrade ? 'text-blue-900 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>{t('substitution_confirm')}</span><span className={`text-xs font-medium ${labelModal.canGrade ? 'text-blue-700 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>{labelModal.canGrade ? t('access_granted') : t('access_denied')}</span></div></label></div><div className="flex gap-2 justify-end pt-2"><Button variant="ghost" onClick={() => setLabelModal({...labelModal, isOpen: false})}>{t('cancel')}</Button><Button variant="primary" onClick={saveTeacherLabel}>{t('save')}</Button></div></div></Modal>
      <Modal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} title={t('setup_schedule')}><div className="space-y-6"><div><label className="block text-sm font-bold text-slate-700 mb-2 dark:text-slate-300">{t('days_batch')}</label><Input type="number" min="1" max="7" value={state.scheduleSettings.daysToAddBatch} onChange={e => { state.scheduleSettings.daysToAddBatch = parseInt(e.target.value); onUpdate(state); }} /></div><div><label className="block text-sm font-bold text-slate-700 mb-2 dark:text-slate-300">{t('skip_days')}</label><div className="flex flex-wrap gap-2">{daysOfWeek.map((day, idx) => { const isSkipped = state.scheduleSettings.skippedWeekDays.includes(idx); return (<button key={idx} onClick={() => { const current = state.scheduleSettings.skippedWeekDays; if (isSkipped) { state.scheduleSettings.skippedWeekDays = current.filter(d => d !== idx); } else { state.scheduleSettings.skippedWeekDays = [...current, idx]; } onUpdate(state); }} className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${isSkipped ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>{day} {isSkipped ? t('skipped_label') : ''}</button>); })}</div></div><div className="border-t border-slate-200 pt-4 dark:border-slate-700"><h4 className="font-bold text-slate-800 mb-4 dark:text-white">{t('quarter_dates')}</h4><div className="grid grid-cols-1 gap-3">{['Q1', 'Q2', 'Q3', 'Q4'].map((q) => { const def = state.scheduleSettings?.quarterDefinitions?.[q] || { start: '', end: '' }; return (<div key={q} className="flex items-center gap-2 text-sm"><span className="w-8 font-bold text-slate-600 dark:text-slate-400">{q}</span><div className="flex-1 flex gap-2"><Input type="date" value={def.start} onChange={e => handleQuarterDateChange(q, 'start', e.target.value)} /><span className="text-slate-400 self-center">—</span><Input type="date" value={def.end} onChange={e => handleQuarterDateChange(q, 'end', e.target.value)} /></div></div>); })}</div></div><div className="border-t border-slate-200 pt-4 dark:border-slate-700"><h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 dark:text-white"><CalendarRange size={18}/> {t('holidays_vacations')}</h4><div className="mb-6"><label className="text-xs font-bold uppercase text-slate-500 mb-2 block">{t('holidays_daily')}</label><div className="flex gap-2 mb-2 items-end"><div className="w-1/2"><label className="text-[10px] text-slate-400">{t('select_date')}</label><Input type="date" id="newHolidayDate" className="h-[42px]" /></div><div className="w-1/2"><label className="text-[10px] text-slate-400">{t('holiday_name')}</label><Input type="text" id="newHolidayTitle" placeholder={t('example_holiday')} className="h-[42px]" /></div></div><Button size="sm" className="w-full mb-3" onClick={() => { const dateEl = document.getElementById('newHolidayDate') as HTMLInputElement; const titleEl = document.getElementById('newHolidayTitle') as HTMLInputElement; if (dateEl.value && !state.scheduleSettings.holidays.find(h => h.date === dateEl.value)) { state.scheduleSettings.holidays.push({ date: dateEl.value, title: titleEl.value || 'Выходной' }); state.scheduleSettings.holidays.sort((a,b) => a.date.localeCompare(b.date)); onUpdate(state); titleEl.value = ''; } }}>{t('add_holiday')}</Button><div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">{state.scheduleSettings.holidays.map(h => (<span key={h.date} className="bg-red-50 text-red-700 px-2 py-1 rounded text-xs font-bold border border-red-100 flex items-center gap-1 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">{H.formatDateDDMMYYYY(h.date)}: {h.title} <button onClick={() => { state.scheduleSettings.holidays = state.scheduleSettings.holidays.filter(x => x.date !== h.date); onUpdate(state); }}>&times;</button></span>))}</div></div><div><label className="text-xs font-bold uppercase text-slate-500 mb-2 block">{t('vacation_periods')}</label><div className="grid grid-cols-3 gap-2 mb-2 items-end"><div><label className="text-[10px] text-slate-400">{t('from_date')}</label><Input type="date" id="vacStart" className="h-[42px]" /></div><div><label className="text-[10px] text-slate-400">{t('to_date')}</label><Input type="date" id="vacEnd" className="h-[42px]" /></div><div><label className="text-[10px] text-slate-400">{t('title')}</label><Input id="vacTitle" placeholder={t('example_vacation')} className="h-[42px]" /></div></div><Button size="sm" className="w-full mb-3" onClick={() => { const start = (document.getElementById('vacStart') as HTMLInputElement).value; const end = (document.getElementById('vacEnd') as HTMLInputElement).value; const title = (document.getElementById('vacTitle') as HTMLInputElement).value || t('example_vacation'); if (start && end) { state.scheduleSettings.vacations.push({ id: H.uid('vac'), start, end, title }); onUpdate(state); } }}>{t('add_period')}</Button><div className="space-y-2">{state.scheduleSettings.vacations.map(v => (<div key={v.id} className="flex justify-between items-center bg-green-50 p-2 rounded border border-green-100 text-xs dark:bg-green-900/20 dark:border-green-800"><span className="font-bold text-green-800 dark:text-green-300">{v.title}</span><span className="text-green-600 dark:text-green-400">{H.formatDateDDMMYYYY(v.start)} — {H.formatDateDDMMYYYY(v.end)}</span><button onClick={() => { state.scheduleSettings.vacations = state.scheduleSettings.vacations.filter(x => x.id !== v.id); onUpdate(state); }} className="text-red-500 font-bold">&times;</button></div>))}</div></div></div></div></Modal>
      <Modal isOpen={showSubjModal} onClose={() => setShowSubjModal(false)} title={t('manage_subjects')}><div className="flex gap-2 mb-4"><Input value={newSubj} onChange={e => setNewSubj(e.target.value)} placeholder={t('subject_name')} /><Button onClick={handleAddSubject}>{t('add')}</Button></div><div className="max-h-60 overflow-y-auto border rounded-lg divide-y dark:border-slate-700 dark:divide-slate-700">{schoolSubjects.map(s => (<div key={s} className="p-2 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800"><span>{s}</span><button onClick={() => deleteSubject(s)} className="text-red-500 hover:text-red-700 font-bold">&times;</button></div>))}</div></Modal>
    </div>
  );
};
