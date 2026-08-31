
import React, { useState } from 'react';
import { AppState, User } from '../types';
import * as H from '../utils/helpers';
import { Messaging } from './SharedComponents';
import { Analytics } from './admin/Analytics';
import { SchoolManagement } from './admin/SchoolManagement';
import { UserManagement } from './admin/UserManagement';
import { StudentRating } from './shared/StudentRating';
import { EljurInfoEditor } from './admin/EljurInfoEditor';
import { Modal, Button } from '../components/ui';

interface Props {
  state: AppState;
  onUpdate: (s: AppState) => void;
  user: User;
}

export default function CreatorDashboard({ state, onUpdate, user }: Props) {
  const [view, setView] = useState<'analytics' | 'schools' | 'users' | 'rating' | 'messages' | 'eljurInfo'>(() => {
    return (localStorage.getItem(`eljur_tab_${user.id}`) as any) || 'analytics';
  });
  const [pendingView, setPendingView] = useState<typeof view | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  
  React.useEffect(() => {
    localStorage.setItem(`eljur_tab_${user.id}`, view);
  }, [view, user.id]);
  
  const lang = state.settings.language || 'ru';
  const t = (k: string) => H.t(k, lang);

  const unreadMessagesCount = H.getUnreadMessagesCount(state, user);

  const handleTabClick = (newView: typeof view) => {
    if (view === 'eljurInfo' && hasUnsavedChanges && newView !== 'eljurInfo') {
      setPendingView(newView);
      setShowUnsavedModal(true);
    } else {
      setView(newView);
    }
  };

  const confirmLeave = () => {
    setHasUnsavedChanges(false);
    setShowUnsavedModal(false);
    if (pendingView) setView(pendingView);
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-1.5 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 inline-flex overflow-x-auto hide-scrollbar gap-1 no-print max-w-full dark:bg-slate-900 dark:border-slate-800 pb-2 sm:pb-1.5">
        <TabButton active={view === 'analytics'} onClick={() => handleTabClick('analytics')} label={t('analytics')} />
        <TabButton active={view === 'schools'} onClick={() => handleTabClick('schools')} label={t('manage_schools')} />
        <TabButton active={view === 'users'} onClick={() => handleTabClick('users')} label={t('global_users')} />
        <TabButton active={view === 'rating'} onClick={() => handleTabClick('rating')} label={t('rating')} />
        <TabButton active={view === 'messages'} onClick={() => handleTabClick('messages')} label={t('messages')} badgeCount={unreadMessagesCount} />
        <TabButton active={view === 'eljurInfo'} onClick={() => handleTabClick('eljurInfo')} label={t('info_eljur')} />
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {view === 'analytics' && <Analytics state={state} lang={lang} />}
        {view === 'schools' && <SchoolManagement state={state} onUpdate={onUpdate} lang={lang} />}
        {view === 'users' && <UserManagement state={state} onUpdate={onUpdate} currentUser={user} isGlobal={true} />}
        {view === 'rating' && <StudentRating state={state} isGlobal={true} />}
        {view === 'messages' && <Messaging state={state} onUpdate={onUpdate} currentUser={user} type="messages" />}
        {view === 'eljurInfo' && <EljurInfoEditor state={state} onUpdate={onUpdate} lang={lang} setHasUnsavedChanges={setHasUnsavedChanges} />}
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
