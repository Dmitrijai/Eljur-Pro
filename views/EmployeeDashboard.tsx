import React, { useState, useEffect, useMemo } from 'react';
import { AppState, User } from '../types';
import { Messaging } from './SharedComponents';
import * as H from '../utils/helpers';
import { UserManagement } from './admin/UserManagement';
import { ScheduleEditor } from './admin/ScheduleEditor';
import { StudentRating } from './shared/StudentRating';
import { HomeroomSummaryView } from './shared/HomeroomSummaryView';
import { TeacherLoadManager } from './admin/TeacherLoadManager';
import { GroupManager } from './admin/GroupManager';
import { GradingSetup } from './admin/GradingSetup';
import { ScheduleView } from './teacher/ScheduleView';
import { HomeworkManager } from './teacher/HomeworkManager';
import { Gradebook } from './teacher/Gradebook';
import { Modal, Button, SideNavDrawer } from '../components/ui';

interface Props {
  state: AppState;
  onUpdate: (s: AppState) => void;
  user: User;
  mobileMenuOpen?: boolean;
  setMobileMenuOpen?: (v: boolean) => void;
}

export default function EmployeeDashboard({ state, onUpdate, user, mobileMenuOpen, setMobileMenuOpen }: Props) {
  const leadingClasses = H.getUserLeadingClasses(state, user.schoolId, user.id);
  const hasHomeroom = leadingClasses.length > 0;
  const isAlsoTeacher = !!user.employeePermissions?.isTeacher;

  const allowedTabs = user.employeePermissions?.allowedTabs || ['messages'];
  const effectiveAllowedTabs = useMemo(() => {
    const list: string[] = [];
    if (isAlsoTeacher) {
      list.push('my_schedule', 'homework', 'grades');
    }
    if (hasHomeroom) {
      list.push('homeroom');
    }
    allowedTabs.forEach(tb => {
      if (tb !== 'homeroom' && !list.includes(tb)) {
        list.push(tb);
      }
    });
    if (isAlsoTeacher && !list.includes('rating')) {
      list.push('rating');
    }
    return list;
  }, [allowedTabs, hasHomeroom, isAlsoTeacher]);

  const [view, setView] = H.useSyncedState<string>(`eljur_tab_${user.id}`, () => effectiveAllowedTabs[0] || 'messages');
  const [hasUnsavedGrades, setHasUnsavedGrades] = useState(false);
  const [pendingView, setPendingView] = useState<string | null>(null);
  const lang = state.settings.language || 'ru';
  const t = (k: string) => H.t(k, lang);

  const unreadMessagesCount = H.getUnreadMessagesCount(state, user);
  const unreadAnnouncementsCount = H.getUnreadAnnouncementsCount(state, user);

  useEffect(() => {
     if (!effectiveAllowedTabs.includes(view)) {
         setView(effectiveAllowedTabs[0] || '');
     }
  }, [effectiveAllowedTabs, view]);

  if (effectiveAllowedTabs.length === 0) {
      return <div className="p-10 text-center text-slate-500">{t('no_available_tabs')}</div>;
  }

  const tabs: { id: string; label: string; badgeCount?: number }[] = [
    ...(isAlsoTeacher ? [
      { id: 'my_schedule', label: allowedTabs.includes('schedule') ? t('my_schedule') : t('schedule') },
      { id: 'homework', label: t('homework') },
      { id: 'grades', label: t('journal') }
    ] : []),
    ...(hasHomeroom ? [{ id: 'homeroom', label: `${t('homeroom_tab')} (${leadingClasses.map(c => `${c.class}${c.letter}`).join(', ')})` }] : []),
    ...(allowedTabs.includes('messages') ? [{ id: 'messages', label: t('messages'), badgeCount: unreadMessagesCount }] : []),
    ...(allowedTabs.includes('announcements') ? [{ id: 'announcements', label: t('announcements'), badgeCount: unreadAnnouncementsCount }] : []),
    ...((allowedTabs.includes('rating') || isAlsoTeacher) ? [{ id: 'rating', label: t('rating') }] : []),
    ...(allowedTabs.includes('schedule') ? [{ id: 'schedule', label: t('schedule') }] : []),
    ...(allowedTabs.includes('users') ? [{ id: 'users', label: t('users') }] : []),
    ...(allowedTabs.includes('load') ? [{ id: 'load', label: t('teacher_load') }] : []),
    ...(allowedTabs.includes('groups') ? [{ id: 'groups', label: t('groups') }] : []),
    ...(allowedTabs.includes('grading') ? [{ id: 'grading', label: t('grading_setup') }] : [])
  ];

  const handleSelectTab = (id: string) => {
    setMobileMenuOpen?.(false);
    if (view === 'grades' && hasUnsavedGrades && id !== 'grades') {
      setPendingView(id);
    } else {
      setView(id);
    }
  };

  const confirmLeave = () => {
    setHasUnsavedGrades(false);
    if (pendingView) setView(pendingView);
    setPendingView(null);
  };

  const roleLabel = `${user.customRole || t('employee')}${isAlsoTeacher ? ` • ${t('teacher')}` : ''}`;

  return (
    <div className="space-y-2.5 sm:space-y-6">
      <SideNavDrawer
        items={tabs}
        activeId={view}
        onSelect={handleSelectTab}
        isOpen={!!mobileMenuOpen}
        onClose={() => setMobileMenuOpen?.(false)}
        onOpen={() => setMobileMenuOpen?.(true)}
        userFio={user.fio}
        userRoleLabel={roleLabel}
        schoolName={H.getSchool(state, user.schoolId)?.name}
        lang={lang}
      />

      {/* Tablet & PC Tab Bar (md and up) */}
      <div className="hidden md:inline-flex md:flex-wrap bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 gap-1.5 no-print w-auto dark:bg-slate-900 dark:border-slate-800">
        {tabs.map(tb => (
          <TabButton key={tb.id} active={view === tb.id} onClick={() => handleSelectTab(tb.id)} label={tb.label} badgeCount={tb.badgeCount} />
        ))}
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {view === 'my_schedule' && isAlsoTeacher && <ScheduleView state={state} user={user} lang={lang} />}
        {view === 'homework' && isAlsoTeacher && <HomeworkManager state={state} onUpdate={onUpdate} user={user} lang={lang} />}
        {view === 'grades' && isAlsoTeacher && <Gradebook state={state} onUpdate={onUpdate} user={user} lang={lang} setHasUnsavedGrades={setHasUnsavedGrades} hasUnsavedGrades={hasUnsavedGrades} />}
        {view === 'homeroom' && hasHomeroom && <HomeroomSummaryView state={state} user={user} onUpdate={onUpdate} />}
        {view === 'messages' && <Messaging state={state} onUpdate={onUpdate} currentUser={user} type="messages" />}
        {view === 'announcements' && <Messaging state={state} onUpdate={onUpdate} currentUser={user} type="announcements" />}
        {view === 'rating' && <StudentRating state={state} schoolId={user.schoolId} />}
        {view === 'schedule' && <ScheduleEditor state={state} onUpdate={onUpdate} user={user} />}
        {view === 'users' && <UserManagement state={state} onUpdate={onUpdate} currentUser={user} isGlobal={false} />}
        {view === 'load' && <TeacherLoadManager state={state} onUpdate={onUpdate} user={user} />}
        {view === 'groups' && <GroupManager state={state} onUpdate={onUpdate} user={user} />}
        {view === 'grading' && <GradingSetup state={state} onUpdate={onUpdate} user={user} />}
      </div>

      <Modal isOpen={!!pendingView} onClose={() => setPendingView(null)} title={t('attention')}>
        <div className="space-y-4">
          <p className="text-slate-700 dark:text-slate-300">
            {t('unsaved_grades_alert')}
          </p>
          <div className="flex flex-wrap justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setPendingView(null)}>{t('cancel')}</Button>
            <Button variant="primary" onClick={confirmLeave} className="bg-red-600 hover:bg-red-700 text-white border-none">{t('leave_without_saving')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const TabButton: React.FC<{ active: boolean; onClick: () => void; label: string; badgeCount?: number }> = ({ active, onClick, label, badgeCount }) => (
  <button
    onClick={onClick}
    className={`flex-none px-3.5 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap flex items-center justify-center gap-2 ${
      active 
        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 dark:bg-blue-600' 
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
    }`}
  >
    <span>{label}</span>
    {typeof badgeCount === 'number' && badgeCount > 0 && (
      <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full leading-none transition-transform duration-200 ${
        active 
          ? 'bg-white text-blue-600 shadow-sm' 
          : 'bg-red-500 text-white shadow-sm'
      }`}>
        {badgeCount > 99 ? '99+' : badgeCount}
      </span>
    )}
  </button>
);
