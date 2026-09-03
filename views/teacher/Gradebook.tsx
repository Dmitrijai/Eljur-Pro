import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AppState, User, Grade, FinalGradeEntry, GradeType } from '../../types';
import * as H from '../../utils/helpers';
import { Button, Input, Select, Card, Modal } from '../../components/ui';
import { Calculator, Printer, Check, AlertCircle, Clock, X, Save } from 'lucide-react';

export const Gradebook = ({ state, onUpdate, user, lang, setHasUnsavedGrades, hasUnsavedGrades }: { state: AppState, onUpdate: any, user: User, lang: 'ru' | 'en', setHasUnsavedGrades?: any, hasUnsavedGrades?: boolean }) => {
   const [localState, setLocalState] = useState<AppState>(() => JSON.parse(JSON.stringify(state)));
   
   useEffect(() => {
       if (!hasUnsavedGrades) {
           setLocalState(JSON.parse(JSON.stringify(state)));
       }
   }, [state, hasUnsavedGrades]);

   const handleSave = () => {
       const updatedGrades = { ...(state.grades || {}), ...(localState.grades || {}) };
       const updatedFinalGrades = { ...(state.finalGrades || {}), ...(localState.finalGrades || {}) };
       onUpdate({
           ...state,
           grades: updatedGrades,
           finalGrades: updatedFinalGrades
       });
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

   const [cls, setCls] = useState(myClasses[0] ? `${myClasses[0].class}_${myClasses[0].letter}` : '');
   const targetKey = cls ? H.getSchoolClassKey(user.schoolId, cls) : '';
   
   const availableSubjects = useMemo(() => {
        if (!cls) return [];
        const assigned = (localState.teacherAssignments || []).filter((a: any) => a.teacherId === user.id && a.classId === cls).map((a: any) => a.subject);
        const schedule = H.getSchoolClassSchedule(localState, user.schoolId, cls);
        if (schedule) {
            Object.values(schedule).forEach((d: any) => {
                d.lessons.forEach((l: any) => {
                    if (l.teacherId === user.id && l.canGrade) { assigned.push(l.lesson); }
                    if (l.subgroups) { l.subgroups.forEach((sg: any) => { if (sg.teacherId === user.id && sg.canGrade) { assigned.push(sg.subject); } }); }
                });
            });
        }
        if (assigned.length === 0 && user.subjects) { return user.subjects; }
        return Array.from(new Set(assigned));
   }, [cls, localState.teacherAssignments, user.id, user.subjects, localState, user.schoolId]);

   const [subj, setSubj] = useState(''); 
   useEffect(() => { if (availableSubjects.length > 0 && !availableSubjects.includes(subj)) { setSubj(availableSubjects[0]); } }, [availableSubjects, subj]);

   const [quarter, setQuarter] = useState('Q1');
   useEffect(() => {
       if (scheduleSettings.quarterDefinitions) {
           const systemNow = new Date(Date.now() + (localState.settings.systemTimeOffset || 0));
           const dateStr = H.dateToIso(systemNow);
           for (const [qKey, def] of Object.entries(scheduleSettings.quarterDefinitions)) {
               if (def.start && def.end && dateStr >= def.start && dateStr <= def.end) { setQuarter(qKey); return; }
           }
       }
   }, [scheduleSettings.quarterDefinitions, localState.settings.systemTimeOffset]);

   const [newDateToAdd, setNewDateToAdd] = useState('');
   const [defaultGradeType, setDefaultGradeType] = useState(''); 
   const [selectedGrade, setSelectedGrade] = useState<{grade: Grade, studentName: string} | null>(null);
   const [editComment, setEditComment] = useState('');
   const [editWeight, setEditWeight] = useState(1);
   const [showFinalModal, setShowFinalModal] = useState(false);
   const [deadlineModal, setDeadlineModal] = useState<{isOpen: boolean, grade: Grade} | null>(null);
   const [deadlineDate, setDeadlineDate] = useState('');
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

   const visibleDates = useMemo(() => { return (localState.quarters[quarter] || []).filter(d => validLessonDates.includes(d)).sort(); }, [localState.quarters, quarter, validLessonDates]);
   const datesAvailableToAdd = useMemo(() => { return validLessonDates.filter(d => !visibleDates.includes(d)); }, [validLessonDates, visibleDates]);

   const addDate = (newDate: string) => { if (!newDate) return; if (!localState.quarters[quarter].includes(newDate)) { localState.quarters[quarter].push(newDate); localState.quarters[quarter].sort(); const newState = {...localState}; setLocalState(newState); setHasUnsavedGrades?.(false); onUpdate(newState); setNewDateToAdd(''); } };
   const getLessonCount = (d: string) => { if (!cls || !d || !subj) return 0; const schedule = H.getSchoolClassSchedule(localState, user.schoolId, cls); if (!schedule) return 0; const days = Object.values(schedule) as any[]; const day = days.find(day => day.date === d); if (!day) return 0; return day.lessons.filter((l: any) => { if(l.subgroups && l.subgroups.length > 0) return l.subgroups.some((sg:any) => sg.subject === subj); return l.lesson === subj; }).length; };
   const getLessonsPerWeek = (classKey: string, subject: string): number => { const schedule = H.getSchoolClassSchedule(localState, user.schoolId, classKey); if (!schedule) return 0; const systemNow = new Date(Date.now() + (localState.settings.systemTimeOffset || 0)); const weekStart = H.getStartOfWeek(systemNow); let count = 0; Object.values(schedule).forEach((day:any) => { if (H.isDateInWeek(day.date, weekStart)) { day.lessons.forEach((l:any) => { if (l.lesson === subject) count++; if (l.subgroups && l.subgroups.length > 0) { if (l.subgroups.some((sg:any) => sg.subject === subject)) count++; } }); } }); return count; };
   const deleteDate = (d: string) => { if(!window.confirm(t('confirm_delete'))) return; localState.quarters[quarter] = localState.quarters[quarter].filter((x: string) => x !== d); const newState = {...localState}; setLocalState(newState); setHasUnsavedGrades?.(false); onUpdate(newState); };

   const updateGrade = (studentId: string, date: string, val: string, type: string, forcedLessonIndex?: number) => {
     const systemNow = new Date(Date.now() + (localState.settings.systemTimeOffset || 0));
     const todayIso = H.dateToIso(systemNow);
     if (date > todayIso) return alert(t('cant_grade_future'));
     if (getLessonCount(date) === 0) return alert(t('no_lesson_grade'));
     
     let activeQuarterKey = null;
     if (scheduleSettings.quarterDefinitions) { for (const [qKey, def] of Object.entries(scheduleSettings.quarterDefinitions)) { if (def.start && def.end && todayIso >= def.start && todayIso <= def.end) { activeQuarterKey = qKey; break; } } }
     if (activeQuarterKey) { const def = scheduleSettings.quarterDefinitions![activeQuarterKey]; if (date < def.start || date > def.end) { return alert('Редактирование запрещено: дата вне текущей четверти.'); } } 
     else { const hasAnyDefinitions = Object.values(scheduleSettings.quarterDefinitions || {}).some(d => d.start && d.end); if (hasAnyDefinitions) { return alert('Текущая дата не попадает ни в одну из четвертей. Редактирование запрещено.'); } }
     const viewDef = scheduleSettings.quarterDefinitions?.[quarter];
     if (viewDef && viewDef.start && viewDef.end) { if (date < viewDef.start || date > viewDef.end) { return alert(`Нельзя выставлять оценки вне дат текущей просматриваемой четверти (${H.formatDateDDMMYYYY(viewDef.start)} - ${H.formatDateDDMMYYYY(viewDef.end)})`); } }

     if (!targetKey) return;
     if (!localState.grades[targetKey]) localState.grades[targetKey] = {};
     if (!localState.grades[targetKey][subj]) localState.grades[targetKey][subj] = [];
     const targetIndex = forcedLessonIndex !== undefined ? forcedLessonIndex : 0;
     const existingGrade = localState.grades[targetKey][subj].find((g: any) => g.studentId === studentId && g.date === date && (g.lessonIndex || 0) === targetIndex);

     let finalType = type;
     if (!existingGrade && type === undefined) { finalType = defaultGradeType; }
     if (type === '') { finalType = ''; }
     let finalValue = val;
     
     // Handle Special Types logic
     if (finalType) {
         const gt = gradeTypes.find(t => t.key === finalType);
         if (gt) {
             if (gt.isDynamicWeight) finalValue = 'Н/У'; // Or dynamic prompt, handled separately via edit
             else if (gt.isNoWeight && gt.name === 'Н') finalValue = 'Н';
             else if (gt.isNoWeight && gt.name === 'ОП') finalValue = 'ОП';
             else {
                 if (isNaN(parseFloat(finalValue)) && finalValue !== '') {
                     finalValue = '';
                 }
             }
             // Fallback for legacy
             if (finalType === 'nu') finalValue = 'Н/У';
             if (finalType === 'n') finalValue = 'Н';
             if (finalType === 'op') finalValue = 'ОП';
         }
     }
     
     if (finalValue.toUpperCase() === 'Н/У' || finalValue.toUpperCase() === 'N/U') { finalType = 'nu'; finalValue = 'Н/У'; }

     const isNewTypeSpecial = gradeTypes.find(t => t.key === finalType)?.isNoWeight || gradeTypes.find(t => t.key === finalType)?.isDynamicWeight;

     if (finalValue === '' && (!finalType || finalType === '')) { if (existingGrade) { const actualIdx = localState.grades[targetKey][subj].indexOf(existingGrade); if (actualIdx > -1) localState.grades[targetKey][subj].splice(actualIdx, 1); } } 
     else {
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
           
           // Logic to preserve custom weight if dynamic
           const gt = gradeTypes.find(t => t.key === finalType);
           if (gt?.isDynamicWeight) {
                // If weight not set or 0, default to 1
                if (!existingGrade.weight) existingGrade.weight = 1;
           } else {
                existingGrade.weight = weight; 
           }
       } 
       else { 
           if (finalValue !== '' || isNewTypeSpecial || finalType !== '') { 
               const newG = { id: H.uid('g'), studentId, date, value: finalValue, type: finalType, weight, comment: targetIndex > 0 ? `${t('lesson_order')} ${targetIndex + 1}` : '', lessonIndex: targetIndex }; 
               localState.grades[targetKey][subj].push(newG); 
           } 
       }
     }
     
     if (selectedGrade && selectedGrade.grade.studentId === studentId && selectedGrade.grade.date === date && (selectedGrade.grade.lessonIndex || 0) === targetIndex) {
         const updatedGrade = localState.grades[targetKey][subj].find((g: any) => g.studentId === studentId && g.date === date && (g.lessonIndex || 0) === targetIndex);
         if (updatedGrade) { setSelectedGrade({ ...selectedGrade, grade: { ...updatedGrade } }); } else { setSelectedGrade(null); }
     }
     setLocalState({...localState});
     setHasUnsavedGrades?.(true);
   };

   const [isCommentSaved, setIsCommentSaved] = useState(false);

   const handleGradeClick = (g: Grade, studentName: string) => { 
       // Only open if grade has a value (non-empty)
       if (g && (g.value || g.value === 0)) {
           setSelectedGrade({grade: g, studentName}); 
           setEditComment(g.comment || ''); 
           setEditWeight(g.weight || 1);
           setIsCommentSaved(false);
       }
   };
   
   const saveGradeDetails = () => { 
       if (!selectedGrade || !targetKey) return; 
       const gIndex = (localState.grades[targetKey]?.[subj] || []).findIndex(g => g.id === selectedGrade.grade.id); 
       if (gIndex > -1) { 
           localState.grades[targetKey][subj][gIndex].comment = editComment; 
           // Allow weight edit if dynamic type
           const typeDef = gradeTypes.find(t => t.key === localState.grades[targetKey][subj][gIndex].type);
           if (typeDef?.isDynamicWeight) { 
               localState.grades[targetKey][subj][gIndex].weight = editWeight; 
           } 
           const newState = {...localState};
           setLocalState(newState);
           setHasUnsavedGrades?.(false);
           onUpdate(newState);
           setSelectedGrade({...selectedGrade, grade: localState.grades[targetKey][subj][gIndex]}); 
           setIsCommentSaved(true);
       } 
   };
   const openDeadlineModal = (g: Grade) => { setDeadlineModal({ isOpen: true, grade: g }); setDeadlineDate(g.deadline || ''); };
   const saveDeadline = () => { if (!deadlineModal || !targetKey) return; const gIndex = (localState.grades[targetKey]?.[subj] || []).findIndex(g => g.id === deadlineModal.grade.id); if (gIndex > -1) { localState.grades[targetKey][subj][gIndex].deadline = deadlineDate; const newState = {...localState}; setLocalState(newState); setHasUnsavedGrades?.(false); onUpdate(newState); setDeadlineModal(null); } };

   const students = localState.users.filter((u: User) => u.schoolId === user.schoolId && u.role === 'student' && `${u.class}_${u.letter}` === cls);
   const quarterLabels: Record<string, string> = { 'Q1': '1', 'Q2': '2', 'Q3': '3', 'Q4': '4' };

   const getFinalData = (studentId: string): FinalGradeEntry => {
       if (!targetKey) return { studentId };
       if (!localState.finalGrades) localState.finalGrades = {}; if (!localState.finalGrades[targetKey]) localState.finalGrades[targetKey] = {}; if (!localState.finalGrades[targetKey][subj]) localState.finalGrades[targetKey][subj] = [];
       const found = localState.finalGrades[targetKey][subj].find(entry => entry.studentId === studentId);
       if (found) return found;
       const newEntry = { studentId }; localState.finalGrades[targetKey][subj].push(newEntry); return newEntry;
   };

   // Helper to get weight dynamically
   const getEffectiveWeight = (g: Grade) => {
        if (!useWeights) return 1;
        const typeDef = gradeTypes.find(t => t.key === g.type);
        if (!typeDef) return 1;
        if (typeDef.isNoWeight) return 0;
        if (typeDef.isDynamicWeight) return g.weight || 1;
        return typeDef.weight; // Use Global Config Weight
   };

   const calculateQuarterStatus = (studentId: string, quarterKey: string) => {
       const def = scheduleSettings.quarterDefinitions?.[quarterKey];
       if (!def || !def.start || !def.end) return { val: null, isNA: false };
       const subjectGrades = targetKey ? (localState.grades[targetKey]?.[subj] || []) : [];
       let wSum = 0; let wCount = 0; let gradeCount = 0;
       const systemNow = new Date(Date.now() + (localState.settings.systemTimeOffset || 0)); systemNow.setHours(0,0,0,0);
       subjectGrades.forEach(g => {
           if (g.studentId === studentId && g.date >= def.start && g.date <= def.end) {
               let valStr = String(g.value);
               // Handle N/U expiry
               const typeDef = gradeTypes.find(t => t.key === g.type);
               if (typeDef?.isDynamicWeight && valStr === 'Н/У') { 
                   const created = new Date(g.date); 
                   const deadline = g.deadline ? new Date(g.deadline) : H.addDays(created, 7); 
                   if (systemNow >= deadline) { valStr = String(minGrade); } 
               }
               const val = parseFloat(valStr);
               if (!isNaN(val)) { 
                   const weight = getEffectiveWeight(g);
                   wSum += val * weight; 
                   wCount += weight; 
                   gradeCount++; 
               }
           }
       });
       const average = wCount > 0 ? (wSum / wCount).toFixed(2) : null;
       let minGrades = 0; const req = (targetKey && localState.subjectRequirements?.[targetKey]?.[subj]) || localState.subjectRequirements?.[cls]?.[subj];
       if (req && req.type === 'manual') { minGrades = req.minGrades; } else { const lessonsPerWeek = getLessonsPerWeek(cls, subj); if (lessonsPerWeek > 3) minGrades = 5; else if (lessonsPerWeek > 0) minGrades = 3; else minGrades = 0; }
       if (minGrades > 0 && gradeCount < minGrades) { return { val: String(minGrade), isNA: true }; }
       return { val: average, isNA: false };
   };
   
   const calculateYearAverage = (studentId: string) => { const entry = getFinalData(studentId); let sum = 0; let count = 0; ['q1', 'q2', 'q3', 'q4'].forEach(q => { const val = parseFloat((entry as any)[q]); if (!isNaN(val)) { sum += val; count++; } }); const examVal = parseFloat(entry.exam || ''); if (!isNaN(examVal)) { sum += examVal; count++; } return count > 0 ? (sum / count).toFixed(2) : null; };
   const updateFinalGrade = (studentId: string, field: keyof FinalGradeEntry, value: string) => { const entry = getFinalData(studentId); (entry as any)[field] = value; const newState = {...localState}; setLocalState(newState); setHasUnsavedGrades?.(false); onUpdate(newState); };
   const confirmFinalGrade = (studentId: string, field: 'q1' | 'q2' | 'q3' | 'q4' | 'year' | 'exam') => { const entry = getFinalData(studentId); if (field === 'q1') entry.isQ1Confirmed = true; if (field === 'q2') entry.isQ2Confirmed = true; if (field === 'q3') entry.isQ3Confirmed = true; if (field === 'q4') entry.isQ4Confirmed = true; if (field === 'exam') entry.isExamConfirmed = true; if (field === 'year') entry.isYearConfirmed = true; const newState = {...localState}; setLocalState(newState); setHasUnsavedGrades?.(false); onUpdate(newState); };
   const systemNow = new Date(Date.now() + (localState.settings.systemTimeOffset || 0)); const todayIso = H.dateToIso(systemNow); systemNow.setHours(0,0,0,0);

   const selectedTypeIsDynamic = selectedGrade ? gradeTypes.find(t => t.key === selectedGrade.grade.type)?.isDynamicWeight : false;

   return (
     <div className="space-y-6">
       <Card className="p-6 bg-slate-50 border-blue-200 no-print dark:bg-slate-900 dark:border-slate-800"><div className="flex flex-wrap gap-4 items-end justify-between w-full"><div className="flex flex-wrap gap-4 items-end"><div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">{t('class')}</label><Select className="w-32" value={cls} onChange={e => { if (hasUnsavedGrades && !window.confirm("У вас есть несохраненные оценки. Продолжить без сохранения?")) return; setHasUnsavedGrades?.(false); setCls(e.target.value); setNewDateToAdd(''); }}>{myClasses.map((c: any) => <option key={`${c.class}_${c.letter}`} value={`${c.class}_${c.letter}`}>{c.class}{c.letter}</option>)}</Select></div><div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">{t('subject')}</label><Select className="w-48" value={subj} onChange={e => { if (hasUnsavedGrades && !window.confirm("У вас есть несохраненные оценки. Продолжить без сохранения?")) return; setHasUnsavedGrades?.(false); setSubj(e.target.value); setNewDateToAdd(''); }}>{availableSubjects.map((s: string) => <option key={s} value={s}>{s}</option>)}</Select></div><div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">{t('quarter')}</label><Select className="w-24" value={quarter} onChange={e => { if (hasUnsavedGrades && !window.confirm("У вас есть несохраненные оценки. Продолжить без сохранения?")) return; setHasUnsavedGrades?.(false); setQuarter(e.target.value); }}>{Object.keys(localState.quarters).map(q => <option key={q} value={q}>{quarterLabels[q]} Ч.</option>)}</Select></div><div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">{t('type')}</label><Select className="w-32" value={defaultGradeType} onChange={e => setDefaultGradeType(e.target.value)} title="Тип оценки по умолчанию"><option value="">{t('not_selected')}</option>{gradeTypes.filter(t => !t.isDynamicWeight && !t.isNoWeight).map(t => (<option key={t.key} value={t.key}>{t.name}</option>))}</Select></div><div className="pl-0 border-l-0 md:pl-4 md:border-l border-slate-300 dark:border-slate-700"><label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">{t('add_date')}</label><div className="flex flex-col gap-1"><div className="flex gap-2 relative"><Select value={newDateToAdd} onChange={e => addDate(e.target.value)} className="w-40" disabled={datesAvailableToAdd.length === 0}><option value="">{t('add_date')}</option>{datesAvailableToAdd.map(d => (<option key={d} value={d}>{H.formatDateDDMMYYYY(d)}</option>))}</Select>{datesAvailableToAdd.length === 0 && <div className="absolute inset-0 z-10" onClick={() => alert(`В расписании этого класса нет уроков по предмету «${subj}» в текущей четверти.`)} />}</div></div></div><div className="flex gap-2"><Button onClick={() => setShowFinalModal(true)} variant="primary" className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 whitespace-nowrap px-4"><Calculator size={16} className="mr-2"/> {t('final_attestation')}</Button><Button variant="secondary" onClick={() => window.print()} className="whitespace-nowrap px-4"><Printer size={16} className="mr-2"/> {t('print')}</Button></div></div><div className="flex gap-2"><Button onClick={handleSave} variant="primary" className={`whitespace-nowrap px-4 ${hasUnsavedGrades ? 'bg-red-600 hover:bg-red-700 animate-[pulse_0.8s_ease-in-out_infinite] shadow-lg shadow-red-500/50' : 'bg-slate-600 hover:bg-slate-700'}`}><Save size={16} className="mr-2"/> Сохранить</Button></div></div></Card>
       <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-soft dark:bg-slate-900 dark:border-slate-800"><table className="w-full text-center text-sm border-collapse min-w-[800px]"><thead><tr><th className="p-4 border-b border-r bg-slate-100 text-left min-w-[200px] text-slate-600 font-bold sticky left-0 z-10 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 text-center">{t('student')}</th>{visibleDates.map(d => { return (<th key={d} className="p-2 border-b border-r bg-slate-50 min-w-[120px] group dark:bg-slate-800 dark:border-slate-700"><div className="flex flex-col items-center justify-center gap-1"><div className="flex items-center gap-1"><div className="text-xs font-semibold text-slate-700 dark:text-slate-300">{H.formatDateDDMMYYYY(d)}</div><button onClick={() => deleteDate(d)} className="text-slate-300 hover:text-red-500 transition no-print"><X size={12}/></button></div></div></th>); })}<th className="p-4 border-b bg-blue-50 text-blue-800 font-bold min-w-[80px] dark:bg-blue-900/30 dark:text-blue-300 dark:border-slate-700 text-center">{t('average')}</th></tr></thead><tbody>{students.map((s: User) => { const sGrades = (targetKey ? (localState.grades[targetKey]?.[subj] || []) : []).filter((g: any) => g.studentId === s.id); let wSum = 0, wCount = 0; return (<tr key={s.id} className="hover:bg-slate-50 transition-colors dark:hover:bg-slate-800/50"><td className="p-4 border-b border-r text-left font-semibold text-slate-800 sticky left-0 bg-white group-hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700">{s.fio}</td>{visibleDates.map(d => { const lessonsCount = getLessonCount(d); const loops = lessonsCount > 1 ? lessonsCount : 1; const isFuture = d > todayIso; const hasLesson = lessonsCount > 0; const isDisabled = isFuture || !hasLesson; return (<td key={d} className={`p-1 border-b border-r h-20 relative dark:border-slate-700 ${isDisabled ? 'bg-slate-100 dark:bg-slate-950 opacity-60' : ''}`}><div className="flex gap-1 justify-center h-full">{Array.from({length: loops}).map((_, lIdx) => { const g = sGrades.find(gr => gr.date === d && (gr.lessonIndex || 0) === lIdx); let displayValue = g?.value || ''; let isExpiredNU = false; if (g && g.value === 'Н/У') { const created = new Date(g.date); const deadline = g.deadline ? new Date(g.deadline) : H.addDays(created, 7); if (systemNow >= deadline) { isExpiredNU = true; displayValue = String(minGrade); } } const cellKey = `${s.id}_${d}_${lIdx}`; const localVal = localValues[cellKey]; const errorMsg = localErrors[cellKey]; const finalDisplayValue = localVal !== undefined ? localVal : displayValue; if (g) { const weight = getEffectiveWeight(g); if (isExpiredNU) { wSum += minGrade * weight; wCount += weight; } else if (!isNaN(parseFloat(g.value as string))) { wSum += parseFloat(g.value as string) * weight; wCount += weight; } } const typeDef = gradeTypes.find(t=>t.key===g?.type); const isNU = typeDef?.isDynamicWeight; const isNoWeight = typeDef?.isNoWeight; const effectiveWeight = g ? getEffectiveWeight(g) : 1; const shouldShowWeight = useWeights && !isNoWeight && ((effectiveWeight !== 1 && effectiveWeight !== 0) || isNU || typeDef); return (<div key={lIdx} className="flex flex-col items-center justify-center w-16 border-r last:border-0 border-dashed border-slate-200 dark:border-slate-700 relative">{loops > 1 && <span className="text-[9px] text-slate-400 mb-1">{lIdx+1}</span>}{errorMsg && (<div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[8px] px-1 rounded z-50 pointer-events-none whitespace-nowrap shadow-sm animate-pulse" style={{ animationDuration: '0.5s' }}>{errorMsg}</div>)}<input disabled={isDisabled} className={`w-full text-center font-bold text-xl border-none bg-transparent focus:bg-blue-50 focus:ring-0 p-0 cursor-pointer ${isDisabled ? 'cursor-not-allowed text-slate-300' : ''} ${errorMsg ? 'text-red-500 line-through decoration-red-500/50' : H.getGradeColorClass(String(finalDisplayValue), minGrade, maxGrade)}`} value={finalDisplayValue} onChange={e => { const val = e.target.value; if (val === '') { setLocalValues(prev => ({...prev, [cellKey]: val})); updateGrade(s.id, d, '', g?.type || '', lIdx); setLocalValues(prev => { const n={...prev}; delete n[cellKey]; return n; }); setLocalErrors(prev => { const n={...prev}; delete n[cellKey]; return n; }); return; } if (!/^\d+$/.test(val)) return; setLocalValues(prev => ({...prev, [cellKey]: val})); const numVal = parseInt(val); if (numVal >= minGrade && numVal <= maxGrade) { updateGrade(s.id, d, val, g?.type || '', lIdx); setLocalValues(prev => { const n={...prev}; delete n[cellKey]; return n; }); setLocalErrors(prev => { const n={...prev}; delete n[cellKey]; return n; }); } else { setLocalErrors(prev => ({...prev, [cellKey]: `Err: ${minGrade}-${maxGrade}`})); } }} onClick={(e) => { if(isDisabled) { alert(isFuture ? t('cant_grade_future') : t('no_lesson_grade')); return; } if (defaultGradeType) { if (!g || g.type !== defaultGradeType) { updateGrade(s.id, d, g ? String(g.value) : '', defaultGradeType, lIdx); } } if(g && g.value !== '') { e.stopPropagation(); handleGradeClick(g, s.fio); } }} /><div className="flex items-center gap-1 w-full px-1"><select disabled={isDisabled} className="flex-1 text-[10px] bg-white border border-slate-200 p-0 text-center text-slate-900 focus:text-slate-900 no-print cursor-pointer hover:bg-slate-100 rounded mt-1 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed" value={g?.type || ''} onChange={e => { updateGrade(s.id, d, String(g?.value || ''), e.target.value, lIdx); setLocalValues(prev => { const n={...prev}; delete n[cellKey]; return n; }); setLocalErrors(prev => { const n={...prev}; delete n[cellKey]; return n; }); }}>{gradeTypes.map(t => (<option key={t.key} value={t.key}>{t.name}</option>))}</select><span className="text-[9px] text-slate-400 font-mono">{shouldShowWeight ? `x${effectiveWeight}` : ''}</span></div></div>)})}</div></td>)})}<td className="p-4 border-b bg-blue-50/50 font-bold text-blue-700 dark:bg-blue-900/10 dark:text-blue-300 dark:border-slate-700 text-center">{wCount ? (wSum / wCount).toFixed(2) : '-'}</td></tr>)})}{students.length === 0 && <tr><td colSpan={visibleDates.length + 2} className="p-10 text-center text-slate-400">{t('list_empty')}</td></tr>}</tbody></table></div>
       
       {selectedGrade && typeof document !== 'undefined' && createPortal(
           <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 p-6 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-[100] animate-in slide-in-from-bottom duration-300">
               <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-8 items-start">
                   {/* Left Side: Info */}
                   <div className="flex-1 pt-1">
                       <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Детали оценки</h3>
                       <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                           <div>
                               <span className="font-bold text-slate-800 dark:text-slate-200">Ученик: </span>
                               <span className="text-slate-600 dark:text-slate-400">{selectedGrade.studentName}</span>
                           </div>
                           <div>
                               <span className="font-bold text-slate-800 dark:text-slate-200">Дата: </span>
                               <span className="text-slate-600 dark:text-slate-400">{H.formatDateDDMMYYYY(selectedGrade.grade.date)}</span>
                           </div>
                           <div className="flex items-center gap-1">
                               <span className="font-bold text-slate-800 dark:text-slate-200">Значение: </span>
                               <span className={`font-bold ${H.getGradeColorClass(String(selectedGrade.grade.value), minGrade, maxGrade)}`}>
                                   {selectedGrade.grade.value}
                               </span>
                           </div>
                           <div>
                               <span className="font-bold text-slate-800 dark:text-slate-200">Тип: </span>
                               <span className="text-slate-600 dark:text-slate-400">
                                   {gradeTypes.find(t=>t.key===selectedGrade.grade.type)?.name || '...'}
                                   <span className="text-slate-400 ml-1">(x{getEffectiveWeight(selectedGrade.grade)})</span>
                               </span>
                           </div>
                           {selectedTypeIsDynamic && (
                               <div className="col-span-2 flex items-center gap-2 mt-2">
                                   <span className="text-xs font-bold text-slate-500">Вес (Коэф.):</span>
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
                                              const gIndex = (localState.grades[targetKey]?.[subj] || []).findIndex((g:any) => g.id === selectedGrade.grade.id);
                                              if (gIndex > -1) {
                                                  localState.grades[targetKey][subj][gIndex].weight = val;
                                                  const newState = {...localState};
                                                  setLocalState(newState);
                                                  onUpdate(newState);
                                                  setSelectedGrade({...selectedGrade, grade: localState.grades[targetKey][subj][gIndex]}); 
                                              }
                                          }
                                      }} 
                                      className="w-16 h-8 text-sm"
                                   />
                                   <Button onClick={() => openDeadlineModal(selectedGrade.grade)} variant="secondary" size="sm" className="h-8 text-xs whitespace-nowrap px-2">
                                       <Clock size={14} className="mr-1"/> Таймер
                                   </Button>
                               </div>
                           )}
                       </div>
                   </div>

                   {/* Right Side: Comment */}
                   <div className="flex-1 w-full flex gap-6">
                       <button
                           onClick={() => setSelectedGrade(null)}
                           className="mt-[-4px] p-1 text-slate-800 hover:text-slate-600 dark:text-slate-200 dark:hover:text-slate-400 transition h-fit"
                       >
                           <X size={24} strokeWidth={2} />
                       </button>
                       <div className="flex-1">
                           <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">КОММЕНТАРИЙ</label>
                           <textarea
                               className="w-full h-24 bg-[#333] text-white rounded-md p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
                               value={editComment}
                               onChange={e => { 
                                   const val = e.target.value;
                                   setEditComment(val); 
                                   if (selectedGrade && targetKey) {
                                       const gIndex = (localState.grades[targetKey]?.[subj] || []).findIndex((g:any) => g.id === selectedGrade.grade.id);
                                       if (gIndex > -1) {
                                           localState.grades[targetKey][subj][gIndex].comment = val;
                                           const newState = {...localState};
                                           setLocalState(newState);
                                           onUpdate(newState);
                                           setSelectedGrade({...selectedGrade, grade: localState.grades[targetKey][subj][gIndex]}); 
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

       <Modal isOpen={!!deadlineModal} onClose={() => setDeadlineModal(null)} title={t('nu_deadline')}><div className="space-y-6"><div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-900 flex items-start gap-3"><AlertCircle className="flex-shrink-0" size={18}/><p>{t('deadline_info')}</p></div><div><label className="block text-sm font-bold text-slate-700 mb-2">{t('select_date')}</label><Input type="date" value={deadlineDate} onChange={e => setDeadlineDate(e.target.value)} /></div><div className="flex justify-end gap-2"><Button onClick={() => setDeadlineModal(null)} variant="ghost">{t('cancel')}</Button><Button onClick={saveDeadline} variant="primary">{t('save')}</Button></div></div></Modal>
       <Modal isOpen={showFinalModal} onClose={() => setShowFinalModal(false)} title={t('final_attestation')} maxWidth="max-w-5xl"><div className="overflow-x-auto"><table className="w-full text-sm text-center min-w-[700px]"><thead className="bg-slate-50 text-slate-600 font-bold dark:bg-slate-800 dark:text-slate-300"><tr><th className="p-3 text-left">{t('student')}</th>{['Q1', 'Q2', 'Q3', 'Q4'].map(q => <th key={q} className="p-3">{quarterLabels[q]} {t('quarter')}</th>)}<th className="p-3">{t('exam')}</th><th className="p-3">{t('year')}</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{students.map(s => { const entry = getFinalData(s.id); const yearAvg = calculateYearAverage(s.id); const renderCell = (field: 'q1'|'q2'|'q3'|'q4'|'exam'|'year', label: string, isConfirmed?: boolean, status?: { val: string | null, isNA: boolean }) => { const storedVal = (entry as any)[field]; const autoVal = status ? status.val : null; const isNA = status ? status.isNA : false; const displayVal = storedVal || autoVal; const isPlaceholder = !storedVal && !!autoVal; const canConfirmYear = field === 'year' ? (entry.q1 && entry.q2 && entry.q3 && entry.q4) : true; return (<td className="p-2"><div className="flex flex-col items-center gap-1"><div className="relative group/cell"><input className={`w-12 text-center border rounded p-1 text-sm font-bold transition-all ${isConfirmed ? 'bg-white border-slate-200 text-slate-800 dark:bg-slate-900 dark:text-white dark:border-slate-700' : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800'} ${isPlaceholder ? 'opacity-50' : ''}`} value={storedVal || ''} placeholder={isPlaceholder ? autoVal! : ''} onChange={e => updateFinalGrade(s.id, field, e.target.value)} />{(!isConfirmed && (storedVal || autoVal)) && canConfirmYear && (<button onClick={() => { if (!storedVal && autoVal) updateFinalGrade(s.id, field, autoVal); confirmFinalGrade(s.id, field); }} title={t('confirm_grade')} className="absolute -right-6 top-1/2 -translate-y-1/2 text-green-500 hover:text-green-600 bg-white dark:bg-slate-800 rounded-full shadow-sm p-0.5"><Check size={14} strokeWidth={3}/></button>)}</div>{!storedVal && isNA && (<span className="text-[10px] text-red-500 font-bold leading-none">Н/А</span>)}{autoVal && !storedVal && !isNA && <span className="text-[9px] text-slate-400" title={t('calc_grade')}>~{autoVal}</span>}</div></td>); }; return (<tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50"><td className="p-3 text-left font-semibold text-slate-700 dark:text-slate-200">{s.fio}</td>{['q1', 'q2', 'q3', 'q4'].map(qKey => { const status = calculateQuarterStatus(s.id, qKey.toUpperCase()); const isConf = (entry as any)[`is${qKey.charAt(0).toUpperCase() + qKey.slice(1)}Confirmed`]; return (<React.Fragment key={qKey}>{renderCell(qKey as any, qKey.toUpperCase(), isConf, status)}</React.Fragment>)})}{renderCell('exam', t('exam'), entry.isExamConfirmed, undefined)}{renderCell('year', t('year'), entry.isYearConfirmed, { val: yearAvg, isNA: false })}</tr>)})}</tbody></table></div><div className="mt-6 flex justify-end"><Button onClick={() => setShowFinalModal(false)} variant="secondary">{t('close')}</Button></div></Modal>
     </div>
   );
}
