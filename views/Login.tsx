
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User } from '../types';
import { Button, Input, Select, Card, Modal } from '../components/ui';
import * as H from '../utils/helpers';
import { verifyUserPasswordDetailed, hashPassword } from '../utils/auth';
import { saveSchoolEntity, syncUserAuthUidMap, ensureFirebaseAuthSession, getPublicCreatorGate, PublicCreatorGateConfig, fetchUsersForLoginLookup, setCurrentSessionUser } from '../services/db';
import { defaultState } from '../App';
import { ShieldCheck, Eye, EyeOff } from 'lucide-react';

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
    systemTimeOffset?: number;
  };
  onShowInfo?: () => void;
}

export default function Login({ users, onLogin, schoolName, settings, onShowInfo }: LoginProps) {
  const [role, setRole] = useState<'student' | 'teacher' | 'director' | 'employee'>('student');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Secret Creator Login Modal State (triggered strictly by secret keypress combo)
  const [showCreatorModal, setShowCreatorModal] = useState(false);
  const [creatorPassword, setCreatorPassword] = useState('');
  const [showCreatorPassword, setShowCreatorPassword] = useState(false);
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
  const longPressTimerRef = useRef<any>(null);
  const longPressTriggeredRef = useRef(false);
  const longPressStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const startLogoLongPress = (clientX?: number, clientY?: number) => {
    longPressTriggeredRef.current = false;
    if (typeof clientX === 'number' && typeof clientY === 'number') {
      longPressStartPosRef.current = { x: clientX, y: clientY };
    } else {
      longPressStartPosRef.current = null;
    }
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      longPressTimerRef.current = null;
      setShowCreatorModal(true);
      setCreatorPassword('');
      setCreatorError('');
      setError('');
    }, 3000);
  };

  const handleLogoMove = (clientX: number, clientY: number) => {
    if (!longPressTimerRef.current || !longPressStartPosRef.current) return;
    const dist = Math.hypot(clientX - longPressStartPosRef.current.x, clientY - longPressStartPosRef.current.y);
    if (dist > 25) {
      cancelLogoLongPress();
    }
  };

  const cancelLogoLongPress = () => {
    longPressStartPosRef.current = null;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  const lang = H.getUserPreferences(null, null).language || settings?.language || 'ru';
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

      const matchCandidateByPassword = async (list: User[]) => {
        let found: User | null = null;
        let upgraded: User | null = null;
        for (const u of list) {
          const verif = await verifyUserPasswordDetailed(u, password);
          if (verif.valid) {
            if (verif.needsRehash && verif.newHash && verif.newSalt) {
              const upg: User = {
                ...u,
                password: password,
                passwordHash: verif.newHash,
                passwordSalt: verif.newSalt,
              };
              found = upg;
              upgraded = upg;
            } else {
              found = u;
            }
            break;
          }
        }
        return { found, upgraded };
      };

      let candidates = filterByLoginAndRole(pool);
      let { found: matchedUser, upgraded: upgradedUserToSave } = await matchCandidateByPassword(candidates);

      // If no local candidate matched both login+role AND password, fetch latest users across all schools from Firestore
      if (!matchedUser) {
        const remoteUsers = await fetchUsersForLoginLookup();
        if (remoteUsers.length > 0) {
          const mergedMap = new Map<string, User>();
          pool.forEach(u => mergedMap.set(`${u.schoolId || 'school_1'}_${u.id}`, u));
          remoteUsers.forEach(u => mergedMap.set(`${u.schoolId || 'school_1'}_${u.id}`, u));
          pool = Array.from(mergedMap.values());
          candidates = filterByLoginAndRole(pool);
          const remoteMatch = await matchCandidateByPassword(candidates);
          matchedUser = remoteMatch.found;
          upgradedUserToSave = remoteMatch.upgraded;
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

      if (matchedUser) {
        if (matchedUser.blockedUntil) {
          const blockDate = new Date(matchedUser.blockedUntil);
          const effectiveOffset = creatorGate?.systemTimeOffset ?? settings?.systemTimeOffset ?? 0;
          if (blockDate > H.getAccurateNow(effectiveOffset)) {
            setError(`${t('account_blocked')} ${H.formatDateTimeInSchoolTz(matchedUser.blockedUntil, undefined, matchedUser.schoolId, lang)}`);
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
      const trimmedInput = creatorPassword.trim();
      const candidates = Array.from(new Set([creatorPassword, trimmedInput]));

      for (const candidate of candidates) {
        if (!candidate) continue;

        // 1. Verify against publicConfig/creatorGate if present
        if (creatorGate?.adminPasswordHash && creatorGate?.adminPasswordSalt) {
          const gateVerif = await verifyUserPasswordDetailed({
            password: (creatorGate as any)?.adminPassword || settings?.adminPassword,
            passwordHash: creatorGate.adminPasswordHash,
            passwordSalt: creatorGate.adminPasswordSalt
          }, candidate);
          if (gateVerif.valid) {
            isValid = true;
            break;
          }
        }

        // 2. Verify against settings hash or plaintext
        if (settings?.adminPasswordHash && settings?.adminPasswordSalt) {
          const settingsVerif = await verifyUserPasswordDetailed({
            password: settings?.adminPassword,
            passwordHash: settings.adminPasswordHash,
            passwordSalt: settings.adminPasswordSalt
          }, candidate);
          if (settingsVerif.valid) {
            isValid = true;
            break;
          }
        }

        if (settings?.adminPassword && candidate === settings.adminPassword) {
          isValid = true;
          break;
        }

        // 3. Verify against creator user in users list
        const matchedCreator = availableUsers.find(u => u.role === 'creator');
        if (matchedCreator) {
          const userVerif = await verifyUserPasswordDetailed(matchedCreator, candidate);
          if (userVerif.valid) {
            isValid = true;
            break;
          }
        }

        // 4. Fallback default creator password ('admin123') if no custom plaintext override was explicitly set
        const explicitCustomPass = settings?.adminPassword && settings.adminPassword !== 'admin123'
          ? settings.adminPassword
          : null;
        if (!explicitCustomPass && candidate === 'admin123') {
          isValid = true;
          break;
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
        } else {
          matchedCreator = {
            ...matchedCreator,
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
    // Canonical test credentials are ALWAYS for the 4 core test users of School 1 (school_1)
    const canonicalMap: Record<'director' | 'teacher' | 'employee' | 'student', { id: string; login: string; pass: string }> = {
      director: { id: 'u_dir', login: 'director', pass: 'dir123' },
      teacher: { id: 'u_teacher', login: 'teacher', pass: 'teach123' },
      employee: { id: 'u_emp', login: 'emp', pass: 'emp123' },
      student: { id: 's_1', login: 's10a_1', pass: 'pass123' },
    };

    const target = canonicalMap[role];
    if (!target) {
      setError(t('no_test_data'));
      return;
    }

    // Check if the canonical School 1 user has an updated login/password in memory, otherwise use canonical defaults
    const school1User = availableUsers.find(
      u => u.id === target.id && (!u.schoolId || u.schoolId === 'school_1')
    );

    setLogin(school1User?.login || target.login);
    setPassword(school1User?.password || target.pass);
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-3 sm:p-4 dark:bg-slate-950 font-sans relative">
      <Card className="w-full max-w-md p-5 sm:p-8 shadow-2xl border-t-[5px] sm:border-t-[6px] border-t-blue-600 dark:border-t-blue-500 relative">
        <div className="text-center mb-5 sm:mb-10">
          <div
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              if (longPressTriggeredRef.current) {
                e.preventDefault();
                e.stopPropagation();
                longPressTriggeredRef.current = false;
                return;
              }
              onShowInfo?.();
            }}
            onTouchStart={(e) => {
              const t0 = e.touches?.[0];
              startLogoLongPress(t0?.clientX, t0?.clientY);
            }}
            onTouchMove={(e) => {
              const t0 = e.touches?.[0];
              if (t0) handleLogoMove(t0.clientX, t0.clientY);
            }}
            onTouchEnd={(e) => {
              cancelLogoLongPress();
              if (longPressTriggeredRef.current) {
                e.preventDefault();
              }
            }}
            onTouchCancel={cancelLogoLongPress}
            onMouseDown={(e) => {
              if (e.button === 0) startLogoLongPress(e.clientX, e.clientY);
            }}
            onMouseMove={(e) => handleLogoMove(e.clientX, e.clientY)}
            onMouseUp={cancelLogoLongPress}
            onMouseLeave={cancelLogoLongPress}
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
            className="w-[72px] h-[72px] sm:w-24 sm:h-24 mx-auto mb-3 sm:mb-6 transform hover:scale-105 transition-transform duration-300 cursor-pointer select-none touch-none [-webkit-touch-callout:none] [-webkit-user-select:none]"
          >
            <img
              src={`${import.meta.env.BASE_URL}assets/icon.png`}
              alt="ЭлЖур"
              draggable={false}
              className="w-full h-full object-contain pointer-events-none select-none [-webkit-user-drag:none] [-webkit-touch-callout:none]"
            />
          </div>
          <h2 className="text-xl sm:text-3xl font-bold text-slate-800 dark:text-white mb-1 sm:mb-2 font-heading">{schoolName}</h2>
          <p className="text-xs sm:text-base text-slate-500 dark:text-slate-400">{t('login_title')}</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-3.5 sm:space-y-6">
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1 sm:mb-2 dark:text-slate-300">{t('role')}</label>
            <Select value={role} onChange={(e) => setRole(e.target.value as any)} className="h-9 sm:h-12 text-xs sm:text-base">
              <option value="student">{t('student')}</option>
              <option value="teacher">{t('teacher')}</option>
              <option value="director">{t('director')}</option>
              <option value="employee">{t('employee')}</option>
            </Select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1 sm:mb-2 dark:text-slate-300">{t('login')}</label>
            <Input maxLength={50} value={login} onChange={(e) => setLogin(e.target.value)} placeholder={t('enter_login')} className="h-9 sm:h-12 text-xs sm:text-base" />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1 sm:mb-2 dark:text-slate-300">{t('password')}</label>
            <div className="relative">
              <Input
                maxLength={64}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('enter_pass')}
                className="h-9 sm:h-12 text-xs sm:text-base pr-10 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
            </div>
          </div>
          
          {error && <div className="text-red-600 text-xs sm:text-sm bg-red-50 p-2.5 sm:p-3 rounded-lg border border-red-100 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">{error}</div>}
          
          <div className="pt-2 sm:pt-6 flex flex-row gap-2.5 sm:gap-4">
            <Button type="submit" variant="primary" disabled={loading} className="flex-1 h-9 sm:h-12 text-xs sm:text-base shadow-blue-500/30">
              {loading ? '...' : t('enter')}
            </Button>
            <Button type="button" variant="ghost" className="flex-1 h-9 sm:h-12 text-xs sm:text-base" onClick={fillTest}>{t('test_data')}</Button>
          </div>
        </form>
      </Card>

      {/* Secret Administrator Password Modal */}
      <Modal 
        isOpen={showCreatorModal} 
        onClose={() => { setShowCreatorModal(false); setCreatorError(''); setCreatorPassword(''); setShowCreatorPassword(false); }} 
        title={lang === 'ru' ? 'Вход администратора' : 'Administrator Access'}
      >
        <div className="p-1 sm:p-2 space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-900 dark:text-blue-200 text-xs sm:text-sm">
            <ShieldCheck size={18} className="shrink-0 text-blue-600 dark:text-blue-400" />
            <span>{lang === 'ru' ? 'Введите секретный пароль администратора для входа.' : 'Enter administrator secret password to access.'}</span>
          </div>

          <form onSubmit={handleCreatorAuth} className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 sm:mb-2">
                {lang === 'ru' ? 'Секретный пароль администратора' : 'Administrator Password'}
              </label>
              <div className="relative">
                <Input 
                  maxLength={64}
                  type={showCreatorPassword ? 'text' : 'password'} 
                  value={creatorPassword} 
                  onChange={(e) => setCreatorPassword(e.target.value)} 
                  placeholder="••••••••" 
                  className="h-9 sm:h-12 text-xs sm:text-base pr-10 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden" 
                  autoFocus
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowCreatorPassword((prev) => !prev)}
                  aria-label={showCreatorPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors focus:outline-none"
                >
                  {showCreatorPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                </button>
              </div>
            </div>

            {creatorError && (
              <div className="text-red-600 text-xs sm:text-sm bg-red-50 p-2.5 sm:p-3 rounded-lg border border-red-100 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">
                {creatorError}
              </div>
            )}

            <div className="pt-1 sm:pt-2 flex gap-2.5 sm:gap-3">
              <Button 
                type="submit" 
                variant="primary" 
                disabled={creatorLoading} 
                className="flex-1 h-9 sm:h-12 text-xs sm:text-base"
              >
                {creatorLoading ? '...' : (lang === 'ru' ? 'Войти' : 'Enter')}
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                className="h-9 sm:h-12 px-4 sm:px-5 text-xs sm:text-base" 
                onClick={() => { setShowCreatorModal(false); setCreatorError(''); setCreatorPassword(''); setShowCreatorPassword(false); }}
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
