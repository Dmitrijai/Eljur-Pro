

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, User, Message, Attachment } from '../types';
import * as H from '../utils/helpers';
import * as DB from '../services/db';
import { Button, Input, Card, Modal, FileDisplay, MultiFileUploader, SearchableSelect, Select } from '../components/ui';
import { Trash2, Edit, Shield, CheckCheck, Clock, Eye, Users, Search, Info, X } from 'lucide-react';

interface MessagingProps {
  state: AppState;
  onUpdate: (s: AppState) => void;
  currentUser: User;
  type: 'messages' | 'announcements';
}

interface ReadReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Message;
  state: AppState;
  isAnnounce: boolean;
  lang: 'ru' | 'en';
  t: (k: string) => string;
}

const ReadReceiptModal: React.FC<ReadReceiptModalProps> = ({
  isOpen,
  onClose,
  item,
  state,
  isAnnounce,
  lang,
  t,
}) => {
  const [filter, setFilter] = useState<'all' | 'read' | 'after_edit' | 'before_edit' | 'unread'>('all');
  const [search, setSearch] = useState('');
  const [showModalEditInfo, setShowModalEditInfo] = useState(false);

  if (!isOpen) return null;

  const isEdited = !!(item.editedAt || item.editedById);
  const realAuthor = item.realAuthorId ? state.users.find((u) => u.id === item.realAuthorId) : null;
  const editorUser = item.editedById
    ? state.users.find((u) => u.id === item.editedById)
    : (realAuthor || state.users.find((u) => u.id === item.fromId));
  const editedByDisplay = editorUser
    ? (editorUser.role === 'employee' || (item.editedById && item.editedById !== item.fromId)
        ? `${t('executed_by')} ${H.formatShortName(editorUser.fio)}`
        : H.formatShortName(editorUser.fio))
    : '';
  const beforeSet = new Set(item.readBeforeEditBy || []);
  const afterSet = new Set(item.readAfterEditBy || []);

  // For regular messages:
  if (!isAnnounce) {
    const recipients = (item.toIds || []).map((id) => {
      const user = state.users.find((u) => u.id === id);
      const readBefore = beforeSet.has(id);
      const readAfter = afterSet.has(id);
      const isRead = !!(
        item.readBy?.includes(id) ||
        readBefore ||
        readAfter ||
        (item.read && (!item.readBy || item.readBy.length === 0))
      );
      return {
        id,
        user,
        fio: user?.fio || 'Unknown',
        role: user?.role || '',
        classGrade: (user as any)?.classGrade || user?.class,
        classLetter: (user as any)?.classLetter || user?.letter,
        subject: (user as any)?.subject,
        isRead,
        readBefore,
        readAfter,
      };
    });

    const readCount = recipients.filter((r) => r.isRead).length;
    const readBeforeCount = recipients.filter((r) => r.readBefore).length;
    const readAfterCount = recipients.filter((r) => r.readAfter).length;
    const totalCount = recipients.length;
    const percent = totalCount > 0 ? Math.round((readCount / totalCount) * 100) : 0;

    const filteredRecipients = recipients.filter((r) => {
      if (filter === 'read' && !r.isRead) return false;
      if (filter === 'after_edit' && !r.readAfter) return false;
      if (filter === 'before_edit' && !r.readBefore) return false;
      if (filter === 'unread' && r.isRead) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return r.fio.toLowerCase().includes(q) || (r.user?.login && r.user.login.toLowerCase().includes(q));
      }
      return true;
    });

    return (
      <Modal isOpen={isOpen} onClose={onClose} title={t('read_receipt_title')} maxWidth="max-w-xl">
        <div className="space-y-3 sm:space-y-5">
          {/* Header Info */}
          <div className="p-2.5 sm:p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="text-[11px] sm:text-xs font-semibold text-slate-400">{t('theme')}:</div>
              {(isEdited || realAuthor) && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowModalEditInfo((v) => !v)}
                    onBlur={() => setTimeout(() => setShowModalEditInfo(false), 200)}
                    className="w-5 h-5 sm:w-6 sm:h-6 inline-flex items-center justify-center rounded-md sm:rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200/80 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 dark:text-amber-400 dark:border-amber-800/60 transition shadow-xs cursor-pointer"
                  >
                    <Edit size={11} className="sm:w-3 sm:h-3" />
                  </button>
                  {showModalEditInfo && (
                    <div className="absolute right-0 top-7 z-30 whitespace-nowrap bg-slate-900 text-white dark:bg-slate-800 text-[10px] sm:text-[11px] font-medium px-2.5 py-1.5 rounded-lg shadow-lg border border-slate-700 flex flex-col gap-0.5">
                      {realAuthor && (
                        <div className="text-amber-200 font-semibold">
                          {lang === 'ru' ? 'Отправил:' : 'Sent by:'} {t('executed_by')} {H.formatShortName(realAuthor.fio)}
                        </div>
                      )}
                      {item.editedAt && (
                        <div>{lang === 'ru' ? 'Исправлено:' : 'Edited:'} {H.formatDateTimeInSchoolTz(item.editedAt, state, item.schoolId, lang as 'ru' | 'en')}</div>
                      )}
                      {isEdited && editedByDisplay && (
                        <div className="text-amber-300 font-semibold">
                          {lang === 'ru' ? 'Отредактировал:' : 'Edited by:'} {editedByDisplay}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="font-bold text-slate-800 dark:text-white text-xs sm:text-base mb-2 sm:mb-3 break-words [overflow-wrap:anywhere]">{item.title || (item as any).subject || (lang === 'ru' ? 'Без темы' : 'No subject')}</div>

            {/* Progress Bar */}
            <div className="space-y-1 sm:space-y-1.5">
              <div className="flex justify-between text-[11px] sm:text-xs font-semibold">
                <span className="text-slate-600 dark:text-slate-300">
                  {t('read_by')}: <span className="font-bold text-blue-600 dark:text-blue-400">{readCount}</span> {t('of_total')} {totalCount} ({percent}%)
                </span>
                <span className={readCount === totalCount ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                  {readCount === totalCount ? t('all_read') : `${totalCount - readCount} ${t('unread_by').toLowerCase()}`}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${readCount === totalCount ? 'bg-emerald-500' : 'bg-blue-600'}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              {isEdited && (
                <div className="pt-2 flex flex-wrap gap-3 text-[11px] font-semibold">
                  <span className="text-amber-700 dark:text-amber-400">
                    • {lang === 'ru' ? 'Прочитали до исправления:' : 'Read before edit:'} <b>{readBeforeCount}</b>
                  </span>
                  <span className="text-emerald-700 dark:text-emerald-400">
                    • {lang === 'ru' ? 'Прочитали после исправления:' : 'Read after edit:'} <b>{readAfterCount}</b>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Filter Tabs & Search */}
          <div className="flex flex-col sm:flex-row gap-2.5 justify-between items-stretch sm:items-center">
            <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1 text-xs font-semibold overflow-x-auto hide-scrollbar">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1.5 rounded-lg transition whitespace-nowrap ${
                  filter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {t('all_filter')} ({totalCount})
              </button>
              {!isEdited ? (
                <button
                  type="button"
                  onClick={() => setFilter('read')}
                  className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 whitespace-nowrap ${
                    filter === 'read'
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <CheckCheck size={13} /> {t('read_by')} ({readCount})
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setFilter('after_edit')}
                    className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 whitespace-nowrap ${
                      filter === 'after_edit'
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <CheckCheck size={13} /> {lang === 'ru' ? 'После испр.' : 'After edit'} ({readAfterCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter('before_edit')}
                    className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 whitespace-nowrap ${
                      filter === 'before_edit'
                        ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm font-bold'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Clock size={12} /> {lang === 'ru' ? 'До испр.' : 'Before edit'} ({readBeforeCount})
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setFilter('unread')}
                className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 whitespace-nowrap ${
                  filter === 'unread'
                    ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Clock size={12} /> {t('unread_by')} ({totalCount - readCount})
              </button>
            </div>

            {totalCount > 3 && (
              <div className="relative">
                <input
                  type="text"
                  maxLength={100}
                  value={search}
                  onChange={(e) => setSearch(e.target.value.slice(0, 100))}
                  placeholder={lang === 'ru' ? 'Поиск получателя...' : 'Search recipient...'}
                  className="w-full sm:w-44 text-xs py-1.5 px-3 pl-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                />
                <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
              </div>
            )}
          </div>

          {/* Recipients List */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto pr-1">
            {filteredRecipients.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400 italic">
                {lang === 'ru' ? 'Получатели не найдены' : 'No recipients found'}
              </div>
            ) : (
              filteredRecipients.map((r) => {
                const roleLabel = t(r.role) || r.role;
                const subDetails =
                  r.classGrade && r.classLetter ? `${r.classGrade}-${r.classLetter}` : r.subject || '';

                return (
                  <div key={r.id} className="py-1.5 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-3">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div
                        className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold text-white shrink-0 ${
                          r.isRead ? 'bg-blue-600' : 'bg-slate-400'
                        }`}
                      >
                        {r.fio.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {H.formatShortName(r.fio)}
                        </div>
                        <div className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 truncate flex items-center gap-1.5">
                          <span>{roleLabel}</span>
                          {subDetails && (
                            <>
                              <span>•</span>
                              <span>{subDetails}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {!isEdited ? (
                        r.isRead ? (
                          <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                            <CheckCheck size={12} className="text-emerald-600 dark:text-emerald-400" />
                            <span>{t('read_by')}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                            <Clock size={11} className="text-slate-400" />
                            <span>{t('unread_by')}</span>
                          </span>
                        )
                      ) : r.isRead ? (
                        <div className="flex flex-wrap justify-end gap-1">
                          {r.readBefore && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
                              <Clock size={11} className="text-amber-600 dark:text-amber-400" />
                              <span>{lang === 'ru' ? 'До испр.' : 'Before edit'}</span>
                            </span>
                          )}
                          {r.readAfter ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                              <CheckCheck size={12} className="text-emerald-600 dark:text-emerald-400" />
                              <span>{lang === 'ru' ? 'После испр.' : 'After edit'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                              <span>{lang === 'ru' ? 'Новую не читал' : 'Not read after edit'}</span>
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                          <Clock size={12} className="text-slate-400" />
                          <span>{t('unread_by')}</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Modal>
    );
  }

  // For Announcements:
  const allReadIds = Array.from(
    new Set([...(item.readBy || []), ...(item.readBeforeEditBy || []), ...(item.readAfterEditBy || [])])
  );
  const viewedUsers = allReadIds.map((id) => {
    const user = state.users.find((u) => u.id === id);
    const readBefore = beforeSet.has(id);
    const readAfter = afterSet.has(id);
    return {
      id,
      user,
      fio: user?.fio || 'Unknown',
      role: user?.role || '',
      classGrade: (user as any)?.classGrade || user?.class,
      classLetter: (user as any)?.classLetter || user?.letter,
      subject: (user as any)?.subject,
      readBefore,
      readAfter,
    };
  });

  const readBeforeAnnCount = viewedUsers.filter((u) => u.readBefore).length;
  const readAfterAnnCount = viewedUsers.filter((u) => u.readAfter).length;

  const filteredViewed = viewedUsers.filter((u) => {
    if (isEdited && filter === 'after_edit' && !u.readAfter) return false;
    if (isEdited && filter === 'before_edit' && !u.readBefore) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return u.fio.toLowerCase().includes(q) || (u.user?.login && u.user.login.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('read_receipt_announce_title')} maxWidth="max-w-xl">
      <div className="space-y-3 sm:space-y-5">
        <div className="p-2.5 sm:p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="text-[11px] sm:text-xs font-semibold text-slate-400">{t('theme')}:</div>
            {(isEdited || realAuthor) && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowModalEditInfo((v) => !v)}
                  onBlur={() => setTimeout(() => setShowModalEditInfo(false), 200)}
                  className="w-5 h-5 sm:w-6 sm:h-6 inline-flex items-center justify-center rounded-md sm:rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200/80 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 dark:text-amber-400 dark:border-amber-800/60 transition shadow-xs cursor-pointer"
                >
                  <Edit size={11} className="sm:w-3 sm:h-3" />
                </button>
                {showModalEditInfo && (
                  <div className="absolute right-0 top-7 z-30 whitespace-nowrap bg-slate-900 text-white dark:bg-slate-800 text-[10px] sm:text-[11px] font-medium px-2.5 py-1.5 rounded-lg shadow-lg border border-slate-700 flex flex-col gap-0.5">
                    {realAuthor && (
                      <div className="text-amber-200 font-semibold">
                        {lang === 'ru' ? 'Отправил:' : 'Sent by:'} {t('executed_by')} {H.formatShortName(realAuthor.fio)}
                      </div>
                    )}
                    {item.editedAt && (
                      <div>{lang === 'ru' ? 'Исправлено:' : 'Edited:'} {H.formatDateTimeInSchoolTz(item.editedAt, state, item.schoolId, lang as 'ru' | 'en')}</div>
                    )}
                    {isEdited && editedByDisplay && (
                      <div className="text-amber-300 font-semibold">
                        {lang === 'ru' ? 'Отредактировал:' : 'Edited by:'} {editedByDisplay}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="font-bold text-slate-800 dark:text-white text-xs sm:text-base mb-1.5 sm:mb-2 break-words [overflow-wrap:anywhere]">{item.title || (item as any).subject || (lang === 'ru' ? 'Без темы' : 'No subject')}</div>
          <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5">
              <Eye size={14} />
              <span>
                {t('viewed_by_count')}: {viewedUsers.length} {lang === 'ru' ? 'чел.' : 'people'}
              </span>
            </span>
            {isEdited && (
              <>
                <span className="text-amber-700 dark:text-amber-400">
                  • {lang === 'ru' ? 'До испр.:' : 'Before edit:'} <b>{readBeforeAnnCount}</b>
                </span>
                <span className="text-emerald-700 dark:text-emerald-400">
                  • {lang === 'ru' ? 'После испр.:' : 'After edit:'} <b>{readAfterAnnCount}</b>
                </span>
              </>
            )}
          </div>
        </div>

        {(isEdited || viewedUsers.length > 5) && (
          <div className="flex flex-col sm:flex-row gap-2.5 justify-between items-stretch sm:items-center">
            {isEdited && (
              <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1 text-xs font-semibold overflow-x-auto hide-scrollbar">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`px-2.5 py-1.5 rounded-lg transition whitespace-nowrap ${
                    filter === 'all'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {t('all_filter')} ({viewedUsers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('after_edit')}
                  className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 whitespace-nowrap ${
                    filter === 'after_edit'
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <CheckCheck size={13} /> {lang === 'ru' ? 'После испр.' : 'After edit'} ({readAfterAnnCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('before_edit')}
                  className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 whitespace-nowrap ${
                    filter === 'before_edit'
                      ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm font-bold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Clock size={12} /> {lang === 'ru' ? 'До испр.' : 'Before edit'} ({readBeforeAnnCount})
                </button>
              </div>
            )}

            {viewedUsers.length > 3 && (
              <div className="relative flex-1">
                <input
                  type="text"
                  maxLength={100}
                  value={search}
                  onChange={(e) => setSearch(e.target.value.slice(0, 100))}
                  placeholder={lang === 'ru' ? 'Поиск пользователя...' : 'Search user...'}
                  className="w-full text-xs py-1.5 px-3 pl-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                />
                <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
              </div>
            )}
          </div>
        )}

        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto pr-1">
          {filteredViewed.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400 italic">
              {viewedUsers.length === 0
                ? lang === 'ru'
                  ? 'Объявление еще никто не просмотрел'
                  : 'No one has viewed this announcement yet'
                : lang === 'ru'
                ? 'Пользователи не найдены'
                : 'No users found'}
            </div>
          ) : (
            filteredViewed.map((u) => {
              const roleLabel = t(u.role) || u.role;
              const subDetails =
                u.classGrade && u.classLetter ? `${u.classGrade}-${u.classLetter}` : u.subject || '';

              return (
                <div key={u.id} className="py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-3">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600 flex items-center justify-center text-[11px] sm:text-xs font-bold text-white shrink-0">
                      {u.fio.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {H.formatShortName(u.fio)}
                      </div>
                      <div className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 truncate flex items-center gap-1">
                        <span>{roleLabel}</span>
                        {subDetails && (
                          <>
                            <span>•</span>
                            <span>{subDetails}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {!isEdited ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 shrink-0">
                      <CheckCheck size={13} className="text-emerald-600 dark:text-emerald-400" />
                      <span>{t('read_by')}</span>
                    </span>
                  ) : (
                    <div className="flex flex-wrap justify-end gap-1 shrink-0">
                      {u.readBefore && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
                          <Clock size={11} className="text-amber-600 dark:text-amber-400" />
                          <span>{lang === 'ru' ? 'До испр.' : 'Before edit'}</span>
                        </span>
                      )}
                      {u.readAfter && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                          <CheckCheck size={12} className="text-emerald-600 dark:text-emerald-400" />
                          <span>{lang === 'ru' ? 'После испр.' : 'After edit'}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};

interface MessageCardProps {
  item: Message;
  state: AppState;
  currentUser: User;
  activeTab: 'inbox' | 'sent' | 'compose';
  isAnnounce: boolean;
  isUnread: boolean;
  onVisible: (id: string) => void;
  userOptions: { value: string; label: string; group: string }[];
  expanded: boolean;
  onToggleExpand: () => void;
  onStartEdit: (m: Message) => void;
  onDelete: (id: string) => void;
  onReply: (m: Message, senderId: string) => void;
  lang: 'ru' | 'en';
  t: (k: string) => string;
}

const MessageCard: React.FC<MessageCardProps> = ({
  item,
  state,
  currentUser,
  activeTab,
  isAnnounce,
  isUnread,
  onVisible,
  userOptions,
  expanded,
  onToggleExpand,
  onStartEdit,
  onDelete,
  onReply,
  lang,
  t,
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [showReceiptsModal, setShowReceiptsModal] = useState(false);
  const [showEditedPopover, setShowEditedPopover] = useState(false);

  const needsPostEditRead =
    activeTab === 'inbox' &&
    !!item.editedAt &&
    !(item.readAfterEditBy || []).includes(currentUser.id);
  const needsReadBySync =
    activeTab === 'inbox' &&
    !(item.readBy || []).includes(currentUser.id);

  useEffect(() => {
    if ((!isUnread && !needsPostEditRead && !needsReadBySync) || activeTab !== 'inbox' || !cardRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            onVisible(item.id);
          }
        });
      },
      {
        root: null, // screen viewport
        rootMargin: '0px',
        threshold: 0.15, // triggered when 15% is visible
      }
    );

    observer.observe(cardRef.current);

    return () => {
      observer.disconnect();
    };
  }, [isUnread, needsPostEditRead, needsReadBySync, activeTab, item.id, onVisible]);

  const sender = state.users.find((u) => u.id === item.fromId);
  const realAuthor = item.realAuthorId ? state.users.find((u) => u.id === item.realAuthorId) : null;
  const editorUser = item.editedById
    ? state.users.find((u) => u.id === item.editedById)
    : (realAuthor || sender || null);
  const editedByDisplay = editorUser
    ? (editorUser.role === 'employee' || (item.editedById && item.editedById !== item.fromId)
        ? `${t('executed_by')} ${H.formatShortName(editorUser.fio)}`
        : H.formatShortName(editorUser.fio))
    : '';
  const canReply = activeTab === 'inbox' && !isAnnounce && sender && userOptions.some((opt) => opt.value === sender.id);
  const recipients = !isAnnounce
    ? item.toIds.map((id) => {
        const fio = state.users.find((u) => u.id === id)?.fio;
        return fio ? H.formatShortName(fio) : '';
      }).filter(Boolean).join(', ')
    : t('all_filter');

  // Read status calculation for sent tab or author view
  const isSenderOrAuthor =
    item.fromId === currentUser.id ||
    item.realAuthorId === currentUser.id ||
    item.editedById === currentUser.id ||
    (currentUser.role === 'employee' && currentUser.employeePermissions?.canSendAsDirector && sender?.role === 'director' && sender?.schoolId === currentUser.schoolId);
  const showReadReceipts = activeTab === 'sent' || (isAnnounce && isSenderOrAuthor);

  let singleRecipientRead = false;
  let readCount = 0;
  const totalCount = !isAnnounce ? (item.toIds || []).length : 0;
  const isSingleRecipient = !isAnnounce && totalCount === 1;
  const isMultiRecipient = !isAnnounce && totalCount > 1;

  if (isSingleRecipient) {
    const recId = item.toIds[0];
    singleRecipientRead = !!(item.readBy?.includes(recId) || (item.read && (!item.readBy || item.readBy.length === 0)));
  } else if (isMultiRecipient) {
    readCount = (item.toIds || []).filter((id) => item.readBy?.includes(id)).length;
  }

  const viewedCount = isAnnounce
    ? new Set([...(item.readBy || []), ...(item.readBeforeEditBy || []), ...(item.readAfterEditBy || [])]).size
    : 0;

  const itemTitle = item.title || (item as any).subject || (lang === 'ru' ? 'Без темы' : 'No subject');
  const itemBody = item.body || (item as any).text || (item as any).content || '';
  const textLines = itemBody.split('\n');
  const allAttachments: { id: string; name: string }[] = [];
  if (item.attachmentId) allAttachments.push({ id: item.attachmentId, name: item.attachmentName || '' });
  if (item.attachments) allAttachments.push(...item.attachments);

  const totalItemsCount = textLines.length + allAttachments.length;
  const isLarge = totalItemsCount > 4 || itemBody.length > 350;

  const visibleTextLines = isLarge && !expanded ? textLines.slice(0, 4) : textLines;
  const remainingSlotsForAttachments =
    isLarge && !expanded ? Math.max(0, 4 - visibleTextLines.length) : allAttachments.length;
  const visibleAttachments =
    isLarge && !expanded ? allAttachments.slice(0, remainingSlotsForAttachments) : allAttachments;

  return (
    <>
      <div
        ref={cardRef}
        className={`rounded-xl sm:rounded-2xl p-3 sm:p-6 transition duration-200 border bg-white dark:bg-slate-900 shadow-sm relative overflow-hidden ${
          isUnread && activeTab === 'inbox'
            ? 'border-blue-400 dark:border-blue-600 border-l-4 sm:border-l-[6px] border-l-blue-600 dark:border-l-blue-500 bg-blue-50/30 dark:bg-blue-950/20 ring-1 ring-blue-500/20'
            : 'border-slate-200 dark:border-slate-800 border-l-4 sm:border-l-[6px] border-l-blue-500/70 dark:border-l-blue-600/70 hover:shadow-md'
        }`}
      >
        <div className="flex flex-col sm:flex-row justify-between items-start mb-2 sm:mb-3 gap-1.5 sm:gap-3 min-w-0">
          <div className="flex items-center gap-2 flex-wrap min-w-0 max-w-full flex-1">
            <h4 className="font-bold text-sm sm:text-lg text-slate-800 dark:text-white break-words [overflow-wrap:anywhere] leading-snug min-w-0 max-w-full">{itemTitle}</h4>
            {isUnread && activeTab === 'inbox' && (
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-blue-700 bg-blue-100 dark:bg-blue-900/60 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                {t('new_badge')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 self-end sm:self-auto relative">
            {(item.editedAt || item.editedById || realAuthor) && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEditedPopover((v) => !v)}
                  onBlur={() => setTimeout(() => setShowEditedPopover(false), 200)}
                  aria-label={
                    lang === 'ru'
                      ? `${item.editedAt || item.editedById ? 'Исправлено' : 'Информация об отправителе'}`
                      : `${item.editedAt || item.editedById ? 'Edited' : 'Sender info'}`
                  }
                  className="w-5 h-5 sm:w-6 sm:h-6 inline-flex items-center justify-center rounded-md sm:rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200/80 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 dark:text-amber-400 dark:border-amber-800/60 transition shadow-xs cursor-pointer"
                >
                  {item.editedAt || item.editedById ? (
                    <Edit size={11} className="sm:w-3 sm:h-3" />
                  ) : (
                    <Info size={11} className="sm:w-3 sm:h-3" />
                  )}
                </button>
                {showEditedPopover && (
                  <div className="absolute right-0 top-7 sm:top-8 z-30 whitespace-nowrap bg-slate-900 text-white dark:bg-slate-800 text-[10px] sm:text-[11px] font-medium px-2.5 py-1.5 rounded-lg shadow-lg border border-slate-700 flex flex-col gap-0.5">
                    {realAuthor && (
                      <div className="text-amber-200 font-semibold">
                        {lang === 'ru' ? 'Отправил:' : 'Sent by:'} {t('executed_by')} {H.formatShortName(realAuthor.fio)}
                      </div>
                    )}
                    {item.editedAt && (
                      <div>{lang === 'ru' ? 'Исправлено:' : 'Edited:'} {H.formatDateTimeInSchoolTz(item.editedAt, state, item.schoolId || currentUser.schoolId, lang as 'ru' | 'en')}</div>
                    )}
                    {(item.editedAt || item.editedById) && editedByDisplay && (
                      <div className="text-amber-300 font-semibold">
                        {lang === 'ru' ? 'Отредактировал:' : 'Edited by:'} {editedByDisplay}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <span className="text-[10px] sm:text-xs font-semibold text-slate-400 bg-slate-100 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded dark:bg-slate-800 dark:text-slate-500">
              {H.formatDateTimeInSchoolTz(item.date, state, item.schoolId || currentUser.schoolId, lang as 'ru' | 'en')}
            </span>
            {activeTab === 'sent' && (
              <>
                <button
                  onClick={() => onStartEdit(item)}
                  className="text-blue-500 p-1 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded transition"
                >
                  <Edit size={13} />
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  className="text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-900/40 rounded transition"
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </div>
        </div>
        <div className="text-[11px] sm:text-xs text-slate-500 mb-2.5 sm:mb-4 pb-2.5 sm:pb-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-2 sm:gap-3 dark:border-slate-800 dark:text-slate-400">
          <div className="flex gap-2.5 sm:gap-6 flex-wrap items-center">
            <span className="flex items-center gap-2">
              {t('from')}:{' '}
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {sender?.fio ? H.formatShortName(sender.fio) : (isAnnounce ? t('school_admin') : 'Unknown')}
              </span>
            </span>

            {activeTab === 'sent' && (
              <span className="flex items-center gap-1.5 flex-wrap min-w-0 max-w-full">
                <span>{t('to')}:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300 break-words [overflow-wrap:anywhere]">{recipients}</span>
              </span>
            )}
          </div>

          {/* Right side: Read status badges / Reply button */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 ml-auto">
            {showReadReceipts && (
              <>
                {/* Single Recipient Message */}
                {isSingleRecipient && (
                  <button
                    type="button"
                    onClick={() => setShowReceiptsModal(true)}
                    className="cursor-pointer"
                    title={
                      lang === 'ru'
                        ? 'Нажмите, чтобы посмотреть детали прочтения (до и после исправления)'
                        : 'Click to view read receipt details (before and after edit)'
                    }
                  >
                    {singleRecipientRead ? (
                      <span
                        className="inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl border border-emerald-200 dark:border-emerald-800/60 shadow-xs transition"
                      >
                        <CheckCheck size={12} className="text-emerald-600 dark:text-emerald-400 sm:w-3.5 sm:h-3.5" />
                        <span>{t('read_by')}</span>
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs transition"
                      >
                        <Clock size={11} className="text-slate-400 sm:w-3.5 sm:h-3.5" />
                        <span>{t('unread_by')}</span>
                      </span>
                    )}
                  </button>
                )}

                {/* Multiple Recipients Message */}
                {isMultiRecipient && (
                  <button
                    type="button"
                    onClick={() => setShowReceiptsModal(true)}
                    className={`inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-semibold px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg sm:rounded-xl border transition-all duration-150 shadow-xs cursor-pointer ${
                      readCount === totalCount
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                        : readCount > 0
                        ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                    }`}
                    title={
                      lang === 'ru'
                        ? 'Нажмите, чтобы посмотреть подробный список получателей и статус прочтения'
                        : 'Click to see detailed recipients read status'
                    }
                  >
                    {readCount === totalCount ? (
                      <CheckCheck size={12} className="text-emerald-600 dark:text-emerald-400 sm:w-3.5 sm:h-3.5" />
                    ) : readCount > 0 ? (
                      <CheckCheck size={12} className="text-blue-600 dark:text-blue-400 sm:w-3.5 sm:h-3.5" />
                    ) : (
                      <Clock size={11} className="text-slate-400 sm:w-3.5 sm:h-3.5" />
                    )}
                    <span>
                      {t('read_by')}: {readCount}/{totalCount}
                    </span>
                    <Users size={10} className="opacity-60 ml-0.5 sm:w-3 sm:h-3" />
                  </button>
                )}

                {/* Announcement Viewers */}
                {isAnnounce && (
                  <button
                    type="button"
                    onClick={() => setShowReceiptsModal(true)}
                    className="inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-semibold px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg sm:rounded-xl border bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 transition-all duration-150 shadow-xs cursor-pointer"
                    title={
                      lang === 'ru'
                        ? 'Нажмите, чтобы посмотреть, кто просмотрел объявление'
                        : 'Click to see who viewed this announcement'
                    }
                  >
                    <Eye size={12} className="text-blue-600 dark:text-blue-400 sm:w-3.5 sm:h-3.5" />
                    <span>
                      {t('viewed_by_count')}: {viewedCount}
                    </span>
                    <Users size={10} className="opacity-60 ml-0.5 sm:w-3 sm:h-3" />
                  </button>
                )}
              </>
            )}

            {canReply && sender && (
              <button
                onClick={() => onReply(item, sender.id)}
                className="text-blue-600 font-semibold hover:underline"
              >
                {t('reply')}
              </button>
            )}
          </div>
        </div>
        <p className={`whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-xs sm:text-sm text-slate-700 leading-relaxed dark:text-slate-300 max-w-full ${isLarge && !expanded ? 'line-clamp-4' : ''}`}>
          {visibleTextLines.join('\n')}
          {isLarge && !expanded && visibleTextLines.length < textLines.length && '...'}
        </p>
        {visibleAttachments.map((att) => (
          <FileDisplay key={att.id} id={att.id} name={att.name} schoolId={item.schoolId || currentUser.schoolId} lang={lang as 'ru' | 'en'} />
        ))}

        {isLarge && (
          <div className="mt-2.5 sm:mt-4">
            <button
              onClick={onToggleExpand}
              className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
            >
              {expanded
                ? lang === 'ru'
                  ? 'Свернуть'
                  : 'Collapse'
                : lang === 'ru'
                ? 'Развернуть'
                : 'Expand'}
            </button>
          </div>
        )}
      </div>

      {/* Read Receipts Detail Modal */}
      {showReceiptsModal && (
        <ReadReceiptModal
          isOpen={showReceiptsModal}
          onClose={() => setShowReceiptsModal(false)}
          item={item}
          state={state}
          isAnnounce={isAnnounce}
          lang={lang}
          t={t}
        />
      )}
    </>
  );
};

export const Messaging: React.FC<MessagingProps> = ({ state, onUpdate, currentUser, type }) => {
  const [activeTab, setActiveTab] = H.useSyncedState<'inbox' | 'sent' | 'compose'>(`eljur_msg_tab_${currentUser.id}_${type}`, 'inbox');
  const [composeTitle, setComposeTitle] = useState('');
  const [composeBody, setComposeBody] = useState('');
  
  // Recipients: Can be UserID or GroupKey (e.g., 'GROUP_TEACHERS')
  const [composeTo, setComposeTo] = useState<string[]>([]);
  
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  
  // Send As Director logic for employees
  const [sendAsDirector, setSendAsDirector] = useState(false);
  
  // Edit Mode
  const [editId, setEditId] = useState<string | null>(null);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);

  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const toggleExpand = (id: string) => setExpandedItems(prev => ({...prev, [id]: !prev[id]}));

  const lang = state.settings.language || 'ru';
  const t = (k: string) => H.t(k, lang);

  const isDirector = currentUser.role === 'director';
  const isCreator = currentUser.role === 'creator';
  const isEmployee = currentUser.role === 'employee';
  const isAnnounce = type === 'announcements';

  // Unread count for current user
  const unreadInboxCount = isAnnounce
    ? H.getUnreadAnnouncementsCount(state, currentUser)
    : H.getUnreadMessagesCount(state, currentUser);

  // Viewport-based read detection batching
  const pendingReadIds = useRef<Set<string>>(new Set());
  const readTimeoutRef = useRef<any>(null);

  const handleItemVisible = useCallback(
    (id: string) => {
      pendingReadIds.current.add(id);

      if (readTimeoutRef.current) {
        clearTimeout(readTimeoutRef.current);
      }

      readTimeoutRef.current = setTimeout(() => {
        if (pendingReadIds.current.size === 0) return;

        const idsToMark = Array.from(pendingReadIds.current);
        pendingReadIds.current.clear();

        const targetList = isAnnounce ? state.announcements : state.messages;
        let hasChanges = false;
        const updatedItems: Message[] = [];

        targetList.forEach((item) => {
          if (idsToMark.includes(item.id)) {
            let itemModified = false;
            H.recordLocalReadReceipt(item.id, currentUser.id, item.editedAt);
            if (!item.readBy) item.readBy = [];
            if (!item.readBy.includes(currentUser.id)) {
              item.readBy.push(currentUser.id);
              item.read = true;
              itemModified = true;
            }
            if (item.editedAt) {
              if (!item.readAfterEditBy) item.readAfterEditBy = [];
              if (!item.readAfterEditBy.includes(currentUser.id)) {
                item.readAfterEditBy.push(currentUser.id);
                itemModified = true;
              }
            }
            if (itemModified) {
              hasChanges = true;
              updatedItems.push(item);
            }
          }
        });

        if (hasChanges) {
          const fallbackSchoolId = (currentUser.schoolId && currentUser.schoolId !== 'global') ? currentUser.schoolId : 'school_1';
          const collectionName = isAnnounce ? 'announcements' : 'messages';
          updatedItems.forEach((item) => {
            const senderSchoolId = state.users.find(u => u.id === item.fromId)?.schoolId;
            const resolvedSid = (item.schoolId && item.schoolId !== 'global')
              ? item.schoolId
              : ((senderSchoolId && senderSchoolId !== 'global') ? senderSchoolId : fallbackSchoolId);
            DB.saveReadReceipt(resolvedSid, collectionName, item).catch((e) => {
              console.warn('Failed to persist read receipt:', e);
            });
          });
          onUpdate({ ...state });
        }
      }, 200);
    },
    [isAnnounce, state, currentUser.id, currentUser.schoolId, onUpdate]
  );

  useEffect(() => {
    return () => {
      if (readTimeoutRef.current) {
        clearTimeout(readTimeoutRef.current);
      }
    };
  }, []);

  // Find director ID for "Send As" logic
  const director = state.users.find(u => u.schoolId === currentUser.schoolId && u.role === 'director');

  const handleSend = async () => {
    if (sending) return;
    const trimmedTitle = H.sanitizeInputText(composeTitle).trim();
    const trimmedBody = H.sanitizeInputText(composeBody).trim();
    if (!trimmedTitle || !trimmedBody) return alert(t('fill_topic_text'));
    if (!isAnnounce && composeTo.length === 0) return alert(t('select_recipient_alert'));

    setSending(true);
    try {
      // RESOLVE RECIPIENTS (GROUPS -> INDIVIDUALS)
      let finalToIds: string[] = [];
      if (!isAnnounce) {
        composeTo.forEach(val => {
          if (val === 'GROUP_ALL_DIRECTORS') {
            finalToIds.push(...state.users.filter(u => u.role === 'director').map(u => u.id));
          } else if (val.startsWith('GROUP_SCHOOL_')) {
            const sId = val.replace('GROUP_SCHOOL_', '');
            finalToIds.push(...state.users.filter(u => u.schoolId === sId && (u.role as string) !== 'creator').map(u => u.id));
          } else if (val === 'GROUP_TEACHERS') {
            // Only teachers (including employees with isTeacher) in SAME school
            finalToIds.push(...state.users.filter(u => H.isUserTeacherCapable(u) && u.schoolId === currentUser.schoolId).map(u => u.id));
          } else if (val === 'GROUP_HEADMASTERS') {
            // All class teachers in this school
            const schoolClasses = H.getSchoolClasses(state, currentUser.schoolId);
            const headmasterIds = schoolClasses.map(c => c.headmasterId).filter(Boolean) as string[];
            finalToIds.push(...headmasterIds);
          } else if (val.startsWith('GROUP_CLASS_')) {
            const classKey = val.replace('GROUP_CLASS_', ''); // 10_A
            finalToIds.push(...state.users.filter(u => u.role === 'student' && u.schoolId === currentUser.schoolId && `${u.class}_${u.letter}` === classKey).map(u => u.id));
          } else {
            finalToIds.push(val); // Single User ID
          }
        });
        // Unique IDs
        finalToIds = Array.from(new Set(finalToIds));
      }

      const recipientSchoolIds = isCreator
        ? Array.from(new Set(finalToIds.map(uid => state.users.find(u => u.id === uid)?.schoolId).filter((s): s is string => !!s && s !== 'global')))
        : [];
      const targetSchoolIds = recipientSchoolIds.length > 0
        ? recipientSchoolIds
        : [(currentUser.schoolId && currentUser.schoolId !== 'global') ? currentUser.schoolId : (state.schools[0]?.id || 'school_1')];
      const targetSchoolId = targetSchoolIds[0];

      const newAttachments: Attachment[] = [];
      for (const f of files) {
        const id = H.uid('att');
        for (const sId of targetSchoolIds) {
          await DB.saveAsset(id, f.name, f.type, f, sId);
        }
        newAttachments.push({ id, name: f.name, type: f.type });
      }

      // Determine Sender ID
      let fromId = currentUser.id;
      let realAuthorId: string | undefined = undefined;

      // Logic: Employee always has option to send as Director if they have access to this tab
      if (sendAsDirector && isEmployee && director && currentUser.employeePermissions?.canSendAsDirector) {
        fromId = director.id;
        realAuthorId = currentUser.id;
      }

      const collectionName = isAnnounce ? 'announcements' : 'messages';

      const accurateIsoNow = await H.getAccurateNowIsoAsync(state.settings?.systemTimeOffset || 0);

      if (editId) {
        // Edit existing
        const list = isAnnounce ? state.announcements : state.messages;
        const idx = list.findIndex(m => m.id === editId);
        if (idx > -1) {
          const existing = list[idx];
          const mergedAtts = [...existingAttachments, ...newAttachments];

          const prevReadBefore = Array.from(
            new Set([...(existing.readBeforeEditBy || []), ...(existing.readBy || [])])
          );

          const updated: Message = {
            ...existing,
            schoolId: (existing.schoolId && existing.schoolId !== 'global') ? existing.schoolId : targetSchoolId,
            title: trimmedTitle,
            body: trimmedBody,
            attachments: mergedAtts,
            editedAt: accurateIsoNow,
            editedById: currentUser.id,
            readBeforeEditBy: prevReadBefore,
            readAfterEditBy: [],
          };
          delete updated.attachmentId;
          delete updated.attachmentName;
          if (!isAnnounce) updated.toIds = finalToIds;

          list[idx] = updated;
          for (const sId of targetSchoolIds) {
            await DB.saveSchoolEntity(sId, collectionName, updated.id, { ...updated, schoolId: sId });
          }
        }
        setEditId(null);
      } else {
        // Create New
        const newItem: Message = {
          id: H.uid(isAnnounce ? 'ann' : 'msg'),
          schoolId: targetSchoolId,
          fromId: fromId,
          ...(realAuthorId ? { realAuthorId } : {}),
          toIds: isAnnounce ? [] : finalToIds, // Announcements are public/broadcast
          title: trimmedTitle,
          body: trimmedBody,
          attachments: newAttachments,
          date: accurateIsoNow
        };

        if (isAnnounce) {
          state.announcements.push(newItem);
        } else {
          state.messages.push(newItem);
        }
        for (const sId of targetSchoolIds) {
          await DB.saveSchoolEntity(sId, collectionName, newItem.id, { ...newItem, schoolId: sId });
        }
      }

      onUpdate({ ...state });
      setComposeTitle('');
      setComposeBody('');
      setFiles([]);
      setExistingAttachments([]);
      setComposeTo([]);
      setSendAsDirector(false);
      setActiveTab('sent');
    } catch (err) {
      console.error('Error sending message:', err);
      alert(lang === 'ru' ? 'Не удалось отправить сообщение. Попробуйте еще раз.' : 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const startEdit = (m: Message) => {
     setComposeTitle(m.title);
     setComposeBody(m.body);
     setComposeTo(m.toIds); // This puts IDs back. Groups are lost visually but functionality remains valid.
     setSendAsDirector(!!(isEmployee && director && m.fromId === director.id));
     setFiles([]);
     const initialAtts: Attachment[] = [...(m.attachments || [])];
     if (m.attachmentId && !initialAtts.some(a => a.id === m.attachmentId)) {
       initialAtts.push({ id: m.attachmentId, name: m.attachmentName || 'File', type: '' });
     }
     setExistingAttachments(initialAtts);
     setEditId(m.id);
     setActiveTab('compose');
  };

  const cancelEdit = () => {
    setEditId(null);
    setComposeTitle('');
    setComposeBody('');
    setFiles([]);
    setExistingAttachments([]);
    setComposeTo([]);
    setSendAsDirector(false);
    setActiveTab('sent');
  };

  const handleReply = (m: Message, senderId: string) => {
     setComposeTitle(`Re: ${m.title}`);
     setComposeBody(`\n\n--- ${t('original_message')} ---\n${m.body}`);
     setComposeTo([senderId]);
     setFiles([]); 
     setEditId(null);
     setActiveTab('compose');
  };

  const deleteItem = (id: string) => {
     if(!confirm(t('delete_msg_confirm'))) return;
     const list = isAnnounce ? state.announcements : state.messages;
     const existingItem = list.find(m => m.id === id);
     const targetSchoolId = (existingItem?.schoolId && existingItem.schoolId !== 'global')
       ? existingItem.schoolId
       : ((currentUser.schoolId && currentUser.schoolId !== 'global') ? currentUser.schoolId : 'school_1');
     const collectionName = isAnnounce ? 'announcements' : 'messages';
     if (isAnnounce) {
        state.announcements = state.announcements.filter(m => m.id !== id);
     } else {
        state.messages = state.messages.filter(m => m.id !== id);
     }
     if (isCreator) {
        (state.schools || []).forEach(s => {
           DB.deleteSchoolEntity(s.id, collectionName, id).catch(() => {});
        });
     } else {
        DB.deleteSchoolEntity(targetSchoolId, collectionName, id).catch(e => {
           console.warn('Failed to delete message entity:', e);
        });
     }
     onUpdate({ ...state });
  };

  const sortNewestFirst = (arr: Message[]) => {
    return [...arr].sort((a, b) => {
      const timeA = Date.parse(a.date || '') || 0;
      const timeB = Date.parse(b.date || '') || 0;
      if (timeB !== timeA) return timeB - timeA;
      return (b.id || '').localeCompare(a.id || '');
    });
  };

  const getFilteredItems = () => {
    const list = isAnnounce ? state.announcements : state.messages;
    if (activeTab === 'sent') {
      return sortNewestFirst(list.filter(m => {
          // I see messages I sent as myself
          if (m.fromId === currentUser.id) return true;
          // I see messages I sent or edited on behalf of director
          if (m.realAuthorId === currentUser.id || m.editedById === currentUser.id) return true;
          // Employee with canSendAsDirector can also see and edit messages sent by the school's director
          if (isEmployee && currentUser.employeePermissions?.canSendAsDirector && director && m.fromId === director.id) return true;
          return false;
      }));
    } else {
      // Inbox
      if (isAnnounce) {
        return sortNewestFirst(list.filter(m => {
            if (m.schoolId && m.schoolId === currentUser.schoolId) return true;
            const sender = state.users.find(u => u.id === m.fromId);
            if (!sender) return !!(m.schoolId && m.schoolId === currentUser.schoolId);
            // Use cast to avoid type errors with Role 'creator'
            if ((sender.role as string) === 'creator') return true; // Global announcement
            if (sender.schoolId === currentUser.schoolId) return true; // My school
            return false;
        }));
      } else {
        // Direct messages to me
        return sortNewestFirst(list.filter(m => (m.toIds || []).includes(currentUser.id)));
      }
    }
  };

  const items = getFilteredItems();

  // Logic for searchable select options
  const userOptions: {value:string, label:string, group:string}[] = [];
  
  // Scopes
  const employeeScopes = currentUser.employeePermissions?.messagingScope || [];
  
  // KEY CHANGE: If employee is writing AS DIRECTOR, they get full scope.
  // If writing as SELF, they use their messagingScope.
  const actingAsDirector = isDirector || (isEmployee && sendAsDirector);
  const actingAsRestrictedEmployee = isEmployee && !sendAsDirector;
  const isAdministrationEmployee = isEmployee && currentUser.employeePermissions?.isAdministration;

  const canMessageAll = isCreator ||
                        actingAsDirector || 
                        isAdministrationEmployee || // Administration can write to all
                        (actingAsRestrictedEmployee && employeeScopes.includes('ALL')) || 
                        currentUser.role === 'teacher';

  if (isCreator) {
     userOptions.push({
         value: 'GROUP_ALL_DIRECTORS',
         label: lang === 'ru' ? 'Все директора школ' : 'All School Directors',
         group: t('groups')
     });
     (state.schools || []).forEach(s => {
         userOptions.push({
             value: `GROUP_SCHOOL_${s.id}`,
             label: `${lang === 'ru' ? 'Вся школа' : 'Whole school'}: ${s.name}`,
             group: t('groups')
         });
     });
  } else if (isDirector || currentUser.role === 'teacher' || isEmployee) {
     if (isDirector || isEmployee) {
        userOptions.push({ value: 'GROUP_TEACHERS', label: t('all_teachers'), group: t('groups') });
        userOptions.push({ value: 'GROUP_HEADMASTERS', label: t('all_class_teachers'), group: t('groups') });
     }
     
     // Classes logic
     const classes = H.getSchoolClasses(state, currentUser.schoolId).filter(c => {
         if (actingAsDirector || isAdministrationEmployee) return true; // Director/Admin sees all
         if (currentUser.role === 'teacher') return currentUser.classes?.includes(`${c.class}_${c.letter}`);
         if (actingAsRestrictedEmployee) {
             if (canMessageAll) return true;
             if (currentUser.employeePermissions?.isTeacher && currentUser.classes?.includes(`${c.class}_${c.letter}`)) return true;
             return employeeScopes.includes(`${c.class}_${c.letter}`);
         }
         return false;
     });
     
     classes.forEach(c => {
         userOptions.push({ value: `GROUP_CLASS_${c.class}_${c.letter}`, label: `${t('whole_class')} ${c.class}${c.letter}`, group: t('groups') });
     });
  }

  // 2. Individuals
  state.users.forEach(u => {
     if (u.id === currentUser.id) return;
     
     // CREATOR Logic - Cast role to string to fix potential type overlap issues
     if ((u.role as string) === 'creator') {
         // Only Directors or Employees with 'canSendAsDirector' permission can write to Creator
         const canContactCreator = isDirector || (isEmployee && currentUser.employeePermissions?.canSendAsDirector);
         
         if (canContactCreator) {
             // NEW: Employee must be in "Director Mode" to see creator
             // If acting as self (restricted), do NOT show Creator.
             if (isEmployee && !sendAsDirector) return;

             userOptions.push({ value: u.id, label: t('creator'), group: t('developer') });
         }
         return; 
     }

     // DIRECTORS can message Creator
     if (isDirector && (u.role as string) === 'creator') {
         return; 
     }
     
     // NORMAL SCHOOL LOGIC (Same School Only, except Creator who can message across all schools)
     if (!isCreator && u.schoolId !== currentUser.schoolId && (u.role as string) !== 'creator') return;

     let canSee = false;
     
     if (isCreator || actingAsDirector || isAdministrationEmployee) {
         canSee = true; // Creator/Director/Admin mode sees all
     } else if (currentUser.role === 'teacher') {
         if (u.role === 'director' || H.isUserTeacherCapable(u)) canSee = true;
         // Can see employees who are Administration
         if (u.role === 'employee' && u.employeePermissions?.isAdministration) canSee = true;
         // Can see students in my classes
         if (u.role === 'student' && currentUser.classes?.includes(`${u.class}_${u.letter}`)) canSee = true;
         // If I am a homeroom teacher, I can see all students in my leading classes
         const myLeadingClasses = H.getUserLeadingClasses(state, currentUser.schoolId, currentUser.id);
         if (u.role === 'student' && myLeadingClasses.some(c => c.class === u.class && c.letter === u.letter)) canSee = true;
     } else if (currentUser.role === 'student') {
         if (u.role === 'director') canSee = true;
         // Can see my teachers (including employees who are also teachers)
         if (H.isUserTeacherCapable(u) && u.classes?.includes(`${currentUser.class}_${currentUser.letter}`)) canSee = true;
         // Can see employees who are Administration
         if (u.role === 'employee' && u.employeePermissions?.isAdministration) canSee = true;
         // Can see employees who are assigned to my class
         if (u.role === 'employee' && u.employeePermissions?.messagingScope?.includes(`${currentUser.class}_${currentUser.letter}`)) canSee = true;
         // Can see my homeroom teacher (even if teacher/employee)
         const myHomeroom = H.getClassHeadmaster(state, currentUser.schoolId, currentUser.class || '', currentUser.letter || '');
         if (myHomeroom && u.id === myHomeroom.id) canSee = true;
     } else if (actingAsRestrictedEmployee) {
         // I am an employee writing as myself (non-admin)
         if (u.role === 'director' || u.role === 'teacher') canSee = true; 
         if (u.role === 'employee') canSee = true; // Other employees
         
         if (u.role === 'student') {
             if (canMessageAll) canSee = true;
             else if (employeeScopes.includes(`${u.class}_${u.letter}`)) canSee = true;
             else if (currentUser.employeePermissions?.isTeacher && currentUser.classes?.includes(`${u.class}_${u.letter}`)) canSee = true;
             // If employee is homeroom teacher of a class, they can see students of that class
             const myLeadingClasses = H.getUserLeadingClasses(state, currentUser.schoolId, currentUser.id);
             if (myLeadingClasses.some(c => c.class === u.class && c.letter === u.letter)) canSee = true;
         }
     }

     if (canSee) {
        const uLeadingClasses = H.getUserLeadingClasses(state, isCreator ? u.schoolId : currentUser.schoolId, u.id);
        let groupName = '';
        
        if (currentUser.role === 'student') {
            const myHomeroom = H.getClassHeadmaster(state, currentUser.schoolId, currentUser.class || '', currentUser.letter || '');
            if (myHomeroom && u.id === myHomeroom.id) {
                groupName = lang === 'ru' ? 'Классный руководитель' : 'Class Teacher';
            } else if ((u.role as string) === 'creator') {
                groupName = t('developer');
            } else if (u.role === 'director') {
                groupName = t('administration');
            } else if (u.role === 'employee') {
                if (u.employeePermissions?.isAdministration) groupName = t('administration');
                else groupName = t('employees');
            } else if (u.role === 'teacher') {
                groupName = t('teachers');
            } else {
                groupName = `${t('students')} ${u.class || ''}${u.letter || ''}`;
            }
        } else {
            // Non-student (Creator, Director, Teacher, Employee)
            if (uLeadingClasses.length > 0 && u.role !== 'student') {
                const classNames = uLeadingClasses.map(c => `${c.class}${c.letter}`).join(lang === 'ru' ? ' и ' : ' & ');
                groupName = lang === 'ru' ? `Клас. рук. ${classNames}` : `Class Teacher ${classNames}`;
            } else if ((u.role as string) === 'creator') {
                groupName = t('developer');
            } else if (u.role === 'director') {
                groupName = t('administration');
            } else if (u.role === 'employee') {
                if (u.employeePermissions?.isAdministration) groupName = t('administration');
                else groupName = t('employees');
            } else if (u.role === 'teacher') {
                groupName = t('teachers');
            } else {
                groupName = `${t('students')} ${u.class || ''}${u.letter || ''}`;
            }
            if (isCreator && u.schoolId) {
                const uSchoolName = state.schools.find(s => s.id === u.schoolId)?.name;
                if (uSchoolName) {
                    groupName = `${uSchoolName} — ${groupName}`;
                }
            }
        }
        
        // Format Label: Short FIO
        let label = H.formatShortName(u.fio);
        
        // Add Suffixes
        if (H.isUserTeacherCapable(u)) {
            const assignedSubjects = Array.from(new Set(
                state.teacherAssignments
                    .filter(a => a.teacherId === u.id)
                    .map(a => a.subject)
            ));
            const parts: string[] = [];
            if (u.role === 'employee' && u.customRole) parts.push(u.customRole);
            if (assignedSubjects.length > 0) parts.push(assignedSubjects.join(', '));
            if (parts.length > 0) {
                label += ` (${parts.join(' • ')})`;
            }
        } else if (u.role === 'director') {
            label += ` (${t('director')})`;
        } else if (u.customRole) {
            label += ` (${u.customRole})`;
        }

        userOptions.push({ value: u.id, label: label, group: groupName });
     }
  });

  // Check if we should show full control buttons (Sent, Compose)
  // Employee gets full controls if they are allowed in this tab (which they are if they are here)
  const showControls = isDirector || isCreator || isEmployee || !isAnnounce;

  useEffect(() => {
    if (!showControls && activeTab !== 'inbox') {
      setActiveTab('inbox');
    }
  }, [showControls, activeTab, setActiveTab]);

  return (
    <div className="space-y-3.5 sm:space-y-6">
      <div className="bg-white p-1 sm:p-1.5 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 inline-flex flex-wrap gap-1 dark:bg-slate-900 dark:border-slate-800">
        <button 
          onClick={() => { setActiveTab('inbox'); setEditId(null); }} 
          className={`px-2.5 sm:px-5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm transition-all duration-200 flex items-center gap-1.5 sm:gap-2 ${
            activeTab==='inbox' 
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
              : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          <span>{t('inbox')}</span>
          {unreadInboxCount > 0 && (
            <span className={`inline-flex items-center justify-center min-w-[18px] sm:min-w-[20px] h-[18px] sm:h-5 ${unreadInboxCount > 9 ? 'px-1 sm:px-1.5' : 'w-[18px] sm:w-5 px-0'} text-[10px] sm:text-xs font-bold rounded-full leading-none shrink-0 transition-transform duration-200 ${
              activeTab === 'inbox' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'bg-red-500 text-white shadow-sm'
            }`}>
              {unreadInboxCount > 99 ? '99+' : unreadInboxCount}
            </span>
          )}
        </button>
        {showControls && (
        <button 
          onClick={() => { setActiveTab('sent'); setEditId(null); }} 
          className={`px-2.5 sm:px-5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm transition-all duration-200 ${activeTab==='sent' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}
        >
          {t('sent')}
        </button>
        )}
        {showControls && (
          <button 
            onClick={() => { setActiveTab('compose'); setEditId(null); setComposeTitle(''); setComposeBody(''); setFiles([]); setExistingAttachments([]); }} 
            className={`px-2.5 sm:px-5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm transition-all duration-200 ${activeTab==='compose' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}
          >
            + {t('write')}
          </button>
        )}
      </div>

      {activeTab === 'compose' ? (
        <Card className="p-3.5 sm:p-8 max-w-2xl shadow-soft">
          <div className="flex justify-between items-center mb-2.5 sm:mb-6">
            <h3 className="text-base sm:text-xl font-bold text-slate-800 dark:text-white">{editId ? t('editing') : (isAnnounce ? t('new_announcement') : t('new_message'))}</h3>
            {editId && <button onClick={cancelEdit} className="text-red-500 hover:underline text-xs sm:text-sm font-semibold">{t('cancel')}</button>}
          </div>
          <div className="space-y-2.5 sm:space-y-5">
            {/* SEND AS DIRECTOR OPTION - Available for employee in messages & announcements */}
            {isEmployee && currentUser.employeePermissions?.canSendAsDirector && !editId && (
                <div className="bg-amber-50 p-3 sm:p-4 rounded-xl border border-amber-100 dark:bg-amber-900/20 dark:border-amber-900/30">
                    <label className="block text-xs sm:text-sm font-bold text-amber-900 mb-1.5 sm:mb-2 dark:text-amber-400 flex items-center gap-1.5 sm:gap-2">
                        <Shield size={15}/> {t('send_as')}:
                    </label>
                    <Select value={sendAsDirector ? 'director' : 'self'} onChange={e => {
                        setSendAsDirector(e.target.value === 'director');
                        setComposeTo([]); // Reset recipients when switching mode
                    }}>
                        <option value="self">{H.formatShortName(currentUser.fio)} ({t('me')})</option>
                        <option value="director">{director ? `${H.formatShortName(director.fio)} (${t('director')})` : t('director')}</option>
                    </Select>
                </div>
            )}

            {!isAnnounce && (
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-600 mb-1 sm:mb-2 dark:text-slate-300">{t('to_label')}</label>
                <SearchableSelect 
                   multi={true}
                   options={userOptions} 
                   value={composeTo} 
                   onChange={setComposeTo} 
                   placeholder={t('select_recipients_placeholder')}
                   lang={lang as 'ru'|'en'}
                />
              </div>
            )}
            <div>
              <div className="flex justify-between items-center mb-1 sm:mb-2">
                <label className="block text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300">{t('theme')}</label>
                <span className="text-[10px] sm:text-xs text-slate-400 font-mono">{composeTitle.length}/150</span>
              </div>
              <Input maxLength={150} value={composeTitle} onChange={e => setComposeTitle(e.target.value.slice(0, 150))} />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1 sm:mb-2">
                <label className="block text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300">{t('text')}</label>
                <span className="text-[10px] sm:text-xs text-slate-400 font-mono">{composeBody.length}/5000</span>
              </div>
              <textarea 
                maxLength={5000}
                className="block w-full border border-slate-300 rounded-xl p-2.5 sm:p-4 h-24 sm:h-36 focus:ring-blue-500 focus:border-blue-500 text-xs sm:text-sm shadow-sm bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-slate-200 break-words [overflow-wrap:anywhere]"
                value={composeBody}
                onChange={e => setComposeBody(e.target.value.slice(0, 5000))}
              />
            </div>
            {editId && existingAttachments.length > 0 && (
              <div className="space-y-1.5">
                <label className="block text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400">
                  {lang === 'ru' ? 'Прикреплённые файлы:' : 'Attached files:'}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {existingAttachments.map(att => (
                    <div key={att.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200">
                      <span className="truncate max-w-[180px] font-medium">{att.name}</span>
                      <button
                        type="button"
                        onClick={() => setExistingAttachments(prev => prev.filter(a => a.id !== att.id))}
                        className="text-red-500 hover:text-red-700 font-bold ml-1"
                        title={t('delete')}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <MultiFileUploader files={files} onFilesChange={setFiles} lang={lang as 'ru'|'en'} />
            <div className="pt-0.5 sm:pt-3 flex gap-2.5 sm:gap-3">
              <Button variant="primary" size="sm" disabled={sending} onClick={handleSend} className="w-full md:w-auto px-6 sm:px-8 sm:h-10 sm:text-sm">
                {sending ? '...' : t('send')}
              </Button>
              {editId && <Button variant="ghost" size="sm" onClick={cancelEdit}>{t('cancel')}</Button>}
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-2.5 sm:space-y-4">
          {items.length === 0 && (
            <p className="text-slate-400 italic text-xs sm:text-sm text-center py-6 sm:py-10 bg-slate-50 rounded-xl sm:rounded-2xl border border-dashed border-slate-200 dark:bg-slate-900 dark:border-slate-800">
              {t('list_empty')}
            </p>
          )}
          {items.map((item) => {
            const isUnread =
              activeTab === 'inbox' &&
              (isAnnounce
                ? H.isAnnouncementUnreadByUser(item, currentUser, state.users)
                : H.isMessageUnreadByUser(item, currentUser, state.users));

            return (
              <MessageCard
                key={item.id}
                item={item}
                state={state}
                currentUser={currentUser}
                activeTab={activeTab}
                isAnnounce={isAnnounce}
                isUnread={isUnread}
                onVisible={handleItemVisible}
                userOptions={userOptions}
                expanded={!!expandedItems[item.id]}
                onToggleExpand={() => toggleExpand(item.id)}
                onStartEdit={startEdit}
                onDelete={deleteItem}
                onReply={handleReply}
                lang={lang as 'ru' | 'en'}
                t={t}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};