
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
import { EljurInfoEditor } from './admin/EljurInfoEditor';
import { SideNavDrawer, Modal, Button } from '../components/ui';
import { Edit } from 'lucide-react';

interface Props {
  state: AppState;
  onUpdate: (s: AppState) => void;
  user: User;
  mobileMenuOpen?: boolean;
  setMobileMenuOpen?: (v: boolean) => void;
}

export default function DirectorDashboard({ state, onUpdate, user, mobileMenuOpen, setMobileMenuOpen }: Props) {
  const [view, setView] = H.useSyncedState<'users' | 'schedule' | 'rating' | 'homeroom' | 'messages' | 'announcements' | 'load' | 'groups' | 'grading' | 'schoolInfo'>(`eljur_tab_${user.id}`, 'users');
  const [pendingView, setPendingView] = useState<typeof view | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  const lang = state.settings.language || 'ru';
  const t = (k: string) => H.t(k, lang);

  const unreadMessagesCount = H.getUnreadMessagesCount(state, user);
  const unreadAnnouncementsCount = H.getUnreadAnnouncementsCount(state, user);

  const tabs: { id: typeof view; label: string; badgeCount?: number; iconOnlyOnDesktop?: boolean }[] = [
    { id: 'users', label: t('users') },
    { id: 'load', label: t('teacher_load') },
    { id: 'groups', label: t('groups') },
    { id: 'schedule', label: t('schedule') },
    { id: 'homeroom', label: t('homeroom_tab') },
    { id: 'rating', label: t('rating') },
    { id: 'grading', label: t('grading_setup') },
    { id: 'messages', label: t('messages'), badgeCount: unreadMessagesCount },
    { id: 'announcements', label: t('announcements'), badgeCount: unreadAnnouncementsCount },
    { id: 'schoolInfo', label: t('info_school'), iconOnlyOnDesktop: true }
  ];

  const handleSelectTab = (id: string) => {
    setMobileMenuOpen?.(false);
    const targetView = id as typeof view;
    if (view === 'schoolInfo' && hasUnsavedChanges && targetView !== 'schoolInfo') {
      setPendingView(targetView);
      setShowUnsavedModal(true);
    } else {
      setView(targetView);
    }
  };

  const confirmLeave = () => {
    setHasUnsavedChanges(false);
    setShowUnsavedModal(false);
    if (pendingView) setView(pendingView);
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
          <TabButton
            key={tb.id}
            active={view === tb.id}
            onClick={() => handleSelectTab(tb.id)}
            label={tb.label}
            badgeCount={tb.badgeCount}
            iconOnly={tb.iconOnlyOnDesktop}
          />
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
        {view === 'schoolInfo' && <EljurInfoEditor state={state} onUpdate={onUpdate} lang={lang} setHasUnsavedChanges={setHasUnsavedChanges} mode="school" schoolId={user.schoolId} />}
      </div>

      {showUnsavedModal && (
        <Modal isOpen={true} onClose={() => setShowUnsavedModal(false)} title={t('unsaved_changes')}>
          <div className="p-6">
            <p className="mb-6 text-slate-700 dark:text-slate-300">
              {t('unsaved_canvas_changes')}
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowUnsavedModal(false)}>
                {t('stay')}
              </Button>
              <Button variant="danger" onClick={confirmLeave}>
                {t('leave_tab')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

const TabButton: React.FC<{ active: boolean; onClick: () => void; label: string; badgeCount?: number; iconOnly?: boolean }> = ({ active, onClick, label, badgeCount, iconOnly }) => (
  <button
    onClick={onClick}
    title={label}
    aria-label={label}
    className={`${iconOnly ? 'px-3 sm:px-3.5 py-2.5' : 'px-3 sm:px-5 py-2.5'} rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap flex items-center justify-center gap-1.5 sm:gap-2 ${
      active 
        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 dark:bg-blue-600' 
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
    }`}
  >
    {iconOnly ? (
      <Edit size={16} />
    ) : (
      <span className="truncate">{label}</span>
    )}
    {typeof badgeCount === 'number' && badgeCount > 0 && (
      <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold rounded-full leading-none shrink-0 transition-transform duration-200 ${
        active 
          ? 'bg-white text-blue-600 shadow-sm' 
          : 'bg-red-500 text-white shadow-sm'
      }`}>
        {badgeCount > 99 ? '99+' : badgeCount}
      </span>
    )}
  </button>
);
