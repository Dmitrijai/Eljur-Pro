import React, { useState, useMemo } from 'react';
import { AppState, User, Grade, FinalGradeEntry } from '../../types';
import * as H from '../../utils/helpers';
import { Button, Card, Modal, Select, ScrollableTableWrapper } from '../../components/ui';
import { 
  Printer, 
  Users, 
  Award, 
  TrendingUp, 
  Search, 
  BookOpen, 
  CheckCircle2, 
  ChevronRight, 
  GraduationCap, 
  UserCheck, 
  Layers, 
  AlertCircle
} from 'lucide-react';

interface Props {
  state: AppState;
  user: User;
  onUpdate?: (s: AppState) => void;
}

export const HomeroomSummaryView: React.FC<Props> = ({ state, user, onUpdate }) => {
  const lang = state.settings.language || 'ru';
  const t = (k: string) => H.t(k, lang);

  const schoolClasses = H.getSchoolClasses(state, user.schoolId);
  const leadingClasses = H.getUserLeadingClasses(state, user.schoolId, user.id);

  const isDirector = user.role === 'director' || (user.role as string) === 'creator';
  const availableClasses = isDirector && leadingClasses.length === 0 ? schoolClasses : (leadingClasses.length > 0 ? leadingClasses : schoolClasses);

  const defaultHomeroomClassKey = useMemo(() => {
    if (leadingClasses.length > 0) return `${leadingClasses[0].class}_${leadingClasses[0].letter}`;
    if (schoolClasses.length > 0) return `${schoolClasses[0].class}_${schoolClasses[0].letter}`;
    return '';
  }, [leadingClasses, schoolClasses]);

  const [selectedClassKey, setSelectedClassKey] = H.useSyncedState<string>(`eljur_hr_cls_${user.id}`, defaultHomeroomClassKey);

  React.useEffect(() => {
    if (availableClasses.length > 0 && !availableClasses.some(c => `${c.class}_${c.letter}` === selectedClassKey)) {
      setSelectedClassKey(`${availableClasses[0].class}_${availableClasses[0].letter}`);
    }
  }, [availableClasses, selectedClassKey]);

  const [selectedQuarter, setSelectedQuarter] = H.useSyncedState<'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4'>(`eljur_hr_q_${user.id}`, 'all');
  const [searchQuery, setSearchQuery] = H.useSyncedState<string>(`eljur_hr_search_${user.id}`, '');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const [selectedClassNum, selectedClassLetter] = selectedClassKey ? selectedClassKey.split('_') : ['', ''];
  const currentSchool = H.getSchool(state, user.schoolId);

  const gradingSystem = H.getSchoolGradingSystem(state, user.schoolId);
  const minGrade = gradingSystem?.minGrade ?? 2;
  const maxGrade = gradingSystem?.maxGrade ?? 5;
  const useWeights = gradingSystem?.useWeights ?? true;
  const gradeTypes = H.getSchoolGradeTypes(state, user.schoolId);
  const scheduleSettings = H.getSchoolScheduleSettings(state, user.schoolId);
  const subjects = H.getSchoolSubjects(state, user.schoolId);

  const classGrades = H.getSchoolClassGrades(state, user.schoolId, selectedClassKey);
  const classFinalGrades = H.getSchoolClassFinalGrades(state, user.schoolId, selectedClassKey);

  const getEffectiveWeight = (g: Grade) => H.getEffectiveGradeWeight(g, gradeTypes, useWeights);

  const computeQuarterAvg = (studentId: string, subject: string, quarterKey: string): { avg: string; avgNum: number; count: number } => {
    const grades = classGrades[subject] || [];
    const def = scheduleSettings?.quarterDefinitions?.[quarterKey];
    const qStart = def?.start || '0000-00-00';
    const qEnd = def?.end || '9999-99-99';

    const qGrades = grades.filter(g => {
      if (g.studentId !== studentId) return false;
      if (def?.start && def?.end) return g.date >= qStart && g.date <= qEnd;
      return H.getQuarterFromDate(g.date) === quarterKey;
    });

    let wSum = 0; let wCount = 0;
    qGrades.forEach(g => {
      const val = H.getEffectiveGradeValue(g, minGrade, state.settings?.systemTimeOffset);
      if (val !== null && !isNaN(val)) {
        const weight = getEffectiveWeight(g);
        if (weight > 0) {
          wSum += val * weight;
          wCount += weight;
        }
      }
    });

    if (wCount === 0) return { avg: '-', avgNum: 0, count: 0 };
    const num = wSum / wCount;
    return { avg: num.toFixed(2), avgNum: num, count: qGrades.length };
  };

  const computeSubjectYearAvg = (studentId: string, subject: string): { avg: string; avgNum: number } => {
    const grades = classGrades[subject] || [];
    const studentGrades = grades.filter(g => g.studentId === studentId);
    let wSum = 0; let wCount = 0;
    studentGrades.forEach(g => {
      const val = H.getEffectiveGradeValue(g, minGrade, state.settings?.systemTimeOffset);
      if (val !== null && !isNaN(val)) {
        const weight = getEffectiveWeight(g);
        if (weight > 0) {
          wSum += val * weight;
          wCount += weight;
        }
      }
    });
    if (wCount === 0) return { avg: '-', avgNum: 0 };
    const num = wSum / wCount;
    return { avg: num.toFixed(2), avgNum: num };
  };

  const classStudents = useMemo(() => {
    if (!selectedClassNum || !selectedClassLetter) return [];
    return state.users
      .filter(u => u.role === 'student' && u.schoolId === user.schoolId && u.class === selectedClassNum && u.letter === selectedClassLetter)
      .sort((a, b) => a.fio.localeCompare(b.fio));
  }, [state.users, user.schoolId, selectedClassNum, selectedClassLetter]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return classStudents;
    const q = searchQuery.toLowerCase();
    return classStudents.filter(s => s.fio.toLowerCase().includes(q) || s.login.toLowerCase().includes(q));
  }, [classStudents, searchQuery]);

  const studentSummaries = useMemo(() => {
    return classStudents.map(student => {
      let totalSubjectAverages = 0;
      let subjectCountWithGrades = 0;
      const subjectData: Record<string, any> = {};

      subjects.forEach(subj => {
        const finalEntry = (classFinalGrades[subj] || []).find(e => e.studentId === student.id) || {} as FinalGradeEntry;
        const q1 = computeQuarterAvg(student.id, subj, 'Q1');
        const q2 = computeQuarterAvg(student.id, subj, 'Q2');
        const q3 = computeQuarterAvg(student.id, subj, 'Q3');
        const q4 = computeQuarterAvg(student.id, subj, 'Q4');
        const year = computeSubjectYearAvg(student.id, subj);

        const activePeriodAvg =
          selectedQuarter === 'Q1' ? q1.avgNum :
          selectedQuarter === 'Q2' ? q2.avgNum :
          selectedQuarter === 'Q3' ? q3.avgNum :
          selectedQuarter === 'Q4' ? q4.avgNum :
          year.avgNum;

        if (activePeriodAvg > 0) {
          totalSubjectAverages += activePeriodAvg;
          subjectCountWithGrades++;
        }

        subjectData[subj] = {
          q1Avg: q1.avg, q1Grade: finalEntry.q1,
          q2Avg: q2.avg, q2Grade: finalEntry.q2,
          q3Avg: q3.avg, q3Grade: finalEntry.q3,
          q4Avg: q4.avg, q4Grade: finalEntry.q4,
          yearAvg: year.avg, yearGrade: finalEntry.year
        };
      });

      const studentOverallGpa = subjectCountWithGrades > 0 ? (totalSubjectAverages / subjectCountWithGrades) : 0;
      return {
        student,
        overallGpa: studentOverallGpa > 0 ? studentOverallGpa.toFixed(2) : '-',
        overallGpaNum: studentOverallGpa,
        subjects: subjectData
      };
    });
  }, [classStudents, subjects, classGrades, classFinalGrades, scheduleSettings, selectedQuarter]);

  const classStats = useMemo(() => {
    const validGpas = studentSummaries.filter(s => s.overallGpaNum > 0);
    const avgGpa = validGpas.length > 0
      ? (validGpas.reduce((acc, curr) => acc + curr.overallGpaNum, 0) / validGpas.length).toFixed(2)
      : '-';

    const safeMin = Math.min(minGrade, maxGrade);
    const safeMax = Math.max(minGrade, maxGrade);
    const range = Math.max(1, safeMax - safeMin);
    const excellentThreshold = Number((safeMin + (2.5 / 3) * range).toFixed(4));
    const goodThreshold = Number((safeMin + (1.5 / 3) * range).toFixed(4));
    const satisfactoryThreshold = Number((safeMin + (0.5 / 3) * range).toFixed(4));

    let excellentCount = 0; let goodCount = 0; let satisfactoryCount = 0; let lowCount = 0;
    validGpas.forEach(s => {
      if (s.overallGpaNum >= excellentThreshold) excellentCount++;
      else if (s.overallGpaNum >= goodThreshold) goodCount++;
      else if (s.overallGpaNum >= satisfactoryThreshold) satisfactoryCount++;
      else lowCount++;
    });

    return { total: classStudents.length, avgGpa, excellentCount, goodCount, satisfactoryCount, lowCount };
  }, [studentSummaries, classStudents, minGrade, maxGrade]);

  const activeStudentSummary = studentSummaries.find(s => s.student.id === selectedStudentId);

  const renderPrintHeader = () => (
    <div className="hidden print:block text-center mb-6 border-b-2 border-slate-800 pb-4">
      <h1 className="text-xl font-bold uppercase tracking-widest text-slate-900">{currentSchool?.name || 'Электронный Журнал'}</h1>
      <h2 className="text-2xl font-bold text-slate-900 mt-2">
        {lang === 'ru' ? `Успеваемость: Класс ${selectedClassNum}${selectedClassLetter}` : `Performance: Class ${selectedClassNum}${selectedClassLetter}`}
      </h2>
      <div className="flex flex-wrap justify-center gap-6 mt-3 text-sm font-medium text-slate-700">
        <span>{lang === 'ru' ? 'Период' : 'Period'}: {selectedQuarter === 'all' ? (lang === 'ru' ? 'Весь год (1-4 четверти)' : 'All Year') : `${selectedQuarter.replace('Q','')} ${t('quarter')}`}</span>
        <span>{lang === 'ru' ? 'Учеников' : 'Students'}: {classStats.total}</span>
        <span>{lang === 'ru' ? 'Ср. балл' : 'Avg GPA'}: {classStats.avgGpa}</span>
        <span>{lang === 'ru' ? 'Дата выгрузки' : 'Date'}: {H.formatDateDDMMYYYY(new Date().toISOString().split('T')[0])}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-3 sm:space-y-6 animate-in fade-in duration-300 print:space-y-0 print:bg-white print:text-black">
      {renderPrintHeader()}

      {/* Hero Header (No Print) */}
      <Card className="p-3 sm:p-6 md:p-8 relative overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs no-print">
        <div className="relative z-10 space-y-1 sm:space-y-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
              <GraduationCap size={12} />
              <span>{lang === 'ru' ? 'Классное руководство' : 'Class Leadership'}</span>
            </div>
            {leadingClasses.some(c => `${c.class}_${c.letter}` === selectedClassKey) && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                <UserCheck size={12} />
                <span>{lang === 'ru' ? 'Ваш класс' : 'Your Class'}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <h2 className="text-base sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-heading leading-tight truncate">
              {lang === 'ru' ? `Успеваемость: ${selectedClassNum}${selectedClassLetter}` : `Performance: ${selectedClassNum}${selectedClassLetter}`}
            </h2>

            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {availableClasses.length > 1 && (
                <Select value={selectedClassKey} onChange={e => setSelectedClassKey(e.target.value)} className="w-20 sm:w-28 text-xs font-bold h-7 sm:h-9 bg-white dark:bg-slate-950">
                  {availableClasses.map(c => (
                    <option key={`${c.class}_${c.letter}`} value={`${c.class}_${c.letter}`}>
                      {c.class}{c.letter}
                    </option>
                  ))}
                </Select>
              )}
              <Button variant="secondary" size="sm" onClick={() => window.print()} className="w-auto h-7 sm:h-9 px-2 sm:px-4 text-xs">
                <Printer size={14} className="sm:mr-1.5 text-slate-500" />
                <span className="hidden sm:inline">{t('print')}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-3.5 mt-2.5 sm:mt-6 pt-2.5 sm:pt-5 border-t border-slate-100 dark:border-slate-800">
          {[
            { label: lang === 'ru' ? 'Учеников' : 'Students', val: classStats.total, icon: Users, color: 'text-blue-600' },
            { label: lang === 'ru' ? 'Ср. балл' : 'Avg GPA', val: classStats.avgGpa, icon: TrendingUp, color: 'text-amber-600' },
            { label: lang === 'ru' ? 'Отличники' : 'Honors', val: classStats.excellentCount, icon: Award, color: 'text-emerald-600' },
            { label: lang === 'ru' ? 'Хорошисты' : 'Good', val: classStats.goodCount, icon: CheckCircle2, color: 'text-blue-600' },
            { label: maxGrade === 5 ? (lang === 'ru' ? 'С тройками' : 'With 3s') : (lang === 'ru' ? 'Удовл.' : 'Satisfactory'), val: classStats.satisfactoryCount, icon: Layers, color: 'text-orange-600' },
            { label: lang === 'ru' ? 'Неуспев.' : 'Low', val: classStats.lowCount, icon: Layers, color: 'text-rose-600' }
          ].map((stat, i) => (
            <div key={i} className="flex flex-col gap-0.5 sm:gap-1 p-1.5 sm:p-3 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1 text-[9px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide truncate">
                <stat.icon size={10} className={`${stat.color} shrink-0 sm:w-3 sm:h-3`} />
                <span className="truncate">{stat.label}</span>
              </div>
              <div className="text-xs sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">{stat.val}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Toolbar (No Print) */}
      <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-4 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs no-print">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'all', label: lang === 'ru' ? 'Итоги года' : 'Year End' },
            { id: 'Q1', label: `1 ${t('q_short')}` },
            { id: 'Q2', label: `2 ${t('q_short')}` },
            { id: 'Q3', label: `3 ${t('q_short')}` },
            { id: 'Q4', label: `4 ${t('q_short')}` }
          ].map(q => (
            <button
              key={q.id}
              onClick={() => setSelectedQuarter(q.id as any)}
              className={`px-2.5 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all ${
                selectedQuarter === q.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={lang === 'ru' ? 'Поиск ученика...' : 'Search student...'}
            className="w-full pl-8 pr-3 py-1.5 text-xs sm:text-sm border border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: landscape; margin: 1cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      {/* Mobile Student Cards (Compact, No horizontal scroll) */}
      <div className="md:hidden print:hidden space-y-2">
        {filteredStudents.map((student, idx) => {
          const summary = studentSummaries.find(s => s.student.id === student.id);
          return (
            <div
              key={student.id}
              onClick={() => setSelectedStudentId(student.id)}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5 cursor-pointer active:scale-[0.99] transition"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 shrink-0">
                    {idx + 1}
                  </span>
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                    {H.formatShortName(student.fio)}
                  </span>
                </div>
                <div className="shrink-0 text-right flex items-center gap-1">
                  <span className="text-[9px] uppercase font-bold text-slate-400">GPA</span>
                  <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                    {summary?.overallGpa || '—'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                {subjects.map(subj => {
                  const sData = summary?.subjects[subj];
                  if (!sData) return null;
                  const qKey = selectedQuarter === 'all' ? 'year' : (selectedQuarter.toLowerCase() as 'q1'|'q2'|'q3'|'q4');
                  const gradeVal = qKey === 'year' ? sData.yearGrade : sData[`${qKey}Grade` as keyof typeof sData];
                  const avgVal = qKey === 'year' ? sData.yearAvg : sData[`${qKey}Avg` as keyof typeof sData];
                  const displayVal = gradeVal || (avgVal && avgVal !== '-' ? avgVal : '—');
                  return (
                    <div key={subj} className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800/60 text-[11px]">
                      <span className="truncate text-slate-600 dark:text-slate-300 font-medium">{subj}</span>
                      <span className={`font-bold shrink-0 ${gradeVal ? H.getGradeColorClass(String(gradeVal), minGrade, maxGrade) : 'text-slate-700 dark:text-slate-200'}`}>
                        {displayVal}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="text-[10px] text-center text-blue-600 dark:text-blue-400 font-semibold pt-0.5">
                {lang === 'ru' ? 'Подробная карточка по четвертям →' : 'Full quarterly card →'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop & Print Matrix Table */}
      <Card className="hidden md:block print:block p-0 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm print:border-none print:shadow-none print:m-0 print:p-0 print:overflow-visible">
        <ScrollableTableWrapper lang={lang} maxHeightClass="max-h-none !overflow-y-visible">
          <table className="w-full text-sm min-w-[800px] border-collapse print:text-[8.5pt] print:min-w-0">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 print:bg-white print:border-b-2 print:border-black">
              <tr>
                <th className="p-3.5 text-center w-12 print:w-6 font-bold sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 print:p-1">№</th>
                <th className="p-3.5 text-left font-bold border-r border-slate-200 dark:border-slate-800 print:border-slate-300 print:p-1 sticky top-0 left-0 bg-slate-50 dark:bg-slate-900 z-30 print:static whitespace-nowrap">{t('fio')}</th>
                <th className="p-3.5 text-center font-black text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-800 sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 print:border-slate-300 print:p-1">GPA</th>
                {subjects.map(s => (
                  <th key={s} className="p-3 text-center min-w-[80px] font-semibold border-r border-slate-200 dark:border-slate-800 sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 print:border-slate-300 print:p-0.5 print:min-w-0" title={s}>
                    <div className="mx-auto truncate max-w-[80px] print:max-w-none print:whitespace-normal print:overflow-visible print:text-[7.5pt] print:leading-tight">{s}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 print:divide-slate-300">
              {filteredStudents.map((student, idx) => {
                const summary = studentSummaries.find(s => s.student.id === student.id);
                const rowBg = 'bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors print:bg-white';
                
                return (
                  <tr key={student.id} className={`${rowBg} cursor-pointer print:break-inside-avoid`} onClick={() => setSelectedStudentId(student.id)}>
                    <td className="p-3.5 text-center text-slate-400 font-mono print:p-1">{idx + 1}</td>
                    <td className="p-3.5 text-left font-bold text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800 print:border-slate-300 sticky left-0 bg-inherit z-10 print:static print:p-1">
                      <span className="truncate block w-44 print:w-auto whitespace-nowrap">{H.formatShortName(student.fio)}</span>
                    </td>
                    <td className="p-3.5 text-center font-bold text-slate-900 dark:text-white border-r border-slate-100 dark:border-slate-800 print:border-slate-300 bg-slate-50/50 dark:bg-slate-900/50 print:bg-white print:p-1">
                      {summary?.overallGpa || '-'}
                    </td>

                    {subjects.map(subj => {
                      const sData = summary?.subjects[subj];
                      if (!sData) return <td key={subj} className="p-3.5 text-center text-slate-300 border-r border-slate-100 dark:border-slate-800 print:border-slate-300 print:p-1">-</td>;

                      if (selectedQuarter === 'all') {
                        return (
                          <td key={subj} className="p-2 text-center border-r border-slate-100 dark:border-slate-800 print:border-slate-300 print:p-0.5 align-middle">
                            <div className="flex flex-col items-center justify-center gap-1 print:gap-0.5">
                              <div className="flex gap-0.5 print:gap-0 w-full justify-center">
                                {(['q1', 'q2', 'q3', 'q4'] as const).map(qKey => {
                                  const gradeVal = sData[`${qKey}Grade` as keyof typeof sData];
                                  const avgVal = sData[`${qKey}Avg` as keyof typeof sData];
                                  return (
                                    <div key={qKey} title={`${qKey.toUpperCase()}: ${gradeVal || avgVal || '-'}`} className="w-5 h-5 print:w-3.5 print:h-3.5 flex items-center justify-center text-[10px] print:text-[6.5pt] font-bold rounded-sm bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 print:border print:border-slate-200">
                                      {gradeVal || (avgVal && avgVal !== '-' ? Math.round(parseFloat(avgVal)) : '·')}
                                    </div>
                                  );
                                })}
                              </div>
                              {sData.yearGrade || sData.yearAvg !== '-' ? (
                                <div className={`px-2 print:px-1 py-0.5 print:py-0 text-[11px] print:text-[7.5pt] font-black rounded ${sData.yearGrade ? H.getGradeColorClass(sData.yearGrade, minGrade, maxGrade) : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'} print:border print:border-black print:bg-white print:text-black`}>
                                  {sData.yearGrade || sData.yearAvg}
                                </div>
                              ) : null}
                            </div>
                          </td>
                        );
                      } else {
                        const qKey = selectedQuarter.toLowerCase() as 'q1'|'q2'|'q3'|'q4';
                        const gradeVal = sData[`${qKey}Grade` as keyof typeof sData];
                        const avgVal = sData[`${qKey}Avg` as keyof typeof sData];
                        
                        return (
                          <td key={subj} className="p-2.5 print:p-1 text-center border-r border-slate-100 dark:border-slate-800 print:border-slate-300 align-middle">
                            <div className="flex flex-col items-center gap-1 print:gap-0.5">
                              {gradeVal ? (
                                <div className={`w-7 h-7 print:w-5 print:h-5 flex items-center justify-center rounded-lg font-black text-xs print:text-[8pt] ${H.getGradeColorClass(gradeVal, minGrade, maxGrade)} print:border print:border-black print:bg-white print:text-black`}>
                                  {gradeVal}
                                </div>
                              ) : (
                                <div className="w-7 h-7 print:w-5 print:h-5 flex items-center justify-center text-slate-300">—</div>
                              )}
                              {avgVal && avgVal !== '-' && (
                                <div className="text-[10px] print:text-[6.5pt] font-medium text-slate-500 dark:text-slate-400">
                                  ср. {avgVal}
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      }
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollableTableWrapper>
      </Card>

      {selectedStudentId && activeStudentSummary && (
        <Modal isOpen={!!selectedStudentId} onClose={() => setSelectedStudentId(null)} title={lang === 'ru' ? 'Личная карточка успеваемости' : 'Personal Academic Card'} maxWidth="max-w-3xl">
          <div className="space-y-3 sm:space-y-6">
            <div className="flex items-center justify-between p-2.5 sm:p-5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 rounded-xl sm:rounded-2xl">
              <div>
                <h3 className="text-sm sm:text-xl font-bold text-slate-900 dark:text-white leading-tight">{H.formatShortName(activeStudentSummary.student.fio)}</h3>
                <p className="text-[11px] sm:text-sm font-medium text-blue-700 dark:text-blue-400 mt-0.5 sm:mt-1">{t('class')} {selectedClassNum}{selectedClassLetter}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] sm:text-xs font-bold text-blue-600/70 dark:text-blue-400/70 uppercase tracking-widest mb-0.5 sm:mb-1">{t('avg_score')}</p>
                <div className="text-lg sm:text-3xl font-black text-blue-700 dark:text-blue-400 leading-none">{activeStudentSummary.overallGpa}</div>
              </div>
            </div>

            {/* Mobile subject list inside modal */}
            <div className="sm:hidden space-y-1.5">
              {subjects.map(subj => {
                const sData = activeStudentSummary.subjects[subj];
                return (
                  <div key={subj} className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">{subj}</span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 shrink-0">
                        {t('year')}: {sData?.yearGrade || sData?.yearAvg || '—'}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
                      {(['q1', 'q2', 'q3', 'q4'] as const).map((qKey, qIdx) => {
                        const g = sData?.[`${qKey}Grade` as keyof typeof sData];
                        const a = sData?.[`${qKey}Avg` as keyof typeof sData];
                        return (
                          <div key={qKey} className="p-1 rounded-md bg-slate-50 dark:bg-slate-800 leading-tight">
                            <div className="text-[9px] text-slate-400 font-bold">{qIdx + 1} ч.</div>
                            <div className="font-bold text-slate-800 dark:text-slate-100">{g || (a && a !== '-' ? a : '—')}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm print:overflow-visible print:rounded-none print:shadow-none print:border-none">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-4 text-left font-bold">{t('subject')}</th>
                    <th className="p-4 text-center font-bold">1 {t('quarter')}</th>
                    <th className="p-4 text-center font-bold">2 {t('quarter')}</th>
                    <th className="p-4 text-center font-bold">3 {t('quarter')}</th>
                    <th className="p-4 text-center font-bold">4 {t('quarter')}</th>
                    <th className="p-4 text-center font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-400">{t('year')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-950">
                  {subjects.map(subj => {
                    const sData = activeStudentSummary.subjects[subj];
                    return (
                      <tr key={subj} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <td className="p-4 font-bold text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800">{subj}</td>
                        {(['q1', 'q2', 'q3', 'q4'] as const).map(qKey => {
                          const g = sData?.[`${qKey}Grade` as keyof typeof sData];
                          const a = sData?.[`${qKey}Avg` as keyof typeof sData];
                          return (
                            <td key={qKey} className="p-3 text-center border-r border-slate-100 dark:border-slate-800 align-middle">
                              {g ? <span className={`inline-block w-8 h-8 leading-8 text-center rounded-lg font-bold ${H.getGradeColorClass(g, minGrade, maxGrade)}`}>{g}</span> : <span className="text-slate-300">—</span>}
                              {a && a !== '-' && <div className="text-[10px] text-slate-500 mt-1">{a}</div>}
                            </td>
                          );
                        })}
                        <td className="p-4 text-center font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20">
                          {sData?.yearGrade || sData?.yearAvg || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="flex justify-end gap-2 sm:gap-3 pt-1 sm:pt-2">
              <Button variant="secondary" size="sm" className="h-8 sm:h-10 text-xs sm:text-sm px-3 sm:px-5" onClick={() => setSelectedStudentId(null)}>{t('cancel')}</Button>
              <Button variant="primary" size="sm" className="h-8 sm:h-10 text-xs sm:text-sm px-3 sm:px-5" onClick={() => window.print()}><Printer size={14} className="mr-1.5 sm:w-4 sm:h-4" />{t('print')}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

