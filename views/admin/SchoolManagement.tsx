import React, { useState } from 'react';
import { AppState, User } from '../../types';
import * as H from '../../utils/helpers';
import * as DB from '../../services/db';
import { generateSalt, hashPassword, verifyUserPasswordDetailed } from '../../utils/auth';
import { Button, Input, Card, Select } from '../../components/ui';
import { Edit, Trash2, AlertCircle, Save } from 'lucide-react';

export const SchoolManagement = ({ state, onUpdate, lang }: { state: AppState, onUpdate: (s: AppState) => void, lang: any }) => {
    const t = (k: string) => H.t(k, lang);
    const [newName, setNewName] = useState('');
    const [directorFio, setDirectorFio] = useState('');
    const [directorLogin, setDirectorLogin] = useState('');
    const [directorPass, setDirectorPass] = useState('');
    
    // Edit Mode State
    const [editSchoolId, setEditSchoolId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editDirectorId, setEditDirectorId] = useState('');
    const [editSchoolIdVal, setEditSchoolIdVal] = useState('');

    const [error, setError] = useState<string | null>(null);

    const addSchool = async () => {
        if (!newName.trim() || !directorFio.trim() || !directorLogin.trim() || !directorPass.trim()) {
            setError(t('fill_fields'));
            return;
        }

        const normLogin = directorLogin.trim().toLowerCase();
        const rawPass = directorPass.trim();
        for (const u of state.users) {
            if (u.login?.trim().toLowerCase() === normLogin) {
                setError(t('login_taken'));
                return;
            }
        }
        for (const u of state.users) {
            if (u.password && u.password.trim() === rawPass) {
                setError(t('password_used'));
                return;
            }
            const isMatch = await verifyUserPasswordDetailed(u, rawPass);
            if (isMatch.valid) {
                setError(t('password_used'));
                return;
            }
        }
        
        const schoolId = H.uid('school');
        const directorId = H.uid('u_dir');
        const salt = generateSalt();
        const passwordHash = await hashPassword(rawPass, salt);
        
        const newSchool = {
            id: schoolId,
            name: newName.trim(),
            directorId,
            classes: [{ class: '10', letter: 'А' }],
            subjects: [...H.DEFAULT_SUBJECTS],
            quarters: { Q1: [], Q2: [], Q3: [], Q4: [] },
            gradingSystem: { ...H.defaultGradingSystem },
            gradeTypes: H.getDefaultGradeTypes(),
            scheduleSettings: { ...H.defaultScheduleSettings }
        };
        const newDirector: User = {
            id: directorId,
            schoolId: schoolId,
            fio: directorFio.trim(),
            login: directorLogin.trim(),
            password: rawPass,
            passwordSalt: salt,
            passwordHash: passwordHash,
            role: 'director'
        };

        state.schools = [...state.schools, newSchool];
        state.users = [...state.users, newDirector];
        if (!state.userOrder) state.userOrder = [];
        state.userOrder = [...state.userOrder, directorId];
        try {
            const rawKnown = localStorage.getItem('eljur_known_school_ids');
            const parsedKnown = rawKnown ? JSON.parse(rawKnown) : ['school_1'];
            const nextKnown = Array.from(new Set([...(Array.isArray(parsedKnown) ? parsedKnown : []), schoolId]));
            localStorage.setItem('eljur_known_school_ids', JSON.stringify(nextKnown));
        } catch {}
        onUpdate({ ...state });
        DB.saveSchoolMetadata(schoolId, newSchool).catch(() => {});
        DB.saveSchoolEntity(schoolId, 'users', newDirector.id, newDirector).catch(() => {});
        DB.saveSchoolState(schoolId, state).catch(() => {});
        DB.saveSchoolCache(schoolId, state).catch(() => {});
        DB.saveSchoolCache('school_1', state).catch(() => {});
        
        setNewName(''); setDirectorFio(''); setDirectorLogin(''); setDirectorPass('');
        setError(null);
    };

    const deleteSchool = (schoolId: string, schoolName: string) => {
        if (!confirm(t('delete_school_confirm'))) return;
        
        const removedUserIds = new Set(state.users.filter(u => u.schoolId === schoolId).map(u => u.id));

        // 1. Remove users of this school
        state.users = state.users.filter(u => u.schoolId !== schoolId);
        state.userOrder = (state.userOrder || []).filter(uid => !removedUserIds.has(uid));

        // 2. Clean schedules
        if (state.schedules) {
            const prefix = `${schoolId}__`;
            Object.keys(state.schedules).forEach(key => {
                if (key.startsWith(prefix)) {
                    delete state.schedules[key];
                }
            });
        }

        // 3. Clean grades
        if (state.grades) {
            const prefix = `${schoolId}__`;
            Object.keys(state.grades).forEach(key => {
                if (key.startsWith(prefix)) {
                    delete state.grades[key];
                }
            });
        }

        // 4. Clean finalGrades
        if (state.finalGrades) {
            const prefix = `${schoolId}__`;
            Object.keys(state.finalGrades).forEach(key => {
                if (key.startsWith(prefix)) {
                    delete state.finalGrades[key];
                }
            });
        }

        // 5. Clean homework
        if (state.homework) {
            state.homework = state.homework.filter(h => h.schoolId !== schoolId && !removedUserIds.has(h.fromId));
        }

        // 6. Clean teacher assignments
        if (state.teacherAssignments) {
            state.teacherAssignments = state.teacherAssignments.filter(a => a.schoolId !== schoolId && !removedUserIds.has(a.teacherId));
        }

        // 7. Clean student groups
        if (state.studentGroups) {
            state.studentGroups = state.studentGroups.filter(g => g.schoolId !== schoolId && !g.studentIds.some(sid => removedUserIds.has(sid)));
        }

        // 8. Clean announcements
        if (state.announcements) {
            state.announcements = state.announcements.filter(a => a.schoolId !== schoolId);
        }

        // 9. Clean messages involving removed users or school
        if (state.messages) {
            state.messages = state.messages.filter(m => !removedUserIds.has(m.fromId) && !m.toIds?.some(tid => removedUserIds.has(tid)) && m.schoolId !== schoolId);
        }

        // 10. Clean school settings
        if (state.settings && (state.settings as any).schoolsSettings) {
            delete (state.settings as any).schoolsSettings[schoolId];
        }

        // 11. Remove school itself
        state.schools = state.schools.filter(s => s.id !== schoolId);
        try {
            const rawKnown = localStorage.getItem('eljur_known_school_ids');
            if (rawKnown) {
                const parsedKnown = JSON.parse(rawKnown);
                if (Array.isArray(parsedKnown)) {
                    localStorage.setItem('eljur_known_school_ids', JSON.stringify(parsedKnown.filter((id: string) => id !== schoolId)));
                }
            }
        } catch {}
        
        onUpdate({ ...state });
        DB.deleteSchoolFromFirestore(schoolId).catch(() => {});
        DB.saveSchoolCache('school_1', state).catch(() => {});
    };

    const startEdit = (s: any) => {
        setEditSchoolId(s.id);
        setEditName(s.name);
        setEditDirectorId(s.directorId);
        setEditSchoolIdVal(s.id);
        setError(null);
    };

    const cancelEdit = () => {
        setEditSchoolId(null);
        setError(null);
    };

    const saveSchool = () => {
        const trimmedName = editName.trim();
        const trimmedSchoolId = editSchoolIdVal.trim();
        if (!trimmedName || !editDirectorId || !trimmedSchoolId || !editSchoolId) {
            setError(t('fill_fields'));
            return;
        }

        const schoolIndex = state.schools.findIndex(s => s.id === editSchoolId);
        if (schoolIndex === -1) return;

        // Check ID uniqueness if changed
        if (trimmedSchoolId !== editSchoolId) {
            if (state.schools.some(s => s.id === trimmedSchoolId)) {
                setError(t('already_exists'));
                return;
            }
        }

        // Check Director Uniqueness Logic:
        // Ensure this Director ID isn't already assigned to another school
        const existingSchoolWithSameDir = state.schools.find(s => s.directorId === editDirectorId && s.id !== editSchoolId);
        if (existingSchoolWithSameDir) {
            setError(t('director_id_exists'));
            return;
        }

        // Handle ID Change Propagation
        if (trimmedSchoolId !== editSchoolId) {
            // Update all users belonging to this school
            state.users.forEach(u => {
                if (u.schoolId === editSchoolId) {
                    u.schoolId = trimmedSchoolId;
                }
            });

            const oldPrefix = `${editSchoolId}__`;
            const newPrefix = `${trimmedSchoolId}__`;

            // Update schedules
            if (state.schedules) {
                Object.keys(state.schedules).forEach(k => {
                    if (k.startsWith(oldPrefix)) {
                        const suffix = k.substring(oldPrefix.length);
                        state.schedules[`${newPrefix}${suffix}`] = state.schedules[k];
                        delete state.schedules[k];
                    } else if (editSchoolId === 'school_1' && !k.includes('__')) {
                        state.schedules[`${newPrefix}${k}`] = state.schedules[k];
                        delete state.schedules[k];
                    }
                });
            }

            // Update grades
            if (state.grades) {
                Object.keys(state.grades).forEach(k => {
                    if (k.startsWith(oldPrefix)) {
                        const suffix = k.substring(oldPrefix.length);
                        state.grades[`${newPrefix}${suffix}`] = state.grades[k];
                        delete state.grades[k];
                    } else if (editSchoolId === 'school_1' && !k.includes('__')) {
                        state.grades[`${newPrefix}${k}`] = state.grades[k];
                        delete state.grades[k];
                    }
                });
            }

            // Update finalGrades
            if (state.finalGrades) {
                Object.keys(state.finalGrades).forEach(k => {
                    if (k.startsWith(oldPrefix)) {
                        const suffix = k.substring(oldPrefix.length);
                        state.finalGrades[`${newPrefix}${suffix}`] = state.finalGrades[k];
                        delete state.finalGrades[k];
                    } else if (editSchoolId === 'school_1' && !k.includes('__')) {
                        state.finalGrades[`${newPrefix}${k}`] = state.finalGrades[k];
                        delete state.finalGrades[k];
                    }
                });
            }

            // Update homework
            if (state.homework) {
                state.homework.forEach(h => {
                    if (h.schoolId === editSchoolId) h.schoolId = trimmedSchoolId;
                });
            }

            // Update teacherAssignments
            if (state.teacherAssignments) {
                state.teacherAssignments.forEach(a => {
                    if (a.schoolId === editSchoolId) a.schoolId = trimmedSchoolId;
                });
            }

            // Update studentGroups
            if (state.studentGroups) {
                state.studentGroups.forEach(g => {
                    if (g.schoolId === editSchoolId) g.schoolId = trimmedSchoolId;
                });
            }

            // Update announcements
            if (state.announcements) {
                state.announcements.forEach(a => {
                    if (a.schoolId === editSchoolId) a.schoolId = trimmedSchoolId;
                });
            }

            // Update messages
            if (state.messages) {
                state.messages.forEach(m => {
                    if (m.schoolId === editSchoolId) m.schoolId = trimmedSchoolId;
                });
            }

            // Update schoolsSettings
            if (state.settings && (state.settings as any).schoolsSettings?.[editSchoolId]) {
                (state.settings as any).schoolsSettings[trimmedSchoolId] = (state.settings as any).schoolsSettings[editSchoolId];
                delete (state.settings as any).schoolsSettings[editSchoolId];
            }

            try {
                const rawKnown = localStorage.getItem('eljur_known_school_ids');
                const parsedKnown = rawKnown ? JSON.parse(rawKnown) : ['school_1'];
                const nextKnown = Array.from(new Set([...(Array.isArray(parsedKnown) ? parsedKnown.filter((id: string) => id !== editSchoolId) : []), trimmedSchoolId]));
                localStorage.setItem('eljur_known_school_ids', JSON.stringify(nextKnown));
            } catch {}
        }

        const updatedSchool = {
            ...state.schools[schoolIndex],
            id: trimmedSchoolId,
            name: trimmedName,
            directorId: editDirectorId
        };
        state.schools = state.schools.map((s, idx) => idx === schoolIndex ? updatedSchool : s);

        // Demote any previous director of this school if director changed
        const demotedDirectors: User[] = [];
        state.users.forEach(u => {
            if (u.schoolId === trimmedSchoolId && u.role === 'director' && u.id !== editDirectorId) {
                u.role = 'teacher';
                demotedDirectors.push(u);
            }
        });

        const targetDirUser = state.users.find(u => u.id === editDirectorId);
        let oldDirSchoolId: string | undefined;
        if (targetDirUser) {
            oldDirSchoolId = targetDirUser.schoolId;
            targetDirUser.role = 'director';
            targetDirUser.schoolId = trimmedSchoolId;
        }
        state.users = [...state.users];

        const oldIdToCleanup = trimmedSchoolId !== editSchoolId ? editSchoolId : null;
        const targetSaveId = trimmedSchoolId;

        setEditSchoolId(null);
        setError(null);
        onUpdate({ ...state });

        DB.saveSchoolMetadata(targetSaveId, updatedSchool).catch(() => {});
        demotedDirectors.forEach(du => {
            DB.saveSchoolEntity(targetSaveId, 'users', du.id, du).catch(() => {});
        });
        if (targetDirUser) {
            if (oldDirSchoolId && oldDirSchoolId !== targetSaveId && oldDirSchoolId !== editSchoolId && oldDirSchoolId !== 'global') {
                DB.deleteSchoolEntity(oldDirSchoolId, 'users', targetDirUser.id).catch(() => {});
            }
            DB.saveSchoolEntity(targetSaveId, 'users', targetDirUser.id, targetDirUser).catch(() => {});
        }
        DB.saveSchoolState(targetSaveId, state).catch(() => {});
        DB.saveSchoolCache(targetSaveId, state).catch(() => {});
        DB.saveSchoolCache('school_1', state).catch(() => {});
        if (oldIdToCleanup) {
            DB.deleteSchoolFromFirestore(oldIdToCleanup).catch(() => {});
        }
    };

    return (
        <div className="space-y-8">
            <Card className="p-4 sm:p-6">
                <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">{t('add_school')}</h3>
                {error && !editSchoolId && (
                    <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm font-medium">
                        <AlertCircle size={16}/> {error}
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500">{t('school_name')}</label>
                        <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('school_placeholder')} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500">{t('director_fio')}</label>
                        <Input value={directorFio} onChange={e => setDirectorFio(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500">{t('director_login')}</label>
                        <Input value={directorLogin} onChange={e => setDirectorLogin(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500">{t('director_pass')}</label>
                        <Input value={directorPass} onChange={e => setDirectorPass(e.target.value)} />
                    </div>
                </div>
                <Button onClick={addSchool} variant="primary" className="mt-4">{t('create_school')}</Button>
            </Card>

            <div className="grid gap-4">
                {state.schools.map(s => {
                    const dir = state.users.find(u => u.id === s.directorId);
                    const isEditing = editSchoolId === s.id;

                    if (isEditing) {
                        return (
                            <Card key={s.id} className="p-6 border-l-[6px] border-l-blue-500 bg-blue-50/50 dark:bg-slate-900">
                                <h4 className="font-bold text-lg mb-4">{t('edit_school')}</h4>
                                {error && (
                                    <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm font-medium">
                                        <AlertCircle size={16}/> {error}
                                    </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">{t('title')}</label>
                                        <Input value={editName} onChange={e => setEditName(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">{t('director')}</label>
                                        <Select
                                            value={editDirectorId}
                                            onChange={e => setEditDirectorId(e.target.value)}
                                            className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100"
                                        >
                                            {state.users
                                                .filter(u => u.role !== 'creator' && u.role !== 'student' && (u.schoolId === s.id || u.id === editDirectorId || !u.schoolId))
                                                .map(u => (
                                                    <option key={u.id} value={u.id}>
                                                        {H.formatShortName(u.fio)} ({t(u.role)}) — ID: {u.id}
                                                    </option>
                                                ))}
                                            {!state.users.some(u => u.id === editDirectorId) && editDirectorId && (
                                                <option value={editDirectorId}>ID: {editDirectorId}</option>
                                            )}
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">{t('school_id')}</label>
                                        <Input value={editSchoolIdVal} onChange={e => setEditSchoolIdVal(e.target.value)} />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={saveSchool} variant="primary"><Save size={16} className="mr-2"/> {t('save')}</Button>
                                    <Button onClick={cancelEdit} variant="ghost">{t('cancel')}</Button>
                                </div>
                            </Card>
                        );
                    }

                    return (
                        <Card key={s.id} className="p-4 sm:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4 border-l-[6px] border-l-indigo-500">
                            <div className="w-full md:w-auto overflow-hidden">
                                <h4 className="font-bold text-base sm:text-lg text-slate-800 dark:text-white truncate">{s.name}</h4>
                                <p className="text-xs sm:text-sm text-slate-500 truncate">{t('director')}: {dir ? `${H.formatShortName(dir.fio)} (ID: ${dir.id})` : `ID: ${s.directorId} (${t('unknown')})`}</p>
                                <p className="text-xs text-slate-400 mt-1 truncate">School ID: {s.id}</p>
                            </div>
                            <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                <Button variant="secondary" size="sm" onClick={() => startEdit(s)} className="flex-1 md:flex-none justify-center">
                                    <Edit size={16} className="mr-2"/> {t('edit')}
                                </Button>
                                <Button variant="danger" size="sm" onClick={() => deleteSchool(s.id, s.name)} className="flex-1 md:flex-none justify-center">
                                    <Trash2 size={16} className="mr-2"/> {t('delete')}
                                </Button>
                            </div>
                        </Card>
                    );
                })}
                {state.schools.length === 0 && <p className="text-center text-slate-400">{t('no_schools')}</p>}
            </div>
        </div>
    );
};
