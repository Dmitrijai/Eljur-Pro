import React, { useState, useEffect } from 'react';
import { AppState } from '../../types';
import * as H from '../../utils/helpers';
import { Button, Input, Select, Card, Modal } from '../../components/ui';
import { Layers, ArrowLeft, ArrowRight, UserPlus } from 'lucide-react';

export const GroupManager = ({ state, onUpdate, user }: { state: AppState, onUpdate: (s: AppState) => void, user: import("../../types").User }) => {
    const schoolClasses = H.getSchoolClasses(state, user.schoolId);
    const [selectedClass, setSelectedClass] = useState(schoolClasses[0] ? `${schoolClasses[0].class}_${schoolClasses[0].letter}` : '');
    const [groupCount, setGroupCount] = useState(2);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const lang = state.settings.language || 'ru';
    const t = (k: string) => H.t(k, lang);

    useEffect(() => {
        if (schoolClasses.length > 0 && !schoolClasses.some(c => `${c.class}_${c.letter}` === selectedClass)) {
            setSelectedClass(`${schoolClasses[0].class}_${schoolClasses[0].letter}`);
        }
    }, [schoolClasses, selectedClass]);

    const classStudents = state.users.filter(u => u.schoolId === user.schoolId && u.role === 'student' && `${u.class}_${u.letter}` === selectedClass).sort((a,b) => a.fio.localeCompare(b.fio));
    const existingGroups = H.getSchoolStudentGroups(state, user.schoolId, selectedClass);
    const unassignedStudents = existingGroups.length > 0
        ? classStudents.filter(s => !existingGroups.some(g => g.studentIds.includes(s.id)))
        : [];

    const executeGenerateGroups = () => {
        state.studentGroups = (state.studentGroups || []).filter(g => {
            const isTargetClass = g.classId === selectedClass;
            const isThisSchool = g.schoolId ? g.schoolId === user.schoolId : classStudents.some(cs => g.studentIds.includes(cs.id));
            return !(isTargetClass && isThisSchool);
        });
        const count = Math.max(2, groupCount || 2);
        const chunkSize = Math.ceil(classStudents.length / count);
        for (let i = 0; i < count; i++) {
            const groupStudents = classStudents.slice(i * chunkSize, (i + 1) * chunkSize).map(u => u.id);
            state.studentGroups.push({ id: H.uid('group'), schoolId: user.schoolId, classId: selectedClass, name: `${t('subgroup_label')} ${i + 1}`, studentIds: groupStudents });
        }
        setShowConfirmModal(false);
        onUpdate(state);
    };

    const assignStudentToGroup = (studentId: string, groupId: string) => {
        const target = (state.studentGroups || []).find(g => g.id === groupId && (!g.schoolId || g.schoolId === user.schoolId));
        if (target && !target.studentIds.includes(studentId)) {
            target.studentIds.push(studentId);
            onUpdate(state);
        }
    };

    const moveStudent = (studentId: string, fromGroupId: string, direction: 'left' | 'right') => {
        const groups = H.getSchoolStudentGroups(state, user.schoolId, selectedClass);
        const currentIdx = groups.findIndex(g => g.id === fromGroupId);
        if (currentIdx === -1) return;
        const targetIdx = direction === 'left' ? currentIdx - 1 : currentIdx + 1;
        if (targetIdx < 0 || targetIdx >= groups.length) return;
        const targetGroup = groups[targetIdx];
        const currentGroup = groups[currentIdx];
        const sIndex = currentGroup.studentIds.indexOf(studentId);
        if (sIndex > -1) {
            currentGroup.studentIds.splice(sIndex, 1);
            targetGroup.studentIds.push(studentId);
            onUpdate(state);
        }
    };
    const renameGroup = (gId: string, newName: string) => {
        const g = (state.studentGroups || []).find(x => x.id === gId && (!x.schoolId || x.schoolId === user.schoolId));
        if (g) { g.name = newName; onUpdate(state); }
    };

    return (
        <Card className="p-3 sm:p-6">
            <h3 className="font-bold text-base sm:text-xl text-slate-800 dark:text-white mb-3 sm:mb-6 flex items-center gap-1.5 sm:gap-2"><Layers size={16} className="sm:w-5 sm:h-5"/> {t('group_separation')}</h3>
            <div className="flex flex-wrap gap-2.5 sm:gap-4 items-end mb-4 sm:mb-8 bg-slate-50 p-2.5 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-700">
                <div>
                    <label className="block text-[11px] sm:text-sm font-bold text-slate-600 mb-1 sm:mb-2 dark:text-slate-300">{t('class')}</label>
                    <Select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-24 sm:w-32 h-8 sm:h-10 text-xs sm:text-sm">
                        {schoolClasses.map(c => <option key={`${c.class}_${c.letter}`} value={`${c.class}_${c.letter}`}>{c.class}{c.letter}</option>)}
                    </Select>
                </div>
                <div>
                    <label className="block text-[11px] sm:text-sm font-bold text-slate-600 mb-1 sm:mb-2 dark:text-slate-300">{t('group_count_label')}</label>
                    <Input type="number" min="2" max="5" value={isNaN(groupCount) ? '' : groupCount} onChange={e => setGroupCount(parseInt(e.target.value) || 2)} className="w-20 sm:w-24 h-8 sm:h-10 text-xs sm:text-sm" />
                </div>
                <Button onClick={() => existingGroups.length > 0 ? setShowConfirmModal(true) : executeGenerateGroups()} variant="primary" size="sm" className="h-8 sm:h-10 px-4 sm:px-8 text-xs sm:text-sm w-full sm:w-auto">{t('generate')}</Button>
            </div>

            {unassignedStudents.length > 0 && (
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl sm:rounded-2xl">
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-amber-800 dark:text-amber-300 mb-2.5">
                        <UserPlus size={15} />
                        <span>{lang === 'ru' ? `Нераспределённые ученики (${unassignedStudents.length})` : `Unassigned students (${unassignedStudents.length})`}</span>
                    </div>
                    <div className="space-y-1.5 sm:space-y-2">
                        {unassignedStudents.map(st => (
                            <div key={st.id} className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-amber-100 dark:border-slate-800">
                                <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">{H.formatShortName(st.fio)}</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {existingGroups.map(g => (
                                        <button
                                            key={g.id}
                                            type="button"
                                            onClick={() => assignStudentToGroup(st.id, g.id)}
                                            className="px-2 py-1 text-[10px] sm:text-xs font-bold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800 transition"
                                        >
                                            + {g.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {existingGroups.length > 0 ? (
                <div className="flex gap-2.5 sm:gap-4 overflow-x-auto pb-2 sm:pb-4 custom-scrollbar">
                    {existingGroups.map((g, idx) => (
                        <div key={g.id} className="flex-1 min-w-[200px] sm:min-w-[280px] bg-white border border-slate-200 rounded-xl sm:rounded-2xl shadow-xs flex flex-col dark:bg-slate-900 dark:border-slate-700 overflow-hidden">
                            <div className="p-2 sm:p-3 border-b border-slate-100 bg-slate-50/80 dark:bg-slate-800 dark:border-slate-700">
                                <Input className="font-bold text-center h-7 sm:h-9 text-xs sm:text-sm bg-white border-slate-200 shadow-none focus:ring-2 focus:ring-blue-500/20" value={g.name} onChange={e => renameGroup(g.id, e.target.value)} />
                                <div className="text-center text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 sm:mt-2">{g.studentIds.length} {t('students_count_suffix')}</div>
                            </div>
                            <div className="p-2 sm:p-3 flex-1 space-y-1 sm:space-y-1.5 max-h-[340px] sm:max-h-[500px] overflow-y-auto custom-scrollbar">
                                {g.studentIds.map(sId => {
                                    const st = state.users.find(u => u.id === sId);
                                    return (
                                        <div key={sId} className="flex items-center justify-between p-1.5 sm:p-2.5 bg-slate-50 rounded-lg sm:rounded-xl border border-slate-100 text-xs sm:text-sm group hover:bg-blue-50 hover:border-blue-200 transition-all dark:bg-slate-900/50 dark:border-slate-800 dark:hover:bg-slate-800 dark:hover:border-blue-900">
                                            <button onClick={() => moveStudent(sId, g.id, 'left')} disabled={idx === 0} className="text-slate-300 hover:text-blue-500 disabled:opacity-0 p-0.5 sm:p-1 hover:bg-white rounded transition-colors"><ArrowLeft size={12} className="sm:w-3.5 sm:h-3.5"/></button>
                                            <span className="truncate font-semibold text-slate-700 dark:text-slate-300 px-1.5 sm:px-2">{st?.fio ? H.formatShortName(st.fio) : '???'}</span>
                                            <button onClick={() => moveStudent(sId, g.id, 'right')} disabled={idx === existingGroups.length - 1} className="text-slate-300 hover:text-blue-500 disabled:opacity-0 p-0.5 sm:p-1 hover:bg-white rounded transition-colors"><ArrowRight size={12} className="sm:w-3.5 sm:h-3.5"/></button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            ) : <div className="text-center py-10 sm:py-20 text-xs sm:text-base text-slate-400 border-2 border-dashed border-slate-200 rounded-xl sm:rounded-3xl dark:border-slate-800 font-medium italic">{t('groups_not_created')}</div>}

            <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} title={t('group_separation')}>
                <div className="space-y-4">
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">{t('replace_groups_confirm')}</p>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setShowConfirmModal(false)}>{t('cancel')}</Button>
                        <Button variant="primary" size="sm" onClick={executeGenerateGroups}>{t('confirm')}</Button>
                    </div>
                </div>
            </Modal>
        </Card>
    );
};
