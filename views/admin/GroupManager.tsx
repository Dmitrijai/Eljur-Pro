
import React, { useState } from 'react';
import { AppState } from '../../types';
import * as H from '../../utils/helpers';
import { Button, Input, Select, Card } from '../../components/ui';
import { Layers, ArrowLeft, ArrowRight } from 'lucide-react';

export const GroupManager = ({ state, onUpdate, user }: { state: AppState, onUpdate: (s: AppState) => void, user: import("../../types").User }) => {
    const schoolClasses = H.getSchoolClasses(state, user.schoolId);
    const [selectedClass, setSelectedClass] = useState(schoolClasses[0] ? `${schoolClasses[0].class}_${schoolClasses[0].letter}` : '');
    const [groupCount, setGroupCount] = useState(2);
    const lang = state.settings.language || 'ru';
    const t = (k: string) => H.t(k, lang);
    const classStudents = state.users.filter(u => u.schoolId === user.schoolId && u.role === 'student' && `${u.class}_${u.letter}` === selectedClass).sort((a,b) => a.fio.localeCompare(b.fio));
    const existingGroups = state.studentGroups.filter(g => g.classId === selectedClass);
    const generateGroups = () => {
        if (!confirm('Существующие группы для этого класса будут удалены. Создать новые?')) return;
        state.studentGroups = state.studentGroups.filter(g => g.classId !== selectedClass);
        const count = Math.max(2, groupCount);
        const chunkSize = Math.ceil(classStudents.length / count);
        for (let i = 0; i < count; i++) {
            const groupStudents = classStudents.slice(i * chunkSize, (i + 1) * chunkSize).map(u => u.id);
            state.studentGroups.push({ id: H.uid('group'), classId: selectedClass, name: `Группа ${i + 1}`, studentIds: groupStudents });
        }
        onUpdate(state);
    };
    const moveStudent = (studentId: string, fromGroupId: string, direction: 'left' | 'right') => {
        const groups = state.studentGroups.filter(g => g.classId === selectedClass);
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
        const g = state.studentGroups.find(x => x.id === gId);
        if (g) { g.name = newName; onUpdate(state); }
    };

    return (
        <Card className="p-6">
            <h3 className="font-bold text-xl text-slate-800 dark:text-white mb-6 flex items-center gap-2"><Layers size={20}/> {t('group_separation')}</h3>
            <div className="flex flex-wrap gap-4 items-end mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-700">
                <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2 dark:text-slate-300">{t('class')}</label>
                    <Select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-32">
                        {schoolClasses.map(c => <option key={`${c.class}_${c.letter}`} value={`${c.class}_${c.letter}`}>{c.class}{c.letter}</option>)}
                    </Select>
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2 dark:text-slate-300">{t('group_count_label')}</label>
                    <Input type="number" min="2" max="5" value={groupCount} onChange={e => setGroupCount(parseInt(e.target.value))} className="w-24" />
                </div>
                <Button onClick={generateGroups} variant="primary" className="h-10 px-8">{t('generate')}</Button>
            </div>
            {existingGroups.length > 0 ? (
                <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                    {existingGroups.map((g, idx) => (
                        <div key={g.id} className="flex-1 min-w-[280px] bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col dark:bg-slate-900 dark:border-slate-700 overflow-hidden">
                            <div className="p-3 border-b border-slate-100 bg-slate-50/80 dark:bg-slate-800 dark:border-slate-700">
                                <Input className="font-bold text-center h-9 bg-white border-slate-200 shadow-none focus:ring-2 focus:ring-blue-500/20" value={g.name} onChange={e => renameGroup(g.id, e.target.value)} />
                                <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">{g.studentIds.length} {t('students_count_suffix')}</div>
                            </div>
                            <div className="p-3 flex-1 space-y-1.5 max-h-[500px] overflow-y-auto custom-scrollbar">
                                {g.studentIds.map(sId => {
                                    const st = state.users.find(u => u.id === sId);
                                    return (
                                        <div key={sId} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-sm group hover:bg-blue-50 hover:border-blue-200 transition-all dark:bg-slate-900/50 dark:border-slate-800 dark:hover:bg-slate-800 dark:hover:border-blue-900">
                                            <button onClick={() => moveStudent(sId, g.id, 'left')} disabled={idx === 0} className="text-slate-300 hover:text-blue-500 disabled:opacity-0 p-1 hover:bg-white rounded transition-colors"><ArrowLeft size={14}/></button>
                                            <span className="truncate font-semibold text-slate-700 dark:text-slate-300 px-2">{st?.fio || '???'}</span>
                                            <button onClick={() => moveStudent(sId, g.id, 'right')} disabled={idx === existingGroups.length - 1} className="text-slate-300 hover:text-blue-500 disabled:opacity-0 p-1 hover:bg-white rounded transition-colors"><ArrowRight size={14}/></button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            ) : <div className="text-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl dark:border-slate-800 font-medium italic">{t('groups_not_created')}</div>}
        </Card>
    );
};
