
import React, { useState } from 'react';
import { AppState, User } from '../../types';
import * as H from '../../utils/helpers';
import { Button, Input, Card } from '../../components/ui';
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

    const addSchool = () => {
        if (!newName || !directorFio || !directorLogin || !directorPass) {
            setError(t('fill_fields'));
            return;
        }
        
        const schoolId = H.uid('school');
        const directorId = H.uid('u_dir');
        
        const newSchool = { id: schoolId, name: newName, directorId };
        const newDirector = {
            id: directorId,
            schoolId: schoolId,
            fio: directorFio,
            login: directorLogin,
            password: directorPass,
            role: 'director'
        };

        state.schools.push(newSchool);
        state.users.push(newDirector as User);
        onUpdate(state);
        
        setNewName(''); setDirectorFio(''); setDirectorLogin(''); setDirectorPass('');
        setError(null);
    };

    const deleteSchool = (schoolId: string, schoolName: string) => {
        if (!confirm(`ВНИМАНИЕ! Вы собираетесь удалить школу "${schoolName}" и ВСЕХ её пользователей (директора, учителей, учеников) и все их данные. Это действие необратимо. Продолжить?`)) return;
        
        // Remove users of this school
        state.users = state.users.filter(u => u.schoolId !== schoolId);
        state.userOrder = state.userOrder.filter(uid => {
            const u = state.users.find(usr => usr.id === uid);
            return !!u; // Keep only if user still exists
        });

        // Remove school
        state.schools = state.schools.filter(s => s.id !== schoolId);
        
        onUpdate(state);
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
        if (!editName || !editDirectorId || !editSchoolIdVal) {
            setError(t('fill_fields'));
            return;
        }

        const schoolIndex = state.schools.findIndex(s => s.id === editSchoolId);
        if (schoolIndex === -1) return;

        // Check ID uniqueness if changed
        if (editSchoolIdVal !== editSchoolId) {
            if (state.schools.some(s => s.id === editSchoolIdVal)) {
                setError(t('already_exists'));
                return;
            }
        }

        // Check Director Uniqueness Logic:
        // Ensure this Director ID isn't already assigned to another school
        const existingSchoolWithSameDir = state.schools.find(s => s.directorId === editDirectorId && s.id !== editSchoolId);
        if (existingSchoolWithSameDir) {
            setError(`Этот ID директора уже привязан к школе "${existingSchoolWithSameDir.name}". Один директор не может управлять несколькими школами.`);
            return;
        }

        // Handle ID Change Propagation
        if (editSchoolIdVal !== editSchoolId) {
            // Update all users belonging to this school
            state.users.forEach(u => {
                if (u.schoolId === editSchoolId) {
                    u.schoolId = editSchoolIdVal;
                }
            });
            // Update the school object
            state.schools[schoolIndex].id = editSchoolIdVal;
        }

        state.schools[schoolIndex].name = editName;
        state.schools[schoolIndex].directorId = editDirectorId;

        onUpdate(state);
        setEditSchoolId(null);
        setError(null);
    };

    return (
        <div className="space-y-8">
            <Card className="p-6">
                <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">{t('add_school')}</h3>
                {error && !editSchoolId && (
                    <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm font-medium">
                        <AlertCircle size={16}/> {error}
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500">{t('school_name')}</label>
                        <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Школа №X" />
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
                                        <label className="text-xs font-bold text-slate-500">ID {t('director')}</label>
                                        <Input value={editDirectorId} onChange={e => setEditDirectorId(e.target.value)} placeholder="User ID" />
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
                        <Card key={s.id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-l-[6px] border-l-indigo-500">
                            <div className="w-full md:w-auto overflow-hidden">
                                <h4 className="font-bold text-lg text-slate-800 dark:text-white truncate">{s.name}</h4>
                                <p className="text-sm text-slate-500 truncate">{t('director')}: {dir ? `${dir.fio} (ID: ${dir.id})` : `ID: ${s.directorId} (${t('unknown')})`}</p>
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
