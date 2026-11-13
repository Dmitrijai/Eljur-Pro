import React, { useState } from 'react';
import { AppState, TeacherAssignment, User } from '../../types';
import * as H from '../../utils/helpers';
import { Button, Select, Card, Modal } from '../../components/ui';
import { Briefcase, Copy, ChevronUp, ChevronDown, RefreshCw, X as XIcon, AlertCircle } from 'lucide-react';

export const TeacherLoadManager = ({ state, onUpdate, user }: { state: AppState, onUpdate: (s: AppState) => void, user?: User }) => {
    const schoolId = user?.schoolId;
    const teachers = state.users.filter(u => H.isUserTeacherCapable(u) && (schoolId ? u.schoolId === schoolId : true)).sort((a,b) => a.fio.localeCompare(b.fio));
    const schoolClasses = H.getSchoolClasses(state, schoolId);
    const schoolSubjects = H.getSchoolSubjects(state, schoolId);
    const defaultClass = schoolClasses[0] ? `${schoolClasses[0].class}_${schoolClasses[0].letter}` : '';
    const defaultSubject = schoolSubjects[0] || 'Русский язык';
    const uidKey = user?.id || 'admin';
    const [expandedTeacher, setExpandedTeacher] = H.useSyncedState<string | null>(`eljur_tlm_exp_${uidKey}`, null);
    const [assignClassByTeacher, setAssignClassByTeacher] = H.useSyncedState<Record<string, string>>(`eljur_tlm_cls_${uidKey}`, {});
    const [assignSubjByTeacher, setAssignSubjByTeacher] = H.useSyncedState<Record<string, string>>(`eljur_tlm_subj_${uidKey}`, {});
    const [teacherError, setTeacherError] = useState<{ teacherId: string, msg: string } | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const lang = state.settings.language || 'ru';
    const t = (k: string) => H.t(k, lang);
    const [confirmSync, setConfirmSync] = useState<{isOpen: boolean, type: 'all' | 'single', teacherId?: string, count?: number} | null>(null);

    const getTeacherClass = (teacherId: string) => {
        const val = assignClassByTeacher[teacherId];
        if (val && schoolClasses.some(c => `${c.class}_${c.letter}` === val)) return val;
        return defaultClass;
    };

    const getTeacherSubj = (teacherId: string) => {
        const val = assignSubjByTeacher[teacherId];
        if (val && schoolSubjects.includes(val)) return val;
        return defaultSubject;
    };

    const syncTeacherClasses = (teacherId: string) => {
        const uIndex = state.users.findIndex(u => u.id === teacherId);
        if (uIndex > -1) {
            const currentAssignments = state.teacherAssignments.filter(a => a.teacherId === teacherId && (!a.schoolId || !schoolId || a.schoolId === schoolId));
            const assignedKeys = currentAssignments.map(a => a.classId);
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
                             const exists = state.teacherAssignments.some(a => a.teacherId === tId && a.classId === classKey && a.subject === subj && (!a.schoolId || !schoolId || a.schoolId === schoolId));
                             const alreadyAdded = newAssignments.some(a => a.teacherId === tId && a.classId === classKey && a.subject === subj);
                             if (!exists && !alreadyAdded) {
                                 newAssignments.push({ id: H.uid('assign'), schoolId, teacherId: tId, classId: classKey, subject: subj });
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
        const targetClass = getTeacherClass(teacherId);
        const targetSubj = getTeacherSubj(teacherId);
        if (!targetClass || !targetSubj) return;
        if (state.teacherAssignments.some(a => a.teacherId === teacherId && a.classId === targetClass && a.subject === targetSubj && (!a.schoolId || !schoolId || a.schoolId === schoolId))) {
            setTeacherError({ teacherId, msg: t('already_exists') });
            setTimeout(() => setTeacherError(null), 3000);
            return;
        }
        setTeacherError(null);
        state.teacherAssignments.push({ id: H.uid('assign'), schoolId, teacherId, classId: targetClass, subject: targetSubj });
        syncTeacherClasses(teacherId);
        onUpdate(state);
    };
    const confirmRemoveAssignment = () => {
        if (!deleteConfirmId) return;
        state.teacherAssignments = state.teacherAssignments.filter(a => a.id !== deleteConfirmId);
        setDeleteConfirmId(null);
        onUpdate(state);
    };

    return (
        <Card className="p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3 mb-3 sm:mb-6">
                <h3 className="font-bold text-base sm:text-xl text-slate-800 dark:text-white flex items-center gap-1.5 sm:gap-2"><Briefcase size={16} className="sm:w-5 sm:h-5"/> {t('teacher_load')}</h3>
                <Button variant="secondary" size="sm" onClick={() => requestSync('all')} className="w-full sm:w-auto h-8 sm:h-10 text-xs sm:text-sm px-3 sm:px-4"><Copy size={13} className="mr-1.5 sm:w-4 sm:h-4"/> {t('sync_all')}</Button>
            </div>
            <div className="space-y-2 sm:space-y-3">
                {teachers.map(teacher => {
                    const validClassKeys = new Set(schoolClasses.map(c => `${c.class}_${c.letter}`));
                    const assignments = state.teacherAssignments.filter(a => a.teacherId === teacher.id && (!a.schoolId || !schoolId || a.schoolId === schoolId) && validClassKeys.has(a.classId));
                    const isExpanded = expandedTeacher === teacher.id;
                    const currentClass = getTeacherClass(teacher.id);
                    const currentSubj = getTeacherSubj(teacher.id);
                    return (
                        <div key={teacher.id} className="border border-slate-200 rounded-lg sm:rounded-xl overflow-hidden dark:border-slate-700">
                            <div className={`p-2.5 sm:p-4 flex flex-nowrap justify-between items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${isExpanded ? 'bg-slate-50 dark:bg-slate-800' : 'bg-white dark:bg-slate-900'}`} onClick={() => setExpandedTeacher(isExpanded ? null : teacher.id)}>
                                <div className="font-bold text-xs sm:text-base text-slate-700 dark:text-slate-200 flex flex-nowrap items-center gap-1.5 sm:gap-2 min-w-0 flex-1 overflow-hidden">
                                    <span className="truncate shrink-0">{H.formatShortName(teacher.fio)}</span>
                                    {teacher.role === 'employee' && (
                                        <span
                                            title={teacher.customRole || t('employee')}
                                            className="text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800 truncate max-w-[115px] sm:max-w-[240px]"
                                        >
                                            {H.formatShortPosition(teacher.customRole || t('employee'))}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 sm:gap-3 text-xs sm:text-sm text-slate-500 shrink-0 whitespace-nowrap">
                                    <span className="bg-slate-100 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold dark:bg-slate-800 dark:text-slate-400">{assignments.length} {t('items')}</span>
                                    {isExpanded ? <ChevronUp size={14} className="sm:w-4 sm:h-4 shrink-0"/> : <ChevronDown size={14} className="sm:w-4 sm:h-4 shrink-0"/>}
                                </div>
                            </div>
                            {isExpanded && (
                                <div className="p-2.5 sm:p-4 bg-slate-50 border-t border-slate-200 dark:bg-slate-900/50 dark:border-slate-700 animate-in slide-in-from-top-2">
                                    <div className="flex justify-between items-center mb-2 sm:mb-4">
                                        <div className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wide">{t('teachers_subjects')}</div>
                                        <Button variant="ghost" size="sm" onClick={() => requestSync('single', teacher.id)} className="text-blue-600 hover:text-blue-700 dark:text-blue-400 h-7 sm:h-8 px-2 sm:px-3 text-[11px] sm:text-xs">
                                            <RefreshCw size={12} className="mr-1 sm:mr-2 sm:w-3.5 sm:h-3.5"/> {t('sync')}
                                        </Button>
                                    </div>
                                    {teacherError?.teacherId === teacher.id && (
                                        <div className="mb-2.5 p-2 rounded-lg bg-red-50 text-red-600 border border-red-200 text-xs font-bold flex items-center gap-1.5">
                                            <AlertCircle size={14} /> {teacherError.msg}
                                        </div>
                                    )}
                                    {assignments.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 sm:gap-3 mb-3 sm:mb-6">
                                            {assignments.map(a => (
                                                <div key={a.id} className="flex justify-between items-center bg-white border border-slate-200 px-2.5 py-1.5 sm:px-3 sm:py-2.5 rounded-lg sm:rounded-xl shadow-xs text-xs sm:text-sm transition-all hover:border-blue-200 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-blue-900">
                                                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                                        <span className="font-bold text-blue-600 dark:text-blue-400 shrink-0">{a.classId.replace('_','')}</span>
                                                        <span className="w-1 h-1 bg-slate-300 rounded-full shrink-0"></span>
                                                        <span className="text-slate-700 dark:text-slate-300 truncate max-w-[140px] sm:max-w-[120px]" title={a.subject}>{a.subject}</span>
                                                    </div>
                                                    <button onClick={() => setDeleteConfirmId(a.id)} className="text-slate-300 hover:text-red-500 transition-colors p-0.5 shrink-0"><XIcon size={13} className="sm:w-3.5 sm:h-3.5"/></button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-slate-400 text-xs sm:text-sm mb-3 sm:mb-6 italic">{t('no_assignments')}</p>}
                                    <div className="flex flex-wrap gap-2 sm:gap-3 items-end p-2.5 sm:p-4 bg-white rounded-xl sm:rounded-2xl border border-dashed border-slate-300 dark:bg-slate-900 dark:border-slate-700">
                                        <div className="w-24 sm:flex-1 sm:min-w-[120px]">
                                            <label className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 mb-1 sm:mb-1.5 block">{t('class')}</label>
                                            <Select className="h-8 sm:h-10 py-0.5 sm:py-1 text-xs sm:text-sm" value={currentClass} onChange={e => setAssignClassByTeacher(prev => ({ ...prev, [teacher.id]: e.target.value }))}>
                                                {schoolClasses.map(c => <option key={`${c.class}_${c.letter}`} value={`${c.class}_${c.letter}`}>{c.class}{c.letter}</option>)}
                                            </Select>
                                        </div>
                                        <div className="flex-1 min-w-[130px] sm:flex-[2] sm:min-w-[180px]">
                                            <label className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 mb-1 sm:mb-1.5 block">{t('subject')}</label>
                                            <Select className="h-8 sm:h-10 py-0.5 sm:py-1 text-xs sm:text-sm" value={currentSubj} onChange={e => setAssignSubjByTeacher(prev => ({ ...prev, [teacher.id]: e.target.value }))}>
                                                {schoolSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                                            </Select>
                                        </div>
                                        <Button size="sm" onClick={() => addAssignment(teacher.id)} className="w-full sm:w-auto px-4 sm:px-6 h-8 sm:h-10 text-xs sm:text-sm">{t('add_subject')}</Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <Modal isOpen={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title={t('teacher_load')}>
                <div className="space-y-4">
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">{t('delete_assignment_confirm')}</p>
                    <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmId(null)}>{t('cancel')}</Button>
                        <Button size="sm" variant="danger" onClick={confirmRemoveAssignment}>{t('delete')}</Button>
                    </div>
                </div>
            </Modal>
            <Modal isOpen={!!confirmSync} onClose={() => setConfirmSync(null)} title={t('confirm_sync_title')}>
                 <div className="text-center py-2 sm:py-4">
                     <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2.5 sm:mb-4">
                         <RefreshCw size={20} className="sm:w-6 sm:h-6" />
                     </div>
                     <h4 className="text-sm sm:text-lg font-bold text-slate-800 dark:text-white mb-1.5 sm:mb-2">
                         {confirmSync?.type === 'all' ? t('sync_all_teachers') : t('sync_single_teacher')}
                     </h4>
                     <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mb-4 sm:mb-6">
                         {t('scan_schedule_msg')} <strong>{confirmSync?.count || 0}</strong> {t('new_items')}
                         {confirmSync?.count === 0 ? ` ${t('no_update_needed')}` : ` ${t('add_them_q')}`}
                     </p>
                     <div className="flex gap-2 sm:gap-3 justify-center">
                         <Button size="sm" onClick={() => setConfirmSync(null)} variant="ghost" className="h-8 sm:h-10 text-xs sm:text-sm">{t('cancel')}</Button>
                         <Button size="sm" onClick={executeSync} disabled={!confirmSync?.count} variant="primary" className="h-8 sm:h-10 text-xs sm:text-sm">
                             {confirmSync?.count ? t('confirm') : t('close')}
                         </Button>
                     </div>
                 </div>
            </Modal>
        </Card>
    );
};
