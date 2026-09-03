

import React, { useState, useEffect } from 'react';
import { AppState, User } from '../types';
import * as DB from '../services/db';
import * as H from '../utils/helpers';
import { Button, Input, Select, Card, FileUploader } from '../components/ui';
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
  const [fontList, setFontList] = useState<any[]>([]);
  const [showSecretPass, setShowSecretPass] = useState(false);
  
  // Time Machine State
  const [virtualDatePart, setVirtualDatePart] = useState('');
  const [virtualTimePart, setVirtualTimePart] = useState('');
  const [timeMachineError, setTimeMachineError] = useState<string | null>(null);

  const isDirector = user.role === 'director';
  const isCreator = user.role === 'creator';
  
  const lang = state.settings.language || 'ru';
  const t = (k: string) => H.t(k, lang);

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
        alert(t('school_name_saved'));
    } else {
        alert(t('school_not_found'));
    }
  };

  const handleExport = async () => {
    if (!confirm(t('download_backup') + '?')) return;
    try {
      if (isDirector && user.schoolId) {
        // School-isolated export for Director
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
            if (state.grades?.[scopedKey]) schoolGrades[scopedKey] = state.grades[scopedKey];
            if (state.finalGrades?.[scopedKey]) schoolFinalGrades[scopedKey] = state.finalGrades[scopedKey];
        });

        const exportObj = {
          isSchoolBackup: true,
          schoolId: sId,
          school: schoolObj,
          users: schoolUsers,
          schedules: schoolSchedules,
          grades: schoolGrades,
          finalGrades: schoolFinalGrades,
          homework: (state.homework || []).filter(h => h.schoolId === sId),
          teacherAssignments: (state.teacherAssignments || []).filter(ta => ta.schoolId === sId),
          studentGroups: (state.studentGroups || []).filter(sg => sg.schoolId === sId),
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

      // Full system export for Creator
      const assets = await DB.getAllAssets();
      const assetsData = await Promise.all(assets.map(async (a) => {
        return new Promise<any>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve({ id: a.id, name: a.name, type: a.type, data: reader.result });
          reader.readAsDataURL(a.blob);
        });
      }));

      const exportObj = {
        isFullBackup: true,
        state: state,
        assets: assetsData,
        timestamp: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(exportObj)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ElZhur_Backup_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Error: ' + e);
    }
  };

  const handleImport = async (file: File) => {
    if (!confirm(t('import_warning'))) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);

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
            scheduleSettings: importedSchool.scheduleSettings || state.schools[schoolIdx].scheduleSettings
          };
        }

        // 2. Update users for this school safely
        if (Array.isArray(importedUsers) && importedUsers.length > 0) {
          // Remove old users of this school
          state.users = state.users.filter(u => u.schoolId !== sId);
          // Insert imported users, mapped to this schoolId
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
          const classKey = key.includes('__') ? key.split('__')[1] : key;
          const targetKey = H.getSchoolClassKey(sId, classKey);
          state.schedules[targetKey] = val as any;
        });

        // 4. Update grades for this school
        const importedGrades = data.grades || data.state?.grades || {};
        if (!state.grades) state.grades = {};
        Object.entries(importedGrades).forEach(([key, val]) => {
          const classKey = key.includes('__') ? key.split('__')[1] : key;
          const targetKey = H.getSchoolClassKey(sId, classKey);
          state.grades[targetKey] = val as any;
        });

        // 5. Update final grades for this school
        const importedFinalGrades = data.finalGrades || data.state?.finalGrades || {};
        if (!state.finalGrades) state.finalGrades = {};
        Object.entries(importedFinalGrades).forEach(([key, val]) => {
          const classKey = key.includes('__') ? key.split('__')[1] : key;
          const targetKey = H.getSchoolClassKey(sId, classKey);
          state.finalGrades[targetKey] = val as any;
        });

        // 6. Update homework, assignments, groups
        const importedHomework = data.homework || data.state?.homework || [];
        state.homework = [
          ...(state.homework || []).filter(h => h.schoolId !== sId),
          ...importedHomework.map((h: any) => ({ ...h, schoolId: sId }))
        ];

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

        onUpdate(state);
        alert(t('import_success'));
        return;
      }
      
      // Full system import for Creator
      if (data.state) {
        // Clear local DB assets
        const db = await DB.openDB();
        const tx = db.transaction(['assets', 'appStore'], 'readwrite');
        await tx.objectStore('assets').clear();
        await tx.objectStore('appStore').clear();

        // Restore assets
        if (data.assets && Array.isArray(data.assets)) {
           for (const a of data.assets) {
              const res = await fetch(a.data);
              const blob = await res.blob();
              await DB.saveAsset(a.id, a.name, a.type, blob);
           }
        }
        
        // Restore state
        await DB.saveState(data.state);
        alert(t('import_success'));
        window.location.reload();
      } else {
        alert(t('invalid_format'));
      }
    } catch (e) {
      alert(t('import_error') + ': ' + e);
    }
  };

  const handleFontUpload = async (file: File) => {
    const id = H.uid('font');
    await DB.saveAsset(id, file.name, file.type, file);
    alert(t('font_loaded'));
    refreshFonts();
  };

  const deleteFont = async (id: string) => {
    if (!confirm(t('delete_font_confirm'))) return;
    if (state.settings.bodyFontId === id) state.settings.bodyFontId = undefined;
    if (state.settings.headingFontId === id) state.settings.headingFontId = undefined;
    
    const db = await DB.openDB();
    const tx = db.transaction('assets', 'readwrite');
    await tx.objectStore('assets').delete(id);
    
    onUpdate(state);
    refreshFonts();
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
      alert(t('time_changed'));
  };

  const resetTime = () => {
      state.settings.systemTimeOffset = 0;
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      setVirtualDatePart(`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`);
      setVirtualTimePart(`${now.getHours()}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
      setTimeMachineError(null);
      onUpdate(state);
      alert(t('time_reset'));
  };

  const handleResetData = async () => {
      if (isDirector && user.schoolId) {
          if (window.confirm(lang === 'ru' ? 'Вы уверены, что хотите сбросить данные своей школы? Это удалит расписание, оценки и списки классов вашей школы.' : 'Are you sure you want to reset your school data? This will clear schedules, grades, and classes for your school.')) {
              H.clearSchoolGrades(state, user.schoolId);
              const school = state.schools.find(s => s.id === user.schoolId);
              if (school) {
                  school.classes = [];
              }
              // Reset users of this school except current director
              state.users = state.users.filter(u => u.schoolId !== user.schoolId || u.id === user.id);
              state.userOrder = (state.userOrder || []).filter(uid => state.users.some(u => u.id === uid));
              onUpdate({ ...state });
              alert(lang === 'ru' ? 'Данные школы успешно сброшены.' : 'School data reset successfully.');
          }
      } else if (isCreator) {
          if (window.confirm('Вы уверены, что хотите сбросить все данные до значений по умолчанию? Это действие необратимо и удалит все текущие данные, вернув приложение к исходному состоянию (вместе с тестовыми данными).')) {
              const newState = JSON.parse(JSON.stringify(defaultState));
              onUpdate(newState);
              alert('Данные успешно сброшены.');
              window.location.reload();
          }
      }
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white font-heading">{t('settings')}</h2>
        <Button onClick={onBack}>← {t('back')}</Button>
      </div>

      {(isDirector || isCreator) && (
        <Card className="p-8">
          <h3 className="font-bold text-lg mb-6 text-slate-800 dark:text-white font-heading">{t('general')}</h3>
          <div className="space-y-4">
             {isDirector && (
             <div>
               <label className="block text-sm font-bold text-slate-600 mb-2 dark:text-slate-300">{t('school_name')}</label>
               <div className="flex gap-4">
                 <Input value={localName} onChange={e => setLocalName(e.target.value)} />
                 <Button variant="primary" onClick={handleSaveName}>{t('save')}</Button>
               </div>
             </div>
             )}
             
             <div>
                <label className="block text-sm font-bold text-slate-600 mb-2 dark:text-slate-300">{t('timezone')}</label>
                <Select 
                   value={state.settings.timezone || 'UTC+3'} 
                   onChange={(e) => { state.settings.timezone = e.target.value; onUpdate(state); }}
                >
                   <option value="UTC+2">Калининград (MSK-1)</option>
                   <option value="UTC+3">Москва (MSK)</option>
                   <option value="UTC+4">Самара (MSK+1)</option>
                   <option value="UTC+5">Екатеринбург (MSK+2)</option>
                   <option value="UTC+6">Омск (MSK+3)</option>
                   <option value="UTC+7">Красноярск (MSK+4)</option>
                   <option value="UTC+8">Иркутск (MSK+5)</option>
                   <option value="UTC+9">Якутск (MSK+6)</option>
                   <option value="UTC+10">Владивосток (MSK+7)</option>
                   <option value="UTC+11">Магадан (MSK+8)</option>
                   <option value="UTC+12">Камчатка (MSK+9)</option>
                </Select>
                <p className="text-xs text-slate-400 mt-1">{t('timezone_desc')}</p>
             </div>
          </div>
        </Card>
      )}

      {isCreator && (
         <Card className="p-8 border-l-[6px] border-l-purple-500">
             <h3 className="font-bold text-lg mb-6 text-slate-800 dark:text-white font-heading text-purple-600 dark:text-purple-400">{t('creator_settings')}</h3>
             
             {/* TIME MACHINE SECTION */}
             <div className="mb-8 p-4 bg-purple-50 border border-purple-100 rounded-xl dark:bg-purple-900/20 dark:border-purple-800">
                 <h4 className="font-bold text-purple-800 dark:text-purple-300 mb-3 flex items-center gap-2"><Clock size={18}/> {t('time_machine_title')}</h4>
                 <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                     <div className="w-full sm:w-auto">
                         <label className="text-xs font-bold text-slate-500 mb-1 block">{t('date')}</label>
                         <Input 
                            type="date" 
                            value={virtualDatePart}
                            onChange={(e) => setVirtualDatePart(e.target.value)}
                            className={`h-[42px] ${timeMachineError && !virtualDatePart ? 'border-red-300 focus:border-red-500' : ''}`}
                         />
                     </div>
                     <div className="w-full sm:w-auto">
                         <label className="text-xs font-bold text-slate-500 mb-1 block">{t('time_hms')}</label>
                         <Input 
                            type="text" 
                            value={virtualTimePart}
                            onChange={(e) => setVirtualTimePart(e.target.value)}
                            placeholder="HH:MM:SS"
                            className={`h-[42px] font-mono w-full sm:w-32 ${timeMachineError ? 'border-red-300 focus:border-red-500 text-red-600' : ''}`}
                            maxLength={8}
                         />
                     </div>
                     <div className="flex gap-2 w-full sm:w-auto">
                         <Button onClick={applyTimeTravel} disabled={!!timeMachineError || !virtualDatePart || !virtualTimePart} variant="primary" className="bg-purple-600 hover:bg-purple-700 h-[42px] flex-1 sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed">{t('apply')}</Button>
                         <Button onClick={resetTime} variant="secondary" className="h-[42px] flex-1 sm:flex-none">{t('reset')}</Button>
                     </div>
                 </div>
                 {timeMachineError && (
                     <div className="mt-2 text-xs font-bold text-red-500 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                         <AlertCircle size={12} /> {timeMachineError}
                     </div>
                 )}
                 <p className="text-xs text-purple-600/70 mt-2 dark:text-purple-400/70">{t('time_machine_desc')}</p>
             </div>

             {/* RESET DATA SECTION */}
             <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-xl dark:bg-red-900/20 dark:border-red-800">
                 <h4 className="font-bold text-red-800 dark:text-red-300 mb-3 flex items-center gap-2"><Trash2 size={18}/> Сброс данных</h4>
                 <p className="text-xs text-red-600/70 mb-4 dark:text-red-400/70">
                     Внимание! Это действие удалит все данные (оценки, расписание, пользователей), кроме тестовых данных по умолчанию.
                 </p>
                 <Button onClick={handleResetData} variant="primary" className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800">Сбросить данные</Button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                     <label className="block text-sm font-bold text-slate-600 mb-2 dark:text-slate-300">{t('secret_key')}</label>
                     <Input 
                        value={state.settings.secretKey || 'Space'} 
                        onChange={e => { state.settings.secretKey = e.target.value; onUpdate(state); }} 
                        placeholder="Space"
                     />
                     <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">{t('secret_key_desc')}</p>
                 </div>
                 <div>
                     <label className="block text-sm font-bold text-slate-600 mb-2 dark:text-slate-300">{t('press_count')}</label>
                     <Input 
                        type="number"
                        min="1"
                        max="20"
                        value={state.settings.secretCount || 4} 
                        onChange={e => { state.settings.secretCount = parseInt(e.target.value); onUpdate(state); }} 
                        className="bg-white text-slate-900 border border-slate-300 dark:bg-slate-950 dark:text-white dark:border-slate-700" 
                     />
                 </div>
                 <div className="col-span-2">
                     <label className="block text-sm font-bold text-slate-600 mb-2 dark:text-slate-300">{t('secret_pass')}</label>
                     <div className="relative">
                         <Input 
                            type={showSecretPass ? 'text' : 'password'}
                            value={state.settings.adminPassword || 'admin'} 
                            onChange={e => { state.settings.adminPassword = e.target.value; onUpdate(state); }} 
                         />
                         <button 
                            type="button"
                            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 cursor-pointer p-0.5 bg-white dark:bg-slate-900 rounded"
                            onMouseDown={() => setShowSecretPass(true)}
                            onMouseUp={() => setShowSecretPass(false)}
                            onMouseLeave={() => setShowSecretPass(false)}
                            onTouchStart={() => setShowSecretPass(true)}
                            onTouchEnd={() => setShowSecretPass(false)}
                         >
                            {showSecretPass ? <EyeOff size={20} /> : <Eye size={20} />}
                         </button>
                     </div>
                     <p className="text-[10px] text-slate-400 mt-1 italic">{t('hold_eye')}</p>
                 </div>
             </div>
         </Card>
      )}

      <Card className="p-8">
        <h3 className="font-bold text-lg mb-6 text-slate-800 dark:text-white font-heading">{t('theme_appearance')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div>
             <label className="block text-sm font-bold text-slate-600 mb-2 dark:text-slate-300">{t('app_theme')}</label>
             <Select 
               value={state.settings.theme} 
               onChange={(e) => {
                 const val = e.target.value as 'light' | 'dark';
                 try { localStorage.setItem('eljur_theme', val); } catch (_) {}
                 const u = state.users.find(usr => usr.id === user.id);
                 if (u) u.theme = val;
                 user.theme = val;
                 state.settings.theme = val;
                 onUpdate(state);
               }}
             >
               <option value="light">{t('theme_light')}</option>
               <option value="dark">{t('theme_dark')}</option>
             </Select>
           </div>
           <div>
             <label className="block text-sm font-bold text-slate-600 mb-2 dark:text-slate-300">{t('language')}</label>
             <Select 
               value={state.settings.language || 'ru'} 
               onChange={(e) => {
                 const val = e.target.value as 'ru' | 'en';
                 try { localStorage.setItem('eljur_lang', val); } catch (_) {}
                 const u = state.users.find(usr => usr.id === user.id);
                 if (u) u.language = val;
                 user.language = val;
                 state.settings.language = val;
                 onUpdate(state);
               }}
             >
               <option value="ru">Русский</option>
               <option value="en">English</option>
             </Select>
           </div>
           
           <div className="col-span-1 md:col-span-2">
               <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 transition-colors hover:border-blue-300 dark:hover:border-blue-700">
                   <div className={`w-10 h-6 rounded-full p-1 transition-colors ${state.settings.showSeasonalAnimations !== false ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                       <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${state.settings.showSeasonalAnimations !== false ? 'translate-x-4' : 'translate-x-0'}`}></div>
                   </div>
                   <input 
                       type="checkbox" 
                       className="hidden" 
                       checked={state.settings.showSeasonalAnimations !== false} 
                       onChange={(e) => { state.settings.showSeasonalAnimations = e.target.checked; onUpdate(state); }}
                   />
                   <div>
                       <span className="block font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2">
                           <Sparkles size={16} className="text-amber-500" />
                           {t('seasonal_animations')}
                       </span>
                       <span className="text-xs text-slate-500 dark:text-slate-400">{t('enable_seasonal')}</span>
                   </div>
               </label>
           </div>
        </div>
      </Card>

      <Card className="p-8">
        <h3 className="font-bold text-lg mb-6 text-slate-800 dark:text-white font-heading">{t('fonts')}</h3>
        <div className="space-y-6">
           <div className="flex flex-col gap-3">
             <label className="text-sm font-bold text-slate-600 dark:text-slate-300">{t('load_font')}</label>
             <FileUploader onFileSelect={handleFontUpload} selectedFileName="" lang={lang as 'ru'|'en'} />
             <p className="text-xs text-slate-400">{t('load_font_desc')}</p>
           </div>
           
           <div className="mt-6 border rounded-xl overflow-x-auto border-slate-200 dark:border-slate-700">
               <table className="w-full text-sm min-w-[400px]">
                   <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700">
                       <tr>
                           <th className="p-3 text-left">{t('file_name')}</th>
                           <th className="p-3 text-center">{t('body_text')}</th>
                           <th className="p-3 text-center">{t('headings')}</th>
                           <th className="p-3 text-right">{t('actions')}</th>
                       </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                       <tr className="bg-white dark:bg-slate-900">
                           <td className="p-3 font-medium">{t('standard_font')}</td>
                           <td className="p-3 text-center">
                               <button 
                                 onClick={() => setBodyFont(undefined)} 
                                 className={`p-1.5 rounded transition ${!state.settings.bodyFontId ? 'bg-green-100 text-green-700 font-bold' : 'text-slate-400 hover:bg-slate-100'}`}
                               >
                                  {!state.settings.bodyFontId ? <Check size={16}/> : t('select')}
                               </button>
                           </td>
                           <td className="p-3 text-center">
                               <button 
                                 onClick={() => setHeadingFont(undefined)} 
                                 className={`p-1.5 rounded transition ${!state.settings.headingFontId ? 'bg-green-100 text-green-700 font-bold' : 'text-slate-400 hover:bg-slate-100'}`}
                               >
                                  {!state.settings.headingFontId ? <Check size={16}/> : t('select')}
                               </button>
                           </td>
                           <td className="p-3 text-right text-xs text-slate-400 italic">{t('system_font')}</td>
                       </tr>
                       {fontList.map(f => (
                           <tr key={f.id} className="bg-white dark:bg-slate-900">
                               <td className="p-3">{f.name}</td>
                               <td className="p-3 text-center">
                                   <button 
                                     onClick={() => setBodyFont(f.id)} 
                                     className={`p-1.5 rounded transition ${state.settings.bodyFontId === f.id ? 'bg-green-100 text-green-700 font-bold' : 'text-slate-400 hover:bg-slate-100'}`}
                                   >
                                      {state.settings.bodyFontId === f.id ? <Check size={16}/> : t('select')}
                                   </button>
                               </td>
                               <td className="p-3 text-center">
                                   <button 
                                     onClick={() => setHeadingFont(f.id)} 
                                     className={`p-1.5 rounded transition ${state.settings.headingFontId === f.id ? 'bg-green-100 text-green-700 font-bold' : 'text-slate-400 hover:bg-slate-100'}`}
                                   >
                                      {state.settings.headingFontId === f.id ? <Check size={16}/> : t('select')}
                                   </button>
                               </td>
                               <td className="p-3 text-right">
                                   <button onClick={() => deleteFont(f.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16}/></button>
                               </td>
                           </tr>
                       ))}
                   </tbody>
               </table>
           </div>
        </div>
      </Card>

      <Card className="p-8">
        <h3 className="font-bold text-lg mb-6 text-slate-800 dark:text-white font-heading">{t('backup')}</h3>
        <div className="space-y-6">
          <div className="flex flex-col gap-3">
            <label className="text-sm font-bold text-slate-600 dark:text-slate-300">{t('export')}</label>
            <Button onClick={handleExport} variant="secondary" className="justify-start">{t('download_backup')}</Button>
            <p className="text-xs text-slate-400">{t('backup_desc')}</p>
          </div>
          <hr className="border-slate-100 dark:border-slate-800" />
          <div className="flex flex-col gap-3">
             <label className="text-sm font-bold text-slate-600 dark:text-slate-300">{t('import')}</label>
             <FileUploader onFileSelect={handleImport} lang={lang as 'ru'|'en'} />
          </div>
        </div>
      </Card>
    </div>
  );
}
