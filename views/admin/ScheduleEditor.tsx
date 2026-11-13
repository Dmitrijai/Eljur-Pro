
import React, { useState, useEffect } from 'react';
import { AppState, Lesson, ScheduleSettings } from '../../types';
import * as H from '../../utils/helpers';
import { Button, Input, Select, Modal } from '../../components/ui';
import { ChevronLeft, ChevronRight, Calendar, Settings, Copy, BookOpen, Printer, Lock, Trash2, MoreVertical, X as XIcon, Type, AlertCircle, CalendarRange } from 'lucide-react';

const isValidCompleteIsoDate = (str: string): boolean => {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [yStr, mStr, dStr] = str.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const parsed = new Date(y, m - 1, d);
  return parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d;
};

const BufferedDateInput = ({
  value,
  min,
  disabled,
  className,
  onCommit
}: {
  value: string;
  min?: string;
  disabled?: boolean;
  className?: string;
  onCommit: (newDate: string) => void;
}) => {
  const [draft, setDraft] = useState(value);
  const isFocusedRef = React.useRef(false);
  const isTypingRef = React.useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setDraft(value);
    }
  }, [value]);

  const commitIfValid = (candidate: string) => {
    if (!isValidCompleteIsoDate(candidate)) {
      setDraft(value);
      return;
    }
    if (min && candidate < min) {
      setDraft(value);
      return;
    }
    if (candidate !== value) {
      onCommit(candidate);
    }
  };

  return (
    <Input
      type="date"
      disabled={disabled}
      min={min}
      className={className}
      value={draft}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onPointerDown={() => {
        isTypingRef.current = false;
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          isTypingRef.current = false;
          commitIfValid(draft);
          (e.currentTarget as HTMLInputElement).blur();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          isTypingRef.current = false;
          setDraft(value);
          (e.currentTarget as HTMLInputElement).blur();
          return;
        }
        if (e.key !== 'Tab') {
          isTypingRef.current = true;
        }
      }}
      onChange={(e) => {
        const nextVal = e.target.value;
        setDraft(nextVal);
        if (!isTypingRef.current && isValidCompleteIsoDate(nextVal)) {
          if (min && nextVal < min) {
            setDraft(value);
            return;
          }
          if (nextVal !== value) {
            onCommit(nextVal);
          }
        }
      }}
      onBlur={() => {
        isFocusedRef.current = false;
        isTypingRef.current = false;
        commitIfValid(draft);
      }}
    />
  );
};

