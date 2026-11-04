

import React, { useState, useEffect } from 'react';
import { AppState, User } from '../types';
import * as DB from '../services/db';
import * as H from '../utils/helpers';
import { hashPassword, generateSalt } from '../utils/auth';
import { Button, Input, Select, Card, FileUploader, Modal } from '../components/ui';
import { Eye, EyeOff, Trash2, Check, Sparkles, Clock, AlertCircle } from 'lucide-react';
import { defaultState } from '../App';

interface SettingsProps {
  state: AppState;
  onUpdate: (s: AppState) => void;
  onBack: () => void;
  user: User; 
}

export default function Settings({ state, onUpdate, onBack, user }: SettingsProps) {
  // Use current school name if director, else first school or generic
  const currentSchool = state.schools.find(s => s.id === user.schoolId);
  const [localName, setLocalName] = useState(currentSchool?.name || 'ЭлЖур');
  const [localEduUrl, setLocalEduUrl] = useState(currentSchool?.educationalResourceUrl || '');
  const [eduUrlSaved, setEduUrlSaved] = useState(false);
  const [fontList, setFontList] = useState<any[]>([]);
  const [showSecretPass, setShowSecretPass] = useState(false);
  
  // Time Machine State
  const [virtualDatePart, setVirtualDatePart] = useState('');
  const [virtualTimePart, setVirtualTimePart] = useState('');
  const [timeMachineError, setTimeMachineError] = useState<string | null>(null);
  const [uiStatus, setUiStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setUiStatus({ type, text });
    setTimeout(() => setUiStatus(prev => (prev?.text === text ? null : prev)), 3500);
  };

  const isDirector = user.role === 'director';
  const isCreator = user.role === 'creator';
  
  const lang = state.settings.language || 'ru';
  const t = (k: string) => H.t(k, lang);

  useEffect(() => {
    if (currentSchool) {
      setLocalName(currentSchool.name || 'ЭлЖур');
      setLocalEduUrl(currentSchool.educationalResourceUrl || '');
    }
  }, [currentSchool?.id, currentSchool?.name, currentSchool?.educationalResourceUrl]);

  const refreshFonts = async () => {
    const assets = await DB.getAllAssets();
    setFontList(assets.filter(a => a.name.toLowerCase().endsWith('.ttf') || a.name.toLowerCase().endsWith('.woff') || a.name.toLowerCase().endsWith('.woff2')));
  };

  React.useEffect(() => {
    refreshFonts();
    
    // Init virtual date input
    const currentSystemTime = new Date(Date.now() + (state.settings.systemTimeOffset || 0));
    const pad = (n: number) => n.toString().padStart(2, '0');
    setVirtualDatePart(`${currentSystemTime.getFullYear()}-${pad(currentSystemTime.getMonth()+1)}-${pad(currentSystemTime.getDate())}`);
    setVirtualTimePart(`${pad(currentSystemTime.getHours())}:${pad(currentSystemTime.getMinutes())}:${pad(currentSystemTime.getSeconds())}`);
  }, []);

  // Validation Effect
  useEffect(() => {
      if (!virtualDatePart && !virtualTimePart) return; // Initial mount or clear

      let error = null;
      if (!virtualDatePart) {
          // Date is required
      } else if (!virtualTimePart) {
          // Time is required
      } else {
          // Check Time Format HH:mm:ss
          const timeRegex = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
          if (!timeRegex.test(virtualTimePart)) {
              error = t('invalid_time_format');
          }
      }
      setTimeMachineError(error);
  }, [virtualDatePart, virtualTimePart, lang]);

  const handleSaveName = () => {
    if (currentSchool) {
        currentSchool.name = localName;
        onUpdate(state);
        notify(t('school_name_saved'), 'success');
    } else {
        notify(t('school_not_found'), 'error');
    }
  };

  const handleSaveEduUrl = () => {
    if (currentSchool) {
        const cleaned = localEduUrl.trim();
        const formatted = cleaned ? H.formatExternalResourceUrl(cleaned) : '';
        currentSchool.educationalResourceUrl = formatted;
        setLocalEduUrl(formatted);
        try {
            localStorage.setItem(`eljur_edu_url_${currentSchool.id}`, formatted);
        } catch {}
        DB.saveSchoolMetadata(currentSchool.id, { educationalResourceUrl: formatted });
        onUpdate({
            ...state,
            schools: state.schools.map(s => s.id === currentSchool.id ? { ...s, educationalResourceUrl: formatted } : s)
        });
        setEduUrlSaved(true);
        setTimeout(() => setEduUrlSaved(false), 2500);
    }
  };

  const executeExport = async () => {
    try {
      const serializeAssets = async (schoolIds: string[]) => {
        const assetMap = new Map<string, any>();
        for (const sId of schoolIds) {
          const list = await DB.getAllAssets(sId);
          for (const a of list) {
            if (!assetMap.has(a.id)) {
              const dataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(String(reader.result || ''));
                reader.readAsDataURL(a.blob);
              });
              assetMap.set(a.id, {
                id: a.id,
                name: a.name,
                type: a.type,
                schoolId: sId,
                data: dataUrl
              });
            }
          }
        }
        return Array.from(assetMap.values());
      };

      if (isDirector && user.schoolId) {
        // School-isolated export for Director (includes cloud & local data + attachments)
        const sId = user.schoolId;
        const schoolObj = state.schools.find(s => s.id === sId);
        const schoolUsers = state.users.filter(u => u.schoolId === sId);
        const schoolClasses = H.getSchoolClasses(state, sId);
        const classKeys = schoolClasses.map(c => `${c.class}_${c.letter}`);

        const schoolSchedules: Record<string, any> = {};
        const schoolGrades: Record<string, any> = {};
        const schoolFinalGrades: Record<string, any> = {};

        classKeys.forEach(ck => {
            const scopedKey = H.getSchoolClassKey(sId, ck);
            if (state.schedules?.[scopedKey]) schoolSchedules[scopedKey] = state.schedules[scopedKey];
            else if (sId === 'school_1' && state.schedules?.[ck]) schoolSchedules[scopedKey] = state.schedules[ck];

            if (state.grades?.[scopedKey]) schoolGrades[scopedKey] = state.grades[scopedKey];
            else if (sId === 'school_1' && state.grades?.[ck]) schoolGrades[scopedKey] = state.grades[ck];

            if (state.finalGrades?.[scopedKey]) schoolFinalGrades[scopedKey] = state.finalGrades[scopedKey];
            else if (sId === 'school_1' && state.finalGrades?.[ck]) schoolFinalGrades[scopedKey] = state.finalGrades[ck];
        });

        const schoolAssets = await serializeAssets([sId]);

        const exportObj = {
          isSchoolBackup: true,
          version: '7.0-cloud',
          schoolId: sId,
          school: schoolObj,
          users: schoolUsers,
          schedules: schoolSchedules,
          grades: schoolGrades,
          finalGrades: schoolFinalGrades,
          homework: H.getSchoolHomework(state, sId),
          messages: (state.messages || []).filter(m => !m.schoolId || m.schoolId === sId),
          announcements: (state.announcements || []).filter(a => !a.schoolId || a.schoolId === sId),
          teacherAssignments: H.getSchoolTeacherAssignments(state, sId),
          studentGroups: H.getSchoolStudentGroups(state, sId),
          assets: schoolAssets,
          timestamp: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeSchoolName = (schoolObj?.name || 'School').replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]/g, '_');
        a.download = `${safeSchoolName}_Backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      // Full system export for Creator across all schools + cloud assets
      const allSchoolIds = Array.from(new Set(['global', 'school_1', ...(state.schools || []).map(s => s.id)]));
      const assetsData = await serializeAssets(allSchoolIds);

      const exportObj = {
        isFullBackup: true,
        version: '7.0-cloud',
        state: state,
        assets: assetsData,
        timestamp: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ElZhur_Full_Cloud_Backup_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      notify('Error: ' + e, 'error');
    }
  };

  const handleExport = () => {
    setConfirmModal({
      title: t('export'),
      message: t('download_backup') + '?',
      onConfirm: () => {
        setConfirmModal(null);
        executeExport();
      }
    });
  };

  const handleImport = (file: File) => {
    setConfirmModal({
      title: t('import'),
      message: t('import_warning'),
      onConfirm: () => {
        setConfirmModal(null);
        executeImport(file);
      }
    });
  };

  const executeImport = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Helper to restore base64 assets into both IndexedDB and Firestore Cloud
      const restoreAssets = async (assetsArr: any[] | undefined, fallbackSchoolId: string) => {
        if (!Array.isArray(assetsArr)) return;
        for (const a of assetsArr) {
          if (!a || !a.id || !a.data) continue;
          const res = await fetch(a.data);
          const blob = await res.blob();
          await DB.saveAsset(a.id, a.name || 'file', a.type || blob.type || 'application/octet-stream', blob, a.schoolId || fallbackSchoolId);
        }
      };

      if (isDirector && user.schoolId) {
        const sId = user.schoolId;
        // School-isolated import for director
        const importedSchool = data.school || (data.state?.schools || []).find((s: any) => s.id === sId || s.id === data.schoolId);
        const importedUsers: User[] = (data.users || (data.state?.users || []).filter((u: any) => u.schoolId === sId || u.schoolId === data.schoolId || (!u.schoolId && u.role !== 'creator')));
        
        // 1. Update school details
        const schoolIdx = state.schools.findIndex(s => s.id === sId);
        if (schoolIdx > -1 && importedSchool) {
          state.schools[schoolIdx] = {
            ...state.schools[schoolIdx],
            name: importedSchool.name || state.schools[schoolIdx].name,
            classes: Array.isArray(importedSchool.classes) ? importedSchool.classes : state.schools[schoolIdx].classes,
            subjects: Array.isArray(importedSchool.subjects) ? importedSchool.subjects : state.schools[schoolIdx].subjects,
            gradingSystem: importedSchool.gradingSystem || state.schools[schoolIdx].gradingSystem,
            gradeTypes: importedSchool.gradeTypes || state.schools[schoolIdx].gradeTypes,
            scheduleSettings: importedSchool.scheduleSettings || state.schools[schoolIdx].scheduleSettings,
            subjectRequirements: importedSchool.subjectRequirements || state.schools[schoolIdx].subjectRequirements,
            educationalResourceUrl: importedSchool.educationalResourceUrl ?? state.schools[schoolIdx].educationalResourceUrl
          };
        }

        // 2. Update users for this school safely
        if (Array.isArray(importedUsers) && importedUsers.length > 0) {
          state.users = state.users.filter(u => u.schoolId !== sId);
          importedUsers.forEach(u => {
            state.users.push({ ...u, schoolId: sId });
            if (!state.userOrder.includes(u.id)) {
              state.userOrder.push(u.id);
            }
          });
        }

        // 3. Update schedules for this school
        const importedSchedules = data.schedules || data.state?.schedules || {};
        if (!state.schedules) state.schedules = {};
        Object.entries(importedSchedules).forEach(([key, val]) => {
          const classKey = key.includes('__') ? key.split('__').pop() || key : key;
          const targetKey = H.getSchoolClassKey(sId, classKey);
          state.schedules[targetKey] = val as any;
        });

        // 4. Update grades for this school
        const importedGrades = data.grades || data.state?.grades || {};
        if (!state.grades) state.grades = {};
        Object.entries(importedGrades).forEach(([key, val]) => {
          const classKey = key.includes('__') ? key.split('__').pop() || key : key;
          const targetKey = H.getSchoolClassKey(sId, classKey);
          state.grades[targetKey] = val as any;
        });

        // 5. Update final grades for this school
        const importedFinalGrades = data.finalGrades || data.state?.finalGrades || {};
        if (!state.finalGrades) state.finalGrades = {};
        Object.entries(importedFinalGrades).forEach(([key, val]) => {
          const classKey = key.includes('__') ? key.split('__').pop() || key : key;
          const targetKey = H.getSchoolClassKey(sId, classKey);
          state.finalGrades[targetKey] = val as any;
        });

        // 6. Update homework, messages, announcements, assignments, groups
        const importedHomework = data.homework || data.state?.homework || [];
        state.homework = [
          ...(state.homework || []).filter(h => h.schoolId !== sId),
          ...importedHomework.map((h: any) => ({ ...h, schoolId: sId }))
        ];

        const importedMessages = data.messages || (data.state?.messages || []).filter((m: any) => !m.schoolId || m.schoolId === sId || m.schoolId === data.schoolId);
        if (Array.isArray(importedMessages) && importedMessages.length > 0) {
          state.messages = [
            ...(state.messages || []).filter(m => m.schoolId !== sId),
            ...importedMessages.map((m: any) => ({ ...m, schoolId: sId }))
          ];
        }

        const importedAnnouncements = data.announcements || (data.state?.announcements || []).filter((a: any) => !a.schoolId || a.schoolId === sId || a.schoolId === data.schoolId);
        if (Array.isArray(importedAnnouncements) && importedAnnouncements.length > 0) {
          state.announcements = [
            ...(state.announcements || []).filter(a => a.schoolId !== sId),
            ...importedAnnouncements.map((a: any) => ({ ...a, schoolId: sId }))
          ];
        }

        const importedAssignments = data.teacherAssignments || data.state?.teacherAssignments || [];
        state.teacherAssignments = [
          ...(state.teacherAssignments || []).filter(a => a.schoolId !== sId),
          ...importedAssignments.map((a: any) => ({ ...a, schoolId: sId }))
        ];

        const importedGroups = data.studentGroups || data.state?.studentGroups || [];
        state.studentGroups = [
          ...(state.studentGroups || []).filter(g => g.schoolId !== sId),
          ...importedGroups.map((g: any) => ({ ...g, schoolId: sId }))
        ];

        await restoreAssets(data.assets, sId);
        await DB.saveSchoolState(sId, state);
        onUpdate({ ...state });
        notify(t('import_success'), 'success');
        return;
      }
      
      // Full system import for Creator (supports both Full Backup and Single-School Backup)
      if (data.state) {
        const db = await DB.openDB();
        const tx = db.transaction(['assets', 'school_cache'], 'readwrite');
        await tx.objectStore('assets').clear();
        await tx.objectStore('school_cache').clear();

        await restoreAssets(data.assets, user.schoolId || 'school_1');
        
        const schoolsToSave = data.state?.schools || [{ id: 'school_1' }];
        for (const s of schoolsToSave) {
          await DB.saveSchoolState(s.id, data.state);
        }
        onUpdate(data.state);
        notify(t('import_success'), 'success');
        window.location.reload();
      } else if (data.isSchoolBackup && data.schoolId) {
        const sId = data.schoolId;
        await restoreAssets(data.assets, sId);
        const existingIdx = state.schools.findIndex(s => s.id === sId);
        if (existingIdx > -1 && data.school) state.schools[existingIdx] = data.school;
        else if (data.school) state.schools.push(data.school);

        if (Array.isArray(data.users)) {
          state.users = [...state.users.filter(u => u.schoolId !== sId), ...data.users];
        }
        if (data.schedules) state.schedules = { ...(state.schedules || {}), ...data.schedules };
        if (data.grades) state.grades = { ...(state.grades || {}), ...data.grades };
        if (data.finalGrades) state.finalGrades = { ...(state.finalGrades || {}), ...data.finalGrades };
        if (Array.isArray(data.homework)) {
          state.homework = [...(state.homework || []).filter(h => h.schoolId !== sId), ...data.homework];
        }
        if (Array.isArray(data.messages)) {
          state.messages = [...(state.messages || []).filter(m => m.schoolId !== sId), ...data.messages];
        }
        if (Array.isArray(data.announcements)) {
          state.announcements = [...(state.announcements || []).filter(a => a.schoolId !== sId), ...data.announcements];
        }
        await DB.saveSchoolState(sId, state);
        onUpdate({ ...state });
        notify(t('import_success'), 'success');
      } else {
        notify(t('invalid_format'), 'error');
      }
    } catch (e) {
      notify(t('import_error') + ': ' + e, 'error');
    }
  };

  const handleFontUpload = async (file: File) => {
    const id = H.uid('font');
    await DB.saveAsset(id, file.name, file.type, file, user.schoolId || 'global');
    notify(t('font_loaded'), 'success');
    refreshFonts();
  };

  const deleteFont = (id: string) => {
    setConfirmModal({
      title: t('fonts'),
      message: t('delete_font_confirm'),
      onConfirm: async () => {
        setConfirmModal(null);
        if (state.settings.bodyFontId === id) state.settings.bodyFontId = undefined;
        if (state.settings.headingFontId === id) state.settings.headingFontId = undefined;
        await DB.deleteAsset(id, user.schoolId || 'global');
        onUpdate({ ...state });
        refreshFonts();
      }
    });
  };

  const setBodyFont = (id?: string) => {
      state.settings.bodyFontId = id;
      onUpdate(state);
  };

  const setHeadingFont = (id?: string) => {
      state.settings.headingFontId = id;
      onUpdate(state);
  };

  const applyTimeTravel = () => {
      if (timeMachineError || !virtualDatePart || !virtualTimePart) return;
      
      const dateTimeStr = `${virtualDatePart}T${virtualTimePart}`;
      const targetTime = new Date(dateTimeStr).getTime();
      
      if (isNaN(targetTime)) {
          setTimeMachineError(t('incorrect_date_time'));
          return;
      }

      const realTime = Date.now();
      const offset = targetTime - realTime;
      
      state.settings.systemTimeOffset = offset;
      onUpdate(state);
      notify(t('time_changed'), 'success');
  };

  const resetTime = () => {
      state.settings.systemTimeOffset = 0;
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      setVirtualDatePart(`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`);
      setVirtualTimePart(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
      setTimeMachineError(null);
      onUpdate(state);
      notify(t('time_reset'), 'success');
  };

  const handleResetData = () => {
      if (isDirector && user.schoolId) {
          setConfirmModal({
              title: t('reset_data_title'),
              message: lang === 'ru' ? 'Вы уверены, что хотите сбросить данные своей школы? Это вернет расписание, списки классов и тестовых пользователей к исходному состоянию.' : 'Are you sure you want to reset your school data? This will restore test schedules, classes and users.',
              onConfirm: () => {
                  setConfirmModal(null);
                  H.clearSchoolGrades(state, user.schoolId);
                  const school = state.schools.find(s => s.id === user.schoolId);
                  if (school) {
                      school.classes = [{ class: '10', letter: 'А', headmasterId: 'u_teacher' }];
                      school.subjects = [...defaultState.subjects];
                  }
                  const otherUsers = state.users.filter(u => u.schoolId !== user.schoolId && u.schoolId !== 'school_1');
                  const defaultSchoolUsers = defaultState.users.filter(u => u.schoolId === 'school_1' || u.schoolId === user.schoolId);
                  state.users = [...otherUsers, ...defaultSchoolUsers];
                  state.userOrder = ['u_dir', 'u_teacher', 'u_emp', 's_1'];
                  state.teacherAssignments = [...defaultState.teacherAssignments];
                  state.classes = [{ class: '10', letter: 'А', headmasterId: 'u_teacher' }];
                  state.subjects = [...defaultState.subjects];
                  onUpdate({ ...state });
                  notify(lang === 'ru' ? 'Данные школы успешно сброшены к начальным тестовым данным.' : 'School data reset successfully to test defaults.', 'success');
              }
          });
      } else if (isCreator) {
          setConfirmModal({
              title: t('reset_data_title'),
              message: t('reset_data_confirm'),
              onConfirm: () => {
                  setConfirmModal(null);
                  const newState = JSON.parse(JSON.stringify(defaultState));
                  onUpdate(newState);
                  notify(t('data_reset_success'), 'success');
                  window.location.reload();
              }
          });
      }
  };

  const roleLabel = user.role === 'director'
    ? t('director')
    : user.role === 'teacher'
      ? t('teacher')
      : user.role === 'student'
        ? `${t('student')}${user.class ? ` • ${user.class}${user.letter || ''}` : ''}`
        : user.role === 'employee'
          ? (user.customRole || t('employee'))
          : t('creator');

  const schoolDisplayName = user.role === 'creator'
    ? t('creator_panel')
    : (currentSchool?.name || t('footer_text'));

  return (
    <div className="space-y-3.5 sm:space-y-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-2xl font-bold text-slate-800 dark:text-white font-heading">{t('settings')}</h2>
        <Button size="sm" onClick={onBack}>← {t('back')}</Button>
      </div>

      {uiStatus && (
        <div className={`p-3 rounded-xl border text-xs sm:text-sm font-bold flex items-center justify-between gap-2 animate-in fade-in ${uiStatus.type === 'error' ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'}`}>
          <span className="flex items-center gap-2">
            {uiStatus.type === 'error' ? <AlertCircle size={15} /> : <Check size={15} />}
            {uiStatus.text}
          </span>
          <button onClick={() => setUiStatus(null)} className="opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* User & School Profile Summary Card */}
      <Card className="p-3 sm:p-6 border-l-4 sm:border-l-[5px] border-l-blue-600">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="space-y-0.5 sm:space-y-1 min-w-0">
            <div className="text-[10px] sm:text-[11px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
              {lang === 'ru' ? 'Учебное заведение' : 'School'}
            </div>
            <div className="text-xs sm:text-base font-bold text-slate-800 dark:text-white truncate">
              {schoolDisplayName}
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
            <div className="sm:text-right">
              <div className="text-[10px] sm:text-[11px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                {lang === 'ru' ? 'Пользователь' : 'User'}
              </div>
              <div className="text-xs sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {H.formatShortName(user.fio)}
              </div>
            </div>
            <span className="text-[10px] sm:text-xs uppercase font-bold tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full shrink-0 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
              {roleLabel}
            </span>
          </div>
        </div>
      </Card>

      {(isDirector || isCreator) && (
        <Card className="p-3.5 sm:p-8">
          <h3 className="font-bold text-sm sm:text-lg mb-3 sm:mb-6 text-slate-800 dark:text-white font-heading">{t('general')}</h3>
          <div className="space-y-3 sm:space-y-4">
             {isDirector && (
             <>
               <div>
                 <label className="block text-xs sm:text-sm font-bold text-slate-600 mb-1 sm:mb-2 dark:text-slate-300">{t('school_name')}</label>
                 <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                   <Input value={localName} onChange={e => setLocalName(e.target.value)} />
                   <Button variant="primary" size="sm" onClick={handleSaveName}>{t('save')}</Button>
                 </div>
               </div>
               <div>
                 <label className="block text-xs sm:text-sm font-bold text-slate-600 mb-1 sm:mb-2 dark:text-slate-300">{t('educational_resource_url')}</label>
                 <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                   <Input
                     type="url"
                     placeholder={t('educational_resource_placeholder')}
                     value={localEduUrl}
                     onChange={e => setLocalEduUrl(e.target.value)}
                   />
                   <Button variant="primary" size="sm" onClick={handleSaveEduUrl}>{t('save')}</Button>
                 </div>
                 {eduUrlSaved && (
                   <p className="text-[11px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                     {t('educational_resource_saved')}
                   </p>
                 )}
               </div>
             </>
             )}
             
             <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-600 mb-1 sm:mb-2 dark:text-slate-300">{t('timezone')}</label>
                <Select 
                   value={
                     (user.schoolId && (state.settings as any).schoolsSettings?.[user.schoolId]?.timezone) ||
                     state.settings.timezone ||
                     'UTC+3'
                   } 
                   onChange={(e) => {
                     const tz = e.target.value;
                     state.settings.timezone = tz;
                     if (user.schoolId) {
                       if (!(state.settings as any).schoolsSettings) (state.settings as any).schoolsSettings = {};
                       if (!(state.settings as any).schoolsSettings[user.schoolId]) (state.settings as any).schoolsSettings[user.schoolId] = {};
                       (state.settings as any).schoolsSettings[user.schoolId].timezone = tz;
                     }
                     onUpdate(state);
                   }}
                >
                   <option value="UTC+2">{lang === 'en' ? 'Kaliningrad (MSK-1)' : 'Калининград (MSK-1)'}</option>
                   <option value="UTC+3">{lang === 'en' ? 'Moscow (MSK)' : 'Москва (MSK)'}</option>
                   <option value="UTC+4">{lang === 'en' ? 'Samara (MSK+1)' : 'Самара (MSK+1)'}</option>
                   <option value="UTC+5">{lang === 'en' ? 'Yekaterinburg (MSK+2)' : 'Екатеринбург (MSK+2)'}</option>
                   <option value="UTC+6">{lang === 'en' ? 'Omsk (MSK+3)' : 'Омск (MSK+3)'}</option>
                   <option value="UTC+7">{lang === 'en' ? 'Krasnoyarsk (MSK+4)' : 'Красноярск (MSK+4)'}</option>
                   <option value="UTC+8">{lang === 'en' ? 'Irkutsk (MSK+5)' : 'Иркутск (MSK+5)'}</option>
                   <option value="UTC+9">{lang === 'en' ? 'Yakutsk (MSK+6)' : 'Якутск (MSK+6)'}</option>
                   <option value="UTC+10">{lang === 'en' ? 'Vladivostok (MSK+7)' : 'Владивосток (MSK+7)'}</option>
                   <option value="UTC+11">{lang === 'en' ? 'Magadan (MSK+8)' : 'Магадан (MSK+8)'}</option>
                   <option value="UTC+12">{lang === 'en' ? 'Kamchatka (MSK+9)' : 'Камчатка (MSK+9)'}</option>
                </Select>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-1">{t('timezone_desc')}</p>
             </div>
          </div>
        </Card>
      )}

      {isCreator && (
         <Card className="p-3.5 sm:p-8 border-l-4 sm:border-l-[6px] border-l-purple-500">
             <h3 className="font-bold text-sm sm:text-lg mb-3 sm:mb-6 text-slate-800 dark:text-white font-heading text-purple-600 dark:text-purple-400">{t('creator_settings')}</h3>
             
             {/* TIME MACHINE SECTION */}
             <div className="mb-4 sm:mb-8 p-3 sm:p-4 bg-purple-50 border border-purple-100 rounded-xl dark:bg-purple-900/20 dark:border-purple-800">
                 <h4 className="font-bold text-xs sm:text-base text-purple-800 dark:text-purple-300 mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2"><Clock size={15}/> {t('time_machine_title')}</h4>
                 <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-4 items-start sm:items-end">
                     <div className="w-full sm:w-auto">
                         <label className="text-[11px] sm:text-xs font-bold text-slate-500 mb-1 block">{t('date')}</label>
                         <Input 
                            type="date" 
                            value={virtualDatePart}
                            onChange={(e) => setVirtualDatePart(e.target.value)}
                            className={`h-8 sm:h-[42px] text-xs sm:text-sm ${timeMachineError && !virtualDatePart ? 'border-red-300 focus:border-red-500' : ''}`}
                         />
                     </div>
                     <div className="w-full sm:w-auto">
                         <label className="text-[11px] sm:text-xs font-bold text-slate-500 mb-1 block">{t('time_hms')}</label>
                         <Input 
                            type="text" 
                            value={virtualTimePart}
                            onChange={(e) => setVirtualTimePart(e.target.value)}
                            placeholder="HH:MM:SS"
                            className={`h-8 sm:h-[42px] font-mono w-full sm:w-32 text-xs sm:text-sm ${timeMachineError ? 'border-red-300 focus:border-red-500 text-red-600' : ''}`}
                            maxLength={8}
                         />
                     </div>
                     <div className="flex gap-2 w-full sm:w-auto">
                         <Button onClick={applyTimeTravel} disabled={!!timeMachineError || !virtualDatePart || !virtualTimePart} variant="primary" size="sm" className="bg-purple-600 hover:bg-purple-700 h-8 sm:h-[42px] flex-1 sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed">{t('apply')}</Button>
                         <Button onClick={resetTime} variant="secondary" size="sm" className="h-8 sm:h-[42px] flex-1 sm:flex-none">{t('reset')}</Button>
                     </div>
                 </div>
                 {timeMachineError && (
                     <div className="mt-2 text-xs font-bold text-red-500 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                         <AlertCircle size={12} /> {timeMachineError}
                     </div>
                 )}
                 <p className="text-[11px] sm:text-xs text-purple-600/70 mt-1.5 sm:mt-2 dark:text-purple-400/70">{t('time_machine_desc')}</p>
             </div>

             {/* RESET DATA SECTION */}
             <div className="mb-4 sm:mb-8 p-3 sm:p-4 bg-red-50 border border-red-100 rounded-xl dark:bg-red-900/20 dark:border-red-800">
                 <h4 className="font-bold text-xs sm:text-base text-red-800 dark:text-red-300 mb-1.5 sm:mb-3 flex items-center gap-1.5 sm:gap-2"><Trash2 size={15}/> {t('reset_data_title')}</h4>
                 <p className="text-[11px] sm:text-xs text-red-600/70 mb-2.5 sm:mb-4 dark:text-red-400/70">
                     {t('reset_data_desc')}
                 </p>
                 <Button onClick={handleResetData} variant="primary" size="sm" className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800">{t('reset_data')}</Button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-6">
                 <div>
                     <label className="block text-xs sm:text-sm font-bold text-slate-600 mb-1 sm:mb-2 dark:text-slate-300">{t('secret_key')}</label>
                     <Input 
                        value={state.settings.secretKey || 'Space'} 
                        onChange={e => {
                          const val = e.target.value;
                          state.settings.secretKey = val;
                          DB.savePublicCreatorGate(user.schoolId || 'school_1', {
                            secretKey: val,
                            secretCount: state.settings.secretCount || 4,
                            adminPasswordHash: state.settings.adminPasswordHash,
                            adminPasswordSalt: state.settings.adminPasswordSalt
                          });
                          onUpdate({ ...state });
                        }} 
                        placeholder="Space"
                     />
                     <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">{t('secret_key_desc')}</p>
                 </div>
                 <div>
                     <label className="block text-xs sm:text-sm font-bold text-slate-600 mb-1 sm:mb-2 dark:text-slate-300">{t('press_count')}</label>
                     <Input 
                        type="number"
                        min="1"
                        max="20"
                        value={state.settings.secretCount || 4} 
                        onChange={e => {
                          const count = parseInt(e.target.value) || 4;
                          state.settings.secretCount = count;
                          DB.savePublicCreatorGate(user.schoolId || 'school_1', {
                            secretCount: count,
                            secretKey: state.settings.secretKey || 'Space',
                            adminPasswordHash: state.settings.adminPasswordHash,
                            adminPasswordSalt: state.settings.adminPasswordSalt
                          });
                          onUpdate({ ...state });
                        }} 
                        className="bg-white text-slate-900 border border-slate-300 dark:bg-slate-950 dark:text-white dark:border-slate-700" 
                     />
                 </div>
                 <div className="col-span-1 md:col-span-2">
                     <label className="block text-xs sm:text-sm font-bold text-slate-600 mb-1 sm:mb-2 dark:text-slate-300">{t('secret_pass')}</label>
                     <div className="relative">
                         <Input 
                            type={showSecretPass ? 'text' : 'password'}
                            value={
                              state.settings.adminPassword !== undefined && state.settings.adminPassword !== ''
                                ? state.settings.adminPassword
                                : (state.users.find(u => u.role === 'creator')?.password || user.password || 'admin123')
                            } 
                            placeholder={t('enter_creator_pass')}
                            onChange={async e => {
                              const newPass = e.target.value;
                              state.settings.adminPassword = newPass;
                              const creatorUser = state.users.find(u => u.role === 'creator');
                              if (creatorUser) creatorUser.password = newPass;
                              user.password = newPass;
                              const targetSchool = user.schoolId || 'school_1';
                              if (newPass.trim()) {
                                const salt = generateSalt();
                                const hash = await hashPassword(newPass, salt);
                                state.settings.adminPasswordHash = hash;
                                state.settings.adminPasswordSalt = salt;
                                if (creatorUser) {
                                  creatorUser.passwordHash = hash;
                                  creatorUser.passwordSalt = salt;
                                }
                                await DB.savePublicCreatorGate(targetSchool, {
                                  adminPasswordHash: hash,
                                  adminPasswordSalt: salt,
                                  secretKey: state.settings.secretKey || 'Space',
                                  secretCount: state.settings.secretCount || 4
                                });
                              } else {
                                state.settings.adminPasswordHash = '';
                                state.settings.adminPasswordSalt = '';
                                await DB.savePublicCreatorGate(targetSchool, {
                                  adminPasswordHash: '',
                                  adminPasswordSalt: '',
                                  secretKey: state.settings.secretKey || 'Space',
                                  secretCount: state.settings.secretCount || 4
                                });
                              }
                              onUpdate({ ...state });
                            }} 
                         />
                         <button 
                            type="button"
                            className="absolute right-2.5 top-1.5 sm:top-2.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 cursor-pointer p-0.5 bg-white dark:bg-slate-900 rounded"
                            onMouseDown={() => setShowSecretPass(true)}
                            onMouseUp={() => setShowSecretPass(false)}
                            onMouseLeave={() => setShowSecretPass(false)}
                            onTouchStart={() => setShowSecretPass(true)}
                            onTouchEnd={() => setShowSecretPass(false)}
                         >
                            {showSecretPass ? <EyeOff size={18} /> : <Eye size={18} />}
                         </button>
                     </div>
                     <p className="text-[10px] text-slate-400 mt-1 italic">{t('hold_eye')}</p>
                 </div>
             </div>
         </Card>
      )}

      <Card className="p-3.5 sm:p-8">
        <h3 className="font-bold text-sm sm:text-lg mb-3 sm:mb-6 text-slate-800 dark:text-white font-heading">{t('theme_appearance')}</h3>
        {(() => {
          const userPrefs = H.getUserPreferences(user.id, user);
          const currentTheme = user.theme ?? userPrefs.theme ?? state.settings.theme ?? 'light';
          const currentLang = user.language ?? userPrefs.language ?? state.settings.language ?? 'ru';
          const currentSeasonal = user.showSeasonalAnimations !== undefined
            ? user.showSeasonalAnimations
            : (userPrefs.showSeasonalAnimations !== undefined
              ? userPrefs.showSeasonalAnimations
              : state.settings.showSeasonalAnimations !== false);

          const syncSessionUserPrefs = (patch: Partial<User>) => {
            try {
              const rawSession = localStorage.getItem('eljur_session');
              if (rawSession) {
                const parsed = JSON.parse(rawSession);
                if (parsed && parsed.user && parsed.user.id === user.id) {
                  parsed.user = { ...parsed.user, ...patch };
                  localStorage.setItem('eljur_session', JSON.stringify(parsed));
                }
              }
            } catch {}
          };

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-6">
               <div>
                 <label className="block text-xs sm:text-sm font-bold text-slate-600 mb-1 sm:mb-2 dark:text-slate-300">{t('app_theme')}</label>
                 <Select 
                   value={currentTheme} 
                   onChange={(e) => {
                     const val = e.target.value as 'light' | 'dark';
                     H.saveUserPreferences(user.id, { theme: val });
                     const u = state.users.find(usr => usr.id === user.id);
                     if (u) u.theme = val;
                     user.theme = val;
                     syncSessionUserPrefs({ theme: val });
                     state.settings.theme = val;
                     onUpdate({ ...state });
                   }}
                 >
                   <option value="light">{t('theme_light')}</option>
                   <option value="dark">{t('theme_dark')}</option>
                 </Select>
               </div>
               <div>
                 <label className="block text-xs sm:text-sm font-bold text-slate-600 mb-1 sm:mb-2 dark:text-slate-300">{t('language')}</label>
                 <Select 
                   value={currentLang} 
                   onChange={(e) => {
                     const val = e.target.value as 'ru' | 'en';
                     H.saveUserPreferences(user.id, { language: val });
                     const u = state.users.find(usr => usr.id === user.id);
                     if (u) u.language = val;
                     user.language = val;
                     syncSessionUserPrefs({ language: val });
                     state.settings.language = val;
                     onUpdate({ ...state });
                   }}
                 >
                   <option value="ru">Русский</option>
                   <option value="en">English</option>
                 </Select>
               </div>
               
               <div className="col-span-1 md:col-span-2">
                   <label className="inline-flex sm:flex items-center gap-2 sm:gap-3 cursor-pointer py-1.5 px-2.5 sm:p-3 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 transition-colors hover:border-blue-300 dark:hover:border-blue-700 w-full">
                       <div className={`w-7 h-4 sm:w-10 sm:h-6 rounded-full p-0.5 sm:p-1 transition-colors shrink-0 ${currentSeasonal ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                           <div className={`w-3 h-3 sm:w-4 sm:h-4 bg-white rounded-full shadow-sm transform transition-transform ${currentSeasonal ? 'translate-x-3 sm:translate-x-4' : 'translate-x-0'}`}></div>
                       </div>
                       <input 
                           type="checkbox" 
                           className="hidden" 
                           checked={currentSeasonal} 
                           onChange={(e) => {
                             const val = e.target.checked;
                             H.saveUserPreferences(user.id, { showSeasonalAnimations: val });
                             const u = state.users.find(usr => usr.id === user.id);
                             if (u) u.showSeasonalAnimations = val;
                             user.showSeasonalAnimations = val;
                             syncSessionUserPrefs({ showSeasonalAnimations: val });
                             state.settings.showSeasonalAnimations = val;
                             onUpdate({ ...state });
                           }}
                       />
                       <div className="min-w-0">
                           <span className="font-bold text-slate-700 dark:text-slate-200 text-[11px] sm:text-sm flex items-center gap-1 sm:gap-2 leading-tight">
                               <Sparkles size={12} className="text-amber-500 shrink-0 sm:w-3.5 sm:h-3.5" />
                               {t('seasonal_animations')}
                           </span>
                           <span className="block text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 leading-tight mt-0.5">{t('enable_seasonal')}</span>
                       </div>
                   </label>
               </div>
            </div>
          );
        })()}
      </Card>

      <Card className="p-3.5 sm:p-8">
        <h3 className="font-bold text-sm sm:text-lg mb-3 sm:mb-6 text-slate-800 dark:text-white font-heading">{t('fonts')}</h3>
        <div className="space-y-3.5 sm:space-y-6">
           <div className="flex flex-col gap-2 sm:gap-3">
             <label className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300">{t('load_font')}</label>
             <FileUploader onFileSelect={handleFontUpload} selectedFileName="" lang={lang as 'ru'|'en'} />
             <p className="text-[11px] sm:text-xs text-slate-400">{t('load_font_desc')}</p>
           </div>
           
           <div className="mt-3 sm:mt-6 border rounded-xl overflow-x-auto border-slate-200 dark:border-slate-700">
               <table className="w-full text-xs sm:text-sm min-w-[320px]">
                   <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700">
                       <tr>
                           <th className="p-2 sm:p-3 text-left">{t('file_name')}</th>
                           <th className="p-2 sm:p-3 text-center">{t('body_text')}</th>
                           <th className="p-2 sm:p-3 text-center">{t('headings')}</th>
                           <th className="p-2 sm:p-3 text-right">{t('actions')}</th>
                       </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                       <tr className="bg-white dark:bg-slate-900">
                           <td className="p-2 sm:p-3 font-medium">{t('standard_font')}</td>
                           <td className="p-2 sm:p-3 text-center">
                               <button 
                                 onClick={() => setBodyFont(undefined)} 
                                 className={`p-1 sm:p-1.5 rounded transition ${!state.settings.bodyFontId ? 'bg-green-100 text-green-700 font-bold' : 'text-slate-400 hover:bg-slate-100'}`}
                               >
                                  {!state.settings.bodyFontId ? <Check size={14}/> : t('select')}
                               </button>
                           </td>
                           <td className="p-2 sm:p-3 text-center">
                               <button 
                                 onClick={() => setHeadingFont(undefined)} 
                                 className={`p-1 sm:p-1.5 rounded transition ${!state.settings.headingFontId ? 'bg-green-100 text-green-700 font-bold' : 'text-slate-400 hover:bg-slate-100'}`}
                               >
                                  {!state.settings.headingFontId ? <Check size={14}/> : t('select')}
                               </button>
                           </td>
                           <td className="p-2 sm:p-3 text-right text-[11px] sm:text-xs text-slate-400 italic">{t('system_font')}</td>
                       </tr>
                       {fontList.map(f => (
                           <tr key={f.id} className="bg-white dark:bg-slate-900">
                               <td className="p-2 sm:p-3">{f.name}</td>
                               <td className="p-2 sm:p-3 text-center">
                                   <button 
                                     onClick={() => setBodyFont(f.id)} 
                                     className={`p-1 sm:p-1.5 rounded transition ${state.settings.bodyFontId === f.id ? 'bg-green-100 text-green-700 font-bold' : 'text-slate-400 hover:bg-slate-100'}`}
                                   >
                                      {state.settings.bodyFontId === f.id ? <Check size={14}/> : t('select')}
                                   </button>
                               </td>
                               <td className="p-2 sm:p-3 text-center">
                                   <button 
                                     onClick={() => setHeadingFont(f.id)} 
                                     className={`p-1 sm:p-1.5 rounded transition ${state.settings.headingFontId === f.id ? 'bg-green-100 text-green-700 font-bold' : 'text-slate-400 hover:bg-slate-100'}`}
                                   >
                                      {state.settings.headingFontId === f.id ? <Check size={14}/> : t('select')}
                                   </button>
                               </td>
                               <td className="p-2 sm:p-3 text-right">
                                   <button onClick={() => deleteFont(f.id)} className="text-red-500 hover:bg-red-50 p-1 sm:p-1.5 rounded"><Trash2 size={14}/></button>
                               </td>
                           </tr>
                       ))}
                   </tbody>
               </table>
           </div>
        </div>
      </Card>

      <Card className="p-3.5 sm:p-8">
        <h3 className="font-bold text-sm sm:text-lg mb-2.5 sm:mb-3 text-slate-800 dark:text-white font-heading">{t('backup')}</h3>
        <div className="mb-3.5 sm:mb-5 p-2.5 sm:p-3.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 text-[11px] sm:text-xs text-slate-700 dark:text-slate-300 space-y-1">
          <div className="font-bold text-blue-800 dark:text-blue-300">
            {lang === 'ru' ? 'Облачное хранение + Резервные копии (JSON)' : 'Cloud Storage + JSON Backups'}
          </div>
          <p>
            {lang === 'ru'
              ? isCreator
                ? 'Все данные автоматически синхронизируются с облачной базой Firestore в реальном времени. Экспорт сохраняет полный слепок всех школ, пользователей, оценок, расписаний, сообщений и вложенных файлов в один JSON-файл. При импорте данные автоматически записываются и в локальный кэш, и на облачный сервер.'
                : 'Все данные вашей школы автоматически сохраняются в облаке Firestore. Вы можете скачать полную резервную копию своей школы (включая расписание, оценки, сообщения и файлы) в JSON-файл или восстановить данные школы из файла с автоматической синхронизацией в облако.'
              : 'All data is synced in real time with Cloud Firestore. Exporting downloads a complete JSON snapshot (including files), and importing restores both local cache and cloud database.'}
          </p>
        </div>
        <div className="space-y-3.5 sm:space-y-6">
          <div className="flex flex-col gap-2 sm:gap-3">
            <label className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300">{t('export')}</label>
            <Button onClick={handleExport} variant="secondary" size="sm" className="justify-start w-fit">{t('download_backup')}</Button>
            <p className="text-[11px] sm:text-xs text-slate-400">{t('backup_desc')}</p>
          </div>
          <hr className="border-slate-100 dark:border-slate-800" />
          <div className="flex flex-col gap-2 sm:gap-3">
             <label className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300">{t('import')}</label>
             <FileUploader onFileSelect={handleImport} lang={lang as 'ru'|'en'} />
          </div>
        </div>
      </Card>

      <Modal isOpen={!!confirmModal} onClose={() => setConfirmModal(null)} title={confirmModal?.title || t('settings')}>
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">{confirmModal?.message}</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmModal(null)}>{t('cancel')}</Button>
            <Button variant="primary" size="sm" onClick={() => confirmModal?.onConfirm()}>{t('confirm')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
