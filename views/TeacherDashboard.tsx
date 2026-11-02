
import React, { useState } from 'react';
import { AppState, User } from '../types';
import * as H from '../utils/helpers';
import { Messaging } from './SharedComponents';
import { ScheduleView } from './teacher/ScheduleView';
import { HomeworkManager } from './teacher/HomeworkManager';
import { Gradebook } from './teacher/Gradebook';
import { StudentRating } from './shared/StudentRating';
import { HomeroomSummaryView } from './shared/HomeroomSummaryView';
import { Modal, Button, SideNavDrawer } from '../components/ui';

export default function TeacherDashboard({ state, onUpdate, user, mobileMenuOpen, setMobileMenuOpen }: { state: AppState, onUpdate: (s: AppState) => void, user: User, mobileMenuOpen?: boolean, setMobileMenuOpen?: (v: boolean) => void }) {
  const leadingClasses = H.getUserLeadingClasses(state, user.schoolId, user.id);
  const hasHomeroom = leadingClasses.length > 0;

  const [view, setView] = useState<'schedule' | 'homework' | 'grades' | 'rating' | 'homeroom' | 'messages' | 'announcements'>(() => {
    return (localStorage.getItem(`eljur_tab_${user.id}`) as any) || 'schedule';
  });
  const [hasUnsavedGrades, setHasUnsavedGrades] = useState(false);
  const [pendingView, setPendingView] = useState<any>(null);

  React.useEffect(() => {
    localStorage.setItem(`eljur_tab_${user.id}`, view);
  }, [view, user.id]);
  const lang = state.settings.language || 'ru';
  const t = (k: string) => H.t(k, lang);

  const unreadMessagesCount = H.getUnreadMessagesCount(state, user);
  const unreadAnnouncementsCount = H.getUnreadAnnouncementsCount(state, user);

  const tabs: { id: typeof view; label: string; badgeCount?: number }[] = [
    { id: 'schedule', label: t('schedule') },
    { id: 'homework', label: t('homework') },
    { id: 'grades', label: t('journal') },
    ...(hasHomeroom ? [{ id: 'homeroom' as const, label: t('homeroom_tab') }] : []),
    { id: 'rating', label: t('rating') },
    { id: 'messages', label: t('messages'), badgeCount: unreadMessagesCount },
    { id: 'announcements', label: t('announcements'), badgeCount: unreadAnnouncementsCount }
  ];

  const handleTabClick = (newView: string) => {
    setMobileMenuOpen?.(false);
    if (view === 'grades' && hasUnsavedGrades && newView !== 'grades') {
      setPendingView(newView);
    } else {
      setView(newView as typeof view);
    }
  };

  const confirmLeave = () => {
    setHasUnsavedGrades(false);
    setView(pendingView);
    setPendingView(null);
  };

  return (
    <div className="space-y-2.5 sm:space-y-6">
      <SideNavDrawer
        items={tabs}
        activeId={view}
        onSelect={handleTabClick}
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
          <TabButton key={tb.id} active={view === tb.id} onClick={() => handleTabClick(tb.id)} label={tb.label} badgeCount={tb.badgeCount} />
        ))}
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {view === 'schedule' && <ScheduleView state={state} user={user} lang={lang} />}
        {view === 'homework' && <HomeworkManager state={state} onUpdate={onUpdate} user={user} lang={lang} />}
        {view === 'grades' && <Gradebook state={state} onUpdate={onUpdate} user={user} lang={lang} setHasUnsavedGrades={setHasUnsavedGrades} hasUnsavedGrades={hasUnsavedGrades} />}
        {view === 'homeroom' && hasHomeroom && <HomeroomSummaryView state={state} user={user} onUpdate={onUpdate} />}
        {view === 'rating' && <StudentRating state={state} schoolId={user.schoolId} />}
        {view === 'messages' && <Messaging state={state} onUpdate={onUpdate} currentUser={user} type="messages" />}
        {view === 'announcements' && <Messaging state={state} onUpdate={onUpdate} currentUser={user} type="announcements" />}
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