const BufferedTimeRangeInput = ({
  value,
  lessonDuration = 45,
  disabled,
  className,
  onCommit
}: {
  value: string;
  lessonDuration?: number;
  disabled?: boolean;
  className?: string;
  onCommit: (newRange: string) => void;
}) => {
  const [draft, setDraft] = useState(value);
  const isFocusedRef = React.useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setDraft(value);
    }
  }, [value]);

  const commitFormatted = (rawCandidate: string) => {
    const formatted = H.normalizeLessonTimeRange(rawCandidate, lessonDuration, value || '08:30 - 09:15');
    setDraft(formatted);
    if (formatted !== value) {
      onCommit(formatted);
    }
  };

  return (
    <Input
      maxLength={25}
      disabled={disabled}
      className={className}
      value={draft}
      placeholder="08:30 - 09:15"
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onChange={(e) => {
        setDraft(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitFormatted(draft);
          (e.currentTarget as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setDraft(value);
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      onBlur={() => {
        isFocusedRef.current = false;
        commitFormatted(draft);
      }}
    />
  );
};

const BufferedSingleTimeInput = ({
  value,
  disabled,
  className,
  onCommit
}: {
  value: string;
  disabled?: boolean;
  className?: string;
  onCommit: (newTime: string) => void;
}) => {
  const [draft, setDraft] = useState(value);
  const isFocusedRef = React.useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setDraft(value);
    }
  }, [value]);

  const commitFormatted = (rawCandidate: string) => {
    const formatted = H.normalizeSingleTimeInput(rawCandidate, value || '08:30');
    setDraft(formatted);
    if (formatted !== value) {
      onCommit(formatted);
    }
  };

  return (
    <Input
      maxLength={10}
      disabled={disabled}
      className={className}
      value={draft}
      placeholder="08:30"
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onChange={(e) => {
        setDraft(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitFormatted(draft);
          (e.currentTarget as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setDraft(value);
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      onBlur={() => {
        isFocusedRef.current = false;
        commitFormatted(draft);
      }}
    />
  );
};

const BufferedDurationInput = ({
  value,
  disabled,
  className,
  onCommit
}: {
  value: number;
  disabled?: boolean;
  className?: string;
  onCommit: (newDuration: number) => void;
}) => {
  const [draft, setDraft] = useState(String(value || 45));
  const isFocusedRef = React.useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setDraft(String(value || 45));
    }
  }, [value]);

  const commitFormatted = (rawCandidate: string) => {
    const parsed = parseInt(rawCandidate.trim(), 10);
    const clamped = !isNaN(parsed) ? Math.max(5, Math.min(240, parsed)) : (value || 45);
    setDraft(String(clamped));
    if (clamped !== value) {
      onCommit(clamped);
    }
  };

  return (
    <Input
      type="number"
      min="5"
      max="240"
      maxLength={3}
      disabled={disabled}
      className={className}
      value={draft}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onChange={(e) => {
        setDraft(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitFormatted(draft);
          (e.currentTarget as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setDraft(String(value || 45));
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      onBlur={() => {
        isFocusedRef.current = false;
        commitFormatted(draft);
      }}
    />
  );
};

export const ScheduleEditor = ({ state, onUpdate, user }: { state: AppState, onUpdate: (s: AppState) => void, user: import("../../types").User }) => {
  const schoolClasses = H.getSchoolClasses(state, user.schoolId);
  const schoolSubjects = H.getSchoolSubjects(state, user.schoolId);
  const [activeClass, setActiveClass] = H.useSyncedState<string>(`eljur_admin_sched_cls_${user.id}`, schoolClasses[0] ? `${schoolClasses[0].class}_${schoolClasses[0].letter}` : '');
  const [newSubj, setNewSubj] = useState('');
  const [showSubjModal, setShowSubjModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showBatchCopyModal, setShowBatchCopyModal] = useState(false);
  const [selectedClassesForCopy, setSelectedClassesForCopy] = useState<string[]>([]);
  
  const [labelModal, setLabelModal] = useState<{isOpen: boolean, dayId: string, lIndex: number, sgIdx: number | null, text: string, canGrade: boolean}>({isOpen: false, dayId: '', lIndex: -1, sgIdx: null, text: '', canGrade: false});
  const [confirmCopyModal, setConfirmCopyModal] = useState(false);
  const [openDaySettings, setOpenDaySettings] = useState<string | null>(null);
  const [appliedTimeAllToast, setAppliedTimeAllToast] = useState(false);
  const [selectedSourceClassForCopy, setSelectedSourceClassForCopy] = useState<string>('');
  
  const lang = state.settings.language || 'ru';
  const t = (k: string) => H.t(k, lang);
  const scheduleSettings = H.getSchoolScheduleSettings(state, user.schoolId);
  const activeClassTimeConfig = H.getClassScheduleTimeConfig(scheduleSettings, activeClass);
  
  const systemNow = H.getSchoolNow(state, user.schoolId);
  const [currentWeekStartIso, setCurrentWeekStartIso] = H.useSyncedState<string>(`eljur_admin_sched_week_${user.id}`, H.dateToIso(H.getStartOfWeek(systemNow)));
  const currentWeekStart = React.useMemo(() => {
      const parsed = new Date(currentWeekStartIso);
      return isNaN(parsed.getTime()) ? H.getStartOfWeek(systemNow) : H.getStartOfWeek(parsed);
  }, [currentWeekStartIso]);
  const setCurrentWeekStart = (val: Date | ((prev: Date) => Date)) => {
      const nextDate = typeof val === 'function' ? val(currentWeekStart) : val;
      setCurrentWeekStartIso(H.dateToIso(H.getStartOfWeek(nextDate)));
  };

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
  const classGroups = H.getSchoolStudentGroups(state, user.schoolId, activeClass);
  const visibleDayKeys = Object.keys(schedule).filter(key => schedule[key]?.date && H.isDateInWeek(schedule[key].date, currentWeekStart)).sort((a,b) => (schedule[a]?.date || '').localeCompare(schedule[b]?.date || ''));
  
  const goPrevWeek = () => setCurrentWeekStart(d => H.addDays(d, -7));
  const goNextWeek = () => setCurrentWeekStart(d => H.addDays(d, 7));
  const goCurrentWeek = () => setCurrentWeekStart(H.getStartOfWeek(H.getSchoolNow(state, user.schoolId)));

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

      for (const [cKey, days] of Object.entries(state.schedules || {})) {
          if (user.schoolId) {
              if (cKey.includes('__')) {
                  const [schId] = cKey.split('__');
                  if (schId !== user.schoolId) continue;
              } else {
                  if (user.schoolId !== 'school_1') continue;
                  const isClassInThisSchool = schoolClasses.some(sc => `${sc.class}_${sc.letter}` === cKey);
                  if (!isClassInThisSchool) continue;
              }
          }
          const normCKey = normalizeClassKey(cKey);
          const day = Object.values(days || {}).find(d => d && d.date === date);
          if (day && Array.isArray(day.lessons)) {
              const conflict = day.lessons.find(l => {
                  if (!l || l.timeRange !== timeRange) return false;
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

  const getRoomConflictDetails = (room: string, date: string, timeRange: string, excludeClassKey: string, excludeLessonId: string): string | null => {
      if (!room || !room.trim()) return null;
      const cleanRoom = room.trim().toLowerCase();
      const normalizeClassKey = (k: string) => k.includes('__') ? k.split('__').pop() || k : k;
      const normExclude = normalizeClassKey(excludeClassKey);

      for (const [cKey, days] of Object.entries(state.schedules || {})) {
          if (user.schoolId) {
              if (cKey.includes('__')) {
                  const [schId] = cKey.split('__');
                  if (schId !== user.schoolId) continue;
              } else {
                  if (user.schoolId !== 'school_1') continue;
                  const isClassInThisSchool = schoolClasses.some(sc => `${sc.class}_${sc.letter}` === cKey);
                  if (!isClassInThisSchool) continue;
              }
          }
          const normCKey = normalizeClassKey(cKey);
          const day = Object.values(days || {}).find(d => d && d.date === date);
          if (day && Array.isArray(day.lessons)) {
              const conflict = day.lessons.find(l => {
                  if (!l || l.timeRange !== timeRange) return false;
                  if (normCKey === normExclude && l.id === excludeLessonId) return false;
                  if (l.room && l.room.trim().toLowerCase() === cleanRoom) return true;
                  if (l.subgroups && l.subgroups.some(sg => sg.room && sg.room.trim().toLowerCase() === cleanRoom)) return true;
                  return false;
              });
              if (conflict) { return normCKey.replace('_', ''); }
          }
      }
      return null;
  };
  
  const sourceClassGroups = H.getSchoolStudentGroups(state, user.schoolId, activeClass);
  const allGroups = state.studentGroups || [];

  const getMergedClassCopyCounts = (): Record<string, number> => {
      const fromSettings = scheduleSettings.classCopyCounts || {};
      let fromLocal: Record<string, number> = {};
      try {
          const raw = localStorage.getItem(`eljur_sched_copy_counts_${user.schoolId || 'school_1'}`);
          if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === 'object') fromLocal = parsed;
          }
      } catch {}
      const merged: Record<string, number> = { ...fromLocal, ...fromSettings };
      Object.keys(fromLocal).forEach(k => {
          merged[k] = Math.max(fromLocal[k] || 0, fromSettings[k] || 0);
      });
      return merged;
  };

  const incrementClassCopyCount = (sourceClsKey: string) => {
      if (!sourceClsKey) return;
      const merged = getMergedClassCopyCounts();
      merged[sourceClsKey] = (merged[sourceClsKey] || 0) + 1;
      try {
          localStorage.setItem(`eljur_sched_copy_counts_${user.schoolId || 'school_1'}`, JSON.stringify(merged));
      } catch {}
      const currentSettings: ScheduleSettings = JSON.parse(JSON.stringify(H.getSchoolScheduleSettings(state, user.schoolId)));
      currentSettings.classCopyCounts = merged;
      H.setSchoolScheduleSettings(state, user.schoolId, currentSettings);
  };

  const hasScheduleOnCurrentWeek = (clsKey: string): boolean => {
      const scopedKey = H.getSchoolClassKey(user.schoolId, clsKey);
      const clsSched = state.schedules[scopedKey] || {};
      return Object.values(clsSched).some(d => d && d.date && H.isDateInWeek(d.date, currentWeekStart));
  };

  const sortedClassesForCopyFrom = React.useMemo(() => {
      const counts = getMergedClassCopyCounts();
      return schoolClasses
          .filter(c => `${c.class}_${c.letter}` !== activeClass)
          .slice()
          .sort((a, b) => {
              const keyA = `${a.class}_${a.letter}`;
              const keyB = `${b.class}_${b.letter}`;
              const countA = counts[keyA] || 0;
              const countB = counts[keyB] || 0;
              if (countB !== countA) return countB - countA;
              const hasCurrA = hasScheduleOnCurrentWeek(keyA) ? 1 : 0;
              const hasCurrB = hasScheduleOnCurrentWeek(keyB) ? 1 : 0;
              if (hasCurrB !== hasCurrA) return hasCurrB - hasCurrA;
              return (parseInt(a.class, 10) - parseInt(b.class, 10)) || a.letter.localeCompare(b.letter);
          });
  }, [schoolClasses, activeClass, scheduleSettings.classCopyCounts, state.schedules, currentWeekStartIso, user.schoolId]);

  const effectiveSourceClassForCopy = React.useMemo(() => {
      if (
          selectedSourceClassForCopy &&
          selectedSourceClassForCopy !== activeClass &&
          sortedClassesForCopyFrom.some(c => `${c.class}_${c.letter}` === selectedSourceClassForCopy)
      ) {
          return selectedSourceClassForCopy;
      }
      return sortedClassesForCopyFrom[0] ? `${sortedClassesForCopyFrom[0].class}_${sortedClassesForCopyFrom[0].letter}` : '';
  }, [selectedSourceClassForCopy, activeClass, sortedClassesForCopyFrom]);

  useEffect(() => {
      if (sortedClassesForCopyFrom.length > 0) {
          const topKey = `${sortedClassesForCopyFrom[0].class}_${sortedClassesForCopyFrom[0].letter}`;
          setSelectedSourceClassForCopy(topKey);
      } else {
          setSelectedSourceClassForCopy('');
      }
  }, [activeClass]);

  const mapLessonsForTargetClass = (lessons: Lesson[], targetClsKey: string, srcClsKey: string = activeClass): Lesson[] => {
      const srcGroupsForClass = srcClsKey === activeClass ? sourceClassGroups : H.getSchoolStudentGroups(state, user.schoolId, srcClsKey);
      let targetGroups = H.getSchoolStudentGroups(state, user.schoolId, targetClsKey);
      
      const hasSubgroups = lessons.some(l => l.subgroups && l.subgroups.length > 0);
      if (hasSubgroups && targetGroups.length === 0) {
          const targetStudents = state.users.filter(u => u.schoolId === user.schoolId && u.role === 'student' && `${u.class}_${u.letter}` === targetClsKey);
          const count = srcGroupsForClass.length > 0 ? srcGroupsForClass.length : 2;
          const chunkSize = targetStudents.length > 0 ? Math.ceil(targetStudents.length / count) : 0;
          for (let i = 0; i < count; i++) {
              const groupStudents = targetStudents.slice(i * chunkSize, (i + 1) * chunkSize).map(u => u.id);
              const newGroup = {
                  id: H.uid('group'),
                  schoolId: user.schoolId,
                  classId: targetClsKey,
                  name: srcGroupsForClass[i]?.name || `Группа ${i + 1}`,
                  studentIds: groupStudents
              };
              if (!state.studentGroups) state.studentGroups = [];
              state.studentGroups.push(newGroup);
              targetGroups.push(newGroup);
          }
      }

      return lessons.map(l => ({
          ...l,
          id: H.uid('l'),
          subgroups: l.subgroups ? l.subgroups.map((sg, sgIdx) => {
              let targetGroupId = sg.groupId;
              if (targetGroups.length > 0) {
                  const alreadyBelongs = targetGroups.some(tg => tg.id === sg.groupId);
                  if (!alreadyBelongs) {
                      const srcGroupIdx = srcGroupsForClass.findIndex(g => g.id === sg.groupId);
                      const srcGroup = srcGroupIdx > -1 ? srcGroupsForClass[srcGroupIdx] : allGroups.find(g => g.id === sg.groupId);
                      if (srcGroup) {
                          const matchedByName = targetGroups.find(tg => tg.name.trim().toLowerCase() === srcGroup.name.trim().toLowerCase());
                          if (matchedByName) targetGroupId = matchedByName.id;
                          else if (srcGroupIdx > -1 && targetGroups[srcGroupIdx]) targetGroupId = targetGroups[srcGroupIdx].id;
                          else targetGroupId = targetGroups[0].id;
                      } else {
                          targetGroupId = targetGroups[sgIdx] ? targetGroups[sgIdx].id : targetGroups[0].id;
                      }
                  }
              }
              return { ...sg, groupId: targetGroupId };
          }) : undefined
      }));
  };

  const copyScheduleStructureFromClass = () => {
      if (!targetScheduleKey || !effectiveSourceClassForCopy) return;
      const srcClassKey = effectiveSourceClassForCopy;
      const srcScopedKey = H.getSchoolClassKey(user.schoolId, srcClassKey);
      const srcSchedule = state.schedules[srcScopedKey] || {};
      const srcCurrentWeekDays = Object.values(srcSchedule)
          .filter(d => d && d.date && H.isDateInWeek(d.date, currentWeekStart))
          .sort((a, b) => a.date.localeCompare(b.date));

      let daysToCopy = srcCurrentWeekDays;
      let shiftDays = 0;

      if (daysToCopy.length === 0) {
          const prevWeekStart = H.addDays(currentWeekStart, -7);
          const srcPrevWeekDays = Object.values(srcSchedule)
              .filter(d => d && d.date && H.isDateInWeek(d.date, prevWeekStart))
              .sort((a, b) => a.date.localeCompare(b.date));
          if (srcPrevWeekDays.length > 0) {
              daysToCopy = srcPrevWeekDays;
              shiftDays = 7;
          }
      }

      if (daysToCopy.length === 0) {
          alert(t('copy_no_curr_week_in_class'));
          return;
      }

      if (!state.schedules[targetScheduleKey]) state.schedules[targetScheduleKey] = {};
      const targetClassSchedule = state.schedules[targetScheduleKey];
      let updated = false;

      daysToCopy.forEach(srcDay => {
          const srcDate = new Date(srcDay.date);
          const newDate = shiftDays !== 0 ? H.addDays(srcDate, shiftDays) : srcDate;
          const newDateStr = H.dateToIso(newDate);
          const exists = Object.values(targetClassSchedule).some(d => d && d.date === newDateStr);
          if (!exists) {
              const newId = H.uid('day');
              const structureLessons: Lesson[] = (srcDay.lessons || []).map(l => ({
                  id: H.uid('l'),
                  timeRange: l.timeRange,
                  lesson: '',
                  teacherId: '',
                  room: ''
              }));
              targetClassSchedule[newId] = {
                  id: newId,
                  title: H.getDayOfWeek(newDateStr, lang),
                  date: newDateStr,
                  lessons: structureLessons,
                  showGroups: false
              };
              updated = true;
          }
      });

      if (updated) {
          incrementClassCopyCount(srcClassKey);
          const currentSettings: ScheduleSettings = JSON.parse(JSON.stringify(H.getSchoolScheduleSettings(state, user.schoolId)));
          if (currentSettings.classTimeSettings?.[srcClassKey] && activeClass && !currentSettings.classTimeSettings[activeClass]) {
              currentSettings.classTimeSettings[activeClass] = { ...currentSettings.classTimeSettings[srcClassKey] };
              H.setSchoolScheduleSettings(state, user.schoolId, currentSettings);
          }
          onUpdate(state);
      } else {
          alert(t('confirm_copy_empty'));
      }
  };

  const copyScheduleBatch = () => {
    if (selectedClassesForCopy.length === 0) return alert(t('select_classes'));
    const prevWeekStart = H.addDays(currentWeekStart, -7);
    let updated = false;
    let copiedFromActiveClass = false;

    const activeSchedule = targetScheduleKey ? (state.schedules[targetScheduleKey] || {}) : {};
    const activeCurrentWeekDays = Object.values(activeSchedule).filter(d => H.isDateInWeek(d.date, currentWeekStart));
    const activePrevWeekDays = Object.values(activeSchedule).filter(d => H.isDateInWeek(d.date, prevWeekStart));

    selectedClassesForCopy.forEach(clsKey => {
        const scopedKey = H.getSchoolClassKey(user.schoolId, clsKey);
        if (!state.schedules[scopedKey]) state.schedules[scopedKey] = {};
        const classSchedule = state.schedules[scopedKey];
        const prevWeekKeys = Object.keys(classSchedule).filter(key => H.isDateInWeek(classSchedule[key].date, prevWeekStart));
        
        if (prevWeekKeys.length > 0) {
            prevWeekKeys.forEach(prevKey => {
                const prevDay = classSchedule[prevKey];
                const prevDate = new Date(prevDay.date);
                const newDate = H.addDays(prevDate, 7);
                const newDateStr = H.dateToIso(newDate);
                const exists = Object.values(classSchedule).some(d => d.date === newDateStr);
                if (!exists) {
                    const newId = H.uid('day');
                    const newLessons = mapLessonsForTargetClass(prevDay.lessons, clsKey, clsKey);
                    state.schedules[scopedKey][newId] = { id: newId, title: prevDay.title, date: newDateStr, lessons: newLessons, showGroups: prevDay.showGroups };
                    updated = true;
                }
            });
        } else if (clsKey !== activeClass && (activeCurrentWeekDays.length > 0 || activePrevWeekDays.length > 0)) {
            const daysToCopy = activeCurrentWeekDays.length > 0 ? activeCurrentWeekDays : activePrevWeekDays;
            const shiftDays = activeCurrentWeekDays.length > 0 ? 0 : 7;
            daysToCopy.forEach(srcDay => {
                const srcDate = new Date(srcDay.date);
                const newDate = shiftDays !== 0 ? H.addDays(srcDate, shiftDays) : srcDate;
                const newDateStr = H.dateToIso(newDate);
                const exists = Object.values(classSchedule).some(d => d.date === newDateStr);
                if (!exists) {
                    const newId = H.uid('day');
                    const newLessons = mapLessonsForTargetClass(srcDay.lessons, clsKey, activeClass);
                    state.schedules[scopedKey][newId] = { id: newId, title: srcDay.title, date: newDateStr, lessons: newLessons, showGroups: srcDay.showGroups };
                    updated = true;
                    copiedFromActiveClass = true;
                }
            });
        }
    });
    if (updated) {
        if (copiedFromActiveClass && activeClass) {
            incrementClassCopyCount(activeClass);
        }
        onUpdate(state);
        setShowBatchCopyModal(false);
        setSelectedClassesForCopy([]);
    } else {
        alert(t('confirm_copy_empty'));
    }
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
                const newLessons = mapLessonsForTargetClass(prevDay.lessons, activeClass, activeClass);
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
            const classTimeCfg = H.getClassScheduleTimeConfig(settings, activeClass);
            const autoLessons = H.generateDefaultLessons(classTimeCfg.startTime, classTimeCfg.lessonDuration); 
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
    const currentDay = state.schedules[targetScheduleKey][dayId];
    if (isDayInPast(currentDay.date)) return; 
    if (field === 'date') {
        if (!isValidCompleteIsoDate(val) || isDayInPast(val)) return;
        const oldDate = currentDay.date;
        if (val === oldDate) return;
        const curSchedule = state.schedules[targetScheduleKey];
        const conflictingKey = Object.keys(curSchedule).find(
            k => k !== dayId && curSchedule[k]?.date === val
        );
        if (conflictingKey && curSchedule[conflictingKey]) {
            curSchedule[conflictingKey].date = oldDate;
            curSchedule[conflictingKey].title = H.getDayOfWeek(oldDate, lang);
        }
        currentDay.date = val;
        currentDay.title = H.getDayOfWeek(val, lang);
        if (!H.isDateInWeek(val, currentWeekStart)) {
            setCurrentWeekStart(H.getStartOfWeek(new Date(val + 'T00:00:00')));
        }
        onUpdate(state);
        return;
    }
    (currentDay as any)[field] = val; 
    onUpdate(state); 
  };
  const incrementTeacherSubjectPopularity = (subjectName: string, teacherId: string) => {
    const subj = (subjectName || '').trim();
    const tId = (teacherId || '').trim();
    if (!subj || !tId) return;
    const currentSettings: ScheduleSettings = JSON.parse(JSON.stringify(H.getSchoolScheduleSettings(state, user.schoolId)));
    if (!currentSettings.teacherSubjectCounts) currentSettings.teacherSubjectCounts = {};
    if (!currentSettings.teacherSubjectCounts[subj]) currentSettings.teacherSubjectCounts[subj] = {};
    currentSettings.teacherSubjectCounts[subj][tId] = (currentSettings.teacherSubjectCounts[subj][tId] || 0) + 1;
    H.setSchoolScheduleSettings(state, user.schoolId, currentSettings);
    try {
      const storageKey = `eljur_teacher_subj_counts_${user.schoolId || 'school_1'}`;
      const raw = localStorage.getItem(storageKey);
      const localMap = raw ? JSON.parse(raw) : {};
      if (!localMap[subj]) localMap[subj] = {};
      localMap[subj][tId] = Math.max(localMap[subj][tId] || 0, currentSettings.teacherSubjectCounts[subj][tId]);
      localStorage.setItem(storageKey, JSON.stringify(localMap));
    } catch {}
  };

  const updateLesson = (dayId: string, lIndex: number, field: keyof Lesson, val: string) => { 
    if (!targetScheduleKey || !state.schedules[targetScheduleKey]?.[dayId]?.lessons?.[lIndex]) return;
    if (isDayInPast(state.schedules[targetScheduleKey][dayId].date)) return; 
    const lesson = state.schedules[targetScheduleKey][dayId].lessons[lIndex];
    (lesson as any)[field] = val; 
    if ((field === 'teacherId' || field === 'lesson') && lesson.lesson && lesson.teacherId) {
      incrementTeacherSubjectPopularity(lesson.lesson, lesson.teacherId);
    }
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
          if ((field === 'teacherId' || field === 'subject') && currentSg.subject && currentSg.teacherId) {
              incrementTeacherSubjectPopularity(currentSg.subject, currentSg.teacherId);
          }
          onUpdate(state);
      }
  };
  const addLesson = (dayId: string) => { 
    if (!targetScheduleKey || !state.schedules[targetScheduleKey]?.[dayId]) return;
    if (isDayInPast(state.schedules[targetScheduleKey][dayId].date)) return; 
    const lessons = state.schedules[targetScheduleKey][dayId].lessons; 
    const lastLesson = lessons[lessons.length - 1]; 
    const classTimeCfg = H.getClassScheduleTimeConfig(scheduleSettings, activeClass);
    const nextTime = lastLesson
        ? H.calculateNextTimeRange(lastLesson.timeRange, classTimeCfg.lessonDuration, classTimeCfg.startTime)
        : H.calculateNextTimeRange('', classTimeCfg.lessonDuration, classTimeCfg.startTime); 
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

  const validClassKeys = new Set(schoolClasses.map(c => `${c.class}_${c.letter}`));

  const getTeacherDisplay = (u: any) => {
      const subjects = state.teacherAssignments
        .filter(a => a.teacherId === u.id && (!a.schoolId || !user.schoolId || a.schoolId === user.schoolId) && validClassKeys.has(a.classId))
        .map(a => a.subject);
      const uniqueSubjs = Array.from(new Set(subjects));
      return `${H.formatShortName(u.fio)}${uniqueSubjs.length > 0 ? ` (${uniqueSubjs.slice(0,2).join(', ')}${uniqueSubjs.length>2?'...':''})` : ''}`;
  };

  const getTeachersSortedForSubject = (subjectName: string) => {
      const schoolTeachers = state.users.filter(u => H.isUserTeacherCapable(u) && (!user.schoolId || u.schoolId === user.schoolId));
      const subj = (subjectName || '').trim();
      if (!subj) {
          return [...schoolTeachers].sort((a, b) => a.fio.localeCompare(b.fio));
      }
      let localMap: Record<string, Record<string, number>> = {};
      try {
          const raw = localStorage.getItem(`eljur_teacher_subj_counts_${user.schoolId || 'school_1'}`);
          if (raw) localMap = JSON.parse(raw);
      } catch {}
      const settingsSubjMap = scheduleSettings.teacherSubjectCounts?.[subj] || {};
      const localSubjMap = localMap[subj] || {};

      const scheduleUsageMap: Record<string, number> = {};
      schoolClasses.forEach(c => {
          const ck = `${c.class}_${c.letter}`;
          const sKey = H.getSchoolClassKey(user.schoolId, ck);
          const classSched = state.schedules[sKey] || {};
          Object.values(classSched).forEach(dayObj => {
              if (!dayObj || !dayObj.lessons) return;
              dayObj.lessons.forEach(les => {
                  if (les.subgroups && les.subgroups.length > 0) {
                      les.subgroups.forEach(sg => {
                          if (sg.subject === subj && sg.teacherId) {
                              scheduleUsageMap[sg.teacherId] = (scheduleUsageMap[sg.teacherId] || 0) + 1;
                          }
                      });
                  } else if (les.lesson === subj && les.teacherId) {
                      scheduleUsageMap[les.teacherId] = (scheduleUsageMap[les.teacherId] || 0) + 1;
                  }
              });
          });
      });

      return [...schoolTeachers].sort((a, b) => {
          const explicitA = Math.max(settingsSubjMap[a.id] || 0, localSubjMap[a.id] || 0);
          const explicitB = Math.max(settingsSubjMap[b.id] || 0, localSubjMap[b.id] || 0);
          const schedUsageA = scheduleUsageMap[a.id] || 0;
          const schedUsageB = scheduleUsageMap[b.id] || 0;
          const assignedActiveA = state.teacherAssignments.some(ta => ta.teacherId === a.id && ta.subject === subj && ta.classId === activeClass && (!ta.schoolId || !user.schoolId || ta.schoolId === user.schoolId)) ? 1 : 0;
          const assignedActiveB = state.teacherAssignments.some(ta => ta.teacherId === b.id && ta.subject === subj && ta.classId === activeClass && (!ta.schoolId || !user.schoolId || ta.schoolId === user.schoolId)) ? 1 : 0;
          const assignedTotalA = state.teacherAssignments.filter(ta => ta.teacherId === a.id && ta.subject === subj && validClassKeys.has(ta.classId) && (!ta.schoolId || !user.schoolId || ta.schoolId === user.schoolId)).length;
          const assignedTotalB = state.teacherAssignments.filter(ta => ta.teacherId === b.id && ta.subject === subj && validClassKeys.has(ta.classId) && (!ta.schoolId || !user.schoolId || ta.schoolId === user.schoolId)).length;

          const popularityA = explicitA * 100 + schedUsageA * 10 + assignedActiveA * 5 + assignedTotalA;
          const popularityB = explicitB * 100 + schedUsageB * 10 + assignedActiveB * 5 + assignedTotalB;
          if (popularityB !== popularityA) return popularityB - popularityA;
          return a.fio.localeCompare(b.fio);
      });
  };

  const renderTeacherSelect = (
      currentTeacherId: string,
      subjectName: string,
      onChangeVal: (newTeacherId: string) => void,
      dayDate: string,
      timeRange: string,
      lessonId: string,
      isPastDay: boolean,
      selectClassName: string,
      overlayTextClassName: string = 'text-xs sm:text-sm justify-center'
  ) => {
      const sortedTeachers = getTeachersSortedForSubject(subjectName);
      const selectedTeacher = state.users.find(u => u.id === currentTeacherId);
      const selectedShortName = selectedTeacher ? H.formatShortName(selectedTeacher.fio) : '';
      return (
          <div className="relative flex-1 min-w-0 w-full print:hidden">
              <Select
                  disabled={isPastDay}
                  value={currentTeacherId}
                  onChange={e => onChangeVal(e.target.value)}
                  className={`${selectClassName} ${selectedShortName ? '!text-transparent selection:bg-transparent' : ''}`}
              >
                  <option value="" className="text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900">-- {t('teacher')} --</option>
                  {sortedTeachers.map(u => {
                      const tConflict = getTeacherConflictDetails(u.id, dayDate, timeRange, activeClass, lessonId);
                      return (
                          <option
                              key={u.id}
                              value={u.id}
                              disabled={!!tConflict}
                              className="text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900"
                          >
                              {getTeacherDisplay(u)} {tConflict ? `🔒 (${t('in_class_short')} ${tConflict})` : ''}
                          </option>
                      );
                  })}
              </Select>
              {selectedShortName && (
                  <div className={`pointer-events-none absolute inset-y-[2px] left-[2px] right-7 flex items-center px-2 truncate font-medium text-slate-800 dark:text-slate-100 ${overlayTextClassName}`}>
                      <span className="truncate">{selectedShortName}</span>
                  </div>
              )}
          </div>
      );
  };

  const updateScheduleSettings = (updater: (s: ScheduleSettings) => void) => {
    const current: ScheduleSettings = JSON.parse(JSON.stringify(H.getSchoolScheduleSettings(state, user.schoolId)));
    if (!current.holidays) current.holidays = [];
    if (!current.vacations) current.vacations = [];
    if (!current.skippedWeekDays) current.skippedWeekDays = [0];
    if (!current.quarterDefinitions) current.quarterDefinitions = { 'Q1': { start: '', end: '' }, 'Q2': { start: '', end: '' }, 'Q3': { start: '', end: '' }, 'Q4': { start: '', end: '' } };
    updater(current);
    H.setSchoolScheduleSettings(state, user.schoolId, current);
    onUpdate(state);
  };

  const handleQuarterDateChange = (q: string, type: 'start' | 'end', value: string) => {
    const current = JSON.parse(JSON.stringify(H.getSchoolScheduleSettings(state, user.schoolId)));
    if (!current.quarterDefinitions) current.quarterDefinitions = { 'Q1': { start: '', end: '' }, 'Q2': { start: '', end: '' }, 'Q3': { start: '', end: '' }, 'Q4': { start: '', end: '' } };
    if (!current.quarterDefinitions[q]) current.quarterDefinitions[q] = {start:'', end:''};
    current.quarterDefinitions[q][type] = value;
    H.setSchoolScheduleSettings(state, user.schoolId, current);

    const allScheduleDates = new Set<string>();
    Object.entries(state.schedules).forEach(([cKey, classDays]) => {
        if (user.schoolId) {
            if (cKey.includes('__')) {
                if (!cKey.startsWith(`${user.schoolId}__`)) return;
            } else if (user.schoolId !== 'school_1') {
                return;
            }
        }
        Object.values(classDays).forEach(day => { if (day.date) allScheduleDates.add(day.date); });
    });

    const targetSchool = H.getSchool(state, user.schoolId);
    const targetQuarters = targetSchool
        ? (targetSchool.quarters || { Q1: [], Q2: [], Q3: [], Q4: [] })
        : (state.quarters || { Q1: [], Q2: [], Q3: [], Q4: [] });

    const quarterKeys = ['Q1', 'Q2', 'Q3', 'Q4'];
    quarterKeys.forEach(qKey => {
        const def = current.quarterDefinitions![qKey];
        if (!targetQuarters[qKey]) targetQuarters[qKey] = [];
        if (def && def.start && def.end) {
            targetQuarters[qKey] = targetQuarters[qKey].filter(d => d >= def.start && d <= def.end);
            allScheduleDates.forEach(date => { if (date >= def.start && date <= def.end) { if (!targetQuarters[qKey].includes(date)) { targetQuarters[qKey].push(date); } } });
            targetQuarters[qKey].sort();
        }
    });

    if (targetSchool) {
        targetSchool.quarters = targetQuarters;
    }
    if (!user.schoolId || user.schoolId === 'school_1') {
        state.quarters = targetQuarters;
    }
    onUpdate(state);
  };

  const visibleDates = visibleDayKeys.map(k => schedule[k].date);
  const vacationInfo = H.getVacationForWeek(currentWeekStart, scheduleSettings, visibleDates);
  const daysOfWeek = [t('days_sun_short'), t('days_mon_short'), t('days_tue_short'), t('days_wed_short'), t('days_thu_short'), t('days_fri_short'), t('days_sat_short')];

  return (
    <div className="space-y-3 sm:space-y-8">
      <div className="bg-white p-2.5 sm:p-4 rounded-2xl border border-slate-200 shadow-soft dark:bg-slate-900 dark:border-slate-800 no-print space-y-2.5 xl:space-y-0 xl:flex xl:gap-4 xl:items-end">
        <div className="w-full xl:w-64 flex items-end gap-2">
            <div className="flex-1 min-w-0">
                <label className="block text-[11px] sm:text-sm font-bold text-slate-700 mb-1 sm:mb-2 dark:text-slate-300">{t('choose_class')}</label>
                <Select value={activeClass} onChange={e => setActiveClass(e.target.value)} className="h-8 sm:h-[42px] text-xs sm:text-sm py-0">
                     {schoolClasses.map(c => <option key={`${c.class}_${c.letter}`} value={`${c.class}_${c.letter}`}>{c.class}{c.letter}</option>)}
                </Select>
            </div>
            <Button onClick={() => window.print()} variant="secondary" title={t('print')} className="sm:hidden h-8 w-8 p-0 shrink-0 justify-center bg-white border border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><Printer size={14} className="flex-shrink-0"/></Button>
        </div>
        <div className="flex-1 flex items-end justify-center bg-slate-50 p-1 rounded-xl border border-slate-200 dark:bg-slate-800 dark:border-slate-700 h-8 sm:h-[42px]">
             <Button variant="ghost" onClick={goPrevWeek} className="px-2 sm:px-3 h-full"><ChevronLeft size={16} className="sm:w-[18px] sm:h-[18px]"/></Button>
             <div className="flex-1 px-1.5 sm:px-2 text-center flex flex-col justify-center h-full">
                <div className="text-[8px] sm:text-[10px] text-slate-400 uppercase font-bold tracking-wider leading-none">{t('week')}</div>
                <div className="text-[11px] sm:text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight whitespace-nowrap">{H.getWeekRangeString(currentWeekStart)}</div>
             </div>
             <Button variant="ghost" onClick={goNextWeek} className="px-2 sm:px-3 h-full"><ChevronRight size={16} className="sm:w-[18px] sm:h-[18px]"/></Button>
        </div>
        <div className="w-full xl:w-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 sm:gap-2">
            <Button variant="secondary" onClick={goCurrentWeek} className="h-8 sm:h-[42px] px-1.5 sm:px-2 text-[10px] sm:text-xs font-semibold justify-center bg-white border border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><Calendar size={12} className="mr-1 flex-shrink-0"/> {t('current')}</Button>
            <Button variant="secondary" onClick={() => setShowSettingsModal(true)} className="h-8 sm:h-[42px] px-1.5 sm:px-2 text-[10px] sm:text-xs font-semibold justify-center bg-white border border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><Settings size={12} className="mr-1 flex-shrink-0"/> {t('setup_schedule')}</Button>
            <Button onClick={() => setShowBatchCopyModal(true)} variant="secondary" className="h-8 sm:h-[42px] px-1.5 sm:px-2 text-[10px] sm:text-xs font-semibold justify-center bg-white border border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><Copy size={12} className="mr-1 flex-shrink-0"/> {t('copy_prev_week')}</Button>
            <Button onClick={() => setShowSubjModal(true)} variant="secondary" className="h-8 sm:h-[42px] px-1.5 sm:px-2 text-[10px] sm:text-xs font-semibold justify-center bg-white border border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><BookOpen size={12} className="mr-1 flex-shrink-0"/> {t('subjects')}</Button>
            <Button onClick={() => window.print()} variant="secondary" className="hidden sm:inline-flex h-8 sm:h-[42px] px-1.5 sm:px-2 text-[10px] sm:text-xs font-semibold justify-center bg-white border border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><Printer size={12} className="mr-1 flex-shrink-0"/> {t('print')}</Button>
        </div>
      </div>
      <div className="space-y-4 sm:space-y-6 print:space-y-4 print:block">
        <div className="hidden print:block p-3 mb-3 border-b-2 border-black text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-600">{H.getSchool(state, user.schoolId)?.name || 'ЭлЖур'}</div>
          <div className="text-xl font-bold text-black mt-0.5">{t('schedule_for')}{activeClass.replace('_', '')}</div>
          <div className="text-xs text-slate-600 mt-1">{t('week')}: {H.getWeekRangeString(currentWeekStart)}</div>
        </div>
        {isPastWeek && <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 sm:px-4 sm:py-3 rounded-xl flex items-center gap-2 sm:gap-3 no-print"><Lock size={15} className="sm:w-[18px] sm:h-[18px] shrink-0" /><span className="text-xs sm:text-sm font-semibold">{t('past_edit_forbidden')}</span></div>}
        {visibleDayKeys.length === 0 && (
          <div className="text-slate-400 p-6 sm:p-12 border-2 border-dashed border-slate-200 rounded-2xl text-center bg-slate-50 dark:bg-slate-900 dark:border-slate-800 text-xs sm:text-base">
            <div>{t('empty_schedule_msg')} ({H.getWeekRangeString(currentWeekStart)})</div>
            {!isPastWeek && (
              <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2 sm:gap-3">
                <Button onClick={() => setConfirmCopyModal(true)} variant="primary" className="bg-indigo-600 hover:bg-indigo-700 h-8 sm:h-10 text-xs sm:text-sm px-3 sm:px-4 w-full sm:w-auto justify-center">
                  <Copy size={14} className="mr-1.5 shrink-0"/> {t('copy_prev_week')}
                </Button>
                {sortedClassesForCopyFrom.length > 0 && (
                  <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-center bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                    <Select
                      value={effectiveSourceClassForCopy}
                      onChange={e => setSelectedSourceClassForCopy(e.target.value)}
                      className="h-7 sm:h-8 text-xs sm:text-sm py-0 px-2.5 w-24 sm:w-28 font-bold text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                      title={t('from_class_label')}
                    >
                      {sortedClassesForCopyFrom.map(c => {
                        const ck = `${c.class}_${c.letter}`;
                        return (
                          <option key={ck} value={ck}>
                            {c.class}{c.letter}
                          </option>
                        );
                      })}
                    </Select>
                    <Button
                      onClick={copyScheduleStructureFromClass}
                      variant="primary"
                      className="bg-blue-600 hover:bg-blue-700 h-7 sm:h-8 text-xs sm:text-sm px-2.5 sm:px-3.5 whitespace-nowrap"
                    >
                      <Copy size={13} className="mr-1.5 shrink-0"/> {t('copy_schedule_btn')}
                    </Button>
                  </div>
                )}
              </div>
            )}
            {!isPastWeek && visibleDayKeys.length === 0 && <div className="mt-2.5 text-xs sm:text-sm">{t('add_days_hint')}</div>}
          </div>
        )}
        {visibleDayKeys.map(dayKey => {
           const day = schedule[dayKey];
           const holidayInfo = H.isHoliday(day.date, scheduleSettings);
           const vacForDay = H.getVacationForDay(day.date, scheduleSettings);
           const isPast = isDayInPast(day.date);
           const isVacationDay = !!vacForDay;
           const isHolidayDay = !!holidayInfo;
           let borderClass = isPast ? 'border-slate-200 opacity-60' : 'border-slate-300 dark:border-slate-700';
           let bgClass = isPast ? 'bg-slate-50 dark:bg-slate-950' : 'bg-white dark:bg-slate-900';
           if (isHolidayDay) { borderClass = 'border-red-200 dark:border-red-900/50'; } else if (isVacationDay) { borderClass = 'border-green-200 dark:border-green-900/50'; bgClass = 'bg-green-50/20 dark:bg-green-900/10'; }
           const isGroupColVisible = day.showGroups === true; 
           return (
             <div key={dayKey} className={`border rounded-xl shadow-sm break-inside-avoid print:border-slate-400 overflow-hidden relative ${borderClass} ${bgClass}`}>
                {isPast && <div className="absolute top-3 right-3 sm:top-4 sm:right-4 no-print text-slate-400" title={t('past_day')}><Lock size={14} className="sm:w-4 sm:h-4" /></div>}
                {(isHolidayDay || (isVacationDay && !vacationInfo?.isFullWeek)) && <div className={`text-center py-1 sm:py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-widest border-b ${isHolidayDay ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400' : 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:border-green-900/30 dark:text-green-400'}`}>{holidayInfo ? holidayInfo.title : vacForDay?.title}</div>}
                <div className={`flex flex-nowrap justify-between items-end sm:items-center gap-1.5 sm:gap-3 p-2 sm:p-4 border-b ${isHolidayDay ? 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30' : (isVacationDay ? 'bg-green-50/50 border-green-100 dark:bg-green-900/10 dark:border-green-900/30' : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700')} relative`}>
                   <div className="hidden md:block md:w-36 shrink-0 no-print" aria-hidden="true" />
                   <div className="flex flex-nowrap gap-1.5 sm:gap-4 items-end sm:items-center justify-start sm:justify-center flex-1 min-w-0">
                      <div className="flex flex-col items-center"><label className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 no-print">{t('day_of_week')}</label><div className="flex items-center gap-1.5 sm:gap-2"><Input maxLength={30} disabled={isPast} className="font-bold text-[11px] sm:text-lg w-24 sm:w-48 border-slate-300 shadow-none bg-transparent hover:bg-white focus:bg-white px-1 py-0.5 sm:px-2 sm:py-1 h-7 sm:h-auto text-center print:hidden" value={day.title || H.getDayOfWeek(day.date, lang as 'ru' | 'en')} onChange={e => updateDayField(dayKey, 'title', e.target.value)} /><span className="hidden print:inline font-bold text-base text-black">{day.title || H.getDayOfWeek(day.date, lang as 'ru' | 'en')}</span></div></div>
                      <div className="flex flex-col items-center"><label className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 no-print">{t('date')}</label><BufferedDateInput disabled={isPast} min={todayIso} className="w-28 sm:w-40 text-[11px] sm:text-sm text-slate-600 font-medium border-slate-300 shadow-none bg-transparent hover:bg-white focus:bg-white px-1 py-0.5 sm:px-2 sm:py-1 h-7 sm:h-auto text-center dark:text-slate-300 print:hidden" value={day.date} onCommit={newDate => updateDayField(dayKey, 'date', newDate)} /><span className="hidden print:inline text-sm font-medium text-slate-700">({H.formatDateDDMMYYYY(day.date)})</span></div>
                   </div>
                   <div className="flex items-center justify-end gap-1 sm:gap-2 w-auto md:w-36 shrink-0 no-print">
                       {!isPast && <Button variant="danger" size="sm" onClick={() => deleteDay(dayKey)} title={t('delete_day')} className="no-print whitespace-nowrap w-7 h-7 sm:w-auto sm:h-8 p-0 sm:px-3 text-[11px] sm:text-xs justify-center"><Trash2 size={13} className="sm:mr-1 sm:w-3.5 sm:h-3.5"/><span className="hidden sm:inline">{t('delete_day')}</span></Button>}
                       {!isPast && (
                           <div className="relative">
                               <button onClick={() => setOpenDaySettings(openDaySettings === dayKey ? null : dayKey)} className="w-7 h-7 sm:w-auto sm:h-auto p-1 sm:p-2 flex items-center justify-center hover:bg-slate-100 rounded-full transition dark:hover:bg-slate-800 text-slate-500"><MoreVertical size={16} className="sm:w-5 sm:h-5" /></button>
                               {openDaySettings === dayKey && (
                                   <div className="absolute right-0 top-full mt-1.5 w-56 sm:w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3 sm:p-4 dark:bg-slate-900 dark:border-slate-700 animate-in fade-in slide-in-from-top-2">
                                       <div className="flex justify-between items-center mb-2 sm:mb-3"><h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white">{t('day_settings')}</h4><button onClick={() => setOpenDaySettings(null)}><XIcon size={15} className="text-slate-400"/></button></div>
                                       <label className={`flex items-center gap-2.5 mb-3 cursor-pointer ${classGroups.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                           <input type="checkbox" disabled={classGroups.length === 0} checked={day.showGroups === true && classGroups.length > 0} onChange={(e) => { const isChecked = e.target.checked; updateDayField(dayKey, 'showGroups', isChecked); if (!isChecked) { day.lessons.forEach(l => l.subgroups = undefined); onUpdate(state); } }} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 sm:w-5 sm:h-5"/>
                                           <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">{t('use_groups')}</span>
                                       </label>
                                       {classGroups.length === 0 && <p className="text-[10px] text-red-500 mb-2 italic">{t('no_groups_class')}</p>}
                                       {day.showGroups && classGroups.length > 0 && (<div className="space-y-1.5"><p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase mb-1.5">{t('split_lessons')}</p><div className="max-h-36 overflow-y-auto custom-scrollbar border border-slate-100 rounded-lg p-1 dark:border-slate-800">{day.lessons.map((l, idx) => (<label key={l.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer dark:hover:bg-slate-800"><input type="checkbox" checked={!!(l.subgroups && l.subgroups.length > 0)} onChange={() => toggleSubgroups(dayKey, idx)} className="rounded text-blue-600"/><span className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400">{idx + 1}. {l.timeRange.split(' - ')[0]}</span></label>))}</div></div>)}
                                   </div>
                               )}
                           </div>
                       )}
                   </div>
                </div>
                {/* Mobile Lesson Editor Cards (No horizontal scroll) */}
                <div className="md:hidden print:hidden divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {day.lessons.map((lesson, idx) => {
                    const isSplit = lesson.subgroups && lesson.subgroups.length > 0;
                    return (
                      <div key={lesson.id} className="p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 flex-1">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-[11px] font-bold shrink-0">{idx + 1}</span>
                            <BufferedTimeRangeInput disabled={isPast} lessonDuration={activeClassTimeConfig.lessonDuration} value={lesson.timeRange} onCommit={val => updateLesson(dayKey, idx, 'timeRange', val)} className="text-[11px] font-mono font-medium text-center h-7 px-2" />
                          </div>
                          {!isPast && (
                            <button onClick={() => deleteLesson(dayKey, idx)} className="p-1 text-slate-400 hover:text-red-500 transition-colors text-base leading-none shrink-0">&times;</button>
                          )}
                        </div>
                        {isSplit ? (
                          <div className="space-y-1.5">
                            {lesson.subgroups?.map((sg, sgIdx) => {
                              const groupName = classGroups.find(g => g.id === sg.groupId)?.name || t('subgroup_label');
                              const conflictClass = getRoomConflictDetails(sg.room, day.date, lesson.timeRange, activeClass, lesson.id);
                              return (
                                <div key={sg.groupId} className="p-2 rounded-lg bg-blue-50/30 dark:bg-blue-950/20 border border-blue-100 dark:border-slate-800 space-y-1.5">
                                  <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">{groupName}</div>
                                  <div className="grid grid-cols-1 gap-1.5">
                                    <Select disabled={isPast} value={sg.subject} onChange={e => updateSubgroup(dayKey, idx, sgIdx, 'subject', e.target.value)} className="text-[11px] h-7 w-full py-0">
                                      <option value="">-- {t('subject')} --</option>
                                      {schoolSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                                    </Select>
                                    <div className="flex items-center gap-1">
                                      {renderTeacherSelect(
                                        sg.teacherId,
                                        sg.subject,
                                        val => updateSubgroup(dayKey, idx, sgIdx, 'teacherId', val),
                                        day.date,
                                        lesson.timeRange,
                                        lesson.id,
                                        isPast,
                                        'text-[11px] h-7 w-full py-0',
                                        'text-[11px] justify-start'
                                      )}
                                      {!isPast && <button onClick={() => openTeacherLabelModal(dayKey, idx, sgIdx)} className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-blue-500 shrink-0" title={t('add_label')}><Type size={12}/></button>}
                                      <Input maxLength={25} disabled={isPast} value={sg.room} onChange={e => updateSubgroup(dayKey, idx, sgIdx, 'room', e.target.value)} className={`text-[11px] w-16 h-7 px-1 text-center shrink-0 ${conflictClass ? '!border-red-500 !text-red-600' : ''}`} placeholder={t('cabinet')} />
                                    </div>
                                    {sg.teacherLabel && <div className="text-[10px] text-red-500 font-bold break-words">{sg.teacherLabel}</div>}
                                    {conflictClass && <div className="text-[10px] text-red-500 font-bold">{t('busy_short')}: {conflictClass}</div>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (() => {
                          const conflictClass = getRoomConflictDetails(lesson.room, day.date, lesson.timeRange, activeClass, lesson.id);
                          return (
                            <div className="grid grid-cols-1 gap-1.5">
                              <Select disabled={isPast} value={lesson.lesson} onChange={e => updateLesson(dayKey, idx, 'lesson', e.target.value)} className="text-[11px] h-7 w-full py-0">
                                <option value="">-- {t('subject')} --</option>
                                {schoolSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                              </Select>
                              <div className="flex items-center gap-1">
                                {renderTeacherSelect(
                                  lesson.teacherId,
                                  lesson.lesson,
                                  val => updateLesson(dayKey, idx, 'teacherId', val),
                                  day.date,
                                  lesson.timeRange,
                                  lesson.id,
                                  isPast,
                                  'text-[11px] h-7 w-full py-0',
                                  'text-[11px] justify-start'
                                )}
                                {!isPast && <button onClick={() => openTeacherLabelModal(dayKey, idx, null)} className="p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-500 shrink-0" title={t('add_label')}><Type size={12}/></button>}
                                <Input maxLength={25} disabled={isPast} value={lesson.room} onChange={e => updateLesson(dayKey, idx, 'room', e.target.value)} className={`text-[11px] w-16 h-7 px-1 text-center shrink-0 ${conflictClass ? '!border-red-500 !text-red-600' : ''}`} placeholder={t('cabinet')} />
                              </div>
                              {lesson.teacherLabel && <div className="text-[10px] text-red-500 font-bold break-words">{lesson.teacherLabel}</div>}
                              {conflictClass && <div className="text-[10px] text-red-500 font-bold">{t('busy_short')}: {conflictClass}</div>}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                  {!isPast && (
                    <div className="p-2 text-center bg-slate-50 dark:bg-slate-800/50">
                      <Button disabled={isPastWeek} variant="ghost" size="sm" className="w-full h-7 text-[11px] border-dashed border-slate-300 text-slate-500 hover:text-blue-600" onClick={() => addLesson(dayKey)}>
                        + {t('add_next_lesson')}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Desktop & Print Table */}
                <div className="hidden md:block print:block p-0 text-center-all bg-white/50 dark:bg-slate-900/50 overflow-x-auto">
                  <table className="w-full text-sm border-collapse table-fixed min-w-[600px] print:min-w-0">
                    <thead><tr className="text-center text-slate-500 border-b border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400"><th className="p-2 w-[20%] font-semibold text-center whitespace-nowrap">{t('time')}</th>{isGroupColVisible && <th className="p-2 w-[10%] font-semibold text-center border-l border-slate-100 dark:border-slate-800">{t('grp')}</th>}<th className={`p-2 ${isGroupColVisible ? 'w-[30%]' : 'w-[36%]'} font-semibold text-center border-l border-slate-100 dark:border-slate-800`}>{t('subject')}</th><th className={`p-2 ${isGroupColVisible ? 'w-[26%]' : 'w-[30%]'} font-semibold text-center border-l border-slate-100 dark:border-slate-800`}>{t('teacher')}</th><th className="p-2 w-[14%] font-semibold text-center border-l border-slate-100 dark:border-slate-800">{t('cabinet')}</th><th className="p-2 w-10 no-print"></th></tr></thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                      {day.lessons.map((lesson, idx) => {
                        const isSplit = lesson.subgroups && lesson.subgroups.length > 0;
                        return (
                        <tr key={lesson.id} className="hover:bg-slate-50/80 transition-colors dark:hover:bg-slate-800/50">
                          <td className="p-2 pl-4 text-center align-top">
                            <BufferedTimeRangeInput disabled={isPast} lessonDuration={activeClassTimeConfig.lessonDuration} value={lesson.timeRange} onCommit={val => updateLesson(dayKey, idx, 'timeRange', val)} className="text-sm font-mono font-medium text-center print:hidden" />
                            <span className="hidden print:inline font-mono font-medium text-slate-800 text-xs">{lesson.timeRange || '—'}</span>
                          </td>
                          {isGroupColVisible && (<td className="p-0 align-top border-l border-slate-50 dark:border-slate-800">{isSplit ? (<div className="divide-y divide-slate-100 dark:divide-slate-800">{lesson.subgroups?.map(sg => { const groupName = classGroups.find(g => g.id === sg.groupId)?.name || t('subgroup_label'); return (<div key={sg.groupId} className="min-h-[42px] h-auto flex items-center justify-center text-[9px] font-bold text-blue-600 dark:text-blue-400 px-1 truncate bg-blue-50/10" title={groupName}>{groupName}</div>); })}</div>) : (<div className="min-h-[42px] flex items-center justify-center text-slate-300">-</div>)}</td>)}
                          <td className="p-0 align-top border-l border-slate-50 dark:border-slate-800">{isSplit ? (<div className="divide-y divide-slate-100 dark:divide-slate-800">{lesson.subgroups?.map((sg, sgIdx) => (<div key={sg.groupId} className="min-h-[42px] h-auto flex items-center p-1 bg-blue-50/20 dark:bg-blue-900/10"><Select disabled={isPast} value={sg.subject} onChange={e => updateSubgroup(dayKey, idx, sgIdx, 'subject', e.target.value)} className="text-sm text-center border-blue-100 dark:border-slate-700 w-full print:hidden"><option value="">-- {t('subject')} --</option>{schoolSubjects.map(s => <option key={s} value={s}>{s}</option>)}</Select><span className="hidden print:inline font-medium text-slate-800 text-xs w-full text-center">{sg.subject || '—'}</span></div>))}</div>) : (<div className="p-2"><Select disabled={isPast} value={lesson.lesson} onChange={e => updateLesson(dayKey, idx, 'lesson', e.target.value)} className="text-sm text-center print:hidden"><option value="">-- {t('subject')} --</option>{schoolSubjects.map(s => <option key={s} value={s}>{s}</option>)}</Select><span className="hidden print:inline font-medium text-slate-800 text-xs">{lesson.lesson || '—'}</span></div>)}</td>
                          <td className="p-0 align-top border-l border-slate-50 dark:border-slate-800">{isSplit ? (<div className="divide-y divide-slate-100 dark:divide-slate-800">{lesson.subgroups?.map((sg, sgIdx) => { const teacherObj = state.users.find(u => u.id === sg.teacherId); const teacherName = teacherObj ? H.formatShortName(teacherObj.fio) : ''; return (<div key={sg.groupId} className="min-h-[42px] h-auto flex flex-col justify-center p-1 bg-blue-50/20 dark:bg-blue-900/10 gap-0.5"><div className="flex gap-1 items-center w-full">{renderTeacherSelect(sg.teacherId, sg.subject, val => updateSubgroup(dayKey, idx, sgIdx, 'teacherId', val), day.date, lesson.timeRange, lesson.id, isPast, 'text-sm text-center border-blue-100 dark:border-slate-700 w-full', 'text-sm justify-center')}<span className="hidden print:inline font-medium text-slate-800 text-xs w-full text-center">{teacherName || '—'}</span>{!isPast && <button onClick={() => openTeacherLabelModal(dayKey, idx, sgIdx)} className="p-1 hover:bg-blue-200 rounded text-blue-500 flex-shrink-0 no-print" title={t('add_label')}><Type size={12}/></button>}</div>{sg.teacherLabel && <div className="text-[9px] text-red-500 font-bold text-center leading-none mt-0.5 break-words">{sg.teacherLabel}</div>}</div>); })}</div>) : (() => { const teacherObj = state.users.find(u => u.id === lesson.teacherId); const teacherName = teacherObj ? H.formatShortName(teacherObj.fio) : ''; return (<div className="p-2 flex flex-col gap-0.5"><div className="flex gap-1 items-center w-full">{renderTeacherSelect(lesson.teacherId, lesson.lesson, val => updateLesson(dayKey, idx, 'teacherId', val), day.date, lesson.timeRange, lesson.id, isPast, 'text-sm text-center w-full', 'text-sm justify-center')}<span className="hidden print:inline font-medium text-slate-800 text-xs w-full text-center">{teacherName || '—'}</span>{!isPast && <button onClick={() => openTeacherLabelModal(dayKey, idx, null)} className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-blue-500 flex-shrink-0 no-print" title={t('add_label')}><Type size={14}/></button>}</div>{lesson.teacherLabel && <div className="text-[10px] text-red-500 font-bold text-center break-words">{lesson.teacherLabel}</div>}</div>); })()}</td>
                          <td className="p-0 align-top border-l border-slate-50 dark:border-slate-800">{isSplit ? (<div className="divide-y divide-slate-100 dark:divide-slate-800">{lesson.subgroups?.map((sg, sgIdx) => { const conflictClass = getRoomConflictDetails(sg.room, day.date, lesson.timeRange, activeClass, lesson.id); return (<div key={sg.groupId} className="min-h-[42px] h-auto flex flex-col justify-center p-1 bg-blue-50/20 dark:bg-blue-900/10"><Input maxLength={25} disabled={isPast} value={sg.room} onChange={e => updateSubgroup(dayKey, idx, sgIdx, 'room', e.target.value)} className={`text-sm w-full text-center border-blue-100 dark:border-slate-700 print:hidden ${conflictClass ? '!border-red-500 !text-red-600 dark:!border-red-500' : ''}`} placeholder={t('room_placeholder')} title={conflictClass ? `${t('room_busy_in')} ${conflictClass}` : undefined} /><span className="hidden print:inline font-medium text-slate-800 text-xs w-full text-center">{sg.room || '—'}</span>{conflictClass && <span className="text-[9px] text-red-500 font-bold text-center no-print">{t('busy_short')}: {conflictClass}</span>}</div>); })}</div>) : (() => { const conflictClass = getRoomConflictDetails(lesson.room, day.date, lesson.timeRange, activeClass, lesson.id); return (<div className="p-2 flex flex-col gap-0.5"><Input maxLength={25} disabled={isPast} value={lesson.room} onChange={e => updateLesson(dayKey, idx, 'room', e.target.value)} className={`text-sm w-full text-center print:hidden ${conflictClass ? '!border-red-500 !text-red-600 dark:!border-red-500' : ''}`} placeholder={t('room_placeholder')} title={conflictClass ? `${t('room_busy_in')} ${conflictClass}` : undefined} /><span className="hidden print:inline font-medium text-slate-800 text-xs w-full text-center">{lesson.room || '—'}</span>{conflictClass && <span className="text-[10px] text-red-500 font-bold text-center no-print">{t('busy_short')}: {conflictClass}</span>}</div>); })()}</td>
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
      {canAddMoreDaysToWeek && !isPastWeek && <div className="flex justify-center no-print"><Button variant="primary" className="w-full py-2.5 sm:py-4 text-xs sm:text-lg border-2 border-blue-200 border-dashed bg-blue-50 text-blue-700 hover:bg-blue-100 shadow-none dark:bg-slate-900 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-slate-800" onClick={addDaysWithSettings}>+ {t('add_days')} ({scheduleSettings.daysToAddBatch} {t('pcs')})</Button></div>}
      <Modal isOpen={showBatchCopyModal} onClose={() => setShowBatchCopyModal(false)} title={t('copy_schedule_title')}><div className="space-y-3 sm:space-y-4"><p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">{t('copy_schedule_body')}</p><div className="max-h-52 sm:max-h-60 overflow-y-auto border border-slate-200 rounded-lg p-1.5 sm:p-2 dark:border-slate-700"><div className="flex justify-between mb-1.5 sm:mb-2 px-2"><button onClick={() => setSelectedClassesForCopy(schoolClasses.map(c => `${c.class}_${c.letter}`))} className="text-[11px] sm:text-xs text-blue-600 font-bold hover:underline">{t('select_all')}</button><button onClick={() => setSelectedClassesForCopy([])} className="text-[11px] sm:text-xs text-slate-400 hover:text-slate-600">{t('reset')}</button></div>{schoolClasses.map(c => { const key = `${c.class}_${c.letter}`; return (<label key={key} className="flex items-center gap-2.5 sm:gap-3 p-1.5 sm:p-2 hover:bg-slate-50 rounded cursor-pointer dark:hover:bg-slate-800"><input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500" checked={selectedClassesForCopy.includes(key)} onChange={(e) => { if (e.target.checked) setSelectedClassesForCopy([...selectedClassesForCopy, key]); else setSelectedClassesForCopy(selectedClassesForCopy.filter(k => k !== key)); }} /><span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200">{c.class}{c.letter}</span></label>); })}</div><div className="flex gap-2 justify-end"><Button variant="ghost" onClick={() => setShowBatchCopyModal(false)} className="h-8 sm:h-10 text-xs sm:text-sm">{t('cancel')}</Button><Button variant="primary" onClick={copyScheduleBatch} className="h-8 sm:h-10 text-xs sm:text-sm">{t('copy')}</Button></div></div></Modal>
      <Modal isOpen={confirmCopyModal} onClose={() => setConfirmCopyModal(false)} title={t('copy_schedule_short')}><div className="space-y-4 sm:space-y-6"><div className="bg-blue-50 text-blue-800 p-3 sm:p-4 rounded-xl border border-blue-100 flex items-start gap-2.5 sm:gap-3"><AlertCircle className="flex-shrink-0 mt-0.5 w-4 h-4 sm:w-5 sm:h-5" size={20}/><div><p className="font-bold text-xs sm:text-sm mb-0.5 sm:mb-1">{t('copy_from_prev_q')}</p><p className="text-[11px] sm:text-sm opacity-90">{t('copy_warning_msg').replace('%s', activeClass.replace('_', ''))}</p></div></div><div className="flex gap-2 sm:gap-3 justify-end"><Button variant="ghost" onClick={() => setConfirmCopyModal(false)} className="h-8 sm:h-10 text-xs sm:text-sm">{t('cancel')}</Button><Button variant="primary" onClick={copyScheduleForCurrentClass} className="h-8 sm:h-10 text-xs sm:text-sm">{t('confirm')}</Button></div></div></Modal>
      <Modal isOpen={labelModal.isOpen} onClose={() => setLabelModal({...labelModal, isOpen: false})} title={t('add_label_title')}><div className="space-y-3 sm:space-y-4"><p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">{t('add_label_desc')}</p><div><label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 sm:mb-2 block">{t('label_text')}</label><Input maxLength={80} autoFocus value={labelModal.text} onChange={e => setLabelModal({...labelModal, text: e.target.value})} placeholder={t('label_placeholder')} className="h-8 sm:h-10 text-xs sm:text-sm" /></div><div><label className={`flex items-start gap-2.5 sm:gap-3 p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all ${labelModal.canGrade ? 'bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700' : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}><div className="pt-0.5"><input type="checkbox" checked={labelModal.canGrade} onChange={e => setLabelModal({...labelModal, canGrade: e.target.checked})} className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300" /></div><div><span className={`block text-xs sm:text-sm font-bold mb-0.5 ${labelModal.canGrade ? 'text-blue-900 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>{t('substitution_confirm')}</span><span className={`text-[10px] sm:text-xs font-medium ${labelModal.canGrade ? 'text-blue-700 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>{labelModal.canGrade ? t('access_granted') : t('access_denied')}</span></div></label></div><div className="flex gap-2 justify-end pt-1 sm:pt-2"><Button variant="ghost" onClick={() => setLabelModal({...labelModal, isOpen: false})} className="h-8 sm:h-10 text-xs sm:text-sm">{t('cancel')}</Button><Button variant="primary" onClick={saveTeacherLabel} className="h-8 sm:h-10 text-xs sm:text-sm">{t('save')}</Button></div></div></Modal>
      <Modal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} title={t('setup_schedule')}>
        <div className="space-y-3 sm:space-y-5">
          <div className="p-2.5 sm:p-3.5 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-800/60 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-200">
                {t('lesson_time_settings')}
              </span>
              {activeClass && (
                <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 shrink-0">
                  {t('class')} {activeClass.replace('_', '')}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 sm:grid sm:grid-cols-2 sm:gap-3">
              <div className="flex items-center justify-between sm:block gap-1.5 flex-1">
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 sm:mb-1 leading-tight">
                  {t('lesson_start_time')}
                </label>
                <BufferedSingleTimeInput
                  className="w-16 sm:w-full h-6 sm:h-9 !py-0.5 sm:!py-1.5 !px-1.5 sm:!px-2 text-center font-mono font-bold text-[11px] sm:text-sm shrink-0"
                  value={activeClassTimeConfig.startTime}
                  onCommit={newStart => {
                    updateScheduleSettings(s => {
                      if (activeClass) {
                        if (!s.classTimeSettings) s.classTimeSettings = {};
                        s.classTimeSettings[activeClass] = {
                          ...(s.classTimeSettings[activeClass] || {}),
                          startTime: newStart,
                          lessonDuration: s.classTimeSettings[activeClass]?.lessonDuration ?? activeClassTimeConfig.lessonDuration
                        };
                      } else {
                        s.defaultStartTime = newStart;
                      }
                    });
                  }}
                />
              </div>
              <div className="flex items-center justify-between sm:block gap-1.5 flex-1">
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 sm:mb-1 leading-tight">
                  {t('lesson_duration_min')}
                </label>
                <BufferedDurationInput
                  className="w-12 sm:w-full h-6 sm:h-9 !py-0.5 sm:!py-1.5 !px-1.5 sm:!px-2 text-center font-bold text-[11px] sm:text-sm shrink-0"
                  value={activeClassTimeConfig.lessonDuration}
                  onCommit={newDur => {
                    updateScheduleSettings(s => {
                      if (activeClass) {
                        if (!s.classTimeSettings) s.classTimeSettings = {};
                        s.classTimeSettings[activeClass] = {
                          ...(s.classTimeSettings[activeClass] || {}),
                          startTime: s.classTimeSettings[activeClass]?.startTime || activeClassTimeConfig.startTime,
                          lessonDuration: newDur
                        };
                      } else {
                        s.defaultLessonDuration = newDur;
                      }
                    });
                  }}
                />
              </div>
            </div>
            {schoolClasses.length > 1 && (
              <div className="flex items-center justify-end pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    updateScheduleSettings(s => {
                      s.defaultStartTime = activeClassTimeConfig.startTime;
                      s.defaultLessonDuration = activeClassTimeConfig.lessonDuration;
                      if (!s.classTimeSettings) s.classTimeSettings = {};
                      schoolClasses.forEach(c => {
                        const ck = `${c.class}_${c.letter}`;
                        s.classTimeSettings![ck] = {
                          startTime: activeClassTimeConfig.startTime,
                          lessonDuration: activeClassTimeConfig.lessonDuration
                        };
                      });
                    });
                    setAppliedTimeAllToast(true);
                    setTimeout(() => setAppliedTimeAllToast(false), 2500);
                  }}
                  className="text-[10px] sm:text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline transition-colors"
                >
                  {appliedTimeAllToast ? `✓ ${t('time_applied_all_classes')}` : t('apply_time_all_classes')}
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <label className="text-[11px] sm:text-sm font-bold text-slate-700 dark:text-slate-300">{t('days_batch')}</label>
            <Input
              type="number"
              min="1"
              max="7"
              maxLength={2}
              className="w-12 sm:w-20 h-6 sm:h-[42px] !py-0.5 sm:!py-1.5 !px-1.5 sm:!px-2 text-center font-bold text-[11px] sm:text-sm"
              value={scheduleSettings.daysToAddBatch}
              onChange={e => {
                updateScheduleSettings(s => {
                  s.daysToAddBatch = parseInt(e.target.value) || 1;
                });
              }}
            />
          </div>

          <div>
            <label className="block text-[11px] sm:text-sm font-bold text-slate-700 mb-1 sm:mb-2 dark:text-slate-300">{t('skip_days')}</label>
            <div className="grid grid-cols-7 sm:flex sm:flex-wrap gap-1 sm:gap-2">
              {daysOfWeek.map((day, idx) => {
                const isSkipped = (scheduleSettings.skippedWeekDays || []).includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      updateScheduleSettings(s => {
                        const current = s.skippedWeekDays || [];
                        if (isSkipped) {
                          s.skippedWeekDays = current.filter(d => d !== idx);
                        } else {
                          s.skippedWeekDays = [...current, idx];
                        }
                      });
                    }}
                    className={`px-1 sm:px-3 py-1 sm:py-2 rounded-lg text-[10px] sm:text-sm font-bold transition-all text-center ${
                      isSkipped
                        ? 'bg-red-100 text-red-600 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
                        : 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
                    }`}
                  >
                    <span>{day}</span>
                    <span className="hidden sm:inline">{isSkipped ? ` ${t('skipped_label')}` : ''}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-2.5 sm:pt-4 dark:border-slate-700">
            <h4 className="font-bold text-[11px] sm:text-sm text-slate-800 mb-2 sm:mb-3 dark:text-white">{t('quarter_dates')}</h4>
            <div className="grid grid-cols-1 gap-1.5 sm:gap-2">
              {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => {
                const def = scheduleSettings.quarterDefinitions?.[q] || { start: '', end: '' };
                return (
                  <div key={q} className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm">
                    <span className="w-6 sm:w-8 font-bold text-slate-600 dark:text-slate-400 shrink-0">{q}</span>
                    <div className="flex-1 grid grid-cols-2 gap-1.5 sm:gap-2 items-center">
                      <BufferedDateInput
                        className="h-7 sm:h-[40px] text-[11px] sm:text-xs px-1.5 sm:px-2"
                        value={def.start}
                        onCommit={val => handleQuarterDateChange(q, 'start', val)}
                      />
                      <BufferedDateInput
                        className="h-7 sm:h-[40px] text-[11px] sm:text-xs px-1.5 sm:px-2"
                        value={def.end}
                        onCommit={val => handleQuarterDateChange(q, 'end', val)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-2.5 sm:pt-4 dark:border-slate-700 space-y-3 sm:space-y-4">
            <h4 className="font-bold text-[11px] sm:text-sm text-slate-800 flex items-center gap-1.5 sm:gap-2 dark:text-white">
              <CalendarRange size={14} className="sm:w-4 sm:h-4" /> {t('holidays_vacations')}
            </h4>

            <div>
              <label className="text-[10px] sm:text-[11px] font-bold uppercase text-slate-500 mb-1 sm:mb-1.5 block">{t('holidays_daily')}</label>
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-1.5 sm:mb-2 items-end">
                <div>
                  <label className="text-[9px] sm:text-[10px] text-slate-400 block mb-0.5">{t('select_date')}</label>
                  <Input type="date" id="newHolidayDate" className="h-7 sm:h-[40px] text-[11px] sm:text-xs px-1.5 sm:px-2" />
                </div>
                <div>
                  <label className="text-[9px] sm:text-[10px] text-slate-400 block mb-0.5">{t('holiday_name')}</label>
                  <Input maxLength={100} type="text" id="newHolidayTitle" placeholder={t('example_holiday')} className="h-7 sm:h-[40px] text-[11px] sm:text-xs px-2 sm:px-2.5" />
                </div>
              </div>
              <Button
                size="sm"
                className="w-full h-7 sm:h-8.5 text-[11px] sm:text-xs mb-1.5 sm:mb-2"
                onClick={() => {
                  const dateEl = document.getElementById('newHolidayDate') as HTMLInputElement;
                  const titleEl = document.getElementById('newHolidayTitle') as HTMLInputElement;
                  if (dateEl.value && !(scheduleSettings.holidays || []).find(h => h.date === dateEl.value)) {
                    updateScheduleSettings(s => {
                      if (!s.holidays) s.holidays = [];
                      s.holidays.push({ date: dateEl.value, title: (titleEl.value || t('holiday')).slice(0, 100) });
                      s.holidays.sort((a, b) => a.date.localeCompare(b.date));
                    });
                    titleEl.value = '';
                  }
                }}
              >
                {t('add_holiday')}
              </Button>
              <div className="flex flex-wrap gap-1 sm:gap-1.5 max-h-24 sm:max-h-28 overflow-y-auto">
                {(scheduleSettings.holidays || []).map(h => (
                  <span key={h.date} className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-bold border border-red-100 flex items-center gap-1 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400 break-words">
                    {H.formatDateDDMMYYYY(h.date)}: {h.title}
                    <button
                      type="button"
                      onClick={() => {
                        updateScheduleSettings(s => {
                          s.holidays = (s.holidays || []).filter(x => x.date !== h.date);
                        });
                      }}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] sm:text-[11px] font-bold uppercase text-slate-500 mb-1 sm:mb-1.5 block">{t('vacation_periods')}</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2 mb-1.5 sm:mb-2 items-end">
                <div>
                  <label className="text-[9px] sm:text-[10px] text-slate-400 block mb-0.5">{t('from_date')}</label>
                  <Input type="date" id="vacStart" className="h-7 sm:h-[40px] text-[11px] sm:text-xs px-1.5 sm:px-2" />
                </div>
                <div>
                  <label className="text-[9px] sm:text-[10px] text-slate-400 block mb-0.5">{t('to_date')}</label>
                  <Input type="date" id="vacEnd" className="h-7 sm:h-[40px] text-[11px] sm:text-xs px-1.5 sm:px-2" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-[9px] sm:text-[10px] text-slate-400 block mb-0.5">{t('title')}</label>
                  <Input maxLength={100} id="vacTitle" placeholder={t('example_vacation')} className="h-7 sm:h-[40px] text-[11px] sm:text-xs px-2 sm:px-2.5" />
                </div>
              </div>
              <Button
                size="sm"
                className="w-full h-7 sm:h-8.5 text-[11px] sm:text-xs mb-1.5 sm:mb-2"
                onClick={() => {
                  const start = (document.getElementById('vacStart') as HTMLInputElement).value;
                  const end = (document.getElementById('vacEnd') as HTMLInputElement).value;
                  const title = ((document.getElementById('vacTitle') as HTMLInputElement).value || t('example_vacation')).slice(0, 100);
                  if (start && end) {
                    updateScheduleSettings(s => {
                      if (!s.vacations) s.vacations = [];
                      s.vacations.push({ id: H.uid('vac'), start, end, title });
                    });
                  }
                }}
              >
                {t('add_period')}
              </Button>
              <div className="space-y-1 sm:space-y-1.5 max-h-24 sm:max-h-28 overflow-y-auto">
                {(scheduleSettings.vacations || []).map(v => (
                  <div key={v.id} className="flex justify-between items-center bg-green-50 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded border border-green-100 text-[10px] sm:text-[11px] dark:bg-green-900/20 dark:border-green-800">
                    <span className="font-bold text-green-800 dark:text-green-300 truncate mr-2">{v.title}</span>
                    <span className="text-green-600 dark:text-green-400 whitespace-nowrap mr-2">{H.formatDateDDMMYYYY(v.start)} — {H.formatDateDDMMYYYY(v.end)}</span>
                    <button
                      type="button"
                      onClick={() => {
                        updateScheduleSettings(s => {
                          s.vacations = (s.vacations || []).filter(x => x.id !== v.id);
                        });
                      }}
                      className="text-red-500 font-bold"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Modal>
      <Modal isOpen={showSubjModal} onClose={() => setShowSubjModal(false)} title={t('manage_subjects')}><div className="flex gap-1.5 sm:gap-2 mb-3 sm:mb-4"><Input maxLength={80} value={newSubj} onChange={e => setNewSubj(e.target.value)} placeholder={t('subject_name')} className="h-8 sm:h-10 text-xs sm:text-sm" /><Button onClick={handleAddSubject} className="h-8 sm:h-10 text-xs sm:text-sm px-3 sm:px-4">{t('add')}</Button></div><div className="max-h-52 sm:max-h-60 overflow-y-auto border rounded-lg divide-y dark:border-slate-700 dark:divide-slate-700">{schoolSubjects.map(s => (<div key={s} className="p-1.5 sm:p-2 text-xs sm:text-sm flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800"><span className="break-words min-w-0 pr-2">{s}</span><button onClick={() => deleteSubject(s)} className="text-red-500 hover:text-red-700 font-bold px-1 shrink-0">&times;</button></div>))}</div></Modal>
    </div>
  );
};
