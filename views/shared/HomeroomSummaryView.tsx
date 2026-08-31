import React, { useState, useMemo } from 'react';
import { AppState, User, Grade, FinalGradeEntry } from '../../types';
import * as H from '../../utils/helpers';
import { Button, Card, Modal, Select } from '../../components/ui';
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

  // Determine which classes are accessible
  const isDirector = user.role === 'director' || (user.role as string) === 'creator';
  const availableClasses = isDirector && leadingClasses.length === 0 ? schoolClasses : (leadingClasses.length > 0 ? leadingClasses : schoolClasses);

  const [selectedClassKey, setSelectedClassKey] = useState<string>(() => {
    if (leadingClasses.length > 0) return `${leadingClasses[0].class}_${leadingClasses[0].letter}`;
    if (schoolClasses.length > 0) return `${schoolClasses[0].class}_${schoolClasses[0].letter}`;
    return '';
  });

  const [selectedQuarter, setSelectedQuarter] = useState<'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4'>('all');
  const [searchQuery, setSearchQuery] = useState('');
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

  const getEffectiveWeight = (g: Grade) => {
    if (!useWeights) return 1;
    const typeDef = gradeTypes.find(t => t.key === g.type);
    if (!typeDef) return 1;
    if (typeDef.isNoWeight) return 0;
    if (typeDef.isDynamicWeight) return g.weight || 1;
    return typeDef.weight;
  };

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
      const val = parseFloat(String(g.value));
      if (!isNaN(val)) {
        const weight = getEffectiveWeight(g);
        wSum += val * weight;
        wCount += weight;
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
      const val = parseFloat(String(g.value));
      if (!isNaN(val)) {
        const weight = getEffectiveWeight(g);
        wSum += val * weight;
        wCount += weight;
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

        if (year.avgNum > 0) {
          totalSubjectAverages += year.avgNum;
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
  }, [classStudents, subjects, classGrades, classFinalGrades, scheduleSettings]);

  const classStats = useMemo(() => {
    const validGpas = studentSummaries.filter(s => s.overallGpaNum > 0);
    const avgGpa = validGpas.length > 0
      ? (validGpas.reduce((acc, curr) => acc + curr.overallGpaNum, 0) / validGpas.length).toFixed(2)
      : '-';

    let excellentCount = 0; let goodCount = 0; let satisfactoryCount = 0; let lowCount = 0;
    validGpas.forEach(s => {
      if (s.overallGpaNum >= 4.5) excellentCount++;
      else if (s.overallGpaNum >= 3.5) goodCount++;
      else if (s.overallGpaNum >= 2.5) satisfactoryCount++;
      else lowCount++;
    });

    return { total: classStudents.length, avgGpa, excellentCount, goodCount, satisfactoryCount, lowCount };
  }, [studentSummaries, classStudents]);

  const activeStudentSummary = studentSummaries.find(s => s.student.id === selectedStudentId);

  // Printing Helper for A4 Layout
  const renderPrintHeader = () => (
    <div className="hidden print:block text-center mb-6 border-b-2 border-slate-800 pb-4">
      <h1 className="text-xl font-bold uppercase tracking-widest text-slate-900">{currentSchool?.name || 'Электронный Журнал'}</h1>
      <h2 className="text-2xl font-bold text-slate-900 mt-2">
        {lang === 'ru' ? `Успеваемость: Класс ${selectedClassNum}${selectedClassLetter}` : `Performance: Class ${selectedClassNum}${selectedClassLetter}`}
      </h2>
      <div className="flex justify-center gap-6 mt-3 text-sm font-medium text-slate-700">
        <span>{lang === 'ru' ? 'Период' : 'Period'}: {selectedQuarter === 'all' ? (lang === 'ru' ? 'Весь год (1-4 четверти)' : 'All Year') : `${selectedQuarter.replace('Q','')} четверть`}</span>
        <span>{lang === 'ru' ? 'Учеников' : 'Students'}: {classStats.total}</span>
        <span>{lang === 'ru' ? 'Ср. балл' : 'Avg GPA'}: {classStats.avgGpa}</span>
        <span>{lang === 'ru' ? 'Дата выгрузки' : 'Date'}: {H.formatDateDDMMYYYY(new Date().toISOString().split('T')[0])}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300 print:space-y-0 print:bg-white print:text-black">
      {renderPrintHeader()}

      {/* Hero Header (No Print) */}
      <Card className="p-6 md:p-8 relative overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-bold uppercase tracking-wider">
                <GraduationCap size={14} />
                <span>{lang === 'ru' ? 'Классное руководство' : 'Class Leadership'}</span>
              </div>
              {leadingClasses.some(c => `${c.class}_${c.letter}` === selectedClassKey) && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider">
                  <UserCheck size={14} />
                  <span>{lang === 'ru' ? 'Ваш класс' : 'Your Class'}</span>
                </div>
              )}
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-heading">
              {lang === 'ru' ? `Успеваемость: ${selectedClassNum}${selectedClassLetter}` : `Performance: ${selectedClassNum}${selectedClassLetter}`}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {availableClasses.length > 1 && (
              <Select value={selectedClassKey} onChange={e => setSelectedClassKey(e.target.value)} className="w-40 font-bold bg-white dark:bg-slate-950">
                {availableClasses.map(c => (
                  <option key={`${c.class}_${c.letter}`} value={`${c.class}_${c.letter}`}>
                    Класс {c.class}{c.letter}
                  </option>
                ))}
              </Select>
            )}
            <Button variant="secondary" onClick={() => window.print()} className="h-10 px-5">
              <Printer size={18} className="mr-2 text-slate-500" />
              {t('print')}
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
          {[
            { label: lang === 'ru' ? 'Учеников' : 'Students', val: classStats.total, icon: Users, color: 'text-blue-600' },
            { label: lang === 'ru' ? 'Средний балл' : 'Avg GPA', val: classStats.avgGpa, icon: TrendingUp, color: 'text-amber-600' },
            { label: lang === 'ru' ? 'Отличники' : 'Honors', val: classStats.excellentCount, icon: Award, color: 'text-emerald-600' },
            { label: lang === 'ru' ? 'Хорошисты' : 'Good', val: classStats.goodCount, icon: CheckCircle2, color: 'text-blue-600' },
            { label: lang === 'ru' ? 'С тройками' : 'With 3s', val: classStats.satisfactoryCount, icon: Layers, color: 'text-orange-600' }
          ].map((stat, i) => (
            <div key={i} className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide">
                <stat.icon size={14} className={stat.color} />
                <span>{stat.label}</span>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{stat.val}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Toolbar (No Print) */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm no-print">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: lang === 'ru' ? 'Итоги года' : 'Year End' },
            { id: 'Q1', label: `1 ${t('quarter')}` },
            { id: 'Q2', label: `2 ${t('quarter')}` },
            { id: 'Q3', label: `3 ${t('quarter')}` },
            { id: 'Q4', label: `4 ${t('quarter')}` }
          ].map(q => (
            <button
              key={q.id}
              onClick={() => setSelectedQuarter(q.id as any)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                selectedQuarter === q.id
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={lang === 'ru' ? 'Поиск ученика...' : 'Search student...'}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Clean Matrix Table */}
      <style>{`
        @media print {
          @page { size: landscape; margin: 1cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <Card className="p-0 border border-slate-200 dark:border-slate-800 overflow-x-auto shadow-sm print:border-none print:shadow-none print:m-0 print:p-0 print:overflow-visible">
        <table className="w-full text-sm min-w-[800px] border-collapse print:text-[10px] print:min-w-0">
          <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 print:bg-white print:border-b-2 print:border-black">
            <tr>
              <th className="p-4 text-center w-12 font-bold print:p-2">№</th>
              <th className="p-4 text-left font-bold border-r border-slate-200 dark:border-slate-800 print:border-slate-300 print:p-2 sticky left-0 bg-slate-50 dark:bg-slate-900 z-10 print:static">{t('fio')}</th>
              <th className="p-4 text-center font-black text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-800 print:border-slate-300 print:p-2">GPA</th>
              {subjects.map(s => (
                <th key={s} className="p-3 text-center min-w-[80px] font-semibold border-r border-slate-200 dark:border-slate-800 print:border-slate-300 print:p-1.5" title={s}>
                  <div className="mx-auto truncate max-w-[80px] print:max-w-[60px] print:text-[10px]">{s}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 print:divide-slate-300">
            {filteredStudents.map((student, idx) => {
              const summary = studentSummaries.find(s => s.student.id === student.id);
              const gpaNum = summary?.overallGpaNum || 0;
              let rowBg = 'bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors print:bg-white';
              
              return (
                <tr key={student.id} className={`${rowBg} cursor-pointer print:break-inside-avoid`} onClick={() => setSelectedStudentId(student.id)}>
                  <td className="p-4 text-center text-slate-400 font-mono print:p-2">{idx + 1}</td>
                  <td className="p-4 text-left font-bold text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800 print:border-slate-300 sticky left-0 bg-inherit z-10 print:static print:p-2">
                    <span className="truncate block w-48 print:w-auto">{student.fio}</span>
                  </td>
                  <td className="p-4 text-center font-bold text-slate-900 dark:text-white border-r border-slate-100 dark:border-slate-800 print:border-slate-300 bg-slate-50/50 dark:bg-slate-900/50 print:bg-white print:p-2">
                    {summary?.overallGpa || '-'}
                  </td>

                  {subjects.map(subj => {
                    const sData = summary?.subjects[subj];
                    if (!sData) return <td key={subj} className="p-4 text-center text-slate-300 border-r border-slate-100 dark:border-slate-800 print:border-slate-300 print:p-2">-</td>;

                    if (selectedQuarter === 'all') {
                      return (
                        <td key={subj} className="p-2 text-center border-r border-slate-100 dark:border-slate-800 print:border-slate-300 print:p-1.5 align-middle">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <div className="flex gap-0.5 w-full justify-center">
                              {(['q1', 'q2', 'q3', 'q4'] as const).map(qKey => {
                                const gradeVal = sData[`${qKey}Grade` as keyof typeof sData];
                                const avgVal = sData[`${qKey}Avg` as keyof typeof sData];
                                return (
                                  <div key={qKey} title={`${qKey.toUpperCase()}: ${gradeVal || avgVal || '-'}`} className="w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-sm bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 print:border print:border-slate-200">
                                    {gradeVal || (avgVal && avgVal !== '-' ? Math.round(parseFloat(avgVal)) : '·')}
                                  </div>
                                );
                              })}
                            </div>
                            {sData.yearGrade || sData.yearAvg !== '-' ? (
                              <div className={`px-2 py-0.5 text-[11px] font-black rounded ${sData.yearGrade ? H.getGradeColorClass(sData.yearGrade, minGrade, maxGrade) : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'} print:border print:border-black print:bg-white print:text-black`}>
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
                        <td key={subj} className="p-3 text-center border-r border-slate-100 dark:border-slate-800 print:border-slate-300 align-middle">
                          <div className="flex flex-col items-center gap-1">
                            {gradeVal ? (
                              <div className={`w-8 h-8 flex items-center justify-center rounded-lg font-black text-sm ${H.getGradeColorClass(gradeVal, minGrade, maxGrade)} print:border print:border-black print:bg-white print:text-black`}>
                                {gradeVal}
                              </div>
                            ) : (
                              <div className="w-8 h-8 flex items-center justify-center text-slate-300">—</div>
                            )}
                            {avgVal && avgVal !== '-' && (
                              <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
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
      </Card>

      {selectedStudentId && activeStudentSummary && (
        <Modal isOpen={!!selectedStudentId} onClose={() => setSelectedStudentId(null)} title={lang === 'ru' ? 'Личная карточка успеваемости' : 'Personal Academic Card'} maxWidth="max-w-3xl">
          <div className="space-y-6">
            <div className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 rounded-2xl">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{activeStudentSummary.student.fio}</h3>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mt-1">Класс {selectedClassNum}{selectedClassLetter}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-blue-600/70 dark:text-blue-400/70 uppercase tracking-widest mb-1">Ср. балл</p>
                <div className="text-3xl font-black text-blue-700 dark:text-blue-400">{activeStudentSummary.overallGpa}</div>
              </div>
            </div>

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
            
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setSelectedStudentId(null)}>{t('cancel')}</Button>
              <Button variant="primary" onClick={() => window.print()}><Printer size={16} className="mr-2" />{t('print')}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

