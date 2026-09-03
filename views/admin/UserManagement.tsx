
import React, { useState, useMemo, useEffect } from 'react';
import { AppState, User, Role } from '../../types';
import * as H from '../../utils/helpers';
import { Button, Input, Select, Card, SearchableSelect, MultiSelect, Modal } from '../../components/ui';
import { Trash2, GripVertical, Lock, Unlock, Minus, Plus, UserX, PlusCircle, X as XIcon, Check, AlertCircle, Shield, Building, Printer, GraduationCap } from 'lucide-react';

export const UserManagement = ({ state, onUpdate, currentUser, isGlobal = false }: { state: AppState, onUpdate: (s: AppState) => void, currentUser: User, isGlobal?: boolean }) => {
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
    const [sortField, setSortField] = useState<keyof User | 'class' | 'default'>('fio');
    const [filterClass, setFilterClass] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [filterSchool, setFilterSchool] = useState('');
    const [highlightId, setHighlightId] = useState<string | null>(null);
    const [blockingUserId, setBlockingUserId] = useState<string | null>(null);
    const [roleInputOpen, setRoleInputOpen] = useState<Record<string, boolean>>({});
    const [newRoleInputOpen, setNewRoleInputOpen] = useState(false);
    const [focusedNameId, setFocusedNameId] = useState<string | null>(null);
    const [newUser, setNewUser] = useState({ fio: '', login: '', password: '', role: 'student' as Role, customRole: '', classKey: '', teacherClasses: [] as string[], schoolId: currentUser.schoolId || ''});
    const [newClassNum, setNewClassNum] = useState('');
    const [newClassLet, setNewClassLet] = useState('');
    const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
    const [uiError, setUiError] = useState<string | null>(null);
    const [uiErrorUserId, setUiErrorUserId] = useState<string | null>(null);
    const [classError, setClassError] = useState<string | null>(null);
    
    // NEW STATE FOR CONFIRMATION DIALOG
    const [classRemovalConfirm, setClassRemovalConfirm] = useState<{ isOpen: boolean, userId: string, classKey: string } | null>(null);

    const lang = state.settings.language || 'ru';
    const t = (k: string) => H.t(k, lang);

    const schoolClasses = useMemo(() => {
        return H.getSchoolClasses(state, currentUser.schoolId);
    }, [state.schools, currentUser.schoolId]);

    const targetAddUserSchoolId = isGlobal ? (newUser.schoolId && newUser.schoolId !== 'global' && newUser.schoolId !== '-' ? newUser.schoolId : '') : currentUser.schoolId;
    const addUserSchoolClasses = useMemo(() => {
        return H.getSchoolClasses(state, targetAddUserSchoolId);
    }, [state.schools, targetAddUserSchoolId]);

    useEffect(() => { if (uiError) { const timer = setTimeout(() => { setUiError(null); setUiErrorUserId(null); }, 15000); return () => clearTimeout(timer); } }, [uiError]);
    useEffect(() => { if (classError) { const timer = setTimeout(() => setClassError(null), 15000); return () => clearTimeout(timer); } }, [classError]);
    const validationErrors = useMemo(() => { 
        const errors: string[] = []; 
        if (!newUser.fio && !newUser.login && !newUser.password) return []; 
        const normFio = newUser.fio.toLowerCase().trim(); 
        const normLogin = newUser.login.toLowerCase().trim(); 
        const targetSchool = targetAddUserSchoolId;

        // FIO duplicate check (only within the same school)
        if (normFio) {
            const sameFio = state.users.some(u => {
                if (isGlobal && !targetSchool) return u.fio?.toLowerCase().trim() === normFio;
                return u.schoolId === targetSchool && u.fio?.toLowerCase().trim() === normFio;
            });
            if (sameFio) errors.push(t('already_exists'));
        }

        // Credential combo uniqueness check (globally across all schools):
        // Logins can be identical, passwords can be identical, but login + password combination cannot be identical
        if (normLogin && newUser.password) {
            const comboTaken = state.users.some(u => 
                u.login?.toLowerCase().trim() === normLogin && 
                u.password === newUser.password
            );
            if (comboTaken) {
                errors.push(lang === 'ru' ? 'Связка логина и пароля уже занята другим пользователем' : 'This login and password combination is already taken');
            }
        }
        return errors; 
    }, [newUser.fio, newUser.login, newUser.password, state.users, targetAddUserSchoolId, isGlobal, lang]);
    let filteredUsers = state.users.filter(u => { if (isGlobal) { if (u.role === 'creator') return false; if (filterSchool && u.schoolId !== filterSchool) return false; } else { if (u.schoolId !== currentUser.schoolId) return false; if (u.id === currentUser.id) return false; if (u.role === 'creator') return false; if (currentUser.role === 'employee' && u.role === 'director') return false; } if (filterRole) return u.role === filterRole; if (filterClass) { if (u.role === 'student') return `${u.class}_${u.letter}` === filterClass; if (u.role === 'teacher') return (u.classes || []).includes(filterClass); return false; } return true; });
    const sortedUsers = [...filteredUsers].sort((a, b) => { if (sortField === 'fio' && !isGlobal) return a.fio.localeCompare(b.fio); const ia = state.userOrder.indexOf(a.id); const ib = state.userOrder.indexOf(b.id); if (ia !== -1 && ib !== -1) return ia - ib; return 0; });
    const handleDragStart = (e: React.DragEvent, id: string) => { setDraggedItemId(id); e.dataTransfer.effectAllowed = 'move'; e.currentTarget.classList.add('dragging-row'); };
    const handleDragEnd = (e: React.DragEvent) => { setDraggedItemId(null); e.currentTarget.classList.remove('dragging-row'); document.querySelectorAll('.dragging-over').forEach(el => el.classList.remove('dragging-over')); };
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.currentTarget.classList.add('dragging-over'); };
    const handleDragLeave = (e: React.DragEvent) => { e.currentTarget.classList.remove('dragging-over'); };
    const handleDrop = (e: React.DragEvent, targetId: string) => { e.preventDefault(); e.currentTarget.classList.remove('dragging-over'); if (!draggedItemId || draggedItemId === targetId) return; const oldIdx = state.userOrder.indexOf(draggedItemId); const newIdx = state.userOrder.indexOf(targetId); if (oldIdx !== -1 && newIdx !== -1) { const newOrder = [...state.userOrder]; newOrder.splice(oldIdx, 1); newOrder.splice(newIdx, 0, draggedItemId); state.userOrder = newOrder; setSortField('default'); onUpdate(state); } };
    const toggleRow = (id: string) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    const updateField = (userId: string, field: keyof User, val: any) => { 
        const uIndex = state.users.findIndex(u => u.id === userId); 
        if (uIndex > -1) { 
            const userToUpdate = state.users[uIndex];
            if (field === 'fio') {
                const normVal = String(val).toLowerCase().trim();
                const isTaken = state.users.some(u => {
                    if (u.id === userId) return false;
                    if (userToUpdate.schoolId && u.schoolId !== userToUpdate.schoolId) return false;
                    return (u.fio || '').toLowerCase().trim() === normVal && normVal !== '';
                });
                if (isTaken) {
                    setUiError(t('already_exists'));
                    setUiErrorUserId(userId);
                    return;
                }
            }
            if (field === 'login' || field === 'password') {
                const testLogin = field === 'login' ? String(val).toLowerCase().trim() : (userToUpdate.login || '').toLowerCase().trim();
                const testPass = field === 'password' ? String(val) : (userToUpdate.password || '');
                if (testLogin && testPass) {
                    const comboTaken = state.users.some(u => 
                        u.id !== userId && 
                        u.login?.toLowerCase().trim() === testLogin && 
                        u.password === testPass
                    );
                    if (comboTaken) {
                        setUiError(lang === 'ru' ? 'Связка логина и пароля уже занята другим пользователем' : 'This login and password combination is already taken');
                        setUiErrorUserId(userId);
                        return;
                    }
                }
            }
            if (field === 'role') { 
                if (val === 'director') { 
                    const existingDir = state.users.find(u => u.schoolId === userToUpdate.schoolId && u.role === 'director' && u.id !== userId); 
                    if (existingDir) { 
                        setUiError(`Director exists: ${existingDir.fio}`); 
                        setUiErrorUserId(userId); 
                        return; 
                    } 
                } 
                state.users[uIndex].classes = undefined; 
                state.users[uIndex].class = undefined; 
                state.users[uIndex].letter = undefined; 
                state.users[uIndex].customRole = undefined; 
                state.users[uIndex].employeePermissions = undefined; 
                if (val === 'employee') { 
                    state.users[uIndex].role = 'employee'; 
                    state.users[uIndex].employeePermissions = { allowedTabs: ['messages'], messagingScope: ['ALL'], canSendAsDirector: false }; 
                } else state.users[uIndex].role = val; 
            } else { 
                (state.users[uIndex] as any)[field] = val; 
            } 
            onUpdate(state); 
        } 
    };
    const updateCustomRole = (userId: string, val: string) => { const uIndex = state.users.findIndex(u => u.id === userId); if (uIndex > -1) { state.users[uIndex].customRole = val; onUpdate(state); } };
    const addClassToTeacher = (userId: string, classKey: string) => { const uIndex = state.users.findIndex(u => u.id === userId); if (uIndex > -1) { const u = state.users[uIndex]; if (!u.classes) u.classes = []; if (!u.classes.includes(classKey)) { u.classes.push(classKey); onUpdate(state); } } };
    
    // UPDATED REMOVE LOGIC WITH MODAL TRIGGER
    const removeClassFromTeacher = (userId: string, classKey: string) => { 
        // CONFIRMATION LOGIC FOR LOAD REMOVAL
        const hasLoad = state.teacherAssignments.some(a => a.teacherId === userId && a.classId === classKey);
        if (hasLoad) {
            // Trigger custom modal instead of native confirm
            setClassRemovalConfirm({ isOpen: true, userId, classKey });
            return;
        }

        // If no load assignment, proceed directly
        proceedRemoveClass(userId, classKey, false);
    };

    // Helper to execute removal after confirmation or directly
    const proceedRemoveClass = (userId: string, classKey: string, removeLoad: boolean) => {
        if (removeLoad) {
            state.teacherAssignments = state.teacherAssignments.filter(a => !(a.teacherId === userId && a.classId === classKey));
        }

        const uIndex = state.users.findIndex(u => u.id === userId); 
        if (uIndex > -1) { 
            const u = state.users[uIndex]; 
            if (u.classes) { 
                u.classes = u.classes.filter(c => c !== classKey); 
                onUpdate(state); 
            } 
        }
        setClassRemovalConfirm(null);
    };

    const updateEmployeePermission = (userId: string, field: any, val: any) => { const uIndex = state.users.findIndex(u => u.id === userId); if (uIndex > -1) { const u = state.users[uIndex]; if (!u.employeePermissions) u.employeePermissions = { allowedTabs: ['messages'], messagingScope: ['ALL'], canSendAsDirector: false }; (u.employeePermissions as any)[field] = val; if (field === 'isAdministration' && val === true) { u.employeePermissions.messagingScope = ['ALL']; } onUpdate(state); } };
    const deleteUser = (id: string, name: string) => { 
        if(!window.confirm(`${t('confirm_delete')} "${name}"?`)) return; 
        if (currentUser.role === 'employee' && (id === currentUser.id || id === state.schools.find(s=>s.id===currentUser.schoolId)?.directorId)) return alert('Error'); 
        state.users = state.users.filter(u => u.id !== id); 
        state.userOrder = state.userOrder.filter(uid => uid !== id); 

        // Cascading cleanups:
        // 1. Director & headmaster cleanup in schools
        if (Array.isArray(state.schools)) {
            state.schools.forEach(s => {
                if (s.directorId === id) s.directorId = '';
                if (Array.isArray(s.classes)) {
                    s.classes.forEach(c => {
                        if (c.headmasterId === id) delete c.headmasterId;
                    });
                }
            });
        }
        if (Array.isArray(state.classes)) {
            state.classes.forEach(c => {
                if (c.headmasterId === id) delete c.headmasterId;
            });
        }
        // 2. Teacher assignments cleanup in global state
        if (Array.isArray(state.teacherAssignments)) {
            state.teacherAssignments = state.teacherAssignments.filter(a => a.teacherId !== id);
        }
        // 3. Student groups cleanup in global state
        if (Array.isArray(state.studentGroups)) {
            state.studentGroups.forEach(g => {
                if (Array.isArray(g.studentIds)) {
                    g.studentIds = g.studentIds.filter(sid => sid !== id);
                }
            });
        }
        // 4. Student grades cleanup
        if (state.grades) {
            Object.keys(state.grades).forEach(cKey => {
                const subjs = state.grades[cKey];
                if (subjs) {
                    Object.keys(subjs).forEach(subj => {
                        if (Array.isArray(subjs[subj])) {
                            subjs[subj] = subjs[subj].filter((g: any) => g.studentId !== id);
                        }
                    });
                }
            });
        }
        // 5. Student finalGrades cleanup
        if (state.finalGrades) {
            Object.keys(state.finalGrades).forEach(cKey => {
                const subjs = state.finalGrades[cKey];
                if (subjs) {
                    Object.keys(subjs).forEach(subj => {
                        if (Array.isArray(subjs[subj])) {
                            subjs[subj] = subjs[subj].filter((fg: any) => fg.studentId !== id);
                        }
                    });
                }
            });
        }
        // 6. Teacher schedule assignments cleanup
        if (state.schedules) {
            Object.values(state.schedules).forEach(dayDict => {
                Object.values(dayDict).forEach(day => {
                    (day.lessons || []).forEach(l => {
                        if (l.teacherId === id) l.teacherId = undefined;
                        (l.subgroups || []).forEach(sg => {
                            if (sg.teacherId === id) sg.teacherId = undefined;
                        });
                    });
                });
            });
        }

        onUpdate(state); 
    };
    const applyBlock = (id: string, duration: any) => { const uIndex = state.users.findIndex(u => u.id === id); if (uIndex > -1) { state.users[uIndex].blockedUntil = duration === 'unblock' ? undefined : new Date(Date.now() + (duration==='1h'?3600000:duration==='24h'?86400000:3153600000000)).toISOString(); onUpdate(state); } setBlockingUserId(null); };
    const addUser = () => { if (!newUser.fio || !newUser.login || !newUser.password) { setUiError(t('fill_fields')); setUiErrorUserId('NEW_USER_FORM'); return; } if (validationErrors.length > 0) { setUiError(validationErrors[0]); setUiErrorUserId('NEW_USER_FORM'); return; } let targetSchoolId = isGlobal && newUser.schoolId && newUser.schoolId !== 'global' && newUser.schoolId !== '-' ? newUser.schoolId : currentUser.schoolId; if (isGlobal && newUser.schoolId === '-') targetSchoolId = ''; if (newUser.role === 'director' && targetSchoolId) { const existingDir = state.users.find(u => u.schoolId === targetSchoolId && u.role === 'director'); if (existingDir) { setUiError(`Director exists: ${existingDir.fio}`); setUiErrorUserId('NEW_USER_FORM'); return; } } const u: User = { id: H.uid('u'), schoolId: targetSchoolId, fio: newUser.fio, login: newUser.login, password: newUser.password, role: newUser.role, customRole: newUser.customRole }; if (newUser.role === 'student' && newUser.classKey) { const [cl, lt] = newUser.classKey.split('_'); u.class = cl; u.letter = lt; } else if (newUser.role === 'teacher') { u.classes = newUser.teacherClasses; } else if (newUser.role === 'employee') { u.employeePermissions = { allowedTabs: ['messages'], messagingScope: ['ALL'], canSendAsDirector: false }; } state.users.push(u); state.userOrder.push(u.id); onUpdate(state); setNewUser({ ...newUser, fio: '', login: '', password: '', role: 'student', customRole: '', classKey: '', teacherClasses: [] }); setNewRoleInputOpen(false); setUiError(null); setUiErrorUserId(null); };
    const handleAddClass = () => { 
        if(!newClassNum || !newClassLet) { setClassError(t('fill_fields')); return; } 
        const lettr = newClassLet.toUpperCase(); 
        const currentClasses = H.getSchoolClasses(state, currentUser.schoolId);
        if (currentClasses.find(c => c.class === newClassNum && c.letter === lettr)) { 
            setClassError(t('already_exists')); 
            return; 
        } 
        const newClass = { class: newClassNum, letter: lettr };
        if (currentUser.schoolId && currentUser.schoolId !== 'global') {
            const school = state.schools?.find(s => s.id === currentUser.schoolId);
            if (school) {
                if (!Array.isArray(school.classes)) school.classes = [];
                school.classes.push(newClass);
                school.classes.sort((a,b) => parseInt(a.class) - parseInt(b.class) || a.letter.localeCompare(b.letter));
            }
        }
        onUpdate(state); 
        setNewClassNum(''); 
        setNewClassLet(''); 
        setClassError(null); 
    };
    const removeClass = (clsKey: string) => { 
        if(!window.confirm(`${t('confirm_delete')} ${clsKey.replace('_','')}?`)) return; 
        const [cNum, cLet] = clsKey.split('_'); 
        const schoolId = currentUser.schoolId;
        if (schoolId && schoolId !== 'global') {
            const school = state.schools?.find(s => s.id === schoolId);
            if (school && Array.isArray(school.classes)) {
                school.classes = school.classes.filter(c => !(c.class === cNum && c.letter === cLet));
            }
            if (school && school.subjectRequirements && school.subjectRequirements[clsKey]) {
                delete school.subjectRequirements[clsKey];
            }
        }
        // Also cleanup teacher and student class references within this school
        state.users.forEach(u => {
            if (schoolId && u.schoolId !== schoolId) return;
            if (u.role === 'teacher' && u.classes) {
                u.classes = u.classes.filter(c => c !== clsKey);
            }
            if (u.role === 'student' && u.class === cNum && u.letter === cLet) {
                u.class = undefined;
                u.letter = undefined;
            }
        });

        // Cleanup school-isolated schedules, grades, finalGrades, homework, assignments, groups
        const scopedKey = H.getSchoolClassKey(schoolId, clsKey);
        if (state.schedules) {
            delete state.schedules[scopedKey];
            delete state.schedules[clsKey];
        }
        if (state.grades) {
            delete state.grades[scopedKey];
            delete state.grades[clsKey];
        }
        if (state.finalGrades) {
            delete state.finalGrades[scopedKey];
            delete state.finalGrades[clsKey];
        }
        if (state.homework) {
            state.homework = state.homework.filter(h => !(h.schoolId === schoolId && h.class === cNum && h.letter === cLet));
        }
        if (state.teacherAssignments) {
            state.teacherAssignments = state.teacherAssignments.filter(a => !(a.schoolId === schoolId && a.classId === clsKey));
        }
        if (state.studentGroups) {
            state.studentGroups = state.studentGroups.filter(g => !(g.schoolId === schoolId && g.classId === clsKey));
        }

        onUpdate(state); 
    };

    const handleAssignHeadmaster = (cNum: string, cLet: string, headmasterId: string) => {
        H.setClassHeadmaster(state, currentUser.schoolId, cNum, cLet, headmasterId ? headmasterId : undefined);
        onUpdate(state);
    };

    const headmasterCandidates = H.getEligibleHeadmasterCandidates(state, currentUser.schoolId);

    const handleSearchSelect = (userId: string) => { setFilterClass(''); setFilterRole(''); setHighlightId(userId); setTimeout(() => { document.getElementById(`row-${userId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100); setTimeout(() => setHighlightId(null), 3000); };
    const toggleRoleInput = (userId: string) => setRoleInputOpen(prev => ({ ...prev, [userId]: !prev[userId] }));

    return (
        <div className="space-y-8">
            {!isGlobal && (
                <Card className="p-6 md:p-8">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                        <div>
                            <h3 className="font-bold text-slate-800 text-xl dark:text-white font-heading">{t('manage_classes')}</h3>
                            <p className="text-xs text-slate-400 mt-1">Добавление классов и назначение классных руководителей (максимум 2 класса на одного человека)</p>
                        </div>
                    </div>
                    {classError && (
                        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between text-red-700 animate-in fade-in slide-in-from-top-1 text-sm font-bold">
                            <div className="flex items-center gap-2"><AlertCircle size={16}/> {classError}</div>
                            <button onClick={() => setClassError(null)} className="hover:bg-red-100 p-1 rounded-lg"><XIcon size={14}/></button>
                        </div>
                    )}
                    
                    {/* Class Cards with Homeroom Assignment */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                        {schoolClasses.map(c => {
                            const key = `${c.class}_${c.letter}`;
                            const studentCount = state.users.filter(u => u.role === 'student' && u.schoolId === currentUser.schoolId && u.class === c.class && u.letter === c.letter).length;
                            return (
                                <div key={key} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all dark:bg-slate-800 dark:border-slate-700 flex flex-col justify-between gap-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 font-extrabold flex items-center justify-center text-base dark:bg-blue-900/30 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                                                {c.class}{c.letter}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 dark:text-white text-sm">{c.class}{c.letter} {t('class')}</div>
                                                <div className="text-[11px] text-slate-400 font-medium">
                                                    {studentCount} {t('students_count_suffix')}
                                                </div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => removeClass(key)} 
                                            title={t('delete')}
                                            className="text-slate-300 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 rounded-xl dark:hover:bg-red-900/30"
                                        >
                                            <XIcon size={16} strokeWidth={2.5}/>
                                        </button>
                                    </div>

                                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
                                            {t('class_teacher')}
                                        </label>
                                        <select 
                                            value={c.headmasterId || ''} 
                                            onChange={e => handleAssignHeadmaster(c.class, c.letter, e.target.value)}
                                            className="w-full text-xs py-2 px-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                                        >
                                            <option value="">-- {t('not_assigned')} --</option>
                                            {headmasterCandidates.map(cand => {
                                                const check = H.canUserBeAssignedAsHeadmaster(state, currentUser.schoolId, cand.id, c.class, c.letter);
                                                const roleName = cand.role === 'director' ? t('director') : (cand.customRole || t(cand.role));
                                                let extra = '';
                                                if (check.leadingClasses.length > 0) {
                                                    extra = ` — кл. рук. ${check.leadingClasses.join(', ')}`;
                                                }
                                                let label = `${H.formatShortName(cand.fio)} (${roleName})${extra}`;
                                                return (
                                                    <option key={cand.id} value={cand.id} disabled={!check.canAssign}>
                                                        {label}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex flex-wrap gap-4 items-end bg-slate-50 p-6 rounded-2xl border border-slate-200 dark:bg-slate-900/50 dark:border-slate-800">
                        <div className="w-24">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">{t('number')}</label>
                            <Input placeholder="10" value={newClassNum} onChange={e => setNewClassNum(e.target.value)} />
                        </div>
                        <div className="w-24">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">{t('letter')}</label>
                            <Input placeholder="А" value={newClassLet} onChange={e => setNewClassLet(e.target.value)} />
                        </div>
                        <Button onClick={handleAddClass} variant="primary" className="px-8 h-10">{t('add_class')}</Button>
                    </div>
                </Card>
            )}
            <Card className="p-0 border-t-[6px] border-t-blue-600">
                <div className="p-5 border-b border-slate-200 flex flex-col gap-4 bg-slate-50/50 dark:bg-slate-900 dark:border-slate-700 no-print"><div className="flex flex-wrap gap-4 justify-between items-center"><div className="flex flex-wrap items-center gap-4"><h3 className="font-bold text-slate-800 text-lg dark:text-white mr-4 font-heading">{isGlobal ? t('global_list') : t('school_users')}</h3><div className="w-64"><SearchableSelect lang={lang as 'ru'|'en'} placeholder={t('search_fio')} options={filteredUsers.map(u => ({ value: u.id, label: u.fio }))} value="" onChange={handleSearchSelect} className="h-10 text-xs" /></div>{isGlobal && <Select value={filterSchool} onChange={e => setFilterSchool(e.target.value)} className="w-40 text-xs py-1.5 h-auto"><option value="">{t('all_schools')}</option>{state.schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>}<Select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="w-32 text-xs py-1.5 h-auto"><option value="">{t('all_roles')}</option><option value="student">{t('student')}</option><option value="teacher">{t('teacher')}</option><option value="director">{t('director')}</option><option value="employee">{t('employee')}</option></Select>{!isGlobal && <Select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="w-32 text-xs py-1.5 h-auto"><option value="">{t('all_classes')}</option>{schoolClasses.map(c => <option key={`${c.class}_${c.letter}`} value={`${c.class}_${c.letter}`}>{c.class}{c.letter}</option>)}</Select>}<Select value={sortField} onChange={e => setSortField(e.target.value as any)} className="w-40 text-xs py-1.5 h-auto"><option value="default">{t('sort_manual')}</option><option value="fio">{t('sort_fio')}</option><option value="role">{t('sort_role')}</option></Select></div><Button size="sm" onClick={() => window.print()} className="no-print"><Printer className="w-4 h-4 mr-2"/> {t('print')}</Button></div></div>
                <div className="overflow-x-auto"><table className="w-full text-sm min-w-[800px]"><thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase text-xs tracking-wider dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"><tr><th className="p-5 w-8 text-center no-print"></th><th className="p-5 w-12 text-center no-print"></th><th className="p-5 text-center">{t('fio')}</th>{isGlobal && <th className="p-5 text-center">{t('school')}</th>}<th className="p-5 text-center">{t('login')}</th><th className="p-5 text-center">{t('password')}</th><th className="p-5 text-center w-40">{t('role')}</th><th className="p-5 text-center">{t('class_assignment')}</th><th className="p-5 text-right no-print">{t('actions')}</th></tr></thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{sortedUsers.map(u => { const hasEmptyFields = !u.fio || !u.login || !u.password || (isGlobal && !u.schoolId) || (u.role === 'student' && (!u.class || !u.letter)) || (u.role === 'teacher' && (!u.classes || u.classes.length === 0)); return (<React.Fragment key={u.id}>{uiError && uiErrorUserId === u.id && (<tr className="bg-red-50 dark:bg-red-900/10 no-print animate-in fade-in slide-in-from-top-1"><td colSpan={isGlobal ? 9 : 8} className="p-2 text-red-600 dark:text-red-400 font-bold text-center border-b border-red-100 dark:border-red-900/30"><div className="flex items-center justify-center gap-2 relative"><AlertCircle size={14}/> {uiError}<button onClick={() => setUiError(null)} className="absolute right-2 p-1 hover:bg-red-200 rounded transition"><XIcon size={14}/></button></div></td></tr>)}<tr id={`row-${u.id}`} draggable onDragStart={(e) => handleDragStart(e, u.id)} onDragEnd={handleDragEnd} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, u.id)} className={`hover:bg-blue-50/50 transition duration-150 group dark:hover:bg-slate-800/50 cursor-move ${highlightId === u.id ? 'highlight-blink bg-blue-100 dark:bg-blue-900' : ''} ${hasEmptyFields ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}><td className="p-5 text-slate-400 text-center no-print"><GripVertical size={16}/></td><td className="p-5 text-center no-print">{((u.role === 'teacher' && !u.customRole) || u.role === 'employee') && <button onClick={() => toggleRow(u.id)} className={`p-1.5 rounded-full transition ${expandedRows[u.id] ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' : 'hover:bg-slate-200 text-slate-400 dark:hover:bg-slate-700'}`}>{expandedRows[u.id] ? <Minus size={14}/> : <Plus size={14}/>}</button>}{u.blockedUntil && <div title={t('blocked')} className="flex justify-center mt-1"><Lock size={14} className="text-red-500" /></div>}</td><td className="p-5 text-center">{focusedNameId !== u.id ? <div onClick={() => setFocusedNameId(u.id)} className="bg-white border border-transparent hover:border-slate-200 rounded px-2 py-1.5 w-full font-semibold text-slate-800 dark:bg-slate-950 dark:text-slate-200 text-center cursor-text min-h-[38px] flex items-center justify-center transition-colors">{H.formatShortName(u.fio)}</div> : <input autoFocus className="bg-white border border-blue-500 rounded px-2 py-1.5 w-full font-semibold text-slate-800 dark:bg-slate-950 dark:text-slate-200 text-center focus:ring-2 focus:ring-blue-100 outline-none" value={u.fio} onChange={(e) => updateField(u.id, 'fio', e.target.value)} onBlur={() => setFocusedNameId(null)} placeholder={t('fio')} />}</td>{isGlobal && <td className="p-5 text-center"><Select value={u.schoolId || '-'} onChange={e => updateField(u.id, 'schoolId', e.target.value === '-' ? '' : e.target.value)} className="text-xs w-32"><option value="-">-</option>{state.schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></td>}<td className="p-5 text-center"><input className="bg-white border border-slate-200 hover:border-slate-300 rounded px-2 py-1.5 w-full font-mono text-slate-600 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-950 dark:hover:border-slate-600 text-center" value={u.login} onChange={(e) => updateField(u.id, 'login', e.target.value)} placeholder={t('login')} /></td><td className="p-5 text-center"><input className="bg-white border border-slate-200 hover:border-slate-300 rounded px-2 py-1.5 w-full font-mono text-slate-600 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-950 dark:hover:border-slate-600 text-center" value={u.password || ''} onChange={(e) => updateField(u.id, 'password', e.target.value)} placeholder={t('password')} /></td><td className="p-5 text-center"><div className="flex flex-col gap-1 items-center relative"><Select value={u.role} onChange={(e) => updateField(u.id, 'role', e.target.value)} className="text-xs py-2 font-medium w-36"><option value="student">{t('student')}</option><option value="teacher">{t('teacher')}</option>{(isGlobal || currentUser.role === 'creator') && <option value="director">{t('director')}</option>}<option value="employee">{t('employee')}</option></Select>{u.role === 'employee' && <div className="mt-1 w-36">{roleInputOpen[u.id] || u.customRole ? <div className="relative group animate-in zoom-in duration-200"><input autoFocus={roleInputOpen[u.id] && !u.customRole} className="text-xs border border-blue-200 rounded-lg px-3 py-1.5 text-center focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none w-full bg-white dark:bg-slate-900 dark:text-slate-200 dark:border-slate-600 dark:focus:border-blue-400 shadow-sm transition-all font-medium text-blue-700 dark:text-blue-300 placeholder-blue-300" value={u.customRole || ''} onChange={e => updateCustomRole(u.id, e.target.value)} placeholder={t('user_position')} />{roleInputOpen[u.id] && !u.customRole && <button onClick={() => toggleRoleInput(u.id)} className="absolute -right-2 -top-2 bg-red-100 rounded-full p-0.5 text-red-500 hover:bg-red-500 hover:text-white shadow-sm border border-red-200 transition-colors"><XIcon size={10}/></button>}</div> : <button onClick={() => toggleRoleInput(u.id)} className="w-full flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-400 border border-dashed border-slate-300 rounded-lg py-1.5 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800 group"><PlusCircle size={12} className="group-hover:scale-110 transition-transform"/><span>{t('user_position')}</span></button>}</div>}</div></td><td className="p-5 text-center">
    {(() => {
        const leadingClasses = H.getUserLeadingClasses(state, u.schoolId, u.id);
        const leadingBadge = leadingClasses.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1 items-center justify-center">
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[10px] font-bold dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300 flex items-center gap-1">
                    <GraduationCap size={11} className="text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>{lang === 'ru' ? 'Кл. рук: ' : 'Class Teacher: '}{leadingClasses.map(c => `${c.class}${c.letter}`).join(', ')}</span>
                </span>
            </div>
        ) : null;

        if (u.role === 'student') {
            return (
                <Select 
                    value={u.class && u.letter && (schoolClasses || []).some(c => c.class === u.class && c.letter === u.letter) ? `${u.class}_${u.letter}` : ''} 
                    onChange={(e) => { 
                        const [c, l] = e.target.value.split('_'); 
                        const uIdx = state.users.findIndex(us => us.id === u.id); 
                        state.users[uIdx].class = c; 
                        state.users[uIdx].letter = l; 
                        onUpdate(state); 
                    }} 
                    className="text-xs py-2 w-32 mx-auto"
                >
                    <option value="">{t('not_selected')}</option>
                    {(schoolClasses || []).map(c => <option key={`${c.class}_${c.letter}`} value={`${c.class}_${c.letter}`}>{c.class}{c.letter}</option>)}
                </Select>
            );
        } else if (u.role === 'teacher') {
            const validKeys = new Set((schoolClasses || []).map(c => `${c.class}_${c.letter}`)); 
            const activeClasses = (u.classes || []).filter(ck => validKeys.has(ck)); 
            return (
                <div className="flex flex-col items-center gap-1">
                    <div className="flex flex-wrap gap-1.5 items-center justify-center">
                        {activeClasses.slice(0, 3).map(ck => <span key={ck} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-[10px] font-bold dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300 shadow-sm">{ck.replace('_','')}</span>)}
                        {activeClasses.length > 3 && <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-1.5 py-1 rounded-lg dark:bg-slate-800">+{activeClasses.length - 3}</span>}
                        {activeClasses.length === 0 && <span className="text-xs text-slate-300 italic">{t('no_classes')}</span>}
                    </div>
                    {leadingBadge}
                </div>
            );
        } else if (u.role === 'employee') {
            return (
                <div className="flex flex-col items-center">
                    <span className="text-xs text-slate-500 font-medium">
                        {u.employeePermissions?.messagingScope?.includes('ALL') ? t('all_classes') : `${u.employeePermissions?.messagingScope?.length || 0} классов`}
                    </span>
                    {u.employeePermissions?.isAdministration && (
                        <span className="text-[9px] uppercase font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 mt-1 dark:bg-amber-900/30 dark:text-amber-400">
                            {t('administration')}
                        </span>
                    )}
                    {leadingBadge}
                </div>
            );
        } else if (u.role === 'director') {
            return (
                <div className="flex flex-col items-center">
                    <span className="text-xs text-slate-500 font-semibold">{t('director')}</span>
                    {leadingBadge}
                </div>
            );
        }
        return <span className="text-slate-400">—</span>;
    })()}
</td><td className="p-5 text-right no-print"><div className="flex items-center justify-end gap-2">{isGlobal && <Button size="sm" variant={u.blockedUntil ? 'primary' : 'secondary'} onClick={() => setBlockingUserId(u.id)}>{u.blockedUntil ? <Unlock size={14} /> : <Lock size={14} />}</Button>}<Button variant="danger" size="sm" onClick={() => deleteUser(u.id, u.fio)}><Trash2 size={14}/></Button></div></td></tr>{u.role === 'teacher' && expandedRows[u.id] && <tr className="bg-slate-50/50 border-b border-slate-200 transition-all animate-in fade-in dark:bg-slate-900/50 dark:border-slate-800 no-print"><td colSpan={isGlobal ? 9 : 8} className="p-4 md:p-5 md:pl-20"><div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-8 shadow-xl max-w-4xl dark:bg-slate-900 dark:border-slate-700"><div className="text-[10px] font-bold text-slate-400 mb-6 uppercase tracking-[0.2em] dark:text-slate-500">{t('class_management')} {u.fio}</div><div className="flex flex-wrap gap-3">{H.getSchoolClasses(state, u.schoolId).map(c => { const key = `${c.class}_${c.letter}`; const isActive = (u.classes || []).includes(key); return <button key={key} onClick={() => isActive ? removeClassFromTeacher(u.id, key) : addClassToTeacher(u.id, key)} className={`px-5 py-2.5 rounded-xl border-2 text-sm font-bold transition-all duration-300 flex items-center gap-2 ${isActive ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30 transform scale-105' : 'bg-white text-slate-600 border-slate-100 hover:border-blue-400 hover:text-blue-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:border-blue-500 dark:hover:text-blue-300'}`}>{isActive && <Check size={16} strokeWidth={3}/>}{c.class}{c.letter}</button> })}</div></div></td></tr>}{u.role === 'employee' && expandedRows[u.id] && <tr className="bg-slate-50/50 border-b border-slate-200 transition-all animate-in fade-in dark:bg-slate-900/50 dark:border-slate-800 no-print"><td colSpan={isGlobal ? 9 : 8} className="p-4 md:p-5 md:pl-20"><div className="bg-white border border-slate-200 rounded-xl p-4 md:p-6 shadow-sm max-w-4xl dark:bg-slate-900 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8"><div><h4 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wide dark:text-slate-400">{t('can_write_to')}</h4><div className="space-y-2 mb-4"><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500" disabled={u.employeePermissions?.isAdministration} checked={u.employeePermissions?.messagingScope?.includes('ALL')} onChange={(e) => updateEmployeePermission(u.id, 'messagingScope', e.target.checked ? ['ALL'] : [])} /><span className="font-semibold text-slate-700 dark:text-slate-200">{t('all_classes')}</span></label></div>{!u.employeePermissions?.messagingScope?.includes('ALL') && <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">{H.getSchoolClasses(state, u.schoolId).map(c => { const key = `${c.class}_${c.letter}`; const isActive = u.employeePermissions?.messagingScope?.includes(key); return <button key={key} onClick={() => { const current = u.employeePermissions?.messagingScope || []; const newScope = isActive ? current.filter(s => s !== key) : [...current, key]; updateEmployeePermission(u.id, 'messagingScope', newScope); }} className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-all ${isActive ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{c.class}{c.letter}</button> })}</div>}</div><div><h4 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wide dark:text-slate-400">{t('access_tabs')}</h4><div className="space-y-3">{['messages', 'announcements', 'rating', 'schedule', 'users', 'load', 'groups', 'grading'].map(tab => <label key={tab} className="flex items-center gap-2 text-sm cursor-pointer p-2 hover:bg-slate-50 rounded dark:hover:bg-slate-800"><input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500" checked={u.employeePermissions?.allowedTabs?.includes(tab)} onChange={(e) => { const current = u.employeePermissions?.allowedTabs || []; const newTabs = e.target.checked ? [...current, tab] : current.filter(t => t !== tab); updateEmployeePermission(u.id, 'allowedTabs', newTabs); }} /><span className="capitalize text-slate-700 dark:text-slate-300">{t(tab === 'load' ? 'teacher_load' : tab === 'grading' ? 'grading_setup' : tab)}</span></label>)}</div><div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2"><h4 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wide dark:text-slate-400">{t('special_rights')}</h4><label className="flex items-center gap-2 text-sm cursor-pointer bg-amber-50 p-2 rounded border border-amber-100 dark:bg-amber-900/20 dark:border-amber-900/30"><input type="checkbox" className="rounded text-amber-600 focus:ring-amber-500" checked={!!u.employeePermissions?.canSendAsDirector} onChange={(e) => updateEmployeePermission(u.id, 'canSendAsDirector', e.target.checked)} /><span className="font-semibold text-amber-900 dark:text-amber-400 flex items-center gap-2"><Shield size={14}/> {t('write_as_director')}</span></label><label className="flex items-center gap-2 text-sm cursor-pointer bg-blue-50 p-2 rounded border border-blue-100 dark:bg-blue-900/20 dark:border-blue-900/30"><input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500" checked={!!u.employeePermissions?.isAdministration} onChange={(e) => updateEmployeePermission(u.id, 'isAdministration', e.target.checked)} /><span className="font-semibold text-blue-900 dark:text-blue-400 flex items-center gap-2"><Building size={14}/> {t('add_to_admin')}</span></label></div></div></div></td></tr>}</React.Fragment>)})}</tbody></table></div>
            </Card>
            <Card className="p-6 md:p-10 max-w-4xl no-print shadow-xl relative"><h3 className="font-bold text-slate-800 mb-6 md:mb-8 text-xl md:text-2xl dark:text-white font-heading">{t('add_user')}</h3>{uiError && uiErrorUserId === 'NEW_USER_FORM' && (<div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between text-red-700 animate-in fade-in slide-in-from-top-2"><div className="flex items-center gap-3"><AlertCircle size={20} /><span className="font-semibold text-sm">{uiError}</span></div><button onClick={() => setUiError(null)} className="ml-auto hover:bg-red-100 p-1 rounded-lg"><XIcon size={16}/></button></div>)}<div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-8 md:mb-10">{isGlobal && <div className="col-span-1 md:col-span-2"><label className="text-sm font-bold text-slate-600 mb-2 block dark:text-slate-300">{t('school')}</label><Select value={newUser.schoolId} onChange={e => setNewUser({...newUser, schoolId: e.target.value})}>{state.schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}<option value="-">-</option></Select></div>}<div className="col-span-1"><label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 block">{t('fio')}</label><Input placeholder={t('fio')} value={newUser.fio} onChange={e => setNewUser({...newUser, fio: e.target.value})} />{validationErrors.some(e => e.includes(t('already_exists'))) && <p className="text-[10px] text-red-500 mt-1 font-bold animate-pulse">{t('already_exists')}</p>}</div><div className="col-span-1"><label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 block">{t('role')}</label><div className="flex flex-col gap-2"><Select value={newUser.role} onChange={e => { const val = e.target.value as Role; setNewUser({ ...newUser, role: val, customRole: val === 'employee' ? 'Сотрудник' : undefined, teacherClasses: [] }); setNewRoleInputOpen(false); }}><option value="student">{t('student')}</option><option value="teacher">{t('teacher')}</option>{(currentUser.role === 'creator' || isGlobal) && <option value="director">{t('director')}</option>}<option value="employee">{t('employee')}</option></Select>{newUser.role === 'employee' && <div className="mt-1">{newRoleInputOpen || newUser.customRole ? <div className="relative group animate-in zoom-in duration-200"><input autoFocus={newRoleInputOpen && !newUser.customRole} className="text-sm border border-blue-300 rounded-lg px-3 py-2.5 w-full bg-white dark:bg-slate-900 dark:text-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder-slate-400" value={newUser.customRole || ''} onChange={e => setNewUser({...newUser, customRole: e.target.value})} placeholder={t('user_position')} />{newRoleInputOpen && !newUser.customRole && <button onClick={() => setNewRoleInputOpen(false)} className="absolute right-2 top-2.5 bg-slate-100 rounded-full p-0.5 text-slate-400 hover:bg-red-100 hover:text-red-500 transition-colors"><XIcon size={14}/></button>}</div> : <button onClick={() => setNewRoleInputOpen(true)} className="w-full flex items-center justify-center gap-2 text-xs font-bold text-slate-500 border border-dashed border-slate-300 rounded-lg py-3 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800"><PlusCircle size={14} /> {t('user_position')}</button>}</div>}</div></div><div className="col-span-1"><label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 block">{t('login')}</label><Input placeholder={t('login')} value={newUser.login} onChange={e => setNewUser({...newUser, login: e.target.value})} />{validationErrors.some(e => e.includes(t('login_taken'))) && <p className="text-[10px] text-red-500 mt-1 font-bold animate-pulse">{t('login_taken')}</p>}</div><div className="col-span-1"><label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 block">{t('password')}</label><Input placeholder={t('password')} value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />{validationErrors.some(e => e.includes(t('password_used'))) && <p className="text-[10px] text-red-500 mt-1 font-bold animate-pulse">{t('password_used')}</p>}</div>{(isGlobal || !isGlobal) && newUser.role === 'student' && <div className="col-span-1 md:col-span-2"><label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 block">{t('choose_class')}</label><Select value={newUser.classKey} onChange={e => setNewUser({...newUser, classKey: e.target.value})}><option value="">{t('not_selected')}</option>{addUserSchoolClasses.map(c => <option key={`${c.class}_${c.letter}`} value={`${c.class}_${c.letter}`}>{c.class}{c.letter}</option>)}</Select></div>}{(isGlobal || !isGlobal) && newUser.role === 'teacher' && <div className="col-span-1 md:col-span-2"><label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 block">{t('assign_classes')}</label><MultiSelect lang={lang as 'ru'|'en'} placeholder={t('select_classes_placeholder')} options={addUserSchoolClasses.map(c => `${c.class}_${c.letter}`)} selected={newUser.teacherClasses} onChange={sel => setNewUser({...newUser, teacherClasses: sel})} label="%s" /></div>}</div><Button variant="primary" onClick={addUser} className="w-full md:w-auto px-12 h-12 text-base shadow-xl disabled:bg-slate-300 disabled:shadow-none" disabled={validationErrors.length > 0}>{t('add_user')}</Button></Card>
            {blockingUserId && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm"><div className="bg-white rounded-2xl shadow-2xl w-full max-sm p-6 dark:bg-slate-900 dark:border dark:border-slate-700"><div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg text-slate-800 dark:text-white">{t('block_user_title')}</h3><button onClick={() => setBlockingUserId(null)} className="text-slate-400 hover:text-slate-600"><UserX size={20}/></button></div><p className="text-sm text-slate-600 mb-6 dark:text-slate-300">{t('select_block_duration')}</p><div className="grid grid-cols-1 gap-3"><Button variant="secondary" onClick={() => applyBlock(blockingUserId, '1h')}>{t('for_1_hour')}</Button><Button variant="secondary" onClick={() => applyBlock(blockingUserId, '24h')}>{t('for_24_hours')}</Button><Button variant="danger" onClick={() => applyBlock(blockingUserId, 'forever')}>{t('forever')}</Button><div className="my-2 border-t border-slate-100 dark:border-slate-800"></div><Button variant="primary" onClick={() => applyBlock(blockingUserId, 'unblock')}>{t('unlock')}</Button></div></div></div>}
            
            {/* NEW CONFIRMATION MODAL */}
            <Modal isOpen={!!classRemovalConfirm} onClose={() => setClassRemovalConfirm(null)} title={t('confirm')}>
                 <div className="space-y-6">
                    <div className="bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-200 flex items-start gap-4 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300">
                         <div className="bg-amber-100 p-2 rounded-full dark:bg-amber-900/50">
                             <AlertCircle size={24} className="text-amber-600 dark:text-amber-400"/>
                         </div>
                         <div>
                             <h4 className="font-bold text-lg mb-1">{t('confirm')}</h4>
                             <p className="text-sm leading-relaxed opacity-90">{t('confirm_remove_class_load')}</p>
                         </div>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <Button variant="ghost" onClick={() => setClassRemovalConfirm(null)}>{t('cancel')}</Button>
                        <Button variant="danger" onClick={() => classRemovalConfirm && proceedRemoveClass(classRemovalConfirm.userId, classRemovalConfirm.classKey, true)}>
                            {t('delete')}
                        </Button>
                    </div>
                 </div>
            </Modal>
        </div>
    );
};
