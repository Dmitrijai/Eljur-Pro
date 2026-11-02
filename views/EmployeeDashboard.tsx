
import React, { useState, useEffect } from 'react';
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
import { SideNavDrawer } from '../components/ui';

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

  const allowedTabs = user.employeePermissions?.allowedTabs || ['messages']; 
  const effectiveAllowedTabs = allowedTabs.filter(t => t !== 'homeroom');
  if (hasHomeroom) effectiveAllowedTabs.push('homeroom');

  const [view, setView] = H.useSyncedState<string>(`eljur_tab_${user.id}`, () => effectiveAllowedTabs[0] || 'messages');
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
    ...(hasHomeroom ? [{ id: 'homeroom', label: `${t('homeroom_tab')} (${leadingClasses.map(c => `${c.class}${c.letter}`).join(', ')})` }] : []),
    ...(allowedTabs.includes('messages') ? [{ id: 'messages', label: t('messages'), badgeCount: unreadMessagesCount }] : []),
    ...(allowedTabs.includes('announcements') ? [{ id: 'announcements', label: t('announcements'), badgeCount: unreadAnnouncementsCount }] : []),
    ...(allowedTabs.includes('rating') ? [{ id: 'rating', label: t('rating') }] : []),
    ...(allowedTabs.includes('schedule') ? [{ id: 'schedule', label: t('schedule') }] : []),
    ...(allowedTabs.includes('users') ? [{ id: 'users', label: t('users') }] : []),
    ...(allowedTabs.includes('load') ? [{ id: 'load', label: t('teacher_load') }] : []),
    ...(allowedTabs.includes('groups') ? [{ id: 'groups', label: t('groups') }] : []),
    ...(allowedTabs.includes('grading') ? [{ id: 'grading', label: t('grading_setup') }] : [])
  ];

  const handleSelectTab = (id: string) => {
    setView(id);
    setMobileMenuOpen?.(false);
  };

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
        userRoleLabel={user.customRole || t('employee')}
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
