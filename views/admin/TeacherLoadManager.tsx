
import React, { useState } from 'react';
import { AppState, TeacherAssignment } from '../../types';
import * as H from '../../utils/helpers';
import { Button, Select, Card, Modal } from '../../components/ui';
import { Briefcase, Copy, ChevronUp, ChevronDown, RefreshCw, X as XIcon } from 'lucide-react';

export const TeacherLoadManager = ({ state, onUpdate, user }: { state: AppState, onUpdate: (s: AppState) => void, user?: User }) => {
    const schoolId = user?.schoolId;
    const teachers = state.users.filter(u => u.role === 'teacher' && (schoolId ? u.schoolId === schoolId : true)).sort((a,b) => a.fio.localeCompare(b.fio));
    const schoolClasses = H.getSchoolClasses(state, schoolId);
    const schoolSubjects = H.getSchoolSubjects(state, schoolId);
    const [expandedTeacher, setExpandedTeacher] = useState<string | null>(null);
    const [newAssignClass, setNewAssignClass] = useState(schoolClasses[0] ? `${schoolClasses[0].class}_${schoolClasses[0].letter}` : '');
    const [newAssignSubject, setNewAssignSubject] = useState(schoolSubjects[0] || 'Русский язык');
    const lang = state.settings.language || 'ru';
    const t = (k: string) => H.t(k, lang);
    const [confirmSync, setConfirmSync] = useState<{isOpen: boolean, type: 'all' | 'single', teacherId?: string, count?: number} | null>(null);

    const syncTeacherClasses = (teacherId: string) => {
        const uIndex = state.users.findIndex(u => u.id === teacherId);
        if (uIndex > -1) {
            const currentAssignments = state.teacherAssignments.filter(a => a.teacherId === teacherId);
            const assignedKeys = currentAssignments.map(a => a.classId);
            // MERGE existing classes with new ones from load, do NOT delete old ones
            const existingKeys = state.users[uIndex].classes || [];
            const mergedKeys = Array.from(new Set([...existingKeys, ...assignedKeys]));
            mergedKeys.sort();
            state.users[uIndex].classes = mergedKeys;
        }
    };
    const calculateSyncData = (teacherId?: string) => {
        let addedCount = 0;
        const newAssignments: TeacherAssignment[] = [];
        schoolClasses.forEach(c => {
            const classKey = `${c.class}_${c.letter}`;
            const scheduleDays = H.getSchoolClassSchedule(state, schoolId, classKey);
            Object.values(scheduleDays).forEach(day => {
                day.lessons.forEach(l => {
                    const checkAndAdd = (subj: string, tId: string) => {
                         if (teacherId && tId !== teacherId) return;
                         if (tId && subj) {
                             const exists = state.teacherAssignments.some(a => a.teacherId === tId && a.classId === classKey && a.subject === subj);
                             const alreadyAdded = newAssignments.some(a => a.teacherId === tId && a.classId === classKey && a.subject === subj);
                             if (!exists && !alreadyAdded) {
                                 newAssignments.push({ id: H.uid('assign'), teacherId: tId, classId: classKey, subject: subj });
                                 addedCount++;
                             }
                         }
                    };
                    if (l.subgroups && l.subgroups.length > 0) {
                        l.subgroups.forEach(sg => checkAndAdd(sg.subject, sg.teacherId));
                    } else {
                        checkAndAdd(l.lesson, l.teacherId);
                    }
                });
            });
        });
        return { addedCount, newAssignments };
    };
    const requestSync = (type: 'all' | 'single', teacherId?: string) => {
        const { addedCount } = calculateSyncData(teacherId);
        setConfirmSync({ isOpen: true, type, teacherId, count: addedCount });
    };
    const executeSync = () => {
        if (!confirmSync) return;
        const { newAssignments } = calculateSyncData(confirmSync.teacherId);
        if (newAssignments.length > 0) {
            state.teacherAssignments.push(...newAssignments);
            const affectedTeachers = Array.from(new Set(newAssignments.map(a => a.teacherId)));
            affectedTeachers.forEach(tId => syncTeacherClasses(tId));
            onUpdate(state);
        }
        setConfirmSync(null);
    };
    const addAssignment = (teacherId: string) => {
        if (!newAssignClass || !newAssignSubject) return;
        if (state.teacherAssignments.some(a => a.teacherId === teacherId && a.classId === newAssignClass && a.subject === newAssignSubject)) {
            alert(t('already_exists'));
            return;
        }
        state.teacherAssignments.push({ id: H.uid('assign'), teacherId, classId: newAssignClass, subject: newAssignSubject });
        syncTeacherClasses(teacherId);
        onUpdate(state);
    };
    const removeAssignment = (id: string, teacherId: string) => {
        if (!confirm(t('delete_assignment_confirm'))) return;
        state.teacherAssignments = state.teacherAssignments.filter(a => a.id !== id);
        // Note: We don't remove class access when removing assignment to preserve history/manual edits
        onUpdate(state);
    };

    return (
        <Card className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-xl text-slate-800 dark:text-white flex items-center gap-2"><Briefcase size={20}/> {t('teacher_load')}</h3>
                <Button variant="secondary" onClick={() => requestSync('all')}><Copy size={16} className="mr-2"/> {t('sync_all')}</Button>
            </div>
            <div className="space-y-3">
                {teachers.map(teacher => {
                    const assignments = state.teacherAssignments.filter(a => a.teacherId === teacher.id);
                    const isExpanded = expandedTeacher === teacher.id;
                    return (
                        <div key={teacher.id} className="border border-slate-200 rounded-xl overflow-hidden dark:border-slate-700">
                            <div className={`p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${isExpanded ? 'bg-slate-50 dark:bg-slate-800' : 'bg-white dark:bg-slate-900'}`} onClick={() => setExpandedTeacher(isExpanded ? null : teacher.id)}>
                                <div className="font-bold text-slate-700 dark:text-slate-200">{teacher.fio}</div>
                                <div className="flex items-center gap-4 text-sm text-slate-500">
                                    <span className="bg-slate-100 px-2 py-0.5 rounded-full text-xs font-bold dark:bg-slate-800 dark:text-slate-400">{assignments.length} {t('items')}</span>
                                    {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                </div>
                            </div>
                            {isExpanded && (
                                <div className="p-4 bg-slate-50 border-t border-slate-200 dark:bg-slate-900/50 dark:border-slate-700 animate-in slide-in-from-top-2">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">{t('teachers_subjects')}</div>
                                        <Button variant="ghost" size="sm" onClick={() => requestSync('single', teacher.id)} className="text-blue-600 hover:text-blue-700 dark:text-blue-400 h-8">
                                            <RefreshCw size={14} className="mr-2"/> {t('sync')}
                                        </Button>
                                    </div>
                                    {assignments.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                                            {assignments.map(a => (
                                                <div key={a.id} className="flex justify-between items-center bg-white border border-slate-200 px-3 py-2.5 rounded-xl shadow-sm text-sm transition-all hover:border-blue-200 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-blue-900">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-blue-600 dark:text-blue-400">{a.classId.replace('_','')}</span>
                                                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                        <span className="text-slate-700 dark:text-slate-300 truncate max-w-[120px]" title={a.subject}>{a.subject}</span>
                                                    </div>
                                                    <button onClick={() => removeAssignment(a.id, teacher.id)} className="text-slate-300 hover:text-red-500 transition-colors"><XIcon size={14}/></button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-slate-400 text-sm mb-6 italic">{t('no_assignments')}</p>}
                                    <div className="flex flex-wrap gap-3 items-end p-4 bg-white rounded-2xl border border-dashed border-slate-300 dark:bg-slate-900 dark:border-slate-700">
                                        <div className="flex-1 min-w-[120px]">
                                            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block">{t('class')}</label>
                                            <Select className="h-10 py-1 text-sm" value={newAssignClass} onChange={e => setNewAssignClass(e.target.value)}>
                                                {schoolClasses.map(c => <option key={`${c.class}_${c.letter}`} value={`${c.class}_${c.letter}`}>{c.class}{c.letter}</option>)}
                                            </Select>
                                        </div>
                                        <div className="flex-[2] min-w-[180px]">
                                            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block">{t('subject')}</label>
                                            <Select className="h-10 py-1 text-sm" value={newAssignSubject} onChange={e => setNewAssignSubject(e.target.value)}>
                                                {schoolSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                                            </Select>
                                        </div>
                                        <Button size="md" onClick={() => addAssignment(teacher.id)} className="px-6 h-10">{t('add_subject')}</Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <Modal isOpen={!!confirmSync} onClose={() => setConfirmSync(null)} title={t('confirm_sync_title')}>
                 <div className="text-center py-4">
                     <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                         <RefreshCw size={24} />
                     </div>
                     <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
                         {confirmSync?.type === 'all' ? t('sync_all_teachers') : t('sync_single_teacher')}
                     </h4>
                     <p className="text-slate-600 dark:text-slate-300 mb-6">
                         {t('scan_schedule_msg')} <strong>{confirmSync?.count || 0}</strong> {t('new_items')}
                         {confirmSync?.count === 0 ? ` ${t('no_update_needed')}` : ` ${t('add_them_q')}`}
                     </p>
                     <div className="flex gap-3 justify-center">
                         <Button onClick={() => setConfirmSync(null)} variant="ghost">{t('cancel')}</Button>
                         <Button onClick={executeSync} disabled={!confirmSync?.count} variant="primary">
                             {confirmSync?.count ? t('confirm') : t('close')}
                         </Button>
                     </div>
                 </div>
            </Modal>
        </Card>
    );
};
