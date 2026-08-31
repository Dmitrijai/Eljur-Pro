
import React, { useState } from 'react';
import { AppState, User } from '../types';
import * as H from '../utils/helpers';
import { Messaging } from './SharedComponents';
import { StudentSchedule } from './student/StudentSchedule';
import { StudentJournal } from './student/StudentJournal';
import { StudentGrades } from './student/StudentGrades';
import { StudentRating } from './shared/StudentRating';

export default function StudentDashboard({ state, user, onUpdate }: { state: AppState, user: User, onUpdate: any }) {
  const [view, setView] = useState<'schedule' | 'journal' | 'grades' | 'rating' | 'messages' | 'announcements'>(() => {
    return (localStorage.getItem(`eljur_tab_${user.id}`) as any) || 'journal';
  });
  
  React.useEffect(() => {
    localStorage.setItem(`eljur_tab_${user.id}`, view);
  }, [view, user.id]);
  const lang = state.settings.language || 'ru';
  const t = (k: string) => H.t(k, lang);

  const unreadMessagesCount = H.getUnreadMessagesCount(state, user);
  const unreadAnnouncementsCount = H.getUnreadAnnouncementsCount(state, user);

  return (
    <div className="space-y-8">
       <div className="bg-white p-1.5 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 inline-flex overflow-x-auto hide-scrollbar gap-1 no-print max-w-full dark:bg-slate-900 dark:border-slate-800 pb-2 sm:pb-1.5">
        <TabButton active={view === 'schedule'} onClick={() => setView('schedule')} label={t('schedule')} />
        <TabButton active={view === 'journal'} onClick={() => setView('journal')} label={t('diary')} />
        <TabButton active={view === 'grades'} onClick={() => setView('grades')} label={t('performance')} />
        <TabButton active={view === 'rating'} onClick={() => setView('rating')} label={t('rating')} />
        <TabButton active={view === 'messages'} onClick={() => setView('messages')} label={t('messages')} badgeCount={unreadMessagesCount} />
        <TabButton active={view === 'announcements'} onClick={() => setView('announcements')} label={t('announcements')} badgeCount={unreadAnnouncementsCount} />
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {view === 'schedule' && <StudentSchedule state={state} user={user} />}
        {view === 'journal' && <StudentJournal state={state} user={user} />}
        {view === 'grades' && <StudentGrades state={state} user={user} />}
        {view === 'rating' && <StudentRating state={state} schoolId={user.schoolId} />}
        {view === 'messages' && <Messaging state={state} onUpdate={onUpdate} currentUser={user} type="messages" />}
        {view === 'announcements' && <Messaging state={state} onUpdate={onUpdate} currentUser={user} type="announcements" />}
      </div>
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
