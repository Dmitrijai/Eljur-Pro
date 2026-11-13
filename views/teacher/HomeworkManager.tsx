import React, { useState, useEffect, useMemo } from 'react';
import { AppState, User, Attachment, ScheduleDay } from '../../types';
import * as H from '../../utils/helpers';
import * as DB from '../../services/db';
import { Button, Select, Card, MultiFileUploader, FileDisplay } from '../../components/ui';
import { Edit, Trash2, X } from 'lucide-react';

export const HomeworkManager = ({ state, onUpdate, user, lang }: { state: AppState, onUpdate: (s: AppState) => void, user: User, lang: 'ru' | 'en' }) => {
   const schoolClasses = H.getSchoolClasses(state, user.schoolId);

   const myClasses = useMemo(() => {
        const assignedClasses = new Set(user.classes || []);
        state.teacherAssignments.forEach((a: any) => {
            if (a.teacherId === user.id && a.classId) assignedClasses.add(a.classId);
        });
        H.getUserLeadingClasses(state, user.schoolId, user.id).forEach((c: any) => {
            assignedClasses.add(`${c.class}_${c.letter}`);
        });
        schoolClasses.forEach((c: any) => {
            const classKey = `${c.class}_${c.letter}`;
            const schedule = H.getSchoolClassSchedule(state, user.schoolId, classKey);
            Object.values(schedule).forEach((day: any) => {
                 day.lessons.forEach((l: any) => {
                     if (l.teacherId === user.id) { assignedClasses.add(classKey); }
                     if (l.subgroups) { l.subgroups.forEach((sg: any) => { if (sg.teacherId === user.id) { assignedClasses.add(classKey); } }); }
                 });
            });
        });
        return schoolClasses.filter((c: any) => assignedClasses.has(`${c.class}_${c.letter}`));
   }, [schoolClasses, user.classes, state, user.id, user.schoolId]);

   const [cls, setCls] = H.useSyncedState<string>(`eljur_hw_cls_${user.id}`, myClasses[0] ? `${myClasses[0].class}_${myClasses[0].letter}` : '');
   useEffect(() => {
       if (myClasses.length > 0 && !myClasses.some((c: any) => `${c.class}_${c.letter}` === cls)) {
           setCls(`${myClasses[0].class}_${myClasses[0].letter}`);
       }
   }, [myClasses, cls]);
   
   const availableSubjects = useMemo(() => {
        if (!cls) return [];
        const assigned = (state.teacherAssignments || []).filter((a: any) => a.teacherId === user.id && a.classId === cls && (!a.schoolId || !user.schoolId || a.schoolId === user.schoolId)).map((a: any) => a.subject).filter(Boolean);
        const schedule = H.getSchoolClassSchedule(state, user.schoolId, cls);
        if (schedule) {
            Object.values(schedule).forEach((d: any) => {
                (d.lessons || []).forEach((l: any) => {
                    if (l.teacherId === user.id && l.lesson) { assigned.push(l.lesson); }
                    if (l.subgroups) { l.subgroups.forEach((sg: any) => { if (sg.teacherId === user.id && sg.subject) { assigned.push(sg.subject); } }); }
                });
            });
        }
        if (assigned.length === 0 && user.subjects && user.subjects.length > 0) { return Array.from(new Set(user.subjects.filter(Boolean))); }
        if (assigned.length === 0) { return H.getSchoolSubjects(state, user.schoolId); }
        return Array.from(new Set(assigned.filter(Boolean)));
   }, [cls, state.teacherAssignments, user.id, user.subjects, state, user.schoolId]);

   const [subj, setSubj] = H.useSyncedState<string>(`eljur_hw_subj_${user.id}`, '');
   useEffect(() => { if (availableSubjects.length > 0 && !availableSubjects.includes(subj)) { setSubj(availableSubjects[0]); } }, [availableSubjects, subj]);

   const [date, setDate] = H.useSyncedState<string>(`eljur_hw_date_${user.id}`, '');
   const [text, setText] = useState('');
   const [files, setFiles] = useState<File[]>([]);
   const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
   const [lessonIndex, setLessonIndex] = H.useSyncedState<number>(`eljur_hw_lidx_${user.id}`, 0);
   const [historyClassFilter, setHistoryClassFilter] = H.useSyncedState<string>(`eljur_hw_hist_cls_${user.id}`, '');
   const [editId, setEditId] = useState<string | null>(null);
   const t = (k: string) => H.t(k, lang);

   const todayIso = H.dateToIso(H.getSchoolNow(state, user.schoolId));

   const validHWDates = useMemo(() => {
       if (!cls || !subj) return [];
       const schedule = H.getSchoolClassSchedule(state, user.schoolId, cls);
       if (!schedule) return [];
       const scheduleSettings = H.getSchoolScheduleSettings(state, user.schoolId);
       const dates = new Set<string>();
       Object.values(schedule).forEach((d: any) => {
           if (!d?.date) return;
           if (H.isHoliday(d.date, scheduleSettings) || H.getVacationForDay(d.date, scheduleSettings)) return;
           const hasSubject = (d.lessons || []).some((l:any) => { if (l.subgroups && l.subgroups.length > 0) { return l.subgroups.some((sg: any) => sg.subject === subj); } return l.lesson === subj; });
           if (hasSubject && d.date >= todayIso) { dates.add(d.date); }
       });
       return Array.from(dates).sort();
   }, [cls, subj, state, user.schoolId, state.settings.systemTimeOffset, todayIso]);

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
         return alert(t('cant_assign_hw_holiday_vacation'));
     }
     const currentTodayIso = H.dateToIso(H.getSchoolNow(state, user.schoolId));
     if (date < currentTodayIso && !editId) { return alert(t('cant_hw_past')); }
     const targetSchoolId = user.schoolId || 'school_1';
     const newAttachments: Attachment[] = [];
     for (const f of files) { const id = H.uid('att'); await DB.saveAsset(id, f.name, f.type, f, targetSchoolId); newAttachments.push({ id, name: f.name, type: f.type }); }
     const [c, l] = cls.split('_');
     let finalText = text;
     if (editId) {
        const idx = state.homework.findIndex((h:any) => h.id === editId);
        if (idx > -1) {
             const existing = state.homework[idx];
             const updatedHW: any = { ...existing, schoolId: existing.schoolId || targetSchoolId, class: c, letter: l, date, subject: subj, text: finalText, attachments: [...existingAttachments, ...newAttachments], lessonIndex: availableLessonCount > 1 ? lessonIndex : 0 };
             delete updatedHW.attachmentId;
             delete updatedHW.attachmentName;
             state.homework[idx] = updatedHW;
             await DB.saveSchoolEntity(targetSchoolId, 'homework', updatedHW.id, updatedHW);
        }
        setEditId(null);
     } else {
        const newHW = { id: H.uid('hw'), schoolId: targetSchoolId, class: c, letter: l, date, subject: subj, text: finalText, attachments: newAttachments, fromId: user.id, lessonIndex: availableLessonCount > 1 ? lessonIndex : 0 };
        state.homework.push(newHW);
        await DB.saveSchoolEntity(targetSchoolId, 'homework', newHW.id, newHW);
     }
     onUpdate({ ...state }); alert(t('saved')); setText(''); setFiles([]); setExistingAttachments([]);
   };

   const startEdit = (h: any) => {
      const currentTodayIso = H.dateToIso(H.getSchoolNow(state, user.schoolId));
      if (h.date < currentTodayIso) { alert(t('cant_hw_past')); return; }
      const initialAtts: Attachment[] = [...(h.attachments || [])];
      if (h.attachmentId && !initialAtts.some(a => a.id === h.attachmentId)) {
          initialAtts.push({ id: h.attachmentId, name: h.attachmentName || 'File', type: h.attachmentType || '' });
      }
      setExistingAttachments(initialAtts);
      setEditId(h.id); setCls(`${h.class}_${h.letter}`); setSubj(h.subject); setDate(h.date); setText(h.text); setLessonIndex(h.lessonIndex || 0); setFiles([]); window.scrollTo({ top: 0, behavior: 'smooth' });
   };

   const deleteHW = (id: string) => {
      const h = state.homework.find((x:any) => x.id === id);
      if (h) {
          const currentTodayIso = H.dateToIso(H.getSchoolNow(state, user.schoolId));
          if (h.date < currentTodayIso) { alert(t('cant_hw_past')); return; }
      }
      if(!confirm(t('confirm_delete'))) return;
      state.homework = state.homework.filter((h:any) => h.id !== id);
      DB.deleteSchoolEntity(user.schoolId || 'school_1', 'homework', id).catch(() => {});
      onUpdate({ ...state });
   };

   const filteredHistory = [...(state.homework || [])]
     .filter((h: any) => h.fromId === user.id && (!h.schoolId || !user.schoolId || h.schoolId === user.schoolId))
     .filter((h: any) => historyClassFilter ? `${h.class}_${h.letter}` === historyClassFilter : true)
     .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));

   return (
     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
        <Card className="p-3.5 sm:p-8 shadow-soft h-fit">
           <h3 className="font-bold text-base sm:text-xl mb-2.5 sm:mb-6 text-slate-800 dark:text-white">{editId ? t('edit') : t('add')} {t('homework')}</h3>
           {editId && <div className="text-xs sm:text-sm bg-yellow-50 text-yellow-800 p-2 mb-2.5 rounded border border-yellow-200">{t('editing')}... <button className="underline font-bold" onClick={() => { setEditId(null); setText(''); setFiles([]); setExistingAttachments([]); }}>{t('cancel')}</button></div>}
           <div className="space-y-2.5 sm:space-y-5">
              <div className="grid grid-cols-2 gap-2.5 sm:gap-6">
                 <div><label className="text-xs sm:text-sm font-bold text-slate-600 mb-1 sm:mb-2 block dark:text-slate-300">{t('class')}</label><Select value={cls} onChange={e => { setCls(e.target.value); setDate(''); }}>{myClasses.map((c: any) => <option key={`${c.class}_${c.letter}`} value={`${c.class}_${c.letter}`}>{c.class}{c.letter}</option>)}</Select></div>
                 <div><label className="text-xs sm:text-sm font-bold text-slate-600 mb-1 sm:mb-2 block dark:text-slate-300">{t('subject')}</label><Select value={subj} onChange={e => { setSubj(e.target.value); setDate(''); }}>{availableSubjects.map((s: string) => <option key={s} value={s}>{s}</option>)}</Select></div>
              </div>
              <div><label className="text-xs sm:text-sm font-bold text-slate-600 mb-1 sm:mb-2 block dark:text-slate-300">{t('submit_hw')}</label><div className="relative"><Select value={date} onChange={e => setDate(e.target.value)} disabled={validHWDates.length === 0}><option value="">-- {t('select_date')} --</option>{validHWDates.map(d => (<option key={d} value={d}>{H.formatDateDDMMYYYY(d)} ({H.getDayOfWeek(d, lang)})</option>))}</Select>{validHWDates.length === 0 && <div className="absolute inset-0 z-10" onClick={() => alert(cls && subj ? (lang === 'en' ? `There are no future lessons for "${subj}" in this class schedule.` : `В расписании этого класса нет будущих уроков по предмету «${subj}».`) : t('list_empty'))} />}</div></div>
              {availableLessonCount > 1 && (<div className="bg-blue-50 p-2.5 sm:p-3 rounded-lg border border-blue-100 dark:bg-blue-900/20 dark:border-blue-800"><label className="text-xs sm:text-sm font-bold text-blue-800 mb-1.5 sm:mb-2 block dark:text-blue-300">{t('select_lesson_found')} ({availableLessonCount})</label><Select value={lessonIndex} onChange={e => setLessonIndex(parseInt(e.target.value))}>{Array.from({length: availableLessonCount}).map((_, i) => (<option key={i} value={i}>{i + 1} {t('lesson_order')}</option>))}</Select></div>)}
              <div>
                <div className="flex justify-between items-center mb-1 sm:mb-2">
                  <label className="text-xs sm:text-sm font-bold text-slate-600 block dark:text-slate-300">{t('hw_text')}</label>
                  <span className="text-[10px] sm:text-xs text-slate-400 font-mono">{text.length}/3000</span>
                </div>
                <textarea maxLength={3000} className="block w-full border border-slate-300 rounded-xl p-2.5 sm:p-4 h-24 sm:h-40 focus:ring-blue-500 focus:border-blue-500 text-xs sm:text-sm shadow-sm bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-slate-200 break-words [overflow-wrap:anywhere]" value={text} onChange={e => setText(e.target.value.slice(0, 3000))} placeholder="..." />
              </div>
              {editId && existingAttachments.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400">
                    {lang === 'ru' ? 'Прикреплённые файлы:' : 'Attached files:'}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {existingAttachments.map(att => (
                      <div key={att.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200">
                        <span className="truncate max-w-[180px] font-medium">{att.name}</span>
                        <button
                          type="button"
                          onClick={() => setExistingAttachments(prev => prev.filter(a => a.id !== att.id))}
                          className="text-red-500 hover:text-red-700 font-bold ml-1"
                          title={t('delete')}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <MultiFileUploader files={files} onFilesChange={setFiles} lang={lang} />
              <Button variant="primary" onClick={submitHW} className="w-full py-2 sm:py-3 text-xs sm:text-base">{t('save_hw')}</Button>
           </div>
        </Card>
        <div className="space-y-3 sm:space-y-6">
           <div className="flex justify-between items-center"><h4 className="font-bold text-slate-700 ml-1 text-sm sm:text-lg dark:text-white">{t('history')}</h4><Select className="w-36 sm:w-40 text-xs" value={historyClassFilter} onChange={e => setHistoryClassFilter(e.target.value)}><option value="">{t('all_classes')}</option>{myClasses.map((c: any) => <option key={`${c.class}_${c.letter}`} value={`${c.class}_${c.letter}`}>{c.class}{c.letter}</option>)}</Select></div>
           <div className="space-y-2.5 sm:space-y-4">
             {filteredHistory.map((h: any) => {
               const lIdxLabel = (h.lessonIndex !== undefined && h.lessonIndex > 0) ? ` (${t('lesson_order')} ${h.lessonIndex + 1})` : '';
               const isPast = (h.date || '') < todayIso;
               return (
               <Card key={h.id} className="p-3 sm:p-5 text-xs sm:text-sm border-l-4 sm:border-l-[6px] border-l-blue-400 dark:border-l-blue-600">
                  <div className="flex justify-between items-center mb-1.5 sm:mb-3 gap-2 min-w-0"><div className="font-bold text-slate-800 text-xs sm:text-base truncate dark:text-white min-w-0">{h.subject}{lIdxLabel}</div><div className="flex items-center gap-1.5 shrink-0"><div className="text-[10px] sm:text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full dark:bg-slate-800 dark:text-slate-400">{h.class}{h.letter} • {H.formatDateDDMMYYYY(h.date)}</div>{!isPast && (<><button onClick={() => startEdit(h)} className="text-blue-500 hover:text-blue-700"><Edit size={13}/></button><button onClick={() => deleteHW(h.id)} className="text-red-500 hover:text-red-700"><Trash2 size={13}/></button></>)}{isPast && <span title={t('past_edit_forbidden')} className="text-slate-300 cursor-not-allowed"><Edit size={13}/></span>}</div></div>
                  <p className="text-slate-600 whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed dark:text-slate-300">{h.text}</p>
                  {((h.attachments || []).length > 0 || h.attachmentId) && (<div className="mt-2.5 sm:mt-4 pt-2 sm:pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-1">{h.attachmentId && <FileDisplay id={h.attachmentId} name={h.attachmentName} schoolId={h.schoolId || user.schoolId} lang={lang} />}{(h.attachments || []).map((att: Attachment) => (<FileDisplay key={att.id} id={att.id} name={att.name} schoolId={h.schoolId || user.schoolId} lang={lang} />))}</div>)}
               </Card>
             )})}
           </div>
        </div>
     </div>
   );
};
