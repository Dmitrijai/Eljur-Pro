
import React, { useState } from 'react';
import { AppState, User } from '../types';
import * as H from '../utils/helpers';
import { Messaging } from './SharedComponents';
import { ScheduleView } from './teacher/ScheduleView';
import { HomeworkManager } from './teacher/HomeworkManager';
import { Gradebook } from './teacher/Gradebook';
import { StudentRating } from './shared/StudentRating';
import { HomeroomSummaryView } from './shared/HomeroomSummaryView';
import { Modal, Button } from '../components/ui';

export default function TeacherDashboard({ state, onUpdate, user }: { state: AppState, onUpdate: (s: AppState) => void, user: User }) {
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

  const handleTabClick = (newView: any) => {
    if (view === 'grades' && hasUnsavedGrades && newView !== 'grades') {
      setPendingView(newView);
    } else {
      setView(newView);
    }
  };

  const confirmLeave = () => {
    setHasUnsavedGrades(false);
    setView(pendingView);
    setPendingView(null);
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-1.5 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 inline-flex overflow-x-auto hide-scrollbar gap-1 no-print max-w-full dark:bg-slate-900 dark:border-slate-800 pb-2 sm:pb-1.5">
        <TabButton active={view === 'schedule'} onClick={() => handleTabClick('schedule')} label={t('schedule')} />
        <TabButton active={view === 'homework'} onClick={() => handleTabClick('homework')} label={t('homework')} />
        <TabButton active={view === 'grades'} onClick={() => handleTabClick('grades')} label={t('journal')} />
        {hasHomeroom && (
          <TabButton 
            active={view === 'homeroom'} 
            onClick={() => handleTabClick('homeroom')} 
            label={t('homeroom_tab')} 
          />
        )}
        <TabButton active={view === 'rating'} onClick={() => handleTabClick('rating')} label={t('rating')} />
        <TabButton active={view === 'messages'} onClick={() => handleTabClick('messages')} label={t('messages')} badgeCount={unreadMessagesCount} />
        <TabButton active={view === 'announcements'} onClick={() => handleTabClick('announcements')} label={t('announcements')} badgeCount={unreadAnnouncementsCount} />
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

      <Modal isOpen={!!pendingView} onClose={() => setPendingView(null)} title="Внимание">
        <div className="space-y-4">
          <p className="text-slate-700 dark:text-slate-300">
            У вас есть несохраненные оценки. Если вы покинете вкладку, они не будут выставлены. Вы уверены, что хотите выйти?
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setPendingView(null)}>Отмена</Button>
            <Button variant="primary" onClick={confirmLeave} className="bg-red-600 hover:bg-red-700 text-white border-none">Выйти без сохранения</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const TabButton = ({ active, onClick, label, badgeCount }: { active: boolean; onClick: () => void; label: string; badgeCount?: number }) => (
  <button
    onClick={onClick}
    className={`flex-none px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap flex items-center justify-center gap-2 ${
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
