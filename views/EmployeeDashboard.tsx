import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
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
import { EljurInfoEditor } from './admin/EljurInfoEditor';
import { ScheduleView } from './teacher/ScheduleView';
import { HomeworkManager } from './teacher/HomeworkManager';
import { Gradebook } from './teacher/Gradebook';
import { Modal, Button, SideNavDrawer } from '../components/ui';
import { Edit } from 'lucide-react';

interface Props {
  state: AppState;
  onUpdate: (s: AppState) => void;
  user: User;
  mobileMenuOpen?: boolean;
  setMobileMenuOpen?: (v: boolean) => void;
}

type EmpTabItem = { id: string; label: string; badgeCount?: number; iconOnlyOnDesktop?: boolean };

export default function EmployeeDashboard({ state, onUpdate, user, mobileMenuOpen, setMobileMenuOpen }: Props) {
  const leadingClasses = H.getUserLeadingClasses(state, user.schoolId, user.id);
  const hasHomeroom = leadingClasses.length > 0;
  const isAlsoTeacher = !!user.employeePermissions?.isTeacher;

  const allowedTabs = user.employeePermissions?.allowedTabs || ['messages'];
  const hasSchoolInfoTab = allowedTabs.includes('schoolInfo') || allowedTabs.includes('school_info');

  const lang = state.settings.language || 'ru';
  const t = (k: string) => H.t(k, lang);

  const unreadMessagesCount = H.getUnreadMessagesCount(state, user);
  const unreadAnnouncementsCount = H.getUnreadAnnouncementsCount(state, user);

  const tabs: EmpTabItem[] = useMemo(() => [
    ...(isAlsoTeacher ? [
      { id: 'my_schedule', label: allowedTabs.includes('schedule') ? t('my_schedule') : t('schedule') },
      { id: 'homework', label: t('homework') },
      { id: 'grades', label: t('journal') }
    ] : []),
    ...(hasHomeroom ? [{ id: 'homeroom', label: t('homeroom_tab') }] : []),
    ...(allowedTabs.includes('messages') ? [{ id: 'messages', label: t('messages'), badgeCount: unreadMessagesCount }] : []),
    ...(allowedTabs.includes('announcements') ? [{ id: 'announcements', label: t('announcements'), badgeCount: unreadAnnouncementsCount }] : []),
    ...((allowedTabs.includes('rating') || (isAlsoTeacher && !user.employeePermissions?.allowedTabs)) ? [{ id: 'rating', label: t('rating') }] : []),
    ...(allowedTabs.includes('schedule') ? [{ id: 'schedule', label: t('schedule') }] : []),
    ...(allowedTabs.includes('users') ? [{ id: 'users', label: t('users') }] : []),
    ...(allowedTabs.includes('load') ? [{ id: 'load', label: t('teacher_load') }] : []),
    ...(allowedTabs.includes('groups') ? [{ id: 'groups', label: t('groups') }] : []),
    ...(allowedTabs.includes('grading') ? [{ id: 'grading', label: t('grading_setup') }] : []),
    ...(hasSchoolInfoTab ? [{ id: 'schoolInfo', label: t('info_school'), iconOnlyOnDesktop: true }] : [])
  ], [isAlsoTeacher, hasHomeroom, allowedTabs, hasSchoolInfoTab, unreadMessagesCount, unreadAnnouncementsCount, lang, user.employeePermissions?.allowedTabs]);

  const effectiveAllowedTabs = useMemo(() => tabs.map(tb => tb.id), [tabs]);

  const [view, setView] = H.useSyncedState<string>(`eljur_tab_${user.id}`, () => effectiveAllowedTabs[0] || 'messages');
  const [hasUnsavedGrades, setHasUnsavedGrades] = useState(false);
  const [hasUnsavedCanvasChanges, setHasUnsavedCanvasChanges] = useState(false);
  const [pendingView, setPendingView] = useState<string | null>(null);

  const barWrapperRef = useRef<HTMLDivElement | null>(null);
  const measureBarRef = useRef<HTMLDivElement | null>(null);
  const [topRowSplitIndex, setTopRowSplitIndex] = useState<number | null>(null);

  const nonIconTabs = useMemo(() => tabs.filter(tb => !tb.iconOnlyOnDesktop), [tabs]);
  const schoolInfoTab = useMemo(() => tabs.find(tb => tb.iconOnlyOnDesktop) || null, [tabs]);

  const recalcTopRowSplit = useCallback(() => {
    if (!schoolInfoTab || !barWrapperRef.current || !measureBarRef.current) {
      setTopRowSplitIndex(null);
      return;
    }
    const maxRowWidth = barWrapperRef.current.clientWidth;
    if (maxRowWidth <= 0) {
      setTopRowSplitIndex(null);
      return;
    }
    const children = Array.from(measureBarRef.current.children) as HTMLElement[];
    if (children.length !== nonIconTabs.length + 1) {
      setTopRowSplitIndex(null);
      return;
    }
    const nonIconWidths = children.slice(0, nonIconTabs.length).map(el => el.offsetWidth);
    const iconWidth = children[nonIconTabs.length].offsetWidth;
    const gap = 6; // gap-1.5 = 6px
    const horizontalChrome = 14; // p-1.5 (12px) + border (2px)
    const availWidth = maxRowWidth - horizontalChrome;

    const totalAllWidth =
      nonIconWidths.reduce((sum, w) => sum + w, 0) +
      iconWidth +
      gap * nonIconWidths.length;

    if (totalAllWidth <= availWidth) {
      // Everything fits on a single row; schoolInfo is naturally at the end
      setTopRowSplitIndex(null);
      return;
    }

    // Tabs wrap into 2+ rows: find how many nonIconTabs fit on row 1 junto with schoolInfoTab at the end of row 1
    let used = 0;
    let fitCount = 0;
    for (let i = 0; i < nonIconWidths.length; i++) {
      const w = nonIconWidths[i];
      const nextUsed = used + (i > 0 ? gap : 0) + w;
      if (nextUsed + gap + iconWidth <= availWidth) {
        used = nextUsed;
        fitCount = i + 1;
      } else {
        break;
      }
    }
    setTopRowSplitIndex(Math.max(1, fitCount));
  }, [nonIconTabs, schoolInfoTab]);

  useLayoutEffect(() => {
    recalcTopRowSplit();
    const wrapperEl = barWrapperRef.current;
    if (!wrapperEl || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      recalcTopRowSplit();
    });
    ro.observe(wrapperEl);
    window.addEventListener('resize', recalcTopRowSplit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recalcTopRowSplit);
    };
  }, [recalcTopRowSplit]);

  useEffect(() => {
    if (view === 'school_info' && effectiveAllowedTabs.includes('schoolInfo')) {
      setView('schoolInfo');
      return;
    }
    if (!effectiveAllowedTabs.includes(view)) {
      setView(effectiveAllowedTabs[0] || '');
    }
  }, [effectiveAllowedTabs, view]);

  if (effectiveAllowedTabs.length === 0) {
    return <div className="p-10 text-center text-slate-500">{t('no_available_tabs')}</div>;
  }

  const handleSelectTab = (id: string) => {
    setMobileMenuOpen?.(false);
    if (view === 'grades' && hasUnsavedGrades && id !== 'grades') {
      setPendingView(id);
    } else if (view === 'schoolInfo' && hasUnsavedCanvasChanges && id !== 'schoolInfo') {
      setPendingView(id);
    } else {
      setView(id);
    }
  };

  const confirmLeave = () => {
    setHasUnsavedGrades(false);
    setHasUnsavedCanvasChanges(false);
    if (pendingView) setView(pendingView);
    setPendingView(null);
  };

  const shortPos = H.formatShortPosition(user.customRole || t('employee'));
  const roleLabel = `${shortPos}${isAlsoTeacher ? ` • ${t('teacher')}` : ''}`;

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

      {/* Hidden measurement bar for desktop row calculation */}
      {schoolInfoTab && (
        <div
          ref={measureBarRef}
          aria-hidden="true"
          className="hidden md:inline-flex fixed -top-[9999px] left-0 pointer-events-none opacity-0 p-1.5 gap-1.5 border border-slate-200"
        >
          {nonIconTabs.map(tb => (
            <TabButton
              key={`measure_${tb.id}`}
              active={view === tb.id}
              onClick={() => {}}
              label={tb.label}
              badgeCount={tb.badgeCount}
              iconOnly={false}
            />
          ))}
          <TabButton
            key={`measure_${schoolInfoTab.id}`}
            active={view === schoolInfoTab.id}
            onClick={() => {}}
            label={schoolInfoTab.label}
            badgeCount={schoolInfoTab.badgeCount}
            iconOnly={true}
          />
        </div>
      )}

      {/* Tablet & PC Tab Bar (md and up) */}
      <div ref={barWrapperRef} className="hidden md:block no-print w-full">
        <div className="inline-flex flex-wrap bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 gap-1.5 w-auto max-w-full dark:bg-slate-900 dark:border-slate-800">
          {schoolInfoTab && topRowSplitIndex !== null ? (
            <>
              {nonIconTabs.slice(0, topRowSplitIndex).map(tb => (
                <TabButton
                  key={tb.id}
                  active={view === tb.id}
                  onClick={() => handleSelectTab(tb.id)}
                  label={tb.label}
                  badgeCount={tb.badgeCount}
                  iconOnly={false}
                />
              ))}
              <TabButton
                key={schoolInfoTab.id}
                active={view === schoolInfoTab.id}
                onClick={() => handleSelectTab(schoolInfoTab.id)}
                label={schoolInfoTab.label}
                badgeCount={schoolInfoTab.badgeCount}
                iconOnly={true}
              />
              <div className="basis-full h-0 -my-[3px]" aria-hidden="true" />
              {nonIconTabs.slice(topRowSplitIndex).map(tb => (
                <TabButton
                  key={tb.id}
                  active={view === tb.id}
                  onClick={() => handleSelectTab(tb.id)}
                  label={tb.label}
                  badgeCount={tb.badgeCount}
                  iconOnly={false}
                />
              ))}
            </>
          ) : (
            tabs.map(tb => (
              <TabButton
                key={tb.id}
                active={view === tb.id}
                onClick={() => handleSelectTab(tb.id)}
                label={tb.label}
                badgeCount={tb.badgeCount}
                iconOnly={tb.iconOnlyOnDesktop}
              />
            ))
          )}
        </div>
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
        {view === 'schoolInfo' && hasSchoolInfoTab && <EljurInfoEditor state={state} onUpdate={onUpdate} lang={lang} setHasUnsavedChanges={setHasUnsavedCanvasChanges} mode="school" schoolId={user.schoolId} />}
      </div>

      <Modal isOpen={!!pendingView} onClose={() => setPendingView(null)} title={view === 'schoolInfo' ? t('unsaved_changes') : t('attention')}>
        <div className="space-y-4">
          <p className="text-slate-700 dark:text-slate-300">
            {view === 'schoolInfo' ? t('unsaved_canvas_changes') : t('unsaved_grades_alert')}
          </p>
          <div className="flex flex-wrap justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setPendingView(null)}>{view === 'schoolInfo' ? t('stay') : t('cancel')}</Button>
            <Button variant="primary" onClick={confirmLeave} className="bg-red-600 hover:bg-red-700 text-white border-none">{view === 'schoolInfo' ? t('leave_tab') : t('leave_without_saving')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const TabButton: React.FC<{ active: boolean; onClick: () => void; label: string; badgeCount?: number; iconOnly?: boolean }> = ({ active, onClick, label, badgeCount, iconOnly }) => (
  <button
    onClick={onClick}
    title={label}
    aria-label={label}
    className={`flex-none ${iconOnly ? 'px-3 sm:px-3.5 py-2 sm:py-2.5' : 'px-3.5 sm:px-6 py-2 sm:py-2.5'} rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap flex items-center justify-center gap-2 ${
      active 
        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 dark:bg-blue-600' 
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
    }`}
  >
    {iconOnly ? (
      <Edit size={16} />
    ) : (
      <span>{label}</span>
    )}
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
