import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AppState, User, Grade, FinalGradeEntry, GradeType } from '../../types';
import * as H from '../../utils/helpers';
import { Button, Input, Select, Card, Modal, ScrollableTableWrapper } from '../../components/ui';
import { Calculator, Printer, Check, AlertCircle, Clock, X, Save, ChevronLeft, ChevronRight } from 'lucide-react';

export const Gradebook = ({ state, onUpdate, user, lang, setHasUnsavedGrades, hasUnsavedGrades }: { state: AppState, onUpdate: any, user: User, lang: 'ru' | 'en', setHasUnsavedGrades?: any, hasUnsavedGrades?: boolean }) => {
   const [localState, setLocalState] = useState<AppState>(() => JSON.parse(JSON.stringify(state)));
   
   useEffect(() => {
       if (!hasUnsavedGrades) {
           setLocalState(JSON.parse(JSON.stringify(state)));
       }
   }, [state, hasUnsavedGrades]);

   const commitGradebookChanges = (nextLocal: AppState) => {
       const updatedGrades = { ...(state.grades || {}), ...(nextLocal.grades || {}) };
       const updatedFinalGrades = { ...(state.finalGrades || {}), ...(nextLocal.finalGrades || {}) };
       if (!user.schoolId || user.schoolId === 'school_1') {
           Object.keys(updatedGrades).forEach(k => {
               if (k.startsWith('school_1__')) {
                   const pure = k.replace(/^school_1__/, '');
                   if (pure && updatedGrades[pure]) {
                       delete updatedGrades[pure];
                   }
               }
           });
           Object.keys(updatedFinalGrades).forEach(k => {
               if (k.startsWith('school_1__')) {
                   const pure = k.replace(/^school_1__/, '');
                   if (pure && updatedFinalGrades[pure]) {
                       delete updatedFinalGrades[pure];
                   }
               }
           });
       }
       const activeSchoolInLocal = H.getSchool(nextLocal, user.schoolId);
       const nextQuarters = activeSchoolInLocal?.quarters || nextLocal.quarters;
       const updatedSchools = (state.schools || []).map(s =>
           s.id === user.schoolId ? { ...s, quarters: nextQuarters } : s
       );
       onUpdate({
           ...state,
           schools: updatedSchools,
           quarters: (!user.schoolId || user.schoolId === 'school_1') ? nextQuarters : state.quarters,
           grades: updatedGrades,
           finalGrades: updatedFinalGrades
       });
   };

   const handleSave = () => {
       commitGradebookChanges(localState);
       setHasUnsavedGrades?.(false);
   };

   const [localValues, setLocalValues] = useState<Record<string, string>>({});
   const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
   const gradingSystem = H.getSchoolGradingSystem(localState, user.schoolId);
   const minGrade = gradingSystem?.minGrade ?? 2;
   const maxGrade = gradingSystem?.maxGrade ?? 5;
   const minWeight = gradingSystem?.minWeight ?? 1;
   const maxWeight = gradingSystem?.maxWeight ?? 20;
   const useWeights = gradingSystem?.useWeights ?? true;
   const gradeTypes = H.getSchoolGradeTypes(localState, user.schoolId);

   const schoolClasses = H.getSchoolClasses(localState, user.schoolId);
   const scheduleSettings = H.getSchoolScheduleSettings(localState, user.schoolId);

   const myClasses = useMemo(() => {
        const assignedClasses = new Set(user.classes || []);
        (localState.teacherAssignments || []).forEach((a: any) => {
            if (a.teacherId === user.id && a.classId && (!a.schoolId || !user.schoolId || a.schoolId === user.schoolId)) {
                const pure = a.classId.includes('__') ? a.classId.split('__').pop() : a.classId;
                if (pure) assignedClasses.add(pure);
            }
        });
        const leading = H.getUserLeadingClasses(localState, user.schoolId, user.id);
        leading.forEach(c => assignedClasses.add(`${c.class}_${c.letter}`));
        schoolClasses.forEach((c: any) => {
            const classKey = `${c.class}_${c.letter}`;
            const schedule = H.getSchoolClassSchedule(localState, user.schoolId, classKey);
            Object.values(schedule).forEach((day: any) => {
                 day.lessons.forEach((l: any) => {
                     if (l.teacherId === user.id && l.canGrade) { assignedClasses.add(classKey); }
                     if (l.subgroups) { l.subgroups.forEach((sg: any) => { if (sg.teacherId === user.id && sg.canGrade) { assignedClasses.add(classKey); } }); }
                 });
            });
        });
        return schoolClasses.filter((c: any) => assignedClasses.has(`${c.class}_${c.letter}`));
   }, [schoolClasses, user.classes, localState, user.schoolId, user.id]);

   const [cls, setCls] = H.useSyncedState<string>(`eljur_gb_cls_${user.id}`, myClasses[0] ? `${myClasses[0].class}_${myClasses[0].letter}` : '');
   useEffect(() => {
       if (myClasses.length > 0 && !myClasses.some((c: any) => `${c.class}_${c.letter}` === cls)) {
           setCls(`${myClasses[0].class}_${myClasses[0].letter}`);
       } else if (myClasses.length === 0 && cls !== '') {
           setCls('');
       }
   }, [myClasses, cls]);
   const targetKey = cls ? H.getSchoolClassKey(user.schoolId, cls) : '';
   
   const availableSubjects = useMemo(() => {
        if (!cls) return [];
        const assigned = (localState.teacherAssignments || []).filter((a: any) => a.teacherId === user.id && a.classId === cls && (!a.schoolId || !user.schoolId || a.schoolId === user.schoolId)).map((a: any) => a.subject).filter(Boolean);
        const schedule = H.getSchoolClassSchedule(localState, user.schoolId, cls);
        if (schedule) {
            Object.values(schedule).forEach((d: any) => {
                (d.lessons || []).forEach((l: any) => {
                    if (l.teacherId === user.id && l.canGrade && l.lesson) { assigned.push(l.lesson); }
                    if (l.subgroups) { l.subgroups.forEach((sg: any) => { if (sg.teacherId === user.id && sg.canGrade && sg.subject) { assigned.push(sg.subject); } }); }
                });
            });
        }
        if (assigned.length === 0 && user.subjects && user.subjects.length > 0) { return Array.from(new Set(user.subjects.filter(Boolean))); }
        if (assigned.length === 0) { return H.getSchoolSubjects(localState, user.schoolId); }
        return Array.from(new Set(assigned.filter(Boolean)));
   }, [cls, localState.teacherAssignments, user.id, user.subjects, localState, user.schoolId]);

   const [subj, setSubj] = H.useSyncedState<string>(`eljur_gb_subj_${user.id}`, ''); 
   useEffect(() => { if (availableSubjects.length > 0 && !availableSubjects.includes(subj)) { setSubj(availableSubjects[0]); } }, [availableSubjects, subj]);

   const defaultQuarter = useMemo(() => {
       if (scheduleSettings.quarterDefinitions) {
           const systemNow = new Date(Date.now() + (localState.settings.systemTimeOffset || 0));
           const dateStr = H.dateToIso(systemNow);
           for (const qKey of ['Q1', 'Q2', 'Q3', 'Q4']) {
               const def = scheduleSettings.quarterDefinitions[qKey];
               if (def && def.start && def.end && dateStr >= def.start && dateStr <= def.end) {
                   return qKey;
               }
           }
       }
       return 'Q1';
   }, [user.schoolId, localState.settings.systemTimeOffset, scheduleSettings.quarterDefinitions]);

   const [quarter, setQuarter] = H.useSyncedState<string>(`eljur_gb_quarter_${user.id}`, defaultQuarter);

   const [newDateToAdd, setNewDateToAdd] = useState('');
   const [defaultGradeType, setDefaultGradeType] = H.useSyncedState<string>(`eljur_gb_deftype_${user.id}`, ''); 
   const [selectedGrade, setSelectedGrade] = useState<{grade: Grade, studentName: string} | null>(null);
   const [editComment, setEditComment] = useState('');
   const [editWeight, setEditWeight] = useState(1);
   const [showFinalModal, setShowFinalModal] = H.useSyncedState<boolean>(`eljur_gb_final_modal_${user.id}`, false);
   const [deadlineModal, setDeadlineModal] = useState<{isOpen: boolean, grade: Grade} | null>(null);
   const [deadlineDate, setDeadlineDate] = useState('');
   const [deadlineError, setDeadlineError] = useState<string | null>(null);
   const [uiNotice, setUiNotice] = useState<string | null>(null);
   const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
   const t = (k: string) => H.t(k, lang);

   const validLessonDates = useMemo(() => {
       if (!cls || !subj) return [];
       const schedule = H.getSchoolClassSchedule(localState, user.schoolId, cls);
       if (!schedule) return [];
       const def = scheduleSettings.quarterDefinitions?.[quarter];
       const qStart = def?.start ? def.start : '0000-00-00';
       const qEnd = def?.end ? def.end : '9999-99-99';
       const validDates = new Set<string>();
       Object.values(schedule).forEach((d:any) => {
           if (d.date >= qStart && d.date <= qEnd) {
               const hasSubject = d.lessons.some((l:any) => { if (l.subgroups && l.subgroups.length > 0) { return l.subgroups.some((sg: any) => sg.subject === subj); } return l.lesson === subj; });
               if (hasSubject) { validDates.add(d.date); }
           }
       });
       return Array.from(validDates).sort();
   }, [cls, subj, localState, user.schoolId, scheduleSettings, quarter]);

   const currentSchoolObj = H.getSchool(localState, user.schoolId);
   const activeQuarters = currentSchoolObj?.quarters || localState.quarters || { Q1: [], Q2: [], Q3: [], Q4: [] };

   const normalizedSubjectGrades = useMemo(() => {
       if (!cls || !subj) return [];
       const classGrades = H.getSchoolClassGrades(localState, user.schoolId, cls);
       return classGrades?.[subj] || [];
   }, [cls, subj, localState, user.schoolId]);

   const ensureMutableSubjectGrades = (): Grade[] => {
       if (!targetKey) return [];
       if (!localState.grades) localState.grades = {};
       if (!localState.grades[targetKey]) {
           const allClassGrades = H.getSchoolClassGrades(localState, user.schoolId, cls);
           localState.grades[targetKey] = JSON.parse(JSON.stringify(allClassGrades || {}));
       }
       if ((!user.schoolId || user.schoolId === 'school_1') && cls && targetKey !== cls && localState.grades[cls]) {
           delete localState.grades[cls];
       }
       if (!Array.isArray(localState.grades[targetKey][subj])) {
           localState.grades[targetKey][subj] = JSON.parse(JSON.stringify(normalizedSubjectGrades));
       } else {
           localState.grades[targetKey][subj].forEach((g: Grade) => {
               g.type = H.normalizeGradeTypeKey(g.type, gradeTypes);
           });
       }
       return localState.grades[targetKey][subj];
   };

   const visibleDates = useMemo(() => {
       const savedDates = activeQuarters[quarter as keyof typeof activeQuarters] || [];
       const datesWithGrades = new Set<string>();
       normalizedSubjectGrades.forEach((g: Grade) => {
           if (validLessonDates.includes(g.date)) datesWithGrades.add(g.date);
       });
       const combined = new Set([...savedDates.filter((d: string) => validLessonDates.includes(d)), ...Array.from(datesWithGrades)]);
       if (combined.size === 0 && validLessonDates.length > 0) {
           const systemNow = new Date(Date.now() + (localState.settings.systemTimeOffset || 0));
           const todayIso = H.dateToIso(systemNow);
           const pastOrToday = validLessonDates.filter(d => d <= todayIso);
           (pastOrToday.length > 0 ? pastOrToday : validLessonDates).forEach(d => combined.add(d));
       }
       return Array.from(combined).sort();
   }, [activeQuarters, quarter, validLessonDates, normalizedSubjectGrades, localState]);
   const datesAvailableToAdd = useMemo(() => { return validLessonDates.filter(d => !visibleDates.includes(d)); }, [validLessonDates, visibleDates]);

   const syncQuartersToSchool = (nextQuarters: any) => {
       if (!user.schoolId || user.schoolId === 'school_1') {
           localState.quarters = nextQuarters;
       }
       const sch = H.getSchool(localState, user.schoolId);
       if (sch) sch.quarters = nextQuarters;
   };

   const addDate = (newDate: string) => {
       if (!newDate) return;
       const nextQ = { ...activeQuarters, [quarter]: [...(activeQuarters[quarter as keyof typeof activeQuarters] || [])] };
       if (!nextQ[quarter as keyof typeof nextQ].includes(newDate)) {
           nextQ[quarter as keyof typeof nextQ].push(newDate);
           nextQ[quarter as keyof typeof nextQ].sort();
           syncQuartersToSchool(nextQ);
           const newState = { ...localState };
           setLocalState(newState);
           setHasUnsavedGrades?.(false);
           commitGradebookChanges(newState);
           setNewDateToAdd('');
       }
   };
   const getLessonCount = (d: string) => { if (!cls || !d || !subj) return 0; const schedule = H.getSchoolClassSchedule(localState, user.schoolId, cls); if (!schedule) return 0; const days = Object.values(schedule) as any[]; const day = days.find(day => day.date === d); if (!day) return 0; return day.lessons.filter((l: any) => { if(l.subgroups && l.subgroups.length > 0) return l.subgroups.some((sg:any) => sg.subject === subj); return l.lesson === subj; }).length; };
   const getLessonsPerWeek = (classKey: string, subject: string): number => {
       const schedule = H.getSchoolClassSchedule(localState, user.schoolId, classKey);
       if (!schedule) return 0;
       const systemNow = new Date(Date.now() + (localState.settings.systemTimeOffset || 0));
       const weekStart = H.getStartOfWeek(systemNow);
       const countDaySubject = (day: any) => {
           let c = 0;
           (day?.lessons || []).forEach((l: any) => {
               if (l.subgroups && l.subgroups.length > 0) {
                   if (l.subgroups.some((sg: any) => sg.subject === subject)) c++;
               } else if (l.lesson === subject) {
                   c++;
               }
           });
           return c;
       };
       let currentWeekCount = 0;
       const weekBuckets = new Map<string, number>();
       Object.values(schedule).forEach((day: any) => {
           if (!day?.date) return;
           const dayCount = countDaySubject(day);
           if (H.isDateInWeek(day.date, weekStart)) {
               currentWeekCount += dayCount;
           }
           if (dayCount > 0) {
               const wsIso = H.dateToIso(H.getStartOfWeek(new Date(day.date)));
               weekBuckets.set(wsIso, (weekBuckets.get(wsIso) || 0) + dayCount);
           }
       });
       if (currentWeekCount > 0) return currentWeekCount;
       let maxWeekly = 0;
       weekBuckets.forEach(v => { if (v > maxWeekly) maxWeekly = v; });
       return maxWeekly;
   };
   const deleteDate = (d: string) => {
       setConfirmDialog({
           message: t('confirm_delete'),
           onConfirm: () => {
               const nextQ = { ...activeQuarters, [quarter]: (activeQuarters[quarter as keyof typeof activeQuarters] || []).filter((x: string) => x !== d) };
               syncQuartersToSchool(nextQ);
               const newState = { ...localState };
               setLocalState(newState);
               setHasUnsavedGrades?.(false);
               commitGradebookChanges(newState);
               setConfirmDialog(null);
           }
       });
   };

   const updateGrade = (studentId: string, date: string, val: string, type: string, forcedLessonIndex?: number) => {
     const systemNow = new Date(Date.now() + (localState.settings.systemTimeOffset || 0));
     const todayIso = H.dateToIso(systemNow);
     if (date > todayIso) { setUiNotice(t('cant_grade_future')); return; }
     if (getLessonCount(date) === 0) { setUiNotice(t('no_lesson_grade')); return; }
     
     let activeQuarterKey = null;
     if (scheduleSettings.quarterDefinitions) { for (const [qKey, def] of Object.entries(scheduleSettings.quarterDefinitions)) { if (def.start && def.end && todayIso >= def.start && todayIso <= def.end) { activeQuarterKey = qKey; break; } } }
     if (activeQuarterKey) { const def = scheduleSettings.quarterDefinitions![activeQuarterKey]; if (date < def.start || date > def.end) { setUiNotice(t('edit_forbidden_out_of_q')); return; } } 
     else { const hasAnyDefinitions = Object.values(scheduleSettings.quarterDefinitions || {}).some(d => d.start && d.end); if (hasAnyDefinitions) { setUiNotice(t('date_not_in_any_q')); return; } }
     const viewDef = scheduleSettings.quarterDefinitions?.[quarter];
     if (viewDef && viewDef.start && viewDef.end) { if (date < viewDef.start || date > viewDef.end) { setUiNotice(`${t('cant_grade_out_of_view_q')} (${H.formatDateDDMMYYYY(viewDef.start)} - ${H.formatDateDDMMYYYY(viewDef.end)})`); return; } }

     if (!targetKey) return;
     const subjList = ensureMutableSubjectGrades();
     const targetIndex = forcedLessonIndex !== undefined ? forcedLessonIndex : 0;
     const existingGrade = subjList.find((g: any) => g.studentId === studentId && g.date === date && (g.lessonIndex || 0) === targetIndex);

     let finalType = H.normalizeGradeTypeKey(type, gradeTypes);
     if (!existingGrade && type === undefined) { finalType = defaultGradeType; }
     if (type === '') { finalType = ''; }
     let finalValue = val;
     
     if (finalType) {
         const gt = gradeTypes.find(t => t.key === finalType);
         if (gt) {
             if (gt.isDynamicWeight) finalValue = 'Н/У';
             else if (gt.isNoWeight && gt.name === 'Н') finalValue = 'Н';
             else if (gt.isNoWeight && gt.name === 'ОП') finalValue = 'ОП';
             else {
                 if (isNaN(parseFloat(finalValue)) && finalValue !== '') {
                     finalValue = '';
                 }
             }
             if (finalType === 'nu') finalValue = 'Н/У';
             if (finalType === 'n') finalValue = 'Н';
             if (finalType === 'op') finalValue = 'ОП';
         }
     }
     
     if (finalValue.toUpperCase() === 'Н/У' || finalValue.toUpperCase() === 'N/U') { finalType = 'nu'; finalValue = 'Н/У'; }

     const isNewTypeSpecial = gradeTypes.find(t => t.key === finalType)?.isNoWeight || gradeTypes.find(t => t.key === finalType)?.isDynamicWeight;

     if (finalValue === '' && (!finalType || finalType === '')) {
         if (existingGrade) {
             const actualIdx = subjList.indexOf(existingGrade);
             if (actualIdx > -1) subjList.splice(actualIdx, 1);
         }
     } else {
       let weight = 1;
       if (finalType) { 
           if (!useWeights) { weight = 1; } 
           else { 
               const gt = gradeTypes.find((t:any) => t.key === finalType);
               weight = gt?.weight || 1; 
           } 
       }
       if (existingGrade) { 
           existingGrade.value = finalValue; 
           existingGrade.type = finalType; 
           const gt = gradeTypes.find(t => t.key === finalType);
           if (gt?.isDynamicWeight) {
                if (!existingGrade.weight) existingGrade.weight = 1;
           } else {
                existingGrade.weight = weight; 
           }
       } else { 
           if (finalValue !== '' || isNewTypeSpecial || finalType !== '') { 
               const newG = { id: H.uid('g'), studentId, date, value: finalValue, type: finalType, weight, comment: targetIndex > 0 ? `${t('lesson_order')} ${targetIndex + 1}` : '', lessonIndex: targetIndex }; 
               subjList.push(newG); 
           } 
       }
     }
     
     if (selectedGrade && selectedGrade.grade.studentId === studentId && selectedGrade.grade.date === date && (selectedGrade.grade.lessonIndex || 0) === targetIndex) {
         const updatedGrade = subjList.find((g: any) => g.studentId === studentId && g.date === date && (g.lessonIndex || 0) === targetIndex);
         if (updatedGrade) { setSelectedGrade({ ...selectedGrade, grade: { ...updatedGrade } }); } else { setSelectedGrade(null); }
     }
     setLocalState({...localState});
     setHasUnsavedGrades?.(true);
   };

   const [isCommentSaved, setIsCommentSaved] = useState(false);

   const handleGradeClick = (g: Grade, studentName: string) => { 
       if (g && (g.value || g.value === 0)) {
           setSelectedGrade({grade: g, studentName}); 
           setEditComment(g.comment || ''); 
           setEditWeight(g.weight || 1);
           setIsCommentSaved(false);
       }
   };
   
   const saveGradeDetails = () => { 
       if (!selectedGrade || !targetKey) return; 
       const subjList = ensureMutableSubjectGrades();
       const gIndex = subjList.findIndex(g => g.id === selectedGrade.grade.id); 
       if (gIndex > -1) { 
           subjList[gIndex].comment = editComment; 
           const gType = H.normalizeGradeTypeKey(subjList[gIndex].type, gradeTypes);
           const typeDef = gradeTypes.find(t => t.key === gType || t.id === gType || t.name === gType);
           if (typeDef?.isDynamicWeight) { 
               subjList[gIndex].weight = editWeight; 
           } 
           const newState = {...localState};
           setLocalState(newState);
           setHasUnsavedGrades?.(false);
           commitGradebookChanges(newState);
           setSelectedGrade({...selectedGrade, grade: subjList[gIndex]}); 
           setIsCommentSaved(true);
       } 
   };
   const getMinDeadlineDate = (gradeDate?: string): string => {
       if (!gradeDate || !/^\d{4}-\d{2}-\d{2}$/.test(gradeDate)) return '';
       const [y, m, d] = gradeDate.split('-').map(Number);
       const dt = new Date(y, m - 1, d + 1);
       const pad = (n: number) => String(n).padStart(2, '0');
       return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
   };

   const openDeadlineModal = (g: Grade) => {
       setDeadlineError(null);
       const minDate = getMinDeadlineDate(g.date);
       const initialDate = (g.deadline && (!g.date || g.deadline > g.date)) ? g.deadline : minDate;
       setDeadlineModal({ isOpen: true, grade: g });
       setDeadlineDate(initialDate);
   };

   const saveDeadline = () => {
       if (!deadlineModal || !targetKey) return;
       const gradeDate = deadlineModal.grade.date;
       if (deadlineDate && gradeDate && deadlineDate <= gradeDate) {
           setDeadlineError(
               lang === 'ru'
                   ? `Нельзя выбрать дату выставления Н/У (${H.formatDateDDMMYYYY(gradeDate)}) или дату до неё.`
                   : `Cannot select the Н/У grade date (${H.formatDateDDMMYYYY(gradeDate)}) or any earlier date.`
           );
           return;
       }
       const subjList = ensureMutableSubjectGrades();
       const gIndex = subjList.findIndex(g => g.id === deadlineModal.grade.id);
       if (gIndex > -1) {
           subjList[gIndex].deadline = deadlineDate;
           const newState = { ...localState };
           setLocalState(newState);
           setHasUnsavedGrades?.(false);
           commitGradebookChanges(newState);
           if (selectedGrade && selectedGrade.grade.id === deadlineModal.grade.id) {
               setSelectedGrade({ ...selectedGrade, grade: { ...subjList[gIndex] } });
           }
           setDeadlineError(null);
           setDeadlineModal(null);
       }
   };

   const students = localState.users.filter((u: User) => u.schoolId === user.schoolId && u.role === 'student' && `${u.class}_${u.letter}` === cls);
   const quarterLabels: Record<string, string> = { 'Q1': '1', 'Q2': '2', 'Q3': '3', 'Q4': '4' };

   const getFinalData = (studentId: string): FinalGradeEntry => {
       if (!targetKey) return { studentId };
       if (!localState.finalGrades) localState.finalGrades = {};
       if (!localState.finalGrades[targetKey]) {
           const existingClassFinals = H.getSchoolClassFinalGrades(localState, user.schoolId, cls);
           localState.finalGrades[targetKey] = JSON.parse(JSON.stringify(existingClassFinals || {}));
       }
       if ((!user.schoolId || user.schoolId === 'school_1') && cls && targetKey !== cls && localState.finalGrades[cls]) {
           delete localState.finalGrades[cls];
       }
       if (!localState.finalGrades[targetKey][subj]) localState.finalGrades[targetKey][subj] = [];
       const found = localState.finalGrades[targetKey][subj].find(entry => entry.studentId === studentId);
       if (found) return found;
       const newEntry = { studentId }; localState.finalGrades[targetKey][subj].push(newEntry); return newEntry;
   };

   const getEffectiveWeight = (g: Grade) => H.getEffectiveGradeWeight(g, gradeTypes, useWeights);

   const calculateQuarterStatus = (studentId: string, quarterKey: string) => {
       const def = scheduleSettings.quarterDefinitions?.[quarterKey];
       if (!def || !def.start || !def.end) return { val: null, isNA: false };
       let wSum = 0; let wCount = 0; let gradeCount = 0;
       normalizedSubjectGrades.forEach(g => {
           if (g.studentId === studentId && g.date >= def.start && g.date <= def.end) {
               const val = H.getEffectiveGradeValue(g, minGrade, localState.settings?.systemTimeOffset);
               if (val !== null) { 
                   const weight = getEffectiveWeight(g);
                   if (weight > 0) {
                       wSum += val * weight; 
                       wCount += weight; 
                       gradeCount++; 
                   }
               }
           }
       });
       const average = wCount > 0 ? (wSum / wCount).toFixed(2) : null;
       let minGrades = 0;
       const schoolReqs = H.getSchoolSubjectRequirements(localState, user.schoolId);
       const req = schoolReqs?.[cls]?.[subj]
           || (targetKey && localState.subjectRequirements?.[targetKey]?.[subj])
           || ((!user.schoolId || user.schoolId === 'school_1') ? localState.subjectRequirements?.[cls]?.[subj] : undefined);
       if (req && req.type === 'manual') { minGrades = req.minGrades; } else { const lessonsPerWeek = getLessonsPerWeek(cls, subj); if (lessonsPerWeek > 3) minGrades = 5; else if (lessonsPerWeek > 0) minGrades = 3; else minGrades = 0; }
       if (minGrades > 0 && gradeCount < minGrades) { return { val: String(minGrade), isNA: true }; }
       return { val: average, isNA: false };
   };
   
   const calculateYearAverage = (studentId: string) => { const entry = getFinalData(studentId); let sum = 0; let count = 0; (['q1', 'q2', 'q3', 'q4'] as const).forEach(q => { const val = H.parseGradeNumericValue((entry as any)[q], minGrade); if (val !== null) { sum += val; count++; } }); const examVal = H.parseGradeNumericValue(entry.exam || '', minGrade); if (examVal !== null) { sum += examVal; count++; } return count > 0 ? (sum / count).toFixed(2) : null; };
   const updateFinalGrade = (studentId: string, field: keyof FinalGradeEntry, value: string) => {
       const trimmed = value.trim().toUpperCase();
       if (trimmed !== '' && !['Н/А', 'N/A', 'ЗЧ', 'НЗ'].includes(trimmed)) {
           const num = Number(trimmed);
           if (isNaN(num) || num < minGrade || num > maxGrade) {
               return;
           }
       }
       const entry = getFinalData(studentId);
       (entry as any)[field] = trimmed;
       if (trimmed === '') {
           if (field === 'q1') entry.isQ1Confirmed = false;
           if (field === 'q2') entry.isQ2Confirmed = false;
           if (field === 'q3') entry.isQ3Confirmed = false;
           if (field === 'q4') entry.isQ4Confirmed = false;
           if (field === 'exam') entry.isExamConfirmed = false;
           if (field === 'year') entry.isYearConfirmed = false;
       }
       const newState = {...localState};
       setLocalState(newState);
       setHasUnsavedGrades?.(false);
       commitGradebookChanges(newState);
   };
   const confirmFinalGrade = (studentId: string, field: 'q1' | 'q2' | 'q3' | 'q4' | 'year' | 'exam') => { const entry = getFinalData(studentId); if (field === 'q1') entry.isQ1Confirmed = true; if (field === 'q2') entry.isQ2Confirmed = true; if (field === 'q3') entry.isQ3Confirmed = true; if (field === 'q4') entry.isQ4Confirmed = true; if (field === 'exam') entry.isExamConfirmed = true; if (field === 'year') entry.isYearConfirmed = true; const newState = {...localState}; setLocalState(newState); setHasUnsavedGrades?.(false); commitGradebookChanges(newState); };
   const systemNow = new Date(Date.now() + (localState.settings.systemTimeOffset || 0)); const todayIso = H.dateToIso(systemNow); systemNow.setHours(0,0,0,0);

   const [mobileViewMode, setMobileViewMode] = H.useSyncedState<'by_date' | 'table'>(`eljur_gb_mobmode_${user.id}`, 'by_date');
   const [selectedMobileDate, setSelectedMobileDate] = H.useSyncedState<string>(`eljur_gb_mobdate_${user.id}`, '');

   useEffect(() => {
       if (visibleDates.length === 0) {
           setSelectedMobileDate('');
           return;
       }
       if (!selectedMobileDate || !visibleDates.includes(selectedMobileDate)) {
           const pastOrToday = visibleDates.filter(d => d <= todayIso);
           const bestDate = pastOrToday.length > 0 ? pastOrToday[pastOrToday.length - 1] : visibleDates[0];
           setSelectedMobileDate(bestDate);
       }
   }, [visibleDates, selectedMobileDate, todayIso]);

   const selectedTypeIsDynamic = selectedGrade ? gradeTypes.find(t => {
       const nk = H.normalizeGradeTypeKey(selectedGrade.grade.type, gradeTypes);
       return t.key === nk || t.id === nk || t.name === nk;
   })?.isDynamicWeight : false;

   if (myClasses.length === 0) {
     return (
       <Card className="p-8 sm:p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 text-xs sm:text-sm">
         {lang === 'ru' ? 'У вас пока нет назначенных классов или уроков с правом выставления оценок.' : 'You do not have any assigned classes or grading permissions yet.'}
       </Card>
     );
   }

   const activeMobileDate = selectedMobileDate && visibleDates.includes(selectedMobileDate)
       ? selectedMobileDate
       : (visibleDates[visibleDates.length - 1] || '');
   const activeMobileDateIdx = visibleDates.indexOf(activeMobileDate);

   const renderGradeCellInput = (s: User, d: string, lIdx: number, loops: number, isDisabled: boolean, isFuture: boolean, sGrades: Grade[]) => {
       const g = sGrades.find(gr => gr.date === d && (gr.lessonIndex || 0) === lIdx);
       let displayValue = g?.value || '';
       const isExpiredNU = g ? H.isGradeExpiredNU(g, localState.settings?.systemTimeOffset) : false;
       if (isExpiredNU) displayValue = String(minGrade);
       const cellKey = `${s.id}_${d}_${lIdx}`;
       const localVal = localValues[cellKey];
       const errorMsg = localErrors[cellKey];
       const finalDisplayValue = localVal !== undefined ? localVal : displayValue;
       const normTypeKey = H.normalizeGradeTypeKey(g?.type, gradeTypes);
       const typeDef = gradeTypes.find(t => (t.key === normTypeKey || t.id === normTypeKey || t.name === normTypeKey) && t.key !== 'default' && t.name !== '...');
       const isNU = typeDef?.isDynamicWeight;
       const isNoWeight = typeDef?.isNoWeight;
       const hasGrade = Boolean(g && String(finalDisplayValue).trim() !== '');
       const effectiveWeight = g ? getEffectiveWeight(g) : 1;
       const shouldShowWeight = hasGrade && useWeights && !isNoWeight && effectiveWeight > 0;
       const selectedSelectVal = typeDef ? typeDef.key : 'default';

       return (
           <div key={lIdx} className="flex flex-col items-center justify-center w-[70px] sm:w-[82px] print:w-auto print:min-w-0 max-w-full overflow-hidden border-r last:border-0 border-dashed border-slate-200 dark:border-slate-700 relative px-0.5 print:px-0">
               {loops > 1 && <span className="text-[9px] text-slate-400 mb-0.5 leading-none print:hidden">{lIdx + 1}</span>}
               {errorMsg && (
                   <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[8px] px-1 rounded z-50 pointer-events-none whitespace-nowrap shadow-sm animate-pulse no-print" style={{ animationDuration: '0.5s' }}>
                       {errorMsg}
                   </div>
               )}
               {hasGrade && (
                   <div className="hidden print:inline-flex items-baseline justify-center gap-0.5 leading-none whitespace-nowrap">
                       <span className="font-bold text-[8.5pt] text-black">{finalDisplayValue}</span>
                       {useWeights && !isNoWeight && effectiveWeight >= 1 && (
                           <span className="text-[6.5pt] font-medium text-slate-600">×{effectiveWeight}</span>
                       )}
                   </div>
               )}
               <input
                   disabled={isDisabled}
                   placeholder="—"
                   className={`w-full text-center font-bold text-sm sm:text-lg leading-tight border-none bg-transparent focus:bg-blue-50 focus:ring-0 p-0 cursor-pointer placeholder:text-slate-300 dark:placeholder:text-slate-700 print:hidden ${isDisabled ? 'cursor-not-allowed text-slate-300' : ''} ${errorMsg ? 'text-red-500 line-through decoration-red-500/50' : H.getGradeColorClass(String(finalDisplayValue), minGrade, maxGrade)}`}
                   value={finalDisplayValue}
                   onChange={e => {
                       const rawVal = e.target.value;
                       if (rawVal === '') {
                           setLocalValues(prev => ({ ...prev, [cellKey]: '' }));
                           updateGrade(s.id, d, '', selectedSelectVal, lIdx);
                           setLocalValues(prev => { const n = { ...prev }; delete n[cellKey]; return n; });
                           setLocalErrors(prev => { const n = { ...prev }; delete n[cellKey]; return n; });
                           return;
                       }
                       const upper = rawVal.trim().toUpperCase();
                       if (['Н', 'N', 'УВ', 'Б', 'ОП', 'О', 'ЗЧ', 'НЗ', 'Н/У'].includes(upper)) {
                           setLocalValues(prev => ({ ...prev, [cellKey]: upper }));
                           const matchedType = gradeTypes.find(t => t.name.toUpperCase() === upper || (upper === 'Н' && (t.key === 'n' || t.name === 'Н')) || (upper === 'ОП' && (t.key === 'op' || t.name === 'ОП')) || (upper === 'Н/У' && (t.key === 'nu' || t.name === 'Н/У')))?.key || (upper === 'Н' ? 'n' : upper === 'ОП' ? 'op' : upper === 'Н/У' ? 'nu' : selectedSelectVal);
                           updateGrade(s.id, d, upper, matchedType, lIdx);
                           setLocalValues(prev => { const n = { ...prev }; delete n[cellKey]; return n; });
                           setLocalErrors(prev => { const n = { ...prev }; delete n[cellKey]; return n; });
                           return;
                       }
                       if (/^\d+(\/\d+)?$/.test(rawVal)) {
                           setLocalValues(prev => ({ ...prev, [cellKey]: rawVal }));
                           const parts = rawVal.split('/').map(Number);
                           const allValid = parts.every(p => p >= minGrade && p <= maxGrade);
                           if (allValid) {
                               updateGrade(s.id, d, rawVal, (!g && defaultGradeType) ? defaultGradeType : selectedSelectVal, lIdx);
                               setLocalValues(prev => { const n = { ...prev }; delete n[cellKey]; return n; });
                               setLocalErrors(prev => { const n = { ...prev }; delete n[cellKey]; return n; });
                           } else {
                               setLocalErrors(prev => ({ ...prev, [cellKey]: `Err: ${minGrade}-${maxGrade}` }));
                           }
                           return;
                       }
                   }}
                   onClick={(e) => {
                       if (isDisabled) {
                           setUiNotice(isFuture ? t('cant_grade_future') : t('no_lesson_grade'));
                           return;
                       }
                       if (defaultGradeType) {
                           if (!g || selectedSelectVal !== defaultGradeType) {
                               updateGrade(s.id, d, g ? String(g.value) : '', defaultGradeType, lIdx);
                           }
                       }
                       if (g && g.value !== '') {
                           e.stopPropagation();
                           handleGradeClick(g, s.fio);
                       }
                   }}
               />
               <div className="flex items-center justify-center gap-0.5 w-full mt-0.5 overflow-hidden print:hidden">
                   <select
                       disabled={isDisabled}
                       className="flex-1 min-w-0 max-w-full truncate text-[9px] sm:text-[10px] leading-tight h-4 sm:h-4.5 bg-white border border-slate-200 px-0.5 py-0 text-center text-slate-900 focus:text-slate-900 no-print cursor-pointer hover:bg-slate-100 rounded dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                       value={selectedSelectVal}
                       onChange={e => {
                           updateGrade(s.id, d, String(g?.value || ''), e.target.value, lIdx);
                           setLocalValues(prev => { const n = { ...prev }; delete n[cellKey]; return n; });
                           setLocalErrors(prev => { const n = { ...prev }; delete n[cellKey]; return n; });
                       }}
                   >
                       <option key="gt_default" value="default">...</option>
                       {gradeTypes.filter(gt => gt.key !== 'default' && gt.name !== '...').map((gt, idx) => (
                           <option key={`${gt.key || gt.id || idx}_${idx}`} value={gt.key}>{gt.name}</option>
                       ))}
                   </select>
                   {shouldShowWeight && (
                       <span className="text-[8px] sm:text-[9px] text-slate-400 font-mono shrink-0 leading-none">×{effectiveWeight}</span>
                   )}
               </div>
           </div>
       );
   };

   return (
     <div className="space-y-3 sm:space-y-5">
       <div className="hidden print:block p-3 mb-3 border-b-2 border-black text-center">
         <div className="text-xs font-bold uppercase tracking-widest text-slate-600">{H.getSchool(localState, user.schoolId)?.name || 'ЭлЖур'}</div>
         <div className="text-xl font-bold text-black mt-0.5">{t('journal')}: {cls.replace('_', '')} — {subj} ({quarterLabels[quarter]} {t('quarter')})</div>
         <div className="text-xs text-slate-600 mt-1">{t('teacher')}: {H.formatShortName(user.fio)}</div>
       </div>
       <Card className="p-2.5 sm:p-5 bg-slate-50 border-blue-200 no-print dark:bg-slate-900 dark:border-slate-800">
         <div className="flex flex-wrap gap-2 sm:gap-3 items-end justify-between w-full">
           <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3 items-end w-full xl:w-auto">
             <div>
               <label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">{t('class')}</label>
               <Select className="w-full sm:w-28 text-xs h-8 sm:h-9" value={cls} onChange={e => {
                 const nextVal = e.target.value;
                 const applyChange = () => { setHasUnsavedGrades?.(false); setSelectedGrade(null); setCls(nextVal); setNewDateToAdd(''); setConfirmDialog(null); };
                 if (hasUnsavedGrades) { setConfirmDialog({ message: t('unsaved_grades_confirm'), onConfirm: applyChange }); return; }
                 applyChange();
               }}>{myClasses.map((c: any, idx: number) => <option key={`${c.class}_${c.letter}_${idx}`} value={`${c.class}_${c.letter}`}>{c.class}{c.letter}</option>)}</Select>
             </div>
             <div>
               <label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">{t('subject')}</label>
               <Select className="w-full sm:w-48 text-xs h-8 sm:h-9" value={subj} onChange={e => {
                 const nextVal = e.target.value;
                 const applyChange = () => { setHasUnsavedGrades?.(false); setSelectedGrade(null); setSubj(nextVal); setNewDateToAdd(''); setConfirmDialog(null); };
                 if (hasUnsavedGrades) { setConfirmDialog({ message: t('unsaved_grades_confirm'), onConfirm: applyChange }); return; }
                 applyChange();
               }}>{availableSubjects.map((s: string, idx: number) => <option key={`${s}_${idx}`} value={s}>{s}</option>)}</Select>
             </div>
             <div>
               <label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">{t('quarter')}</label>
               <Select className="w-full sm:w-28 text-xs h-8 sm:h-9" value={quarter} onChange={e => {
                 const nextVal = e.target.value;
                 const applyChange = () => { setHasUnsavedGrades?.(false); setSelectedGrade(null); setQuarter(nextVal); setConfirmDialog(null); };
                 if (hasUnsavedGrades) { setConfirmDialog({ message: t('unsaved_grades_confirm'), onConfirm: applyChange }); return; }
                 applyChange();
               }}>{(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => <option key={q} value={q}>{quarterLabels[q]} {t('q_short')}</option>)}</Select>
             </div>
             <div>
               <label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">{t('type')}</label>
               <Select className="w-full sm:w-36 text-xs h-8 sm:h-9" value={defaultGradeType} onChange={e => setDefaultGradeType(e.target.value)} title={t('default_grade_type')}><option key="__none__" value="">{t('not_selected')}</option>{gradeTypes.filter(gt => !gt.isDynamicWeight && !gt.isNoWeight).map((gt, idx) => (<option key={`${gt.key || gt.id || idx}_${idx}`} value={gt.key}>{gt.name}</option>))}</Select>
             </div>
             <div className="col-span-2 sm:w-auto pl-0 border-l-0 md:pl-3 md:border-l border-slate-300 dark:border-slate-700">
               <label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">{t('add_date')}</label>
               <div className="flex gap-2 relative">
                 <Select value={newDateToAdd} onChange={e => addDate(e.target.value)} className="w-full sm:w-44 text-xs h-8 sm:h-9" disabled={datesAvailableToAdd.length === 0}>
                   <option key="__add_date__" value="">{t('add_date')}</option>
                   {datesAvailableToAdd.map((d, idx) => (<option key={`${d}_${idx}`} value={d}>{H.formatDateDDMMYYYY(d)}</option>))}
                 </Select>
                 {datesAvailableToAdd.length === 0 && <div className="absolute inset-0 z-10" onClick={() => setUiNotice(t('no_lessons_subject_quarter'))} />}
               </div>
             </div>
           </div>
           <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
             <Button onClick={() => setShowFinalModal(true)} variant="primary" size="sm" className="flex-1 sm:flex-initial bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 whitespace-nowrap px-2.5 py-1.5 text-xs h-8 sm:h-9">
               <Calculator size={14} className="mr-1.5"/> {t('final_attestation')}
             </Button>
             <Button variant="secondary" size="sm" onClick={() => window.print()} className="w-auto whitespace-nowrap px-2.5 py-1.5 text-xs h-8 sm:h-9">
               <Printer size={14} className="sm:mr-1.5"/><span className="hidden sm:inline">{t('print')}</span>
             </Button>
             <Button onClick={handleSave} variant="primary" size="sm" className={`flex-1 sm:flex-initial whitespace-nowrap px-3 py-1.5 text-xs h-8 sm:h-9 ${hasUnsavedGrades ? 'bg-red-600 hover:bg-red-700 animate-[pulse_0.8s_ease-in-out_infinite] shadow-lg shadow-red-500/50' : 'bg-slate-600 hover:bg-slate-700'}`}>
               <Save size={14} className="mr-1.5"/> {t('save')}
             </Button>
           </div>
         </div>
       </Card>

       {/* Mobile Mode Switcher & Single-Date Vertical Grading View (< md) */}
       <div className="md:hidden no-print space-y-2.5">
         <div className="flex items-center justify-between gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
           <button
             type="button"
             onClick={() => setMobileViewMode('by_date')}
             className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition ${
               mobileViewMode === 'by_date'
                 ? 'bg-blue-600 text-white shadow-xs'
                 : 'text-slate-600 dark:text-slate-400'
             }`}
           >
             {lang === 'ru' ? 'По дате' : 'By Date'}
           </button>
           <button
             type="button"
             onClick={() => setMobileViewMode('table')}
             className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition ${
               mobileViewMode === 'table'
                 ? 'bg-blue-600 text-white shadow-xs'
                 : 'text-slate-600 dark:text-slate-400'
             }`}
           >
             {lang === 'ru' ? 'Вся таблица' : 'Full Table'}
           </button>
         </div>

         {mobileViewMode === 'by_date' && (
           <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
             {visibleDates.length > 0 && activeMobileDate ? (
               <>
                 <div className="p-2 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-1.5">
                   <Button
                     variant="ghost"
                     size="sm"
                     className="px-2 h-8"
                     disabled={activeMobileDateIdx <= 0}
                     onClick={() => {
                       if (activeMobileDateIdx > 0) setSelectedMobileDate(visibleDates[activeMobileDateIdx - 1]);
                     }}
                   >
                     <ChevronLeft size={16} />
                   </Button>
                   <div className="flex-1 min-w-0 flex items-center justify-center gap-1">
                     <Select
                       value={activeMobileDate}
                       onChange={e => setSelectedMobileDate(e.target.value)}
                       className="w-full text-xs font-bold text-center"
                     >
                       {visibleDates.map(d => (
                         <option key={d} value={d}>
                           {H.getDayOfWeek(d, lang as 'ru' | 'en')} • {H.formatDateDDMMYYYY(d)}
                         </option>
                       ))}
                     </Select>
                     <button
                       type="button"
                       onClick={() => deleteDate(activeMobileDate)}
                       className="p-1.5 text-slate-400 hover:text-red-500 shrink-0"
                       title={lang === 'ru' ? 'Удалить дату из журнала' : 'Delete date'}
                     >
                       <X size={14} />
                     </button>
                   </div>
                   <Button
                     variant="ghost"
                     size="sm"
                     className="px-2 h-8"
                     disabled={activeMobileDateIdx < 0 || activeMobileDateIdx >= visibleDates.length - 1}
                     onClick={() => {
                       if (activeMobileDateIdx >= 0 && activeMobileDateIdx < visibleDates.length - 1) {
                         setSelectedMobileDate(visibleDates[activeMobileDateIdx + 1]);
                       }
                     }}
                   >
                     <ChevronRight size={16} />
                   </Button>
                 </div>
                 <div className="divide-y divide-slate-100 dark:divide-slate-800">
                   {students.map((s: User, sIdx: number) => {
                     const sGrades = normalizedSubjectGrades.filter((g: any) => g.studentId === s.id);
                     let wSum = 0, wCount = 0;
                     sGrades.forEach(g => {
                       if (visibleDates.includes(g.date)) {
                         const weight = getEffectiveWeight(g);
                         const parsedVal = H.getEffectiveGradeValue(g, minGrade, localState.settings?.systemTimeOffset);
                         if (parsedVal !== null && weight > 0) {
                           wSum += parsedVal * weight;
                           wCount += weight;
                         }
                       }
                     });
                     const avgStr = wCount ? (wSum / wCount).toFixed(2) : '—';
                     const lessonsCount = getLessonCount(activeMobileDate);
                     const loops = lessonsCount > 1 ? lessonsCount : 1;
                     const isFuture = activeMobileDate > todayIso;
                     const hasLesson = lessonsCount > 0;
                     const isDisabled = isFuture || !hasLesson;

                     return (
                       <div key={s.id} className="p-2 flex items-center justify-between gap-2">
                         <div className="min-w-0 flex-1">
                           <div className="flex items-center gap-1">
                             <span className="text-[10px] font-mono text-slate-400">{sIdx + 1}.</span>
                             <span className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">{H.formatShortName(s.fio)}</span>
                           </div>
                           <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                             {t('average')}: <span className="font-bold text-blue-600 dark:text-blue-400">{avgStr}</span>
                           </div>
                         </div>
                         <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/60 p-1 rounded-lg border border-slate-200/70 dark:border-slate-700 shrink-0">
                           {Array.from({ length: loops }).map((_, lIdx) =>
                             renderGradeCellInput(s, activeMobileDate, lIdx, loops, isDisabled, isFuture, sGrades)
                           )}
                         </div>
                       </div>
                     );
                   })}
                 </div>
               </>
             ) : (
               <div className="p-6 text-center text-slate-400 text-xs">{t('list_empty')}</div>
             )}
           </div>
         )}
       </div>

       <div className={`${mobileViewMode === 'by_date' ? 'hidden md:block print:block' : 'block'} border border-slate-200 rounded-2xl bg-white shadow-soft dark:bg-slate-900 dark:border-slate-800 overflow-hidden print:overflow-visible print:border-none`}>
         <ScrollableTableWrapper lang={lang} maxHeightClass="max-h-none !overflow-y-visible">
           <table className="w-full text-center text-sm border-collapse min-w-[680px] print:min-w-0">
             <thead>
               <tr>
                 <th className="p-2 sm:p-3.5 print:p-1 border-b border-r bg-slate-100 text-left min-w-[115px] sm:min-w-[175px] print:min-w-0 print:w-auto text-slate-600 font-bold sticky top-0 left-0 z-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 text-xs sm:text-sm print:text-[7.5pt] whitespace-nowrap">{t('student')}</th>
                 {visibleDates.map(d => (
                   <th key={d} className="p-1.5 sm:p-2 print:p-0.5 border-b border-r bg-slate-50 min-w-[96px] sm:min-w-[115px] print:min-w-0 print:w-auto sticky top-0 z-30 group dark:bg-slate-800 dark:border-slate-700">
                     <div className="flex flex-col items-center justify-center gap-0.5">
                       <div className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 print:hidden">{H.getDayOfWeek(d, lang as 'ru' | 'en')}</div>
                       <div className="flex items-center gap-1">
                         <div className="text-[11px] sm:text-xs print:text-[7pt] font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{H.formatDateDDMMYYYY(d)}</div>
                         <button onClick={() => deleteDate(d)} className="text-slate-300 hover:text-red-500 transition no-print"><X size={12}/></button>
                       </div>
                     </div>
                   </th>
                 ))}
                 <th className="p-2 sm:p-3.5 print:p-1 border-b bg-blue-50 text-blue-800 font-bold min-w-[68px] sm:min-w-[80px] print:min-w-0 print:w-auto sticky top-0 z-30 dark:bg-blue-950 dark:text-blue-300 dark:border-slate-700 text-center text-xs sm:text-sm print:text-[7.5pt]">{t('average')}</th>
               </tr>
             </thead>
             <tbody>
               {students.map((s: User) => {
                 const sGrades = normalizedSubjectGrades.filter((g: any) => g.studentId === s.id);
                 let wSum = 0, wCount = 0;
                 return (
                   <tr key={s.id} className="group hover:bg-slate-50 transition-colors dark:hover:bg-slate-800/50">
                     <td className="p-2 sm:p-3.5 print:p-1 border-b border-r text-left font-semibold text-xs sm:text-sm print:text-[8pt] text-slate-800 sticky left-0 z-20 bg-white group-hover:bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] dark:bg-slate-900 dark:group-hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700 whitespace-nowrap">{H.formatShortName(s.fio)}</td>
                     {visibleDates.map(d => {
                       const lessonsCount = getLessonCount(d);
                       const loops = lessonsCount > 1 ? lessonsCount : 1;
                       const isFuture = d > todayIso;
                       const hasLesson = lessonsCount > 0;
                       const isDisabled = isFuture || !hasLesson;
                       Array.from({length: loops}).forEach((_, lIdx) => {
                         const g = sGrades.find(gr => gr.date === d && (gr.lessonIndex || 0) === lIdx);
                         if (g) {
                           const weight = getEffectiveWeight(g);
                           const parsedVal = H.getEffectiveGradeValue(g, minGrade, localState.settings?.systemTimeOffset);
                           if (parsedVal !== null && weight > 0) {
                             wSum += parsedVal * weight;
                             wCount += weight;
                           }
                         }
                       });
                       return (
                         <td key={d} className={`p-1 print:p-0.5 border-b border-r h-16 sm:h-20 print:h-auto relative z-0 dark:border-slate-700 ${isDisabled ? 'bg-slate-100 dark:bg-slate-950 opacity-60 print:opacity-100 print:bg-transparent' : ''}`}>
                           <div className="flex gap-1 print:gap-0.5 justify-center items-center h-full">
                             {Array.from({length: loops}).map((_, lIdx) => renderGradeCellInput(s, d, lIdx, loops, isDisabled, isFuture, sGrades))}
                           </div>
                         </td>
                       );
                     })}
                     <td className="p-2 sm:p-3.5 print:p-1 border-b bg-blue-50/50 font-bold text-xs sm:text-sm print:text-[8pt] text-blue-700 dark:bg-blue-900/10 dark:text-blue-300 dark:border-slate-700 text-center">{wCount ? (wSum / wCount).toFixed(2) : '-'}</td>
                   </tr>
                 );
               })}
               {students.length === 0 && <tr><td colSpan={visibleDates.length + 2} className="p-10 text-center text-slate-400">{t('list_empty')}</td></tr>}
             </tbody>
           </table>
         </ScrollableTableWrapper>
       </div>
       
       {selectedGrade && typeof document !== 'undefined' && createPortal(
           <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 p-3 sm:p-6 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-[100] animate-in slide-in-from-bottom duration-300 no-print">
               <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-2.5 sm:gap-8 items-start">
                   {/* Left Side: Info */}
                   <div className="flex-1 w-full">
                       <div className="flex items-center justify-between mb-2 sm:mb-5">
                           <h3 className="text-sm sm:text-lg font-bold text-slate-800 dark:text-white">{t('grade_details')}</h3>
                           <button
                               onClick={() => setSelectedGrade(null)}
                               className="md:hidden p-1 text-slate-500 hover:text-slate-800 dark:text-slate-300 transition"
                           >
                               <X size={18} strokeWidth={2} />
                           </button>
                       </div>
                       <div className="grid grid-cols-2 gap-y-1.5 sm:gap-y-4 gap-x-3 sm:gap-x-8 text-xs sm:text-sm">
                           <div className="truncate">
                               <span className="font-bold text-slate-800 dark:text-slate-200">{t('student')}: </span>
                               <span className="text-slate-600 dark:text-slate-400">{H.formatShortName(selectedGrade.studentName)}</span>
                           </div>
                           <div>
                               <span className="font-bold text-slate-800 dark:text-slate-200">{t('date')}: </span>
                               <span className="text-slate-600 dark:text-slate-400">{H.formatDateDDMMYYYY(selectedGrade.grade.date)}</span>
                           </div>
                           <div className="flex items-center gap-1">
                               <span className="font-bold text-slate-800 dark:text-slate-200">{t('value_label')}: </span>
                               <span className={`font-bold ${H.getGradeColorClass(String(selectedGrade.grade.value), minGrade, maxGrade)}`}>
                                   {selectedGrade.grade.value}
                               </span>
                           </div>
                           <div className="truncate">
                               <span className="font-bold text-slate-800 dark:text-slate-200">{t('type')}: </span>
                               <span className="text-slate-600 dark:text-slate-400">
                                   {H.getGradeTypeDisplayName(selectedGrade.grade.type, gradeTypes, lang) || '...'}
                                   <span className="text-slate-400 ml-1">(×{getEffectiveWeight(selectedGrade.grade)})</span>
                               </span>
                           </div>
                           {selectedTypeIsDynamic && (
                               <div className="col-span-2 flex items-center gap-2 mt-1">
                                   <span className="text-[11px] sm:text-xs font-bold text-slate-500">{t('weight_coeff')}</span>
                                   <Input 
                                      type="number" 
                                      min={minWeight} 
                                      max={maxWeight} 
                                      value={editWeight} 
                                      onChange={e => { 
                                          const raw = parseInt(e.target.value);
                                          const val = isNaN(raw) ? minWeight : Math.max(minWeight, Math.min(maxWeight, raw));
                                          setEditWeight(val); 
                                          if (selectedGrade && targetKey) {
                                              const subjList = ensureMutableSubjectGrades();
                                              const gIndex = subjList.findIndex((g:any) => g.id === selectedGrade.grade.id);
                                              if (gIndex > -1) {
                                                  subjList[gIndex].weight = val;
                                                  const newState = {...localState};
                                                  setLocalState(newState);
                                                  commitGradebookChanges(newState);
                                                  setSelectedGrade({...selectedGrade, grade: subjList[gIndex]}); 
                                              }
                                          }
                                      }} 
                                      className="w-14 sm:w-16 h-7 sm:h-8 text-xs sm:text-sm"
                                   />
                                   <Button onClick={() => openDeadlineModal(selectedGrade.grade)} variant="secondary" size="sm" className="h-7 sm:h-8 text-[11px] sm:text-xs whitespace-nowrap px-2">
                                       <Clock size={13} className="mr-1"/> {t('timer_btn')}
                                   </Button>
                               </div>
                           )}
                       </div>
                   </div>

                   {/* Right Side: Comment */}
                   <div className="flex-1 w-full flex gap-4 sm:gap-6">
                       <button
                           onClick={() => setSelectedGrade(null)}
                           className="hidden md:block mt-[-4px] p-1 text-slate-800 hover:text-slate-600 dark:text-slate-200 dark:hover:text-slate-400 transition h-fit"
                       >
                           <X size={24} strokeWidth={2} />
                       </button>
                       <div className="flex-1">
                           <label className="block text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 sm:mb-2">{t('comment_upper')}</label>
                           <textarea
                               className="w-full h-14 sm:h-24 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg p-2 sm:p-3 text-xs sm:text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
                               value={editComment}
                               onChange={e => { 
                                   const val = e.target.value;
                                   setEditComment(val); 
                                   if (selectedGrade && targetKey) {
                                       const subjList = ensureMutableSubjectGrades();
                                       const gIndex = subjList.findIndex((g:any) => g.id === selectedGrade.grade.id);
                                       if (gIndex > -1) {
                                           subjList[gIndex].comment = val;
                                           const newState = {...localState};
                                           setLocalState(newState);
                                           commitGradebookChanges(newState);
                                           setSelectedGrade({...selectedGrade, grade: subjList[gIndex]}); 
                                       }
                                   }
                               }}
                               placeholder="..."
                           />
                       </div>
                   </div>
               </div>
           </div>,
           document.body
       )}

       <Modal isOpen={!!uiNotice} onClose={() => setUiNotice(null)} title={t('attention')}>
           <div className="space-y-4">
               <p className="text-sm text-slate-700 dark:text-slate-300">{uiNotice}</p>
               <div className="flex justify-end">
                   <Button onClick={() => setUiNotice(null)} variant="primary">{t('close')}</Button>
               </div>
           </div>
       </Modal>
       <Modal isOpen={!!confirmDialog} onClose={() => setConfirmDialog(null)} title={t('attention')}>
           <div className="space-y-4">
               <p className="text-sm text-slate-700 dark:text-slate-300">{confirmDialog?.message}</p>
               <div className="flex justify-end gap-2">
                   <Button onClick={() => setConfirmDialog(null)} variant="secondary">{t('cancel')}</Button>
                   <Button onClick={() => confirmDialog?.onConfirm()} variant="danger">{t('confirm')}</Button>
               </div>
           </div>
       </Modal>
       <Modal isOpen={!!deadlineModal} onClose={() => { setDeadlineError(null); setDeadlineModal(null); }} title={t('nu_deadline')}>
           <div className="space-y-5">
               <div className="bg-blue-50 dark:bg-blue-950/40 p-4 rounded-xl border border-blue-100 dark:border-blue-800 text-sm text-blue-900 dark:text-blue-200 flex items-start gap-3">
                   <AlertCircle className="flex-shrink-0 mt-0.5" size={18}/>
                   <p>{t('deadline_info')}</p>
               </div>
               <div>
                   <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('select_date')}</label>
                   <Input
                       type="date"
                       min={getMinDeadlineDate(deadlineModal?.grade.date)}
                       value={deadlineDate}
                       onChange={e => {
                           const val = e.target.value;
                           setDeadlineDate(val);
                           if (val && deadlineModal?.grade.date && val <= deadlineModal.grade.date) {
                               setDeadlineError(
                                   lang === 'ru'
                                       ? `Нельзя выбрать дату выставления Н/У (${H.formatDateDDMMYYYY(deadlineModal.grade.date)}) или дату до неё.`
                                       : `Cannot select the Н/У grade date (${H.formatDateDDMMYYYY(deadlineModal.grade.date)}) or any earlier date.`
                               );
                           } else {
                               setDeadlineError(null);
                           }
                       }}
                   />
                   {deadlineError && (
                       <p className="mt-2 text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                           <AlertCircle size={13} className="shrink-0" />
                           <span>{deadlineError}</span>
                       </p>
                   )}
               </div>
               <div className="flex justify-end gap-2">
                   <Button onClick={() => { setDeadlineError(null); setDeadlineModal(null); }} variant="ghost">{t('cancel')}</Button>
                   <Button onClick={saveDeadline} disabled={!!(deadlineDate && deadlineModal?.grade.date && deadlineDate <= deadlineModal.grade.date)} variant="primary">{t('save')}</Button>
               </div>
           </div>
       </Modal>
       <Modal isOpen={showFinalModal} onClose={() => setShowFinalModal(false)} title={`${t('final_attestation')}: ${cls.replace('_', '')} — ${subj}`} maxWidth="max-w-5xl">
           <div className="hidden print:block pb-2 mb-3 border-b border-slate-300 text-center">
               <div className="text-xs font-bold uppercase tracking-widest text-slate-600">{H.getSchool(localState, user.schoolId)?.name || 'ЭлЖур'}</div>
               <div className="text-xs text-slate-600 mt-0.5">{t('teacher')}: {H.formatShortName(user.fio)}</div>
           </div>
           <div className="flex items-center justify-between gap-2 mb-3 no-print">
               <div className="text-xs text-slate-500 dark:text-slate-400">
                   {lang === 'ru' ? `Класс: ${cls.replace('_', '')} • Предмет: ${subj}` : `Class: ${cls.replace('_', '')} • Subject: ${subj}`}
               </div>
               <Button variant="secondary" size="sm" onClick={() => window.print()} className="px-2.5 py-1.5 text-xs">
                   <Printer size={14} className="mr-1.5"/> {t('print')}
               </Button>
           </div>
           <div className="overflow-x-auto print:overflow-visible">
               <table className="w-full text-xs sm:text-sm text-center min-w-[540px] print:min-w-0 border-collapse">
                   <thead className="bg-slate-50 text-slate-600 font-bold dark:bg-slate-800 dark:text-slate-300">
                       <tr>
                           <th className="p-2 sm:p-3 text-left sticky left-0 z-30 bg-slate-50 dark:bg-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">{t('student')}</th>
                           {['Q1', 'Q2', 'Q3', 'Q4'].map(q => <th key={q} className="p-2 sm:p-3">{quarterLabels[q]} {t('q_short')}</th>)}
                           <th className="p-2 sm:p-3">{t('exam')}</th>
                           <th className="p-2 sm:p-3">{t('year')}</th>
                       </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                       {students.map(s => {
                           const entry = getFinalData(s.id);
                           const yearAvg = calculateYearAverage(s.id);
                           const renderCell = (field: 'q1'|'q2'|'q3'|'q4'|'exam'|'year', label: string, isConfirmed?: boolean, status?: { val: string | null, isNA: boolean }) => {
                               const storedVal = (entry as any)[field];
                               const autoVal = status ? status.val : null;
                               const isNA = status ? status.isNA : false;
                               const isPlaceholder = !storedVal && !!autoVal;
                               const canConfirmYear = field === 'year' ? (entry.q1 && entry.q2 && entry.q3 && entry.q4) : true;
                               const printDisplay = storedVal || (isNA ? 'Н/А' : '—');
                               return (
                                   <td className="p-1.5 sm:p-2 relative z-0">
                                       <span className="hidden print:inline font-bold text-black">{printDisplay}</span>
                                       <div className="flex flex-col items-center gap-1 print:hidden">
                                           <div className="relative group/cell">
                                               <input
                                                   className={`w-10 sm:w-12 text-center border rounded p-1 text-xs sm:text-sm font-bold transition-all ${isConfirmed ? 'bg-white border-slate-200 text-slate-800 dark:bg-slate-900 dark:text-white dark:border-slate-700' : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800'} ${isPlaceholder ? 'opacity-50' : ''}`}
                                                   value={storedVal || ''}
                                                   placeholder={isPlaceholder ? autoVal! : ''}
                                                   onChange={e => updateFinalGrade(s.id, field, e.target.value)}
                                               />
                                               {(!isConfirmed && (storedVal || autoVal)) && canConfirmYear && (
                                                   <button
                                                       onClick={() => {
                                                           if (!storedVal && autoVal) {
                                                               const parsedAuto = parseFloat(autoVal);
                                                               const finalAuto = !isNaN(parsedAuto) ? String(Math.max(minGrade, Math.min(maxGrade, Math.round(parsedAuto)))) : autoVal;
                                                               updateFinalGrade(s.id, field, finalAuto);
                                                           }
                                                           confirmFinalGrade(s.id, field);
                                                       }}
                                                       title={t('confirm_grade')}
                                                       className="absolute -right-5 top-1/2 -translate-y-1/2 text-green-500 hover:text-green-600 bg-white dark:bg-slate-800 rounded-full shadow-sm p-0.5 no-print"
                                                   >
                                                       <Check size={13} strokeWidth={3}/>
                                                   </button>
                                               )}
                                           </div>
                                           {!storedVal && isNA && (
                                               <span className="text-[10px] text-red-500 font-bold leading-none">Н/А</span>
                                           )}
                                           {autoVal && !storedVal && !isNA && <span className="text-[9px] text-slate-400" title={t('calc_grade')}>~{autoVal}</span>}
                                       </div>
                                   </td>
                               );
                           };
                           return (
                               <tr key={s.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                   <td className="p-2 sm:p-3 text-left font-semibold text-slate-700 dark:text-slate-200 sticky left-0 z-20 bg-white group-hover:bg-slate-50 dark:bg-slate-900 dark:group-hover:bg-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] whitespace-nowrap">{H.formatShortName(s.fio)}</td>
                                   {['q1', 'q2', 'q3', 'q4'].map(qKey => {
                                       const status = calculateQuarterStatus(s.id, qKey.toUpperCase());
                                       const isConf = (entry as any)[`is${qKey.charAt(0).toUpperCase() + qKey.slice(1)}Confirmed`];
                                       return (<React.Fragment key={qKey}>{renderCell(qKey as any, qKey.toUpperCase(), isConf, status)}</React.Fragment>);
                                   })}
                                   {renderCell('exam', t('exam'), entry.isExamConfirmed, undefined)}
                                   {renderCell('year', t('year'), entry.isYearConfirmed, { val: yearAvg, isNA: false })}
                               </tr>
                           );
                       })}
                   </tbody>
               </table>
           </div>
           <div className="mt-4 sm:mt-6 flex justify-end gap-2 no-print">
               <Button onClick={() => window.print()} variant="secondary">
                   <Printer size={14} className="mr-1.5"/> {t('print')}
               </Button>
               <Button onClick={() => setShowFinalModal(false)} variant="secondary">{t('close')}</Button>
           </div>
       </Modal>
     </div>
   );
}
