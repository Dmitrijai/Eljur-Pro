
import React, { useState } from 'react';
import { AppState, User } from '../types';
import * as H from '../utils/helpers';
import { Messaging } from './SharedComponents';
import { UserManagement } from './admin/UserManagement';
import { TeacherLoadManager } from './admin/TeacherLoadManager';
import { GroupManager } from './admin/GroupManager';
import { ScheduleEditor } from './admin/ScheduleEditor';
import { StudentRating } from './shared/StudentRating';
import { HomeroomSummaryView } from './shared/HomeroomSummaryView';
import { GradingSetup } from './admin/GradingSetup';
import { SideNavDrawer } from '../components/ui';

interface Props {
  state: AppState;
  onUpdate: (s: AppState) => void;
  user: User;
  mobileMenuOpen?: boolean;
  setMobileMenuOpen?: (v: boolean) => void;
}

export default function DirectorDashboard({ state, onUpdate, user, mobileMenuOpen, setMobileMenuOpen }: Props) {
  const [view, setView] = H.useSyncedState<'users' | 'schedule' | 'rating' | 'homeroom' | 'messages' | 'announcements' | 'load' | 'groups' | 'grading'>(`eljur_tab_${user.id}`, 'users');
  const lang = state.settings.language || 'ru';
  const t = (k: string) => H.t(k, lang);

  const unreadMessagesCount = H.getUnreadMessagesCount(state, user);
  const unreadAnnouncementsCount = H.getUnreadAnnouncementsCount(state, user);

  const tabs: { id: typeof view; label: string; badgeCount?: number }[] = [
    { id: 'users', label: t('users') },
    { id: 'load', label: t('teacher_load') },
    { id: 'groups', label: t('groups') },
    { id: 'schedule', label: t('schedule') },
    { id: 'homeroom', label: t('homeroom_tab') },
    { id: 'rating', label: t('rating') },
    { id: 'grading', label: t('grading_setup') },
    { id: 'messages', label: t('messages'), badgeCount: unreadMessagesCount },
    { id: 'announcements', label: t('announcements'), badgeCount: unreadAnnouncementsCount }
  ];

  const handleSelectTab = (id: string) => {
    setView(id as typeof view);
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
        userRoleLabel={t(user.role)}
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
        {view === 'users' && <UserManagement state={state} onUpdate={onUpdate} currentUser={user} />}
        {view === 'load' && <TeacherLoadManager state={state} onUpdate={onUpdate} user={user} />}
        {view === 'groups' && <GroupManager state={state} onUpdate={onUpdate} user={user} />}
        {view === 'schedule' && <ScheduleEditor state={state} onUpdate={onUpdate} user={user} />}
        {view === 'homeroom' && <HomeroomSummaryView state={state} user={user} onUpdate={onUpdate} />}
        {view === 'rating' && <StudentRating state={state} schoolId={user.schoolId} />}
        {view === 'grading' && <GradingSetup state={state} onUpdate={onUpdate} user={user} />}
        {view === 'messages' && <Messaging state={state} onUpdate={onUpdate} currentUser={user} type="messages" />}
        {view === 'announcements' && <Messaging state={state} onUpdate={onUpdate} currentUser={user} type="announcements" />}
      </div>
    </div>
  );
}

const TabButton: React.FC<{ active: boolean; onClick: () => void; label: string; badgeCount?: number }> = ({ active, onClick, label, badgeCount }) => (
  <button
    onClick={onClick}
    className={`px-3 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap flex items-center justify-center gap-1.5 sm:gap-2 ${
      active 
        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 dark:bg-blue-600' 
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
    }`}
  >
    <span className="truncate">{label}</span>
    {typeof badgeCount === 'number' && badgeCount > 0 && (
      <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full leading-none shrink-0 transition-transform duration-200 ${
        active 
          ? 'bg-white text-blue-600 shadow-sm' 
          : 'bg-red-500 text-white shadow-sm'
      }`}>
        {badgeCount > 99 ? '99+' : badgeCount}
      </span>
    )}
  </button>
);
