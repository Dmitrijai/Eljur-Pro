
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
    
    useEffect(() => {
        if (schoolClasses.length > 0 && !schoolClasses.some(c => `${c.class}_${c.letter}` === selectedClass)) {
            setSelectedClass(`${schoolClasses[0].class}_${schoolClasses[0].letter}`);
        }
    }, [schoolClasses, selectedClass]);

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
        if (gradingSettings.minGrade === undefined || isNaN(gradingSettings.minGrade) || gradingSettings.maxGrade === undefined || isNaN(gradingSettings.maxGrade)) return t('fill_range_grades');
        if (gradingSettings.minGrade <= 0 || gradingSettings.maxGrade <= 0) return t('grades_gt_0');
        if (gradingSettings.minGrade >= gradingSettings.maxGrade) return t('min_lt_max');
        if (gradingSettings.useWeights) {
            if (gradingSettings.minWeight === undefined || isNaN(gradingSettings.minWeight) || gradingSettings.maxWeight === undefined || isNaN(gradingSettings.maxWeight)) return t('fill_range_weights');
            if (gradingSettings.minWeight <= 0 || gradingSettings.maxWeight <= 0) return t('weights_gt_0');
            if (gradingSettings.minWeight > gradingSettings.maxWeight) return t('min_weight_gt_max');
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
                H.clearSchoolGrades(state, schoolId);
                const prefix = `${schoolId}__`;
                if (state.grades) {
                    Object.keys(state.grades).forEach(k => {
                        if (k.startsWith(prefix)) delete state.grades[k];
                    });
                }
                if (state.finalGrades) {
                    Object.keys(state.finalGrades).forEach(k => {
                        if (k.startsWith(prefix)) delete state.finalGrades[k];
                    });
                }
            } else {
                state.grades = {}; // Wipe grades if global
                state.finalGrades = {}; // Wipe final grades if global
            }
            onUpdate(state);
            
            setConfirmStep(0);
            setStatusMsg({type: 'success', text: t('grading_updated_msg')});
        }
    };

    const cancelSave = () => {
        setConfirmStep(0);
        setStatusMsg(null);
    };

    // Helper to calculate lessons per week for the currently viewed week in system (with multi-week fallback for vacations)
    const getLessonsPerWeek = (classKey: string, subject: string): number => {
        const schedule = H.getSchoolClassSchedule(state, schoolId, classKey);
        if (!schedule) return 0;
        
        const systemNow = H.getSchoolNow(state, schoolId);
        const weekStart = H.getStartOfWeek(systemNow);
        
        let count = 0;
        const weekCounts: Record<string, number> = {};
        Object.values(schedule).forEach(day => {
            let dayMatches = 0;
            day.lessons.forEach(l => {
                if (l.lesson === subject) dayMatches++;
                if (l.subgroups && l.subgroups.some(sg => sg.subject === subject)) dayMatches++;
            });
            if (dayMatches > 0) {
                const ws = H.dateToIso(H.getStartOfWeek(H.parseIsoDateLocal(day.date)));
                weekCounts[ws] = (weekCounts[ws] || 0) + dayMatches;
            }
            if (H.isDateInWeek(day.date, weekStart)) {
                count += dayMatches;
            }
        });
        if (count === 0 && Object.keys(weekCounts).length > 0) {
            return Math.max(...Object.values(weekCounts));
        }
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
        if (!confirm(t('delete_type_confirm'))) return;
        const updated = currentGradeTypes.filter(gt => gt.id !== id);
        H.setSchoolGradeTypes(state, schoolId, updated);
        onUpdate(state);
        resetForm();
    };

    const saveType = () => {
        if (!typeName) return setTypeError(t('enter_type_name'));
        
        // Name uniqueness
        const existingName = currentGradeTypes.find(gt => gt.name.toLowerCase() === typeName.toLowerCase().trim() && gt.id !== editingType?.id);
        if (existingName) return setTypeError(t('type_exists'));

        // Checkboxes logic
        if (isDynamic && isNoWeight) return setTypeError(t('both_flags_error')); 
        
        // Weight validation (ONLY IF WEIGHTS ARE ENABLED GLOBALLY)
        let finalWeight = 1;
        
        if (initialGradingSystem?.useWeights) {
            if (!isDynamic && !isNoWeight) {
                if (typeWeight === '' || typeWeight === undefined) return setTypeError(t('enter_coeff_number'));
                finalWeight = typeof typeWeight === 'string' ? parseFloat(typeWeight) : typeWeight;
                const min = initialGradingSystem?.minWeight || 1;
                const max = initialGradingSystem?.maxWeight || 10;
                if (isNaN(finalWeight)) return setTypeError(t('enter_coeff_number'));
                if (finalWeight <= 0) return setTypeError(t('coeff_gt_0'));
                if (finalWeight < min || finalWeight > max) {
                    return setTypeError(`${t('coeff_range_error')} ${min} - ${max}`);
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
            setWeightCellError({id, error: t('must_be_gt_0')});
            return;
        }
        if (numVal < min || numVal > max) {
            setWeightCellError({id, error: `${t('range_label')}: ${min}-${max}`});
            return;
        }

        setWeightCellError(null);
        const updatedTypes = currentGradeTypes.map(gt => gt.id === id ? { ...gt, weight: numVal } : gt);
        H.setSchoolGradeTypes(state, schoolId, updatedTypes);
        onUpdate(state);
    };

    return (
        <div className="space-y-4 sm:space-y-8">
            {/* Top Section: Grading System */}
            <Card className="p-3 sm:p-8">
                <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-6">
                    <Sliders size={18} className="text-slate-700 dark:text-slate-300 sm:w-6 sm:h-6"/>
                    <h3 className="font-bold text-base sm:text-xl text-slate-800 dark:text-white font-heading">{t('grading_system')}</h3>
                </div>
                
                <div className="flex flex-wrap gap-2.5 sm:gap-8 items-end mb-3 sm:mb-6">
                    <div>
                        <label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 sm:mb-2 block">{t('grade_range')}</label>
                        <div className="flex items-center gap-1 sm:gap-2">
                            <Input 
                                type="number" 
                                min="1"
                                maxLength={4}
                                className="w-11 sm:w-20 h-6 sm:h-10 text-[11px] sm:text-sm !py-0.5 !px-1 sm:!py-2.5 sm:!px-3 text-center" 
                                value={isNaN(gradingSettings.minGrade) ? '' : gradingSettings.minGrade} 
                                onChange={e => setGradingSettings({...gradingSettings, minGrade: parseInt(e.target.value)})}
                            />
                            <span className="text-slate-400 text-xs">—</span>
                            <Input 
                                type="number" 
                                min="1"
                                maxLength={4}
                                className="w-11 sm:w-20 h-6 sm:h-10 text-[11px] sm:text-sm !py-0.5 !px-1 sm:!py-2.5 sm:!px-3 text-center" 
                                value={isNaN(gradingSettings.maxGrade) ? '' : gradingSettings.maxGrade} 
                                onChange={e => setGradingSettings({...gradingSettings, maxGrade: parseInt(e.target.value)})}
                            />
                        </div>
                    </div>

                    <div className="pb-1 sm:pb-3">
                        <label className="flex items-center gap-1.5 sm:gap-3 cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="w-3.5 h-3.5 sm:w-5 sm:h-5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                                checked={gradingSettings.useWeights}
                                onChange={e => setGradingSettings({...gradingSettings, useWeights: e.target.checked})}
                            />
                            <span className="font-bold text-[11px] sm:text-base text-slate-700 dark:text-slate-300">{t('use_coefficients')}</span>
                        </label>
                    </div>

                    {gradingSettings.useWeights && (
                        <div className="animate-in fade-in slide-in-from-left-2">
                            <label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 sm:mb-2 block">{t('weight_range')}</label>
                            <div className="flex items-center gap-1 sm:gap-2">
                                <Input 
                                    type="number" 
                                    min="1"
                                    maxLength={4}
                                    className="w-11 sm:w-20 h-6 sm:h-10 text-[11px] sm:text-sm !py-0.5 !px-1 sm:!py-2.5 sm:!px-3 text-center" 
                                    value={isNaN(gradingSettings.minWeight) ? '' : gradingSettings.minWeight} 
                                    onChange={e => setGradingSettings({...gradingSettings, minWeight: parseInt(e.target.value)})}
                                />
                                <span className="text-slate-400 text-xs">—</span>
                                <Input 
                                    type="number" 
                                    min="1"
                                    maxLength={4}
                                    className="w-11 sm:w-20 h-6 sm:h-10 text-[11px] sm:text-sm !py-0.5 !px-1 sm:!py-2.5 sm:!px-3 text-center" 
                                    value={isNaN(gradingSettings.maxWeight) ? '' : gradingSettings.maxWeight} 
                                    onChange={e => setGradingSettings({...gradingSettings, maxWeight: parseInt(e.target.value)})}
                                />
                            </div>
                        </div>
                    )}

                    {!confirmStep && <Button onClick={handleSaveClick} disabled={!hasChanges} variant="primary" size="sm" className="w-full sm:w-auto sm:ml-auto px-4 sm:px-8 h-7 sm:h-10 text-xs sm:text-sm">{t('save')}</Button>}
                </div>

                {statusMsg && (
                    <div className={`p-2.5 sm:p-4 rounded-xl border flex items-center gap-2 sm:gap-3 animate-in fade-in slide-in-from-top-2 text-xs sm:text-sm ${statusMsg.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                        {statusMsg.type === 'error' ? <AlertCircle size={16} className="sm:w-5 sm:h-5"/> : <Check size={16} className="sm:w-5 sm:h-5"/>}
                        <span className="font-semibold">{statusMsg.text}</span>
                        {statusMsg.type === 'success' && <button onClick={() => setStatusMsg(null)} className="ml-auto"><XIcon size={14} className="sm:w-4 sm:h-4"/></button>}
                    </div>
                )}

                {confirmStep > 0 && (
                    <div className="mt-3 sm:mt-4 p-3 sm:p-5 bg-amber-50 border border-amber-200 rounded-xl animate-in zoom-in-95 duration-200 dark:bg-amber-900/20 dark:border-amber-800">
                        <div className="flex items-start gap-2.5 sm:gap-4">
                            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5 sm:mt-1 sm:w-6 sm:h-6 dark:text-amber-500"/>
                            <div>
                                <h4 className="text-sm sm:text-lg font-bold text-amber-900 dark:text-amber-400 mb-1 sm:mb-2">
                                    {confirmStep === 1 ? t('warning_dangerous') : t('are_you_sure')}
                                </h4>
                                <p className="text-amber-800 dark:text-amber-300 text-xs sm:text-sm mb-3 sm:mb-4">
                                    {confirmStep === 1 
                                        ? t('wipe_grades_warning')
                                        : t('wipe_grades_confirm')}
                                </p>
                                <div className="flex flex-wrap gap-2 sm:gap-3">
                                    <Button size="sm" onClick={cancelSave} variant="secondary" className="h-8 sm:h-10 text-xs sm:text-sm bg-white border-amber-200 text-amber-900 hover:bg-amber-100 dark:bg-slate-800 dark:text-amber-300 dark:border-amber-900">{t('cancel')}</Button>
                                    <Button size="sm" onClick={confirmSave} variant="danger" className="h-8 sm:h-10 text-xs sm:text-sm !bg-red-600 !text-white hover:!bg-red-700 border-transparent shadow-lg shadow-red-500/30 font-bold">
                                        {confirmStep === 1 ? t('understand_continue') : t('confirm_delete_save')}
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
                    <div className="w-full md:w-1/3 p-3 sm:p-8 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50/50 dark:bg-slate-900 dark:border-slate-800">
                        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-6">
                            <Tag size={18} className="text-slate-700 dark:text-slate-300 sm:w-6 sm:h-6"/>
                            <h3 className="font-bold text-base sm:text-xl text-slate-800 dark:text-white font-heading uppercase tracking-wide">{editingType ? t('edit_type') : t('add_type')}</h3>
                        </div>
                        
                        <div className="space-y-2.5 sm:space-y-6">
                            <div>
                                <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase mb-1 sm:mb-2">{t('name_label')}</label>
                                <Input maxLength={60} value={typeName} onChange={e => setTypeName(e.target.value)} placeholder={t('example_essay')} className="h-7 sm:h-10 text-[11px] sm:text-sm !py-1 !px-2 sm:!py-2.5 sm:!px-3" />
                            </div>
                            
                            {/* Conditionally render Weight inputs based on Global Setting */}
                            {initialGradingSystem?.useWeights && (
                                <div>
                                    <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase mb-1 sm:mb-2">{t('coefficient_label')}</label>
                                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-start">
                                        <div className="w-full sm:flex-1">
                                            <Input 
                                                type={isDynamic || isNoWeight ? 'text' : 'number'}
                                                maxLength={4}
                                                min={initialGradingSystem?.minWeight} 
                                                max={initialGradingSystem?.maxWeight} 
                                                value={isDynamic || isNoWeight ? '-' : typeWeight} 
                                                disabled={isDynamic || isNoWeight}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    if (!isDynamic && !isNoWeight) {
                                                        if (val !== '') {
                                                            const num = parseFloat(val);
                                                            if (num <= 0) setTypeError(t('num_gt_0'));
                                                            else if (num < (initialGradingSystem?.minWeight || 1) || num > (initialGradingSystem?.maxWeight || 10)) setTypeError(t('out_of_range'));
                                                            else setTypeError(null);
                                                        }
                                                    }
                                                    setTypeWeight(val);
                                                }} 
                                                placeholder={t('number_placeholder')}
                                                className={`h-7 sm:h-10 text-[11px] sm:text-sm !py-1 !px-2 sm:!py-2.5 sm:!px-3 ${isDynamic || isNoWeight ? 'text-center font-bold text-slate-400 bg-slate-100 cursor-not-allowed' : ''}`}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5 sm:gap-2 pt-0.5 sm:pt-1">
                                            <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300" 
                                                    checked={isDynamic} 
                                                    onChange={e => { setIsDynamic(e.target.checked); if(e.target.checked) setIsNoWeight(false); setTypeError(null); }}
                                                />
                                                <span className="text-[11px] sm:text-xs font-medium text-slate-600 dark:text-slate-400">{t('teacher_sets_weight')}</span>
                                            </label>
                                            <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300" 
                                                    checked={isNoWeight} 
                                                    onChange={e => { setIsNoWeight(e.target.checked); if(e.target.checked) setIsDynamic(false); setTypeError(null); }}
                                                />
                                                <span className="text-[11px] sm:text-xs font-medium text-slate-600 dark:text-slate-400">{t('no_weight_value')}</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {typeError && (
                                <div className="bg-red-50 text-red-600 p-2 sm:p-3 rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1.5 sm:gap-2 border border-red-100 animate-pulse">
                                    <AlertCircle size={13} className="sm:w-3.5 sm:h-3.5"/> {typeError}
                                </div>
                            )}

                            <Button onClick={saveType} variant="primary" className="w-full h-8 sm:h-12 text-xs sm:text-sm shadow-md sm:shadow-lg shadow-blue-500/20">{editingType ? t('save_changes') : t('add')}</Button>
                            {editingType && <Button onClick={resetForm} variant="ghost" className="w-full h-7 sm:h-9 text-[11px] sm:text-xs">{t('cancel')}</Button>}
                        </div>
                    </div>

                    {/* RIGHT: LIST */}
                    <div className="w-full md:w-2/3 p-0 bg-white dark:bg-slate-900">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs sm:text-sm text-left">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] sm:text-xs uppercase tracking-wider dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
                                    <tr>
                                        <th className="p-2.5 pl-3 sm:p-4 sm:pl-6">{t('type_col')}</th>
                                        <th className="p-2.5 sm:p-4 text-center w-20 sm:w-32">{t('weight_col')}</th>
                                        <th className="p-2.5 pr-3 sm:p-4 sm:pr-6 text-right">{t('actions_col')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {currentGradeTypes.map(gt => (
                                        <tr key={gt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 group transition-colors">
                                            <td className="p-2.5 pl-3 sm:p-4 sm:pl-6 font-bold text-slate-700 dark:text-slate-200">{gt.name}</td>
                                            <td className="p-2 sm:p-4 text-center relative">
                                                {!initialGradingSystem?.useWeights ? (
                                                    <span className="font-bold text-slate-300">-</span>
                                                ) : gt.isDynamicWeight ? (
                                                    <span className="inline-block text-[9px] sm:text-[10px] uppercase font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded border border-amber-100 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400">{t('edit_short')}</span>
                                                ) : gt.isNoWeight ? (
                                                    <span className="inline-block text-[9px] sm:text-[10px] uppercase font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded border border-purple-100 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-400">-</span>
                                                ) : (
                                                    <div className="relative inline-block w-11 sm:w-20">
                                                        <Input 
                                                            key={`${gt.id}_${gt.weight}`}
                                                            maxLength={4}
                                                            className={`h-6 sm:h-8 !py-0.5 !px-1 text-center font-bold text-slate-800 dark:text-white text-[11px] sm:text-sm ${weightCellError?.id === gt.id ? 'border-red-300 focus:border-red-500 bg-red-50 text-red-700' : 'border-transparent bg-transparent hover:bg-slate-100 hover:border-slate-200 focus:bg-white focus:border-blue-500'}`}
                                                            defaultValue={gt.weight}
                                                            onBlur={(e) => handleCellWeightBlur(gt.id, e.target.value)}
                                                            onKeyDown={(e) => { if(e.key === 'Enter') e.currentTarget.blur(); }}
                                                        />
                                                        {weightCellError?.id === gt.id && (
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-red-600 text-white text-[9px] sm:text-[10px] px-1.5 py-0.5 sm:px-2 sm:py-1 rounded shadow-lg z-10 whitespace-nowrap animate-in fade-in zoom-in">
                                                                {weightCellError.error}
                                                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-red-600"></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-2 pr-3 sm:p-4 sm:pr-6 text-right flex justify-end gap-1 sm:gap-2">
                                                <button onClick={() => openEditType(gt)} className="p-1.5 sm:p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition"><Edit size={14} className="sm:w-4 sm:h-4"/></button>
                                                <button onClick={() => deleteType(gt.id)} className="p-1.5 sm:p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"><Trash2 size={14} className="sm:w-4 sm:h-4"/></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {currentGradeTypes.length === 0 && (
                                        <tr><td colSpan={3} className="p-6 sm:p-8 text-center text-slate-400 italic">{t('no_types_created')}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Bottom Section: Subject Requirements */}
            <Card className="p-3 sm:p-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3 mb-3 sm:mb-6">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <Settings size={18} className="text-slate-700 dark:text-slate-300 sm:w-6 sm:h-6"/>
                        <h3 className="font-bold text-base sm:text-xl text-slate-800 dark:text-white font-heading">{t('grades_per_subject')}</h3>
                    </div>
                    <Select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-full sm:w-40 h-8 sm:h-10 text-xs sm:text-sm">
                        {schoolClasses.map(c => <option key={`${c.class}_${c.letter}`} value={`${c.class}_${c.letter}`}>{c.class}{c.letter}</option>)}
                    </Select>
                </div>

                <div className="bg-blue-50 border border-blue-100 text-blue-800 p-2.5 sm:p-4 rounded-xl mb-3 sm:mb-6 text-xs sm:text-sm font-medium dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300">
                    {t('auto_logic_info')}
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl dark:border-slate-700">
                    <table className="w-full text-xs sm:text-sm text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] sm:text-xs dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400">
                            <tr>
                                <th className="p-2 sm:p-4">{t('subject')}</th>
                                <th className="p-1.5 sm:p-4 text-center">{t('lessons_week')}</th>
                                <th className="p-1.5 sm:p-4 text-center w-28 sm:w-40">{t('type')}</th>
                                <th className="p-1.5 sm:p-4 text-center w-16 sm:w-32">{t('min_grades')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {schoolSubjects.map(subj => {
                                const targetClassKey = H.getSchoolClassKey(schoolId, selectedClass);
                                const lessonsCount = getLessonsPerWeek(selectedClass, subj);
                                const autoMin = lessonsCount > 3 ? 5 : (lessonsCount >= 1 ? 3 : 0);
                                const schoolReqs = H.getSchoolSubjectRequirements(state, schoolId);
                                const req = schoolReqs?.[selectedClass]?.[subj]
                                    || state.subjectRequirements?.[targetClassKey]?.[subj]
                                    || ((!schoolId || schoolId === 'school_1') ? state.subjectRequirements?.[selectedClass]?.[subj] : undefined)
                                    || { type: 'auto', minGrades: autoMin };
                                const isAuto = req.type === 'auto';
                                const displayMin = isAuto ? autoMin : req.minGrades;

                                return (
                                    <tr key={subj} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="p-2 sm:p-4 font-bold text-slate-700 dark:text-slate-200 break-words">{subj}</td>
                                        <td className="p-1.5 sm:p-4 text-center font-mono text-slate-500">{lessonsCount}</td>
                                        <td className="p-1.5 sm:p-4 text-center">
                                            <div className="flex justify-center bg-slate-100 rounded-lg p-0.5 sm:p-1 w-fit mx-auto dark:bg-slate-800">
                                                <button 
                                                    onClick={() => updateRequirement(subj, 'type', 'auto')}
                                                    className={`px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-bold rounded-md transition-all ${isAuto ? 'bg-white text-blue-600 shadow-xs dark:bg-slate-700 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    {t('auto')}
                                                </button>
                                                <button 
                                                    onClick={() => updateRequirement(subj, 'type', 'manual')}
                                                    className={`px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-bold rounded-md transition-all ${!isAuto ? 'bg-white text-blue-600 shadow-xs dark:bg-slate-700 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    {t('manual')}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="p-1.5 sm:p-4 text-center">
                                            <Input 
                                                type="number" 
                                                min="0"
                                                maxLength={4}
                                                className={`w-11 sm:w-20 h-6 sm:h-10 !py-0.5 !px-1 sm:!py-2.5 sm:!px-3 text-[11px] sm:text-sm text-center font-bold mx-auto ${isAuto ? 'bg-slate-50 text-slate-500 border-transparent shadow-none' : 'bg-white border-slate-200'}`}
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
            <Modal isOpen={confirmConflictModal} onClose={() => setConfirmConflictModal(false)} title={t('weight_conflict_title')}>
                <div className="space-y-4">
                    <div className="bg-red-50 p-4 rounded-xl border border-red-200 flex items-start gap-3 text-red-800">
                        <AlertTriangle className="flex-shrink-0 mt-0.5" size={20}/>
                        <div>
                            <h4 className="font-bold text-lg mb-1">{t('conflicts_found')}</h4>
                            <p className="text-sm">
                                {t('new_range_excludes')} ({gradingSettings.minWeight} - {gradingSettings.maxWeight}). 
                                <br/><br/>
                                {t('to_continue_delete')}
                            </p>
                        </div>
                    </div>
                    
                    <div className="border rounded-lg overflow-x-auto">
                        <table className="w-full text-sm min-w-[300px]">
                            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800">
                                <tr>
                                    <th className="p-2 text-left">{t('type_col')}</th>
                                    <th className="p-2 text-center">{t('current_weight')}</th>
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

                    <div className="flex flex-wrap justify-end gap-3 pt-4">
                        <Button onClick={() => setConfirmConflictModal(false)} variant="secondary">{t('cancel')}</Button>
                        <Button onClick={() => proceedWithRangeUpdate(true)} variant="danger">{t('confirm_delete_continue')}</Button>
                    </div>
                </div>
            </Modal>
            
            {/* Weight Reset Confirmation Modal */}
            <Modal isOpen={weightResetConfirm} onClose={() => setWeightResetConfirm(false)} title={t('coeff_reset_title')}>
                <div className="space-y-4">
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex items-start gap-3 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300">
                        <AlertTriangle className="flex-shrink-0 mt-0.5" size={24}/>
                        <div>
                            <h4 className="font-bold text-lg mb-1">{t('attention')}</h4>
                            <p className="text-sm">
                                {t('changed_coeff_setting')} 
                                <br/><br/>
                                {t('coeff_reset_to_1')}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-3 pt-2">
                        <Button onClick={() => setWeightResetConfirm(false)} variant="secondary">{t('cancel')}</Button>
                        <Button onClick={proceedFromWeightReset} variant="primary">{t('got_it_continue')}</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
