
import React, { useState } from 'react';
import { AppState, User } from '../types';
import * as H from '../utils/helpers';
import { Messaging } from './SharedComponents';
import { Analytics } from './admin/Analytics';
import { SchoolManagement } from './admin/SchoolManagement';
import { UserManagement } from './admin/UserManagement';
import { StudentRating } from './shared/StudentRating';
import { EljurInfoEditor } from './admin/EljurInfoEditor';
import { Modal, Button, SideNavDrawer } from '../components/ui';

interface Props {
  state: AppState;
  onUpdate: (s: AppState) => void;
  user: User;
  mobileMenuOpen?: boolean;
  setMobileMenuOpen?: (v: boolean) => void;
}

export default function CreatorDashboard({ state, onUpdate, user, mobileMenuOpen, setMobileMenuOpen }: Props) {
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

  const tabs: { id: typeof view; label: string; badgeCount?: number }[] = [
    { id: 'analytics', label: t('analytics') },
    { id: 'schools', label: t('manage_schools') },
    { id: 'users', label: t('global_users') },
    { id: 'rating', label: t('rating') },
    { id: 'messages', label: t('messages'), badgeCount: unreadMessagesCount },
    { id: 'eljurInfo', label: t('info_eljur') }
  ];

  const handleTabClick = (newView: string) => {
    setMobileMenuOpen?.(false);
    const targetView = newView as typeof view;
    if (view === 'eljurInfo' && hasUnsavedChanges && targetView !== 'eljurInfo') {
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
        onSelect={handleTabClick}
        isOpen={!!mobileMenuOpen}
        onClose={() => setMobileMenuOpen?.(false)}
        onOpen={() => setMobileMenuOpen?.(true)}
        userFio={user.fio}
        userRoleLabel={t(user.role)}
        schoolName={lang === 'ru' ? 'Глобальное управление' : 'Global Management'}
        lang={lang}
      />

      {/* Tablet & PC Tab Bar (md and up) */}
      <div className="hidden md:inline-flex md:flex-wrap bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 gap-1.5 no-print w-auto dark:bg-slate-900 dark:border-slate-800">
        {tabs.map(tb => (
          <TabButton key={tb.id} active={view === tb.id} onClick={() => handleTabClick(tb.id)} label={tb.label} badgeCount={tb.badgeCount} />
        ))}
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
