
import React, { useState, useEffect } from 'react';
import { AppState, GradeType, User } from '../../types';
import * as H from '../../utils/helpers';
import { Button, Input, Select, Card, Modal } from '../../components/ui';
import { Sliders, AlertCircle, Check, AlertTriangle, Settings, X as XIcon, Plus, Tag, Trash2, Edit } from 'lucide-react';

export const GradingSetup = ({ state, onUpdate, user }: { state: AppState, onUpdate: (s: AppState) => void, user?: User }) => {
    const lang = state.settings.language || 'ru';
    const t = (k: string) => H.t(k, lang);
    const schoolId = user?.schoolId;
    const schoolClasses = H.getSchoolClasses(state, schoolId);
    const schoolSubjects = H.getSchoolSubjects(state, schoolId);
    const initialGradingSystem = H.getSchoolGradingSystem(state, schoolId);
    const currentGradeTypes = H.getSchoolGradeTypes(state, schoolId);

    const [selectedClass, setSelectedClass] = useState(schoolClasses[0] ? `${schoolClasses[0].class}_${schoolClasses[0].letter}` : '');
    
    // Top Section State (Buffered to allow "Save")
    const [gradingSettings, setGradingSettings] = useState(initialGradingSystem || {
        minGrade: 2, maxGrade: 5, useWeights: true, minWeight: 1, maxWeight: 10
    });

    // Confirmation Logic for Range Save
    const [confirmStep, setConfirmStep] = useState<0 | 1 | 2>(0);
    const [statusMsg, setStatusMsg] = useState<{type: 'error' | 'success', text: string} | null>(null);
    const [conflictTypes, setConflictTypes] = useState<GradeType[]>([]);
    const [confirmConflictModal, setConfirmConflictModal] = useState(false);
    
    // NEW: Weight Reset Confirmation
    const [weightResetConfirm, setWeightResetConfirm] = useState(false);

    // Grade Type Management State
    const [editingType, setEditingType] = useState<GradeType | null>(null);
    const [typeName, setTypeName] = useState('');
    const [typeCode, setTypeCode] = useState('');
    // CHANGED: Initialize with empty string instead of 2
    const [typeWeight, setTypeWeight] = useState<string | number>('');
    const [isDynamic, setIsDynamic] = useState(false);
    const [isNoWeight, setIsNoWeight] = useState(false);
    const [typeError, setTypeError] = useState<string | null>(null);
    const [weightCellError, setWeightCellError] = useState<{id: string, error: string} | null>(null);

    // Auto-dismiss success message
    useEffect(() => {
        if (statusMsg?.type === 'success') {
            const timer = setTimeout(() => {
                setStatusMsg(null);
            }, 5000); // 5 seconds
            return () => clearTimeout(timer);
        }
    }, [statusMsg]);

    // Check for changes to disable save button
    const hasChanges = JSON.stringify(gradingSettings) !== JSON.stringify(initialGradingSystem);

    const validate = () => {
        if (gradingSettings.minGrade === undefined || isNaN(gradingSettings.minGrade) || gradingSettings.maxGrade === undefined || isNaN(gradingSettings.maxGrade)) return 'Заполните диапазон оценок.';
        if (gradingSettings.minGrade <= 0 || gradingSettings.maxGrade <= 0) return 'Оценки должны быть больше 0.';
        if (gradingSettings.minGrade >= gradingSettings.maxGrade) return 'Мин. оценка должна быть меньше макс. оценки.';
        if (gradingSettings.useWeights) {
            if (gradingSettings.minWeight === undefined || isNaN(gradingSettings.minWeight) || gradingSettings.maxWeight === undefined || isNaN(gradingSettings.maxWeight)) return 'Заполните диапазон весов.';
            if (gradingSettings.minWeight <= 0 || gradingSettings.maxWeight <= 0) return 'Веса должны быть больше 0.';
            if (gradingSettings.minWeight > gradingSettings.maxWeight) return 'Мин. вес не может быть больше макс. веса.';
        }
        return null;
    };

    const handleSaveClick = () => {
        if (!hasChanges) return;
        const error = validate();
        if (error) {
            setStatusMsg({type: 'error', text: error});
            return;
        }
        
        // 1. Check for Weight Toggle Change
        if (gradingSettings.useWeights !== initialGradingSystem?.useWeights) {
            setWeightResetConfirm(true);
            return;
        }
        
        // 2. Check for conflicts with existing Grade Types (Only if weights are staying ON and not toggled)
        if (gradingSettings.useWeights) {
            const conflicts = currentGradeTypes.filter(gt => {
                if (gt.isDynamicWeight || gt.isNoWeight) return false;
                return gt.weight < gradingSettings.minWeight || gt.weight > gradingSettings.maxWeight;
            });
            
            if (conflicts.length > 0) {
                setConflictTypes(conflicts);
                setConfirmConflictModal(true);
                return;
            }
        }

        setStatusMsg(null);
        setConfirmStep(1);
    };

    const proceedWithRangeUpdate = (deleteConflicts: boolean) => {
        if (deleteConflicts) {
            const safeIds = conflictTypes.map(c => c.id);
            const remaining = currentGradeTypes.filter(gt => !safeIds.includes(gt.id));
            H.setSchoolGradeTypes(state, schoolId, remaining);
        }
        setConfirmConflictModal(false);
        setConfirmStep(1); // Proceed to normal wipe confirmation
    };
    
    const proceedFromWeightReset = () => {
        setWeightResetConfirm(false);
        setConfirmStep(1);
    };

    const confirmSave = () => {
        if (confirmStep === 1) {
            setConfirmStep(2);
        } else if (confirmStep === 2) {
            // Apply Weight Reset if Toggle Changed
            if (gradingSettings.useWeights !== initialGradingSystem?.useWeights) {
                 const updatedTypes = currentGradeTypes.map(gt => {
                     if (!gt.isDynamicWeight && !gt.isNoWeight) {
                         return { ...gt, weight: 1 };
                     }
                     return gt;
                 });
                 H.setSchoolGradeTypes(state, schoolId, updatedTypes);
            }

            // EXECUTE SAVE AND WIPE
            H.setSchoolGradingSystem(state, schoolId, gradingSettings);
            if (schoolId) {
                const school = H.getSchool(state, schoolId);
                if (school) {
                    school.grades = {};
                    school.finalGrades = {};
                }
            }
            state.grades = {}; // Wipe grades
            state.finalGrades = {}; // Wipe final grades
            onUpdate(state);
            
            setConfirmStep(0);
            setStatusMsg({type: 'success', text: 'Система оценивания обновлена. Все старые оценки удалены.'});
        }
    };

    const cancelSave = () => {
        setConfirmStep(0);
        setStatusMsg(null);
    };

    // Helper to calculate lessons per week for the currently viewed week in system
    const getLessonsPerWeek = (classKey: string, subject: string): number => {
        const schedule = H.getSchoolClassSchedule(state, schoolId, classKey);
        if (!schedule) return 0;
        
        // Use system time for current week calculation
        const systemNow = new Date(Date.now() + (state.settings.systemTimeOffset || 0));
        const weekStart = H.getStartOfWeek(systemNow);
        
        let count = 0;
        Object.values(schedule).forEach(day => {
            if (H.isDateInWeek(day.date, weekStart)) {
                day.lessons.forEach(l => {
                    if (l.lesson === subject) count++;
                    if (l.subgroups) {
                        if (l.subgroups.some(sg => sg.subject === subject)) count++;
                    }
                });
            }
        });
        return count;
    };

    const updateRequirement = (subject: string, field: 'type' | 'minGrades', value: any) => {
        const targetClassKey = H.getSchoolClassKey(schoolId, selectedClass);
        if (!state.subjectRequirements) state.subjectRequirements = {};
        if (!state.subjectRequirements[targetClassKey]) state.subjectRequirements[targetClassKey] = {};
        if (!state.subjectRequirements[targetClassKey][subject]) {
            state.subjectRequirements[targetClassKey][subject] = { type: 'auto', minGrades: 0 };
        }
        (state.subjectRequirements[targetClassKey][subject] as any)[field] = value;

        if (schoolId) {
            const school = H.getSchool(state, schoolId);
            if (school) {
                if (!school.subjectRequirements) school.subjectRequirements = {};
                if (!school.subjectRequirements[selectedClass]) school.subjectRequirements[selectedClass] = {};
                if (!school.subjectRequirements[selectedClass][subject]) {
                    school.subjectRequirements[selectedClass][subject] = { type: 'auto', minGrades: 0 };
                }
                (school.subjectRequirements[selectedClass][subject] as any)[field] = value;
            }
        }
        onUpdate(state);
    };

    // --- Grade Type Logic ---
    const resetForm = () => {
        setEditingType(null);
        setTypeName('');
        setTypeCode('');
        setTypeWeight(''); // Reset to empty
        setIsDynamic(false);
        setIsNoWeight(false);
        setTypeError(null);
    };

    const openEditType = (gt: GradeType) => {
        setEditingType(gt);
        setTypeName(gt.name);
        setTypeCode(gt.key);
        setTypeWeight(gt.weight);
        setIsDynamic(!!gt.isDynamicWeight);
        setIsNoWeight(!!gt.isNoWeight);
        setTypeError(null);
    };

    const deleteType = (id: string) => {
        if (!confirm('Вы уверены, что хотите удалить этот тип оценки?')) return;
        const updated = currentGradeTypes.filter(gt => gt.id !== id);
        H.setSchoolGradeTypes(state, schoolId, updated);
        onUpdate(state);
        resetForm();
    };

    const saveType = () => {
        if (!typeName) return setTypeError('Введите название типа');
        
        // Name uniqueness
        const existingName = currentGradeTypes.find(gt => gt.name.toLowerCase() === typeName.toLowerCase().trim() && gt.id !== editingType?.id);
        if (existingName) return setTypeError('Тип с таким именем уже существует');

        // Checkboxes logic
        if (isDynamic && isNoWeight) return setTypeError('Нельзя выбрать оба флага одновременно'); 
        
        // Weight validation (ONLY IF WEIGHTS ARE ENABLED GLOBALLY)
        let finalWeight = 1;
        
        if (initialGradingSystem?.useWeights) {
            if (!isDynamic && !isNoWeight) {
                if (typeWeight === '' || typeWeight === undefined) return setTypeError('Введите число для коэффициента');
                finalWeight = typeof typeWeight === 'string' ? parseFloat(typeWeight) : typeWeight;
                const min = initialGradingSystem?.minWeight || 1;
                const max = initialGradingSystem?.maxWeight || 10;
                if (isNaN(finalWeight)) return setTypeError('Введите число для коэффициента');
                if (finalWeight <= 0) return setTypeError('Коэффициент должен быть больше 0');
                if (finalWeight < min || finalWeight > max) {
                    return setTypeError(`Коэффициент должен быть в диапазоне от ${min} до ${max}`);
                }
            }
        } else {
            // If weights are disabled, force weight to 1
            finalWeight = 1;
        }

        const key = typeCode || H.uid('k').substring(0, 4); // simplistic key gen if empty

        const newType: GradeType = {
            id: editingType ? editingType.id : H.uid('gt'),
            key: editingType ? (typeCode || editingType.key) : key,
            name: typeName,
            // If global weights are OFF, we save 1. If ON, we use calculated finalWeight (or 0 for special types)
            weight: !initialGradingSystem?.useWeights ? 1 : (isDynamic || isNoWeight ? 0 : finalWeight),
            isDynamicWeight: isDynamic,
            isNoWeight: isNoWeight
        };

        const updatedTypes = [...currentGradeTypes];
        if (editingType) {
            const idx = updatedTypes.findIndex(gt => gt.id === editingType.id);
            if (idx > -1) {
                updatedTypes[idx] = newType;
            }
        } else {
            updatedTypes.push(newType);
        }
        H.setSchoolGradeTypes(state, schoolId, updatedTypes);
        
        onUpdate(state);
        resetForm();
    };

    const handleCellWeightBlur = (id: string, value: string) => {
        const numVal = parseFloat(value);
        const min = initialGradingSystem?.minWeight || 1;
        const max = initialGradingSystem?.maxWeight || 10;

        if (isNaN(numVal) || numVal <= 0) {
            setWeightCellError({id, error: 'Должно быть > 0'});
            return;
        }
        if (numVal < min || numVal > max) {
            setWeightCellError({id, error: `Диапазон: ${min}-${max}`});
            return;
        }

        setWeightCellError(null);
        const updatedTypes = currentGradeTypes.map(gt => gt.id === id ? { ...gt, weight: numVal } : gt);
        H.setSchoolGradeTypes(state, schoolId, updatedTypes);
        onUpdate(state);
    };

    return (
        <div className="space-y-8">
            {/* Top Section: Grading System */}
            <Card className="p-8">
                <div className="flex items-center gap-3 mb-6">
                    <Sliders size={24} className="text-slate-700 dark:text-slate-300"/>
                    <h3 className="font-bold text-xl text-slate-800 dark:text-white font-heading">{t('grading_system')}</h3>
                </div>
                
                <div className="flex flex-wrap gap-8 items-end mb-6">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">{t('grade_range')}</label>
                        <div className="flex items-center gap-2">
                            <Input 
                                type="number" 
                                min="1"
                                className="w-20 text-center" 
                                value={isNaN(gradingSettings.minGrade) ? '' : gradingSettings.minGrade} 
                                onChange={e => setGradingSettings({...gradingSettings, minGrade: parseInt(e.target.value)})}
                            />
                            <span className="text-slate-400">—</span>
                            <Input 
                                type="number" 
                                min="1"
                                className="w-20 text-center" 
                                value={isNaN(gradingSettings.maxGrade) ? '' : gradingSettings.maxGrade} 
                                onChange={e => setGradingSettings({...gradingSettings, maxGrade: parseInt(e.target.value)})}
                            />
                        </div>
                    </div>

                    <div className="pb-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                                checked={gradingSettings.useWeights}
                                onChange={e => setGradingSettings({...gradingSettings, useWeights: e.target.checked})}
                            />
                            <span className="font-bold text-slate-700 dark:text-slate-300">{t('use_coefficients')}</span>
                        </label>
                    </div>

                    {gradingSettings.useWeights && (
                        <div className="animate-in fade-in slide-in-from-left-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">{t('weight_range')}</label>
                            <div className="flex items-center gap-2">
                                <Input 
                                    type="number" 
                                    min="1"
                                    className="w-20 text-center" 
                                    value={isNaN(gradingSettings.minWeight) ? '' : gradingSettings.minWeight} 
                                    onChange={e => setGradingSettings({...gradingSettings, minWeight: parseInt(e.target.value)})}
                                />
                                <span className="text-slate-400">—</span>
                                <Input 
                                    type="number" 
                                    min="1"
                                    className="w-20 text-center" 
                                    value={isNaN(gradingSettings.maxWeight) ? '' : gradingSettings.maxWeight} 
                                    onChange={e => setGradingSettings({...gradingSettings, maxWeight: parseInt(e.target.value)})}
                                />
                            </div>
                        </div>
                    )}

                    {!confirmStep && <Button onClick={handleSaveClick} disabled={!hasChanges} variant="primary" className="ml-auto px-8">{t('save')}</Button>}
                </div>

                {statusMsg && (
                    <div className={`p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${statusMsg.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                        {statusMsg.type === 'error' ? <AlertCircle size={20}/> : <Check size={20}/>}
                        <span className="font-semibold">{statusMsg.text}</span>
                        {statusMsg.type === 'success' && <button onClick={() => setStatusMsg(null)} className="ml-auto"><XIcon size={16}/></button>}
                    </div>
                )}

                {confirmStep > 0 && (
                    <div className="mt-4 p-5 bg-amber-50 border border-amber-200 rounded-xl animate-in zoom-in-95 duration-200 dark:bg-amber-900/20 dark:border-amber-800">
                        <div className="flex items-start gap-4">
                            <AlertTriangle size={24} className="text-amber-600 flex-shrink-0 mt-1 dark:text-amber-500"/>
                            <div>
                                <h4 className="text-lg font-bold text-amber-900 dark:text-amber-400 mb-2">
                                    {confirmStep === 1 ? 'Внимание! Это опасное действие.' : 'Вы абсолютно уверены?'}
                                </h4>
                                <p className="text-amber-800 dark:text-amber-300 text-sm mb-4">
                                    {confirmStep === 1 
                                        ? 'Сохранение новой системы оценивания приведет к УДАЛЕНИЮ ВСЕХ ранее выставленных оценок во всей школе. Это действие необратимо.'
                                        : 'Все данные об успеваемости будут уничтожены. Подтвердите сохранение.'}
                                </p>
                                <div className="flex gap-3">
                                    <Button onClick={cancelSave} variant="secondary" className="bg-white border-amber-200 text-amber-900 hover:bg-amber-100 dark:bg-slate-800 dark:text-amber-300 dark:border-amber-900">{t('cancel')}</Button>
                                    <Button onClick={confirmSave} variant="danger" className="!bg-red-600 !text-white hover:!bg-red-700 border-transparent shadow-lg shadow-red-500/30 font-bold">
                                        {confirmStep === 1 ? 'Я понимаю, продолжить' : 'ПОДТВЕРДИТЬ УДАЛЕНИЕ И СОХРАНИТЬ'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </Card>

            {/* Middle Section: Grade Types Management */}
            <Card className="p-0 overflow-hidden">
                <div className="flex flex-col md:flex-row">
                    {/* LEFT: FORM */}
                    <div className="w-full md:w-1/3 p-8 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50/50 dark:bg-slate-900 dark:border-slate-800">
                        <div className="flex items-center gap-3 mb-6">
                            <Tag size={24} className="text-slate-700 dark:text-slate-300"/>
                            <h3 className="font-bold text-xl text-slate-800 dark:text-white font-heading uppercase tracking-wide">{editingType ? 'Редактировать тип' : 'Добавить тип'}</h3>
                        </div>
                        
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Название</label>
                                <Input value={typeName} onChange={e => setTypeName(e.target.value)} placeholder="Например: Эссе" />
                            </div>
                            
                            {/* Conditionally render Weight inputs based on Global Setting */}
                            {initialGradingSystem?.useWeights && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Коэффициент</label>
                                    <div className="flex gap-3 items-start">
                                        <div className="flex-1">
                                            <Input 
                                                type={isDynamic || isNoWeight ? 'text' : 'number'}
                                                min={initialGradingSystem?.minWeight} 
                                                max={initialGradingSystem?.maxWeight} 
                                                value={isDynamic || isNoWeight ? '-' : typeWeight} 
                                                disabled={isDynamic || isNoWeight}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    // Live validation for input field
                                                    if (!isDynamic && !isNoWeight) {
                                                        if (val !== '') {
                                                            const num = parseFloat(val);
                                                            if (num <= 0) setTypeError('Число должно быть > 0');
                                                            else if (num < (initialGradingSystem?.minWeight || 1) || num > (initialGradingSystem?.maxWeight || 10)) setTypeError('Вне диапазона');
                                                            else setTypeError(null);
                                                        }
                                                    }
                                                    setTypeWeight(val);
                                                }} 
                                                placeholder="Число"
                                                className={isDynamic || isNoWeight ? 'text-center font-bold text-slate-400 bg-slate-100 cursor-not-allowed' : ''}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2 pt-1">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300" 
                                                    checked={isDynamic} 
                                                    onChange={e => { setIsDynamic(e.target.checked); if(e.target.checked) setIsNoWeight(false); setTypeError(null); }}
                                                />
                                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Учитель ставит вес (как Н/У)</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300" 
                                                    checked={isNoWeight} 
                                                    onChange={e => { setIsNoWeight(e.target.checked); if(e.target.checked) setIsDynamic(false); setTypeError(null); }}
                                                />
                                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Нет веса/числа (как Н, ОП)</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {typeError && (
                                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs font-bold flex items-center gap-2 border border-red-100 animate-pulse">
                                    <AlertCircle size={14}/> {typeError}
                                </div>
                            )}

                            <Button onClick={saveType} variant="primary" className="w-full h-12 text-sm shadow-lg shadow-blue-500/20">{editingType ? 'Сохранить изменения' : 'Добавить'}</Button>
                            {editingType && <Button onClick={resetForm} variant="ghost" className="w-full text-xs">Отмена</Button>}
                        </div>
                    </div>

                    {/* RIGHT: LIST */}
                    <div className="w-full md:w-2/3 p-0 bg-white dark:bg-slate-900">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-xs uppercase tracking-wider dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
                                    <tr>
                                        <th className="p-4 pl-6">Тип</th>
                                        <th className="p-4 text-center w-32">Вес</th>
                                        <th className="p-4 text-right pr-6">Действия</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {currentGradeTypes.map(gt => (
                                        <tr key={gt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 group transition-colors">
                                            <td className="p-4 pl-6 font-bold text-slate-700 dark:text-slate-200">{gt.name}</td>
                                            <td className="p-4 text-center relative">
                                                {/* CONDITIONAL RENDER: If global weights are OFF, just show dashes for everyone */}
                                                {!initialGradingSystem?.useWeights ? (
                                                    <span className="font-bold text-slate-300">-</span>
                                                ) : gt.isDynamicWeight ? (
                                                    <span className="inline-block text-[10px] uppercase font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400">Редак.</span>
                                                ) : gt.isNoWeight ? (
                                                    <span className="inline-block text-[10px] uppercase font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded border border-purple-100 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-400">-</span>
                                                ) : (
                                                    <div className="relative inline-block w-20">
                                                        <Input 
                                                            className={`h-8 text-center font-bold text-slate-800 dark:text-white text-sm ${weightCellError?.id === gt.id ? 'border-red-300 focus:border-red-500 bg-red-50 text-red-700' : 'border-transparent bg-transparent hover:bg-slate-100 hover:border-slate-200 focus:bg-white focus:border-blue-500'}`}
                                                            defaultValue={gt.weight}
                                                            onBlur={(e) => handleCellWeightBlur(gt.id, e.target.value)}
                                                            onKeyDown={(e) => { if(e.key === 'Enter') e.currentTarget.blur(); }}
                                                        />
                                                        {weightCellError?.id === gt.id && (
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-red-600 text-white text-[10px] px-2 py-1 rounded shadow-lg z-10 whitespace-nowrap animate-in fade-in zoom-in">
                                                                {weightCellError.error}
                                                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-red-600"></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 text-right pr-6 flex justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openEditType(gt)} className="p-2 text-blue-500 hover:bg-blue-50 rounded transition"><Edit size={16}/></button>
                                                <button onClick={() => deleteType(gt.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition"><Trash2 size={16}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {currentGradeTypes.length === 0 && (
                                        <tr><td colSpan={3} className="p-8 text-center text-slate-400 italic">Нет созданных типов</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Bottom Section: Subject Requirements */}
            <Card className="p-8">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <Settings size={24} className="text-slate-700 dark:text-slate-300"/>
                        <h3 className="font-bold text-xl text-slate-800 dark:text-white font-heading">{t('grades_per_subject')}</h3>
                    </div>
                    <Select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-40">
                        {schoolClasses.map(c => <option key={`${c.class}_${c.letter}`} value={`${c.class}_${c.letter}`}>{c.class}{c.letter}</option>)}
                    </Select>
                </div>

                <div className="bg-blue-50 border border-blue-100 text-blue-800 p-4 rounded-xl mb-6 text-sm font-medium dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300">
                    {t('auto_logic_info')}
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl dark:border-slate-700">
                    <table className="w-full text-sm text-left min-w-[500px]">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400">
                            <tr>
                                <th className="p-4">{t('subject')}</th>
                                <th className="p-4 text-center">{t('lessons_week')}</th>
                                <th className="p-4 text-center w-40">{t('type')}</th>
                                <th className="p-4 text-center w-32">{t('min_grades')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {schoolSubjects.map(subj => {
                                const targetClassKey = H.getSchoolClassKey(schoolId, selectedClass);
                                const lessonsCount = getLessonsPerWeek(selectedClass, subj);
                                const autoMin = lessonsCount > 3 ? 5 : (lessonsCount >= 1 ? 3 : 0);
                                const req = state.subjectRequirements?.[targetClassKey]?.[subj] || state.subjectRequirements?.[selectedClass]?.[subj] || { type: 'auto', minGrades: autoMin };
                                const isAuto = req.type === 'auto';
                                const displayMin = isAuto ? autoMin : req.minGrades;

                                return (
                                    <tr key={subj} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="p-4 font-bold text-slate-700 dark:text-slate-200">{subj}</td>
                                        <td className="p-4 text-center font-mono text-slate-500">{lessonsCount}</td>
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center bg-slate-100 rounded-lg p-1 w-fit mx-auto dark:bg-slate-800">
                                                <button 
                                                    onClick={() => updateRequirement(subj, 'type', 'auto')}
                                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${isAuto ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    {t('auto')}
                                                </button>
                                                <button 
                                                    onClick={() => updateRequirement(subj, 'type', 'manual')}
                                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${!isAuto ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    {t('manual')}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <Input 
                                                type="number" 
                                                min="0"
                                                className={`w-20 text-center font-bold mx-auto ${isAuto ? 'bg-slate-50 text-slate-500 border-transparent shadow-none' : 'bg-white border-slate-200'}`}
                                                value={displayMin}
                                                disabled={isAuto}
                                                onChange={e => updateRequirement(subj, 'minGrades', parseInt(e.target.value))}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Range Conflict Confirmation Modal */}
            <Modal isOpen={confirmConflictModal} onClose={() => setConfirmConflictModal(false)} title="Конфликт диапазона весов">
                <div className="space-y-4">
                    <div className="bg-red-50 p-4 rounded-xl border border-red-200 flex items-start gap-3 text-red-800">
                        <AlertTriangle className="flex-shrink-0 mt-0.5" size={20}/>
                        <div>
                            <h4 className="font-bold text-lg mb-1">Обнаружены конфликты</h4>
                            <p className="text-sm">
                                Новый диапазон весов ({gradingSettings.minWeight} - {gradingSettings.maxWeight}) исключает коэффициенты следующих типов оценок. 
                                <br/><br/>
                                Чтобы продолжить, эти типы будут <strong>удалены</strong>.
                            </p>
                        </div>
                    </div>
                    
                    <div className="border rounded-lg overflow-x-auto">
                        <table className="w-full text-sm min-w-[300px]">
                            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800">
                                <tr>
                                    <th className="p-2 text-left">Тип</th>
                                    <th className="p-2 text-center">Текущий вес</th>
                                </tr>
                            </thead>
                            <tbody>
                                {conflictTypes.map(ct => (
                                    <tr key={ct.id} className="border-t">
                                        <td className="p-2 font-bold">{ct.name}</td>
                                        <td className="p-2 text-center text-red-600 font-bold">{ct.weight}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button onClick={() => setConfirmConflictModal(false)} variant="secondary">{t('cancel')}</Button>
                        <Button onClick={() => proceedWithRangeUpdate(true)} variant="danger">Подтвердить удаление и продолжить</Button>
                    </div>
                </div>
            </Modal>
            
            {/* Weight Reset Confirmation Modal */}
            <Modal isOpen={weightResetConfirm} onClose={() => setWeightResetConfirm(false)} title="Сброс коэффициентов">
                <div className="space-y-4">
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex items-start gap-3 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300">
                        <AlertTriangle className="flex-shrink-0 mt-0.5" size={24}/>
                        <div>
                            <h4 className="font-bold text-lg mb-1">Внимание!</h4>
                            <p className="text-sm">
                                Вы изменили настройку использования коэффициентов. 
                                <br/><br/>
                                При сохранении все коэффициенты типов оценок будут <strong>сброшены до 1</strong>.
                            </p>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button onClick={() => setWeightResetConfirm(false)} variant="secondary">{t('cancel')}</Button>
                        <Button onClick={proceedFromWeightReset} variant="primary">Понятно, продолжить</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
