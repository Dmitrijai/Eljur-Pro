
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User } from '../types';
import { Button, Input, Select, Card, Modal } from '../components/ui';
import * as H from '../utils/helpers';
import { verifyUserPasswordDetailed, hashPassword } from '../utils/auth';
import { saveSchoolEntity, syncUserAuthUidMap, ensureFirebaseAuthSession, getPublicCreatorGate, PublicCreatorGateConfig, fetchUsersForLoginLookup, setCurrentSessionUser } from '../services/db';
import { defaultState } from '../App';
import { ShieldCheck } from 'lucide-react';

interface LoginProps {
  users: User[];
  onLogin: (u: User) => void;
  schoolName: string;
  settings?: { 
    language?: 'ru' | 'en';
    secretKey?: string;
    secretCount?: number;
    adminPassword?: string;
    adminPasswordHash?: string;
    adminPasswordSalt?: string;
  };
  onShowInfo?: () => void;
}

export default function Login({ users, onLogin, schoolName, settings, onShowInfo }: LoginProps) {
  const [role, setRole] = useState<'student' | 'teacher' | 'director' | 'employee'>('student');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Secret Creator Login Modal State (triggered strictly by secret keypress combo)
  const [showCreatorModal, setShowCreatorModal] = useState(false);
  const [creatorPassword, setCreatorPassword] = useState('');
  const [creatorError, setCreatorError] = useState('');
  const [creatorLoading, setCreatorLoading] = useState(false);

  // Pre-login public gate configuration (loaded without requiring authentication)
  const [creatorGate, setCreatorGate] = useState<PublicCreatorGateConfig | null>(() => {
    try {
      const cached = localStorage.getItem('eljur_gate_school_1') || localStorage.getItem('eljur_gate_default');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let isMounted = true;
    getPublicCreatorGate('school_1').then(gate => {
      if (isMounted && gate) {
        setCreatorGate(gate);
      }
    });
    return () => { isMounted = false; };
  }, []);

  const pressCountRef = useRef(0);
  const resetTimerRef = useRef<any>(null);

  const lang = settings?.language || 'ru';
  const t = (k: string) => H.t(k, lang);

  // Guarantee that users are never an empty list and always include default test roles
  const availableUsers = useMemo(() => {
    const list = [...(users || [])];
    defaultState.users.forEach(du => {
      if (!list.some(u => u.id === du.id || (u.login === du.login && u.role === du.role))) {
        list.push(du);
      }
    });
    return list;
  }, [users]);

  // Use public gate config if available, fallback to settings or default
  const targetSecretKey = (creatorGate?.secretKey || settings?.secretKey || 'Space').trim();
  const targetSecretCount = creatorGate?.secretCount ?? settings?.secretCount ?? 4;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If modal is open, Enter submits the modal
      if (showCreatorModal) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleCreatorAuth();
        }
        return;
      }

      // Check if pressed key matches secretKey configured in settings
      const code = e.code || '';
      const key = e.key || '';
      const target = targetSecretKey.toLowerCase();

      const isSecretKey =
        code.toLowerCase() === target ||
        key.toLowerCase() === target ||
        (target === 'space' && (code === 'Space' || key === ' ' || key === 'Spacebar'));

      if (isSecretKey) {
        pressCountRef.current += 1;
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        resetTimerRef.current = setTimeout(() => {
          pressCountRef.current = 0;
        }, 1800);

        if (pressCountRef.current >= targetSecretCount) {
          pressCountRef.current = 0;
          if (target === 'space') {
            e.preventDefault();
          }
          setShowCreatorModal(true);
          setCreatorPassword('');
          setCreatorError('');
          return;
        }
      } else {
        // If another key is pressed (not a modifier), reset counter
        if (!['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(key)) {
          pressCountRef.current = 0;
        }
      }

      if (e.key === 'Enter') {
        handleAuth();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, [login, password, role, availableUsers, showCreatorModal, creatorPassword, targetSecretKey, targetSecretCount, settings, creatorGate]);

  const handleAuth = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!login && !password) return;

    setLoading(true);
    setError('');

    try {
      const normLogin = login.trim().toLowerCase();
      let pool = [...availableUsers];

      const filterByLoginAndRole = (list: User[]) =>
        list.filter(u => {
          const loginMatches = (u.login?.trim().toLowerCase() === normLogin || u.login === login);
          if (!loginMatches) return false;
          if (role === 'employee') {
            return u.role === 'employee' || (u.role === 'teacher' && !!u.customRole);
          }
          return u.role === role;
        });

      let candidates = filterByLoginAndRole(pool);

      if (candidates.length === 0) {
        // Fetch users from Firestore across schools in case user was created on another device
        const remoteUsers = await fetchUsersForLoginLookup();
        if (remoteUsers.length > 0) {
          const mergedMap = new Map<string, User>();
          pool.forEach(u => mergedMap.set(`${u.schoolId || 'school_1'}_${u.id}`, u));
          remoteUsers.forEach(u => mergedMap.set(`${u.schoolId || 'school_1'}_${u.id}`, u));
          pool = Array.from(mergedMap.values());
          candidates = filterByLoginAndRole(pool);
        }
      }

      if (candidates.length === 0) {
        // Check if user exists under a different role to provide a helpful clear error
        const existsUnderOtherRole = pool.find(u => (u.login?.trim().toLowerCase() === normLogin || u.login === login));
        if (existsUnderOtherRole) {
          setError(lang === 'ru' 
            ? 'Пользователь найден, но выбранная роль не совпадает. Выберите правильную роль!' 
            : 'User found, but selected role does not match. Please select the correct role!');
        } else {
          setError(t('invalid_login'));
        }
        setLoading(false);
        return;
      }

      let matchedUser: User | null = null;
      let upgradedUserToSave: User | null = null;
      for (const u of candidates) {
        const verif = await verifyUserPasswordDetailed(u, password);
        if (verif.valid) {
          if (verif.needsRehash && verif.newHash && verif.newSalt) {
            const upgraded: User = {
              ...u,
              passwordHash: verif.newHash,
              passwordSalt: verif.newSalt,
            };
            delete upgraded.password;
            matchedUser = upgraded;
            upgradedUserToSave = upgraded;
          } else {
            matchedUser = u;
          }
          break;
        }
      }

      if (matchedUser) {
        if (matchedUser.blockedUntil) {
          const blockDate = new Date(matchedUser.blockedUntil);
          if (blockDate > new Date()) {
            setError(`${t('account_blocked')} ${blockDate.toLocaleString()}`);
            setLoading(false);
            return;
          }
        }

        // Synchronization with Firebase Auth + /authUidMap/{uid} mapping table
        const sId = matchedUser.schoolId || 'school_1';
        const domainSchool = sId.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase() || 'school1';
        const userSafeId = matchedUser.id.replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
        const virtualEmail = `${userSafeId}@${domainSchool}.eljur.org`;
        const fbAuthPassword = password.length < 6 ? `${password}__eljur123` : password;
        let isAuthEstablished = false;
        try {
          const userCred = await ensureFirebaseAuthSession(virtualEmail, fbAuthPassword, [password], {
            schoolId: sId,
            userId: matchedUser.id,
            role: matchedUser.role
          });
          if (userCred?.user?.uid) {
            isAuthEstablished = true;
          }
        } catch (fbAuthErr: any) {
          console.warn('Firebase Auth session warning (proceeding with local session):', fbAuthErr);
        }

        setCurrentSessionUser(matchedUser);

        if (upgradedUserToSave && upgradedUserToSave.schoolId && isAuthEstablished) {
          saveSchoolEntity(upgradedUserToSave.schoolId, 'users', upgradedUserToSave.id, upgradedUserToSave).catch((e) => {
            console.warn('Could not persist rehashed password credentials to cloud:', e);
          });
        }

        setError('');
        onLogin(matchedUser);
      } else {
        setError(t('invalid_login'));
      }
    } catch (err) {
      setError(t('invalid_login'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreatorAuth = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!creatorPassword) return;

    setCreatorLoading(true);
    setCreatorError('');

    try {
      let isValid = false;

      // 1. If publicConfig/creatorGate has a password hash, verify against that salted hash
      if (creatorGate?.adminPasswordHash && creatorGate?.adminPasswordSalt) {
        const computed = await hashPassword(creatorPassword, creatorGate.adminPasswordSalt);
        isValid = (computed === creatorGate.adminPasswordHash);
      } else if (settings?.adminPasswordHash && settings?.adminPasswordSalt) {
        const computed = await hashPassword(creatorPassword, settings.adminPasswordSalt);
        isValid = (computed === settings.adminPasswordHash);
      } else if (settings?.adminPassword) {
        // Plaintext settings password (only if explicitly configured in memory)
        isValid = (creatorPassword === settings.adminPassword);
      } else {
        // 2. Check if creator user in users list has a password / hash
        const matchedCreator = availableUsers.find(u => u.role === 'creator');
        if (matchedCreator?.passwordHash && matchedCreator?.passwordSalt) {
          const verif = await verifyUserPasswordDetailed(matchedCreator, creatorPassword);
          isValid = verif.valid;
        } else if (matchedCreator?.password) {
          isValid = (creatorPassword === matchedCreator.password);
        } else {
          // Direct virtual Firebase Auth verification
          try {
            const virtualEmail = 'creator@global.eljur.org';
            const fbAuthPassword = creatorPassword.length < 6 ? `${creatorPassword}__eljur123` : creatorPassword;
            await ensureFirebaseAuthSession(virtualEmail, fbAuthPassword, [creatorPassword]);
            isValid = true;
          } catch {
            isValid = false;
          }
        }
      }

      if (isValid) {
        let matchedCreator = availableUsers.find(u => u.role === 'creator');
        if (!matchedCreator) {
          matchedCreator = {
            id: 'u_creator',
            schoolId: 'global',
            fio: 'Создатель',
            role: 'creator',
            login: 'creator',
            password: creatorPassword,
          };
        }

        const virtualEmail = 'creator@global.eljur.org';
        const fbAuthPassword = creatorPassword.length < 6 ? `${creatorPassword}__eljur123` : creatorPassword;
        try {
          const userCred = await ensureFirebaseAuthSession(virtualEmail, fbAuthPassword, [
            creatorPassword
          ]);
          if (userCred?.user?.uid) {
            await syncUserAuthUidMap('global', matchedCreator.id, 'creator', userCred.user.uid);
          }
        } catch (fbAuthErr: any) {
          console.warn('Creator Firebase Auth session warning (proceeding):', fbAuthErr);
        }

        setShowCreatorModal(false);
        onLogin(matchedCreator);
      } else {
        setCreatorError(lang === 'ru' ? 'Неверный пароль администратора' : 'Invalid administrator password');
      }
    } catch (err) {
      setCreatorError(lang === 'ru' ? 'Ошибка входа' : 'Login error');
    } finally {
      setCreatorLoading(false);
    }
  };

  const fillTest = () => {
    const u = availableUsers.find(user => {
      if (role === 'employee') return user.role === 'employee' || (user.role === 'teacher' && !!user.customRole);
      if (role === 'teacher') return user.role === 'teacher' && !user.customRole;
      if (role === 'student') return user.role === 'student';
      if (role === 'director') return user.role === 'director';
      return user.role === role;
    });

    if (u) {
      setLogin(u.login);
      setPassword(u.password || (role === 'director' ? 'dir123' : role === 'teacher' ? 'teach123' : role === 'student' ? 'pass123' : 'emp123'));
      setError('');
    } else {
      if (role === 'director') { setLogin('director'); setPassword('dir123'); setError(''); }
      else if (role === 'teacher') { setLogin('teacher'); setPassword('teach123'); setError(''); }
      else if (role === 'student') { setLogin('s10a_1'); setPassword('pass123'); setError(''); }
      else if (role === 'employee') { setLogin('emp'); setPassword('emp123'); setError(''); }
      else { setError(t('no_test_data')); }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 dark:bg-slate-950 font-sans relative">
      <Card className="w-full max-w-md p-8 shadow-2xl border-t-[6px] border-t-blue-600 dark:border-t-blue-500 relative">
        <div className="text-center mb-10">
          <div 
            onClick={onShowInfo}
            className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white text-4xl font-bold rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-glow transform hover:scale-105 transition-transform duration-300 font-heading cursor-pointer select-none"
          >
            {lang === 'ru' ? 'Э' : 'E'}
          </div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2 font-heading">{schoolName}</h2>
          <p className="text-slate-500 dark:text-slate-400">{t('login_title')}</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 dark:text-slate-300">{t('role')}</label>
            <Select value={role} onChange={(e) => setRole(e.target.value as any)} className="h-12 text-base">
              <option value="student">{t('student')}</option>
              <option value="teacher">{t('teacher')}</option>
              <option value="director">{t('director')}</option>
              <option value="employee">{t('employee')}</option>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 dark:text-slate-300">{t('login')}</label>
            <Input value={login} onChange={(e) => setLogin(e.target.value)} placeholder={t('enter_login')} className="h-12" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 dark:text-slate-300">{t('password')}</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('enter_pass')} className="h-12" />
          </div>
          
          {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">{error}</div>}
          
          <div className="pt-6 flex flex-col sm:flex-row gap-4">
            <Button type="submit" variant="primary" disabled={loading} className="flex-1 h-12 text-base shadow-blue-500/30">
              {loading ? '...' : t('enter')}
            </Button>
            <Button type="button" variant="ghost" className="flex-1 h-12" onClick={fillTest}>{t('test_data')}</Button>
          </div>
        </form>
      </Card>

      {/* Secret Administrator Password Modal */}
      <Modal 
        isOpen={showCreatorModal} 
        onClose={() => { setShowCreatorModal(false); setCreatorError(''); setCreatorPassword(''); }} 
        title={lang === 'ru' ? 'Вход администратора' : 'Administrator Access'}
      >
        <div className="p-2 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-900 dark:text-blue-200 text-sm">
            <ShieldCheck size={20} className="shrink-0 text-blue-600 dark:text-blue-400" />
            <span>{lang === 'ru' ? 'Введите секретный пароль администратора для входа.' : 'Enter administrator secret password to access.'}</span>
          </div>

          <form onSubmit={handleCreatorAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                {lang === 'ru' ? 'Секретный пароль администратора' : 'Administrator Password'}
              </label>
              <Input 
                type="password" 
                value={creatorPassword} 
                onChange={(e) => setCreatorPassword(e.target.value)} 
                placeholder="••••••••" 
                className="h-12 text-base" 
                autoFocus
              />
            </div>

            {creatorError && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">
                {creatorError}
              </div>
            )}

            <div className="pt-2 flex gap-3">
              <Button 
                type="submit" 
                variant="primary" 
                disabled={creatorLoading} 
                className="flex-1 h-12 text-base"
              >
                {creatorLoading ? '...' : (lang === 'ru' ? 'Войти' : 'Enter')}
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                className="h-12 px-5" 
                onClick={() => { setShowCreatorModal(false); setCreatorError(''); setCreatorPassword(''); }}
              >
                {lang === 'ru' ? 'Отмена' : 'Cancel'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
