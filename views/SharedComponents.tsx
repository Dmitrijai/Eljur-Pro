

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, User, Message, Attachment } from '../types';
import * as H from '../utils/helpers';
import * as DB from '../services/db';
import { Button, Input, Card, Modal, FileDisplay, MultiFileUploader, SearchableSelect, Select } from '../components/ui';
import { Trash2, Edit, Shield, CheckCheck, Clock, Eye, Users, Search, Info } from 'lucide-react';

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
  const [filter, setFilter] = useState<'all' | 'read' | 'unread'>('all');
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  // For regular messages:
  if (!isAnnounce) {
    const recipients = (item.toIds || []).map((id) => {
      const user = state.users.find((u) => u.id === id);
      const isRead = !!(item.readBy?.includes(id) || (item.read && (!item.readBy || item.readBy.length === 0)));
      return {
        id,
        user,
        fio: user?.fio || 'Unknown',
        role: user?.role || '',
        classGrade: user?.classGrade,
        classLetter: user?.classLetter,
        subject: user?.subject,
        isRead,
      };
    });

    const readCount = recipients.filter((r) => r.isRead).length;
    const totalCount = recipients.length;
    const percent = totalCount > 0 ? Math.round((readCount / totalCount) * 100) : 0;

    const filteredRecipients = recipients.filter((r) => {
      if (filter === 'read' && !r.isRead) return false;
      if (filter === 'unread' && r.isRead) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return r.fio.toLowerCase().includes(q) || (r.user?.login && r.user.login.toLowerCase().includes(q));
      }
      return true;
    });

    return (
      <Modal isOpen={isOpen} onClose={onClose} title={t('read_receipt_title')} maxWidth="max-w-xl">
        <div className="space-y-5">
          {/* Header Info */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
            <div className="text-xs font-semibold text-slate-400 mb-1">{t('theme')}:</div>
            <div className="font-bold text-slate-800 dark:text-white text-base mb-3 line-clamp-1">{item.title}</div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-600 dark:text-slate-300">
                  {t('read_by')}: <span className="font-bold text-blue-600 dark:text-blue-400">{readCount}</span> из {totalCount} ({percent}%)
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
            </div>
          </div>

          {/* Filter Tabs & Search */}
          <div className="flex flex-col sm:flex-row gap-2.5 justify-between items-stretch sm:items-center">
            <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Все ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('read')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                  filter === 'read'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <CheckCheck size={13} /> {t('read_by')} ({readCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('unread')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
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
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={lang === 'ru' ? 'Поиск получателя...' : 'Search recipient...'}
                  className="w-full sm:w-48 text-xs py-1.5 px-3 pl-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
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
                  <div key={r.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                          r.isRead ? 'bg-blue-600' : 'bg-slate-400'
                        }`}
                      >
                        {r.fio.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {r.fio}
                        </div>
                        <div className="text-xs text-slate-400 dark:text-slate-500 truncate flex items-center gap-1.5">
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

                    <div className="shrink-0">
                      {r.isRead ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                          <CheckCheck size={13} className="text-emerald-600 dark:text-emerald-400" />
                          <span>{t('read_by')}</span>
                        </span>
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
  const viewedUsers = (item.readBy || []).map((id) => {
    const user = state.users.find((u) => u.id === id);
    return {
      id,
      user,
      fio: user?.fio || 'Unknown',
      role: user?.role || '',
      classGrade: user?.classGrade,
      classLetter: user?.classLetter,
      subject: user?.subject,
    };
  });

  const filteredViewed = viewedUsers.filter((u) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return u.fio.toLowerCase().includes(q) || (u.user?.login && u.user.login.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('read_receipt_announce_title')} maxWidth="max-w-xl">
      <div className="space-y-5">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
          <div className="text-xs font-semibold text-slate-400 mb-1">{t('theme')}:</div>
          <div className="font-bold text-slate-800 dark:text-white text-base mb-2 line-clamp-1">{item.title}</div>
          <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1.5">
            <Eye size={14} />
            <span>
              {t('viewed_by_count')}: {viewedUsers.length} {lang === 'ru' ? 'чел.' : 'people'}
            </span>
          </div>
        </div>

        {viewedUsers.length > 5 && (
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === 'ru' ? 'Поиск пользователя...' : 'Search user...'}
              className="w-full text-xs py-2 px-3 pl-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
            />
            <Search size={12} className="absolute left-2.5 top-3 text-slate-400" />
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
                <div key={u.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {u.fio.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {u.fio}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 truncate flex items-center gap-1.5">
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

                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 shrink-0">
                    <CheckCheck size={13} className="text-emerald-600 dark:text-emerald-400" />
                    <span>{t('read_by')}</span>
                  </span>
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

  useEffect(() => {
    if (!isUnread || activeTab !== 'inbox' || !cardRef.current) return;

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
  }, [isUnread, activeTab, item.id, onVisible]);

  const sender = state.users.find((u) => u.id === item.fromId);
  const realAuthor = item.realAuthorId ? state.users.find((u) => u.id === item.realAuthorId) : null;
  const canReply = activeTab === 'inbox' && !isAnnounce && sender && userOptions.some((opt) => opt.value === sender.id);
  const recipients = !isAnnounce
    ? item.toIds.map((id) => state.users.find((u) => u.id === id)?.fio).join(', ')
    : 'Все';

  // Read status calculation for sent tab or author view
  const isSenderOrAuthor = item.fromId === currentUser.id || item.realAuthorId === currentUser.id;
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

  const viewedCount = isAnnounce ? (item.readBy || []).length : 0;

  const textLines = (item.body || '').split('\n');
  const allAttachments: { id: string; name: string }[] = [];
  if (item.attachmentId) allAttachments.push({ id: item.attachmentId, name: item.attachmentName || '' });
  if (item.attachments) allAttachments.push(...item.attachments);

  const totalItemsCount = textLines.length + allAttachments.length;
  const isLarge = totalItemsCount > 4;

  const visibleTextLines = isLarge && !expanded ? textLines.slice(0, 4) : textLines;
  const remainingSlotsForAttachments =
    isLarge && !expanded ? Math.max(0, 4 - visibleTextLines.length) : allAttachments.length;
  const visibleAttachments =
    isLarge && !expanded ? allAttachments.slice(0, remainingSlotsForAttachments) : allAttachments;

  return (
    <>
      <div
        ref={cardRef}
        className={`rounded-2xl p-6 transition duration-200 border bg-white dark:bg-slate-900 shadow-sm relative ${
          isUnread && activeTab === 'inbox'
            ? 'border-blue-400 dark:border-blue-600 border-l-[6px] border-l-blue-600 dark:border-l-blue-500 bg-blue-50/30 dark:bg-blue-950/20 ring-1 ring-blue-500/20'
            : 'border-slate-200 dark:border-slate-800 border-l-[6px] border-l-blue-500/70 dark:border-l-blue-600/70 hover:shadow-md'
        }`}
      >
        <div className="flex justify-between items-start mb-3 gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h4 className="font-bold text-lg text-slate-800 dark:text-white">{item.title}</h4>
            {isUnread && activeTab === 'inbox' && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-700 bg-blue-100 dark:bg-blue-900/60 dark:text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                {t('new_badge')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded dark:bg-slate-800 dark:text-slate-500">
              {new Date(item.date).toLocaleString()}
            </span>
            {activeTab === 'sent' && (
              <>
                <button
                  onClick={() => onStartEdit(item)}
                  className="text-blue-500 p-1 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded transition"
                >
                  <Edit size={14} />
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  className="text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-900/40 rounded transition"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>
        <div className="text-xs text-slate-500 mb-4 pb-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3 dark:border-slate-800 dark:text-slate-400">
          <div className="flex gap-4 sm:gap-6 flex-wrap items-center">
            <span className="flex items-center gap-2">
              {t('from')}:{' '}
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {sender?.fio ? H.formatShortName(sender.fio) : (isAnnounce ? t('school_admin') : 'Unknown')}
              </span>
              {realAuthor && (
                <span
                  className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200 dark:bg-amber-900/40 dark:text-amber-300"
                  title={`${t('sent_by_emp')}: ${realAuthor.fio}`}
                >
                  ({t('executed_by')} {H.formatShortName(realAuthor.fio)})
                </span>
              )}
            </span>

            {activeTab === 'sent' && (
              <span className="flex items-center gap-1.5 flex-wrap">
                <span>{t('to')}:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{recipients}</span>
              </span>
            )}
          </div>

          {/* Right side: Read status badges / Reply button */}
          <div className="flex items-center gap-2.5 shrink-0 ml-auto">
            {showReadReceipts && (
              <>
                {/* Single Recipient Message */}
                {isSingleRecipient && (
                  <div>
                    {singleRecipientRead ? (
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800/60 shadow-sm"
                        title={lang === 'ru' ? 'Получатель прочитал сообщение' : 'Recipient read this message'}
                      >
                        <CheckCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
                        <span>{t('read_by')}</span>
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
                        title={lang === 'ru' ? 'Получатель еще не прочитал сообщение' : 'Recipient has not read yet'}
                      >
                        <Clock size={13} className="text-slate-400" />
                        <span>{t('unread_by')}</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Multiple Recipients Message */}
                {isMultiRecipient && (
                  <button
                    type="button"
                    onClick={() => setShowReceiptsModal(true)}
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-xl border transition-all duration-150 shadow-sm cursor-pointer ${
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
                      <CheckCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
                    ) : readCount > 0 ? (
                      <CheckCheck size={14} className="text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Clock size={13} className="text-slate-400" />
                    )}
                    <span>
                      {t('read_by')}: {readCount}/{totalCount}
                    </span>
                    <Users size={12} className="opacity-60 ml-0.5" />
                  </button>
                )}

                {/* Announcement Viewers */}
                {isAnnounce && (
                  <button
                    type="button"
                    onClick={() => setShowReceiptsModal(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-xl border bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 transition-all duration-150 shadow-sm cursor-pointer"
                    title={
                      lang === 'ru'
                        ? 'Нажмите, чтобы посмотреть, кто просмотрел объявление'
                        : 'Click to see who viewed this announcement'
                    }
                  >
                    <Eye size={14} className="text-blue-600 dark:text-blue-400" />
                    <span>
                      {t('viewed_by_count')}: {viewedCount}
                    </span>
                    <Users size={12} className="opacity-60 ml-0.5" />
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
        <p className="whitespace-pre-wrap text-slate-700 leading-relaxed dark:text-slate-300">
          {visibleTextLines.join('\n')}
          {isLarge && !expanded && visibleTextLines.length < textLines.length && '...'}
        </p>
        {visibleAttachments.map((att) => (
          <FileDisplay key={att.id} id={att.id} name={att.name} lang={lang as 'ru' | 'en'} />
        ))}

        {isLarge && (
          <div className="mt-4">
            <button
              onClick={onToggleExpand}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
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
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent' | 'compose'>('inbox');
  const [composeTitle, setComposeTitle] = useState('');
  const [composeBody, setComposeBody] = useState('');
  
  // Recipients: Can be UserID or GroupKey (e.g., 'GROUP_TEACHERS')
  const [composeTo, setComposeTo] = useState<string[]>([]);
  
  const [files, setFiles] = useState<File[]>([]);
  
  // Send As Director logic for employees
  const [sendAsDirector, setSendAsDirector] = useState(false);
  
  // Edit Mode
  const [editId, setEditId] = useState<string | null>(null);

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

        targetList.forEach((item) => {
          if (idsToMark.includes(item.id)) {
            if (!item.readBy) item.readBy = [];
            if (!item.readBy.includes(currentUser.id)) {
              item.readBy.push(currentUser.id);
              item.read = true;
              hasChanges = true;
            }
          }
        });

        if (hasChanges) {
          onUpdate({ ...state });
        }
      }, 350);
    },
    [isAnnounce, state, currentUser.id, onUpdate]
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
    if (!composeTitle || !composeBody) return alert(t('fill_topic_text'));
    if (!isAnnounce && composeTo.length === 0) return alert(t('select_recipient_alert'));

    const newAttachments: Attachment[] = [];
    for (const f of files) {
       const id = H.uid('att');
       await DB.saveAsset(id, f.name, f.type, f);
       newAttachments.push({ id, name: f.name, type: f.type });
    }

    // RESOLVE RECIPIENTS (GROUPS -> INDIVIDUALS)
    let finalToIds: string[] = [];
    if (!isAnnounce) {
       composeTo.forEach(val => {
           if (val === 'GROUP_TEACHERS') {
              // Only teachers in SAME school
              finalToIds.push(...state.users.filter(u => u.role === 'teacher' && u.schoolId === currentUser.schoolId).map(u => u.id));
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

    // Determine Sender ID
    let fromId = currentUser.id;
    let realAuthorId: string | undefined = undefined;

    // Logic: Employee always has option to send as Director if they have access to this tab
    if (sendAsDirector && isEmployee && director && currentUser.employeePermissions?.canSendAsDirector) {
        fromId = director.id;
        realAuthorId = currentUser.id;
    }

    if (editId) {
      // Edit existing
      const list = isAnnounce ? state.announcements : state.messages;
      const idx = list.findIndex(m => m.id === editId);
      if (idx > -1) {
         const existing = list[idx];
         // Append new
         const mergedAtts = [...(existing.attachments || []), ...newAttachments];
         if (existing.attachmentId) mergedAtts.push({id:existing.attachmentId, name:existing.attachmentName||'', type:''});
         
         const updated: Message = {
            ...existing,
            title: composeTitle,
            body: composeBody,
            attachments: mergedAtts,
            // clean legacy
            attachmentId: undefined
         };
         if (!isAnnounce) updated.toIds = finalToIds;

         list[idx] = updated;
      }
      setEditId(null);
    } else {
      // Create New
      const newItem: Message = {
        id: H.uid(isAnnounce ? 'ann' : 'msg'),
        schoolId: currentUser.schoolId,
        fromId: fromId,
        realAuthorId: realAuthorId,
        toIds: isAnnounce ? [] : finalToIds, // Announcements are public/broadcast
        title: composeTitle,
        body: composeBody,
        attachments: newAttachments,
        date: new Date().toISOString()
      };

      if (isAnnounce) {
        state.announcements.push(newItem);
      } else {
        state.messages.push(newItem);
      }
    }

    onUpdate(state);
    setComposeTitle('');
    setComposeBody('');
    setFiles([]);
    setComposeTo([]);
    setSendAsDirector(false);
    setActiveTab('sent');
  };

  const startEdit = (m: Message) => {
     setComposeTitle(m.title);
     setComposeBody(m.body);
     setComposeTo(m.toIds); // This puts IDs back. Groups are lost visually but functionality remains valid.
     setFiles([]); 
     setEditId(m.id);
     setActiveTab('compose');
  };

  const cancelEdit = () => {
    setEditId(null);
    setComposeTitle('');
    setComposeBody('');
    setFiles([]);
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
     if (isAnnounce) {
        state.announcements = state.announcements.filter(m => m.id !== id);
     } else {
        state.messages = state.messages.filter(m => m.id !== id);
     }
     onUpdate(state);
  };

  const getFilteredItems = () => {
    const list = isAnnounce ? state.announcements : state.messages;
    if (activeTab === 'sent') {
      return list.filter(m => {
          // I see messages I sent as myself
          if (m.fromId === currentUser.id) return true;
          // I see messages I sent on behalf of director
          if (m.realAuthorId === currentUser.id) return true;
          return false;
      }).reverse();
    } else {
      // Inbox
      if (isAnnounce) {
        return list.filter(m => {
            if (m.schoolId && m.schoolId === currentUser.schoolId) return true;
            const sender = state.users.find(u => u.id === m.fromId);
            if (!sender) return !!(m.schoolId && m.schoolId === currentUser.schoolId);
            // Use cast to avoid type errors with Role 'creator'
            if ((sender.role as string) === 'creator') return true; // Global announcement
            if (sender.schoolId === currentUser.schoolId) return true; // My school
            return false;
        }).reverse();
      } else {
        // Direct messages to me
        return list.filter(m => (m.toIds || []).includes(currentUser.id)).reverse();
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

  const canMessageAll = actingAsDirector || 
                        isAdministrationEmployee || // Administration can write to all
                        (actingAsRestrictedEmployee && employeeScopes.includes('ALL')) || 
                        currentUser.role === 'teacher';

  if (isDirector || currentUser.role === 'teacher' || isEmployee) {
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
     
     // NORMAL SCHOOL LOGIC (Same School Only)
     if (u.schoolId !== currentUser.schoolId && (u.role as string) !== 'creator') return;

     let canSee = false;
     
     if (actingAsDirector || isAdministrationEmployee) {
         canSee = true; // Director/Admin mode sees all (except Creator usually handled above)
     } else if (currentUser.role === 'teacher') {
         if (u.role === 'director' || u.role === 'teacher') canSee = true;
         // Can see employees who are Administration
         if (u.role === 'employee' && u.employeePermissions?.isAdministration) canSee = true;
         // Can see students in my classes
         if (u.role === 'student' && currentUser.classes?.includes(`${u.class}_${u.letter}`)) canSee = true;
         // If I am a homeroom teacher, I can see all students in my leading classes
         const myLeadingClasses = H.getUserLeadingClasses(state, currentUser.schoolId, currentUser.id);
         if (u.role === 'student' && myLeadingClasses.some(c => c.class === u.class && c.letter === u.letter)) canSee = true;
     } else if (currentUser.role === 'student') {
         if (u.role === 'director') canSee = true;
         // Can see my teachers
         if (u.role === 'teacher' && u.classes?.includes(`${currentUser.class}_${currentUser.letter}`)) canSee = true;
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
             // If employee is homeroom teacher of a class, they can see students of that class
             const myLeadingClasses = H.getUserLeadingClasses(state, currentUser.schoolId, currentUser.id);
             if (myLeadingClasses.some(c => c.class === u.class && c.letter === u.letter)) canSee = true;
         }
     }

     if (canSee) {
        const uLeadingClasses = H.getUserLeadingClasses(state, currentUser.schoolId, u.id);
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
            // Non-student (Director, Teacher, Employee)
            if (uLeadingClasses.length > 0 && u.role !== 'student') {
                const classNames = uLeadingClasses.map(c => `${c.class}${c.letter}`).join(' и ');
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
        }
        
        // Format Label: Short FIO
        let label = H.formatShortName(u.fio);
        
        // Add Suffixes
        if (u.role === 'teacher') {
            // Get subjects from LOAD (teacherAssignments), not just u.subjects
            const assignedSubjects = Array.from(new Set(
                state.teacherAssignments
                    .filter(a => a.teacherId === u.id)
                    .map(a => a.subject)
            ));
            
            if (assignedSubjects.length > 0) {
                label += ` (${assignedSubjects.join(', ')})`;
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

  return (
    <div className="space-y-6">
      <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 inline-flex flex-wrap gap-1 dark:bg-slate-900 dark:border-slate-800">
        <button 
          onClick={() => { setActiveTab('inbox'); setEditId(null); }} 
          className={`px-5 py-2 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center gap-2 ${
            activeTab==='inbox' 
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
              : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          <span>{t('inbox')}</span>
          {unreadInboxCount > 0 && (
            <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full leading-none transition-transform duration-200 ${
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
          className={`px-5 py-2 rounded-xl font-semibold text-sm transition-all duration-200 ${activeTab==='sent' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}
        >
          {t('sent')}
        </button>
        )}
        {showControls && (
          <button 
            onClick={() => { setActiveTab('compose'); setEditId(null); setComposeTitle(''); setComposeBody(''); setFiles([]); }} 
            className={`px-5 py-2 rounded-xl font-semibold text-sm transition-all duration-200 ${activeTab==='compose' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}
          >
            + {t('write')}
          </button>
        )}
      </div>

      {activeTab === 'compose' ? (
        <Card className="p-8 max-w-2xl shadow-soft">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">{editId ? t('editing') : (isAnnounce ? t('new_announcement') : t('new_message'))}</h3>
            {editId && <button onClick={cancelEdit} className="text-red-500 hover:underline text-sm font-semibold">{t('cancel')}</button>}
          </div>
          <div className="space-y-5">
            {/* SEND AS DIRECTOR OPTION - Always available for employee in this tab */}
            {!isAnnounce && isEmployee && currentUser.employeePermissions?.canSendAsDirector && !editId && (
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 dark:bg-amber-900/20 dark:border-amber-900/30">
                    <label className="block text-sm font-bold text-amber-900 mb-2 dark:text-amber-400 flex items-center gap-2">
                        <Shield size={16}/> {t('send_as')}:
                    </label>
                    <Select value={sendAsDirector ? 'director' : 'self'} onChange={e => {
                        setSendAsDirector(e.target.value === 'director');
                        setComposeTo([]); // Reset recipients when switching mode
                    }}>
                        <option value="self">{currentUser.fio} ({t('me')})</option>
                        <option value="director">{director ? `${director.fio} (${t('director')})` : t('director')}</option>
                    </Select>
                </div>
            )}

            {!isAnnounce && (
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2 dark:text-slate-300">{t('to_label')}</label>
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
              <label className="block text-sm font-bold text-slate-600 mb-2 dark:text-slate-300">{t('theme')}</label>
              <Input value={composeTitle} onChange={e => setComposeTitle(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2 dark:text-slate-300">{t('text')}</label>
              <textarea 
                className="w-full border border-slate-300 rounded-xl p-4 h-36 focus:ring-blue-500 focus:border-blue-500 text-sm shadow-sm bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-slate-200"
                value={composeBody}
                onChange={e => setComposeBody(e.target.value)}
              />
            </div>
            <MultiFileUploader files={files} onFilesChange={setFiles} lang={lang as 'ru'|'en'} />
            <div className="pt-4 flex gap-3">
              <Button variant="primary" onClick={handleSend} className="w-full md:w-auto px-8">{t('send')}</Button>
              {editId && <Button variant="ghost" onClick={cancelEdit}>{t('cancel')}</Button>}
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.length === 0 && (
            <p className="text-slate-400 italic text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 dark:bg-slate-900 dark:border-slate-800">
              {t('list_empty')}
            </p>
          )}
          {items.map((item) => {
            const isUnread =
              activeTab === 'inbox' &&
              (isAnnounce
                ? H.isAnnouncementUnreadByUser(item, currentUser, state.users)
                : H.isMessageUnreadByUser(item, currentUser.id));

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