
import React, { useState, useEffect, useMemo } from 'react';
import { AppState, User, Attachment, ScheduleDay } from '../../types';
import * as H from '../../utils/helpers';
import * as DB from '../../services/db';
import { Button, Select, Card, MultiFileUploader, FileDisplay } from '../../components/ui';
import { Edit, Trash2 } from 'lucide-react';

export const HomeworkManager = ({ state, onUpdate, user, lang }: { state: AppState, onUpdate: (s: AppState) => void, user: User, lang: 'ru' | 'en' }) => {
   const schoolClasses = H.getSchoolClasses(state, user.schoolId);

   const myClasses = useMemo(() => {
        const assignedClasses = new Set(user.classes || []);
        schoolClasses.forEach((c: any) => {
            const classKey = `${c.class}_${c.letter}`;
            const schedule = H.getSchoolClassSchedule(state, user.schoolId, classKey);
            Object.values(schedule).forEach((day: any) => {
                 day.lessons.forEach((l: any) => {
                     if (l.teacherId === user.id && l.canGrade) { assignedClasses.add(classKey); }
                     if (l.subgroups) { l.subgroups.forEach((sg: any) => { if (sg.teacherId === user.id && sg.canGrade) { assignedClasses.add(classKey); } }); }
                 });
            });
        });
        return schoolClasses.filter((c: any) => assignedClasses.has(`${c.class}_${c.letter}`));
   }, [schoolClasses, user.classes, state, user.id, user.schoolId]);

   const [cls, setCls] = useState(myClasses[0] ? `${myClasses[0].class}_${myClasses[0].letter}` : '');
   
   const availableSubjects = useMemo(() => {
        if (!cls) return [];
        const assigned = state.teacherAssignments.filter((a: any) => a.teacherId === user.id && a.classId === cls).map((a: any) => a.subject);
        const schedule = H.getSchoolClassSchedule(state, user.schoolId, cls);
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
   }, [cls, state.teacherAssignments, user.id, user.subjects, state, user.schoolId]);

   const [subj, setSubj] = useState('');
   useEffect(() => { if (availableSubjects.length > 0 && !availableSubjects.includes(subj)) { setSubj(availableSubjects[0]); } }, [availableSubjects, subj]);

   const [date, setDate] = useState('');
   const [text, setText] = useState('');
   const [files, setFiles] = useState<File[]>([]);
   const [lessonIndex, setLessonIndex] = useState<number>(0);
   const [historyClassFilter, setHistoryClassFilter] = useState('');
   const [editId, setEditId] = useState<string | null>(null);
   const t = (k: string) => H.t(k, lang);

   const validHWDates = useMemo(() => {
       if (!cls || !subj) return [];
       const schedule = H.getSchoolClassSchedule(state, user.schoolId, cls);
       if (!schedule) return [];
       const scheduleSettings = H.getSchoolScheduleSettings(state, user.schoolId);
       const today = new Date(Date.now() + (state.settings.systemTimeOffset || 0));
       today.setHours(0,0,0,0);
       const dates: string[] = [];
       Object.values(schedule).forEach((d: any) => {
           if (H.isHoliday(d.date, scheduleSettings) || H.getVacationForDay(d.date, scheduleSettings)) return;
           const hasSubject = d.lessons.some((l:any) => { if (l.subgroups && l.subgroups.length > 0) { return l.subgroups.some((sg: any) => sg.subject === subj); } return l.lesson === subj; });
           if (hasSubject) { const dayDate = new Date(d.date); if (dayDate >= today) { dates.push(d.date); } }
       });
       return dates.sort();
   }, [cls, subj, state, user.schoolId, state.settings.systemTimeOffset]);

   const getLessonCount = () => {
       if (!cls || !date || !subj) return 0;
       const schedule = H.getSchoolClassSchedule(state, user.schoolId, cls);
       if (!schedule) return 0;
       const days = Object.values(schedule) as ScheduleDay[];
       const day = days.find(d => d.date === date);
       if (!day) return 0;
       return day.lessons.filter(l => { if(l.subgroups && l.subgroups.length > 0) return l.subgroups.some((sg:any) => sg.subject === subj); return l.lesson === subj; }).length;
   };
   const availableLessonCount = getLessonCount();

   const submitHW = async () => {
     if (!cls || !subj || !date || !text) return alert(t('fill_fields'));
     const scheduleSettings = H.getSchoolScheduleSettings(state, user.schoolId);
     if (H.isHoliday(date, scheduleSettings) || H.getVacationForDay(date, scheduleSettings)) {
         return alert(lang === 'en' ? 'Cannot assign homework on a holiday or vacation.' : 'Нельзя задавать домашнее задание на праздничный день или период каникул.');
     }
     const today = new Date(Date.now() + (state.settings.systemTimeOffset || 0)); today.setHours(0, 0, 0, 0);
     const selectedDate = new Date(date); selectedDate.setHours(0, 0, 0, 0);
     if (selectedDate < today && !editId) { return alert(t('cant_hw_past')); }
     const newAttachments: Attachment[] = [];
     for (const f of files) { const id = H.uid('att'); await DB.saveAsset(id, f.name, f.type, f); newAttachments.push({ id, name: f.name, type: f.type }); }
     const [c, l] = cls.split('_');
     let finalText = text;
     if (editId) {
        const idx = state.homework.findIndex((h:any) => h.id === editId);
        if (idx > -1) {
             const existing = state.homework[idx];
             const existingAtts = existing.attachments || [];
             if (existing.attachmentId) existingAtts.push({id: existing.attachmentId, name: existing.attachmentName||'File', type: existing.attachmentType||''});
             state.homework[idx] = { ...existing, schoolId: existing.schoolId || user.schoolId, class: c, letter: l, date, subject: subj, text: finalText, attachments: [...existingAtts, ...newAttachments], lessonIndex: availableLessonCount > 1 ? lessonIndex : 0, attachmentId: undefined };
        }
        setEditId(null);
     } else {
        const newHW = { id: H.uid('hw'), schoolId: user.schoolId, class: c, letter: l, date, subject: subj, text: finalText, attachments: newAttachments, fromId: user.id, lessonIndex: availableLessonCount > 1 ? lessonIndex : 0 };
        state.homework.push(newHW);
     }
     onUpdate(state); alert(t('saved')); setText(''); setFiles([]);
   };

   const startEdit = (h: any) => {
      const today = new Date(Date.now() + (state.settings.systemTimeOffset || 0)); today.setHours(0,0,0,0);
      const hwDate = new Date(h.date); hwDate.setHours(0,0,0,0);
      if (hwDate < today) { alert(t('cant_hw_past')); return; }
      setEditId(h.id); setCls(`${h.class}_${h.letter}`); setSubj(h.subject); setDate(h.date); setText(h.text); setLessonIndex(h.lessonIndex || 0); setFiles([]); window.scrollTo({ top: 0, behavior: 'smooth' });
   };

   const deleteHW = (id: string) => {
      const h = state.homework.find((x:any) => x.id === id);
      if (h) {
          const today = new Date(Date.now() + (state.settings.systemTimeOffset || 0)); today.setHours(0,0,0,0);
          const hwDate = new Date(h.date); hwDate.setHours(0,0,0,0);
          if (hwDate < today) { alert(t('cant_hw_past')); return; }
      }
      if(!confirm(t('confirm_delete'))) return;
      state.homework = state.homework.filter((h:any) => h.id !== id);
      onUpdate(state);
   };

   const filteredHistory = state.homework.filter((h: any) => h.fromId === user.id).filter((h: any) => historyClassFilter ? `${h.class}_${h.letter}` === historyClassFilter : true).reverse();

   return (
     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="p-8 shadow-soft h-fit">
           <h3 className="font-bold text-xl mb-6 text-slate-800 dark:text-white">{editId ? t('edit') : t('add')} {t('homework')}</h3>
           {editId && <div className="text-sm bg-yellow-50 text-yellow-800 p-2 mb-4 rounded border border-yellow-200">{t('editing')}... <button className="underline font-bold" onClick={() => { setEditId(null); setText(''); }}>{t('cancel')}</button></div>}
           <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                 <div><label className="text-sm font-bold text-slate-600 mb-2 block dark:text-slate-300">{t('class')}</label><Select value={cls} onChange={e => { setCls(e.target.value); setDate(''); }}>{myClasses.map((c: any) => <option key={`${c.class}_${c.letter}`} value={`${c.class}_${c.letter}`}>{c.class}{c.letter}</option>)}</Select></div>
                 <div><label className="text-sm font-bold text-slate-600 mb-2 block dark:text-slate-300">{t('subject')}</label><Select value={subj} onChange={e => { setSubj(e.target.value); setDate(''); }}>{availableSubjects.map((s: string) => <option key={s} value={s}>{s}</option>)}</Select></div>
              </div>
              <div><label className="text-sm font-bold text-slate-600 mb-2 block dark:text-slate-300">{t('submit_hw')}</label><div className="relative"><Select value={date} onChange={e => setDate(e.target.value)} disabled={validHWDates.length === 0}><option value="">-- {t('select_date')} --</option>{validHWDates.map(d => (<option key={d} value={d}>{H.formatDateDDMMYYYY(d)} ({H.getDayOfWeek(d, lang)})</option>))}</Select>{validHWDates.length === 0 && <div className="absolute inset-0 z-10" onClick={() => alert(cls && subj ? `В расписании этого класса нет будущих уроков по предмету «${subj}».` : t('list_empty'))} />}</div></div>
              {availableLessonCount > 1 && (<div className="bg-blue-50 p-3 rounded-lg border border-blue-100 dark:bg-blue-900/20 dark:border-blue-800"><label className="text-sm font-bold text-blue-800 mb-2 block dark:text-blue-300">{t('select_lesson_found')} ({availableLessonCount})</label><Select value={lessonIndex} onChange={e => setLessonIndex(parseInt(e.target.value))}>{Array.from({length: availableLessonCount}).map((_, i) => (<option key={i} value={i}>{i + 1} {t('lesson_order')}</option>))}</Select></div>)}
              <div><label className="text-sm font-bold text-slate-600 mb-2 block dark:text-slate-300">{t('hw_text')}</label><textarea className="w-full border border-slate-300 rounded-xl p-4 h-40 focus:ring-blue-500 focus:border-blue-500 text-sm shadow-sm bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-slate-200" value={text} onChange={e => setText(e.target.value)} placeholder="..." /></div>
              <div className="pt-2"><MultiFileUploader files={files} onFilesChange={setFiles} lang={lang} /></div>
              <Button variant="primary" onClick={submitHW} className="w-full py-3 text-base">{t('save_hw')}</Button>
           </div>
        </Card>
        <div className="space-y-6">
           <div className="flex justify-between items-center"><h4 className="font-bold text-slate-700 ml-1 text-lg dark:text-white">{t('history')}</h4><Select className="w-40 text-xs py-1" value={historyClassFilter} onChange={e => setHistoryClassFilter(e.target.value)}><option value="">{t('all_classes')}</option>{myClasses.map((c: any) => <option key={`${c.class}_${c.letter}`} value={`${c.class}_${c.letter}`}>{c.class}{c.letter}</option>)}</Select></div>
           <div className="space-y-4">
             {filteredHistory.map((h: any) => {
               const lIdxLabel = (h.lessonIndex !== undefined && h.lessonIndex > 0) ? ` (${t('lesson_order')} ${h.lessonIndex + 1})` : '';
               const isPast = new Date(h.date).setHours(0,0,0,0) < new Date(Date.now() + (state.settings.systemTimeOffset || 0)).setHours(0,0,0,0);
               return (
               <Card key={h.id} className="p-5 text-sm border-l-[6px] border-l-blue-400 dark:border-l-blue-600">
                  <div className="flex justify-between items-center mb-3"><div className="font-bold text-slate-800 text-base dark:text-white">{h.subject}{lIdxLabel}</div><div className="flex items-center gap-2"><div className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full dark:bg-slate-800 dark:text-slate-400">{h.class}{h.letter} • {H.formatDateDDMMYYYY(h.date)}</div>{!isPast && (<><button onClick={() => startEdit(h)} className="text-blue-500 hover:text-blue-700"><Edit size={14}/></button><button onClick={() => deleteHW(h.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14}/></button></>)}{isPast && <span title={t('past_edit_forbidden')} className="text-slate-300 cursor-not-allowed"><Edit size={14}/></span>}</div></div>
                  <p className="text-slate-600 whitespace-pre-wrap leading-relaxed dark:text-slate-300">{h.text}</p>
                  {((h.attachments || []).length > 0 || h.attachmentId) && (<div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">{h.attachmentId && <FileDisplay id={h.attachmentId} name={h.attachmentName} lang={lang} />}{(h.attachments || []).map((att: Attachment) => (<FileDisplay key={att.id} id={att.id} name={att.name} lang={lang} />))}</div>)}
               </Card>
             )})}
           </div>
        </div>
     </div>
   );
};
