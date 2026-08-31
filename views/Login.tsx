
import React, { useState, useEffect, useRef } from 'react';
import { User, Role } from '../types';
import { Button, Input, Select, Card, Modal } from '../components/ui';
import { Eye, EyeOff } from 'lucide-react';
import * as H from '../utils/helpers';

interface LoginProps {
  users: User[];
  onLogin: (u: User) => void;
  schoolName: string;
  settings?: { secretKey?: string, secretCount?: number, adminPassword?: string, language?: 'ru' | 'en' };
  onShowInfo?: () => void;
}

export default function Login({ users, onLogin, schoolName, settings, onShowInfo }: LoginProps) {
  // role state can now include 'employee' explicitly
  const [role, setRole] = useState<Role>('student');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Secret Admin Logic
  const [spaceCount, setSpaceCount] = useState(0);
  const [iconTapCount, setIconTapCount] = useState(0);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);

  const secretKey = settings?.secretKey || 'Space';
  const secretTriggerCount = settings?.secretCount || 4;
  const realAdminPass = settings?.adminPassword || 'admin';
  const lang = settings?.language || 'ru';
  const t = (k: string) => H.t(k, lang);
  
  const clickTimeoutRef = useRef<any>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Secret Key Logic
      if (e.code === secretKey) {
        setSpaceCount(prev => {
           const next = prev + 1;
           if (next >= secretTriggerCount) {
              e.preventDefault(); // Prevent scrolling or typing the trigger key
              setShowAdminModal(true);
              return 0;
           }
           return next;
        });
        // Reset count after 1s if not pressed quickly
        setTimeout(() => setSpaceCount(0), 1000);
      }

      // Global Enter Key Logic for Login
      if (e.key === 'Enter' && !showAdminModal) {
          // If a modal isn't open, try to login
          handleAuth();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [secretKey, secretTriggerCount, showAdminModal, login, password, role]); // Depend on login inputs for closure capture

  const handleIconTap = () => {
    if (window.innerWidth <= 1024) {
      setIconTapCount(prev => {
        const next = prev + 1;
        if (next >= secretTriggerCount) {
          setShowAdminModal(true);
          if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
          return 0;
        }
        return next;
      });
      setTimeout(() => setIconTapCount(0), 1000);
    }

    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    clickTimeoutRef.current = setTimeout(() => {
       if (onShowInfo && !showAdminModal) onShowInfo();
    }, 250);
  };

  const handleAuth = (e?: React.FormEvent) => {
    if (e) e.preventDefault(); // Prevent form submission refresh
    
    if (!login && !password) return; // Don't trigger on empty enter

    // Filter users by credentials and specific role logic
    const user = users.find(u => {
        if (u.login !== login || u.password !== password) return false;
        
        if (role === 'employee') {
            // Updated logic: Check explicitly for role 'employee'
            // Backward compatibility: also check teacher with customRole if role is not strictly employee yet
            return u.role === 'employee' || (u.role === 'teacher' && !!u.customRole);
        }
        
        // Strict role matching for others
        return u.role === role;
    });

    if (user) {
      if (user.blockedUntil) {
          const blockDate = new Date(user.blockedUntil);
          if (blockDate > new Date()) {
              setError(`${t('account_blocked')} ${blockDate.toLocaleString()}`);
              return;
          }
      }
      setError('');
      onLogin(user);
    } else {
      setError(t('invalid_login'));
    }
  };

  const handleCreatorAuth = () => {
    const creator = users.find(u => u.role === 'creator');
    if (creator && adminPass === realAdminPass) {
        onLogin(creator);
        setShowAdminModal(false);
        setAdminPass('');
    } else {
        alert(t('invalid_login'));
    }
  };

  const fillTest = () => {
    // Find a user matching the selected role criteria
    const u = users.find(u => {
        if (role === 'employee') return u.role === 'employee' || (u.role === 'teacher' && !!u.customRole);
        if (role === 'teacher') return u.role === 'teacher' && !u.customRole;
        if (role === 'student') return u.role === 'student';
        return u.role === role;
    });

    if (u) {
      setLogin(u.login);
      setPassword(u.password || '');
      setError('');
    } else {
      setError(t('no_test_data'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 dark:bg-slate-950 font-sans">
      <Card className="w-full max-w-md p-8 shadow-2xl border-t-[6px] border-t-blue-600 dark:border-t-blue-500">
        <div className="text-center mb-10">
           <div 
             onClick={handleIconTap}
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
             <Button type="submit" variant="primary" className="flex-1 h-12 text-base shadow-blue-500/30">{t('enter')}</Button>
             <Button type="button" variant="ghost" className="flex-1 h-12" onClick={fillTest}>{t('test_data')}</Button>
          </div>
        </form>
      </Card>

      <Modal isOpen={showAdminModal} onClose={() => {setShowAdminModal(false); setShowAdminPass(false);}} title={t('login_as_creator')}>
         <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">{t('enter_pass')}</p>
            <div className="relative">
                <form onSubmit={(e) => { e.preventDefault(); handleCreatorAuth(); }}>
                    <Input 
                      autoFocus
                      type={showAdminPass ? 'text' : 'password'} 
                      value={adminPass} 
                      onChange={e => setAdminPass(e.target.value)} 
                      placeholder={t('password')} 
                    />
                    <button 
                        type="button"
                        onMouseDown={() => setShowAdminPass(true)}
                        onMouseUp={() => setShowAdminPass(false)}
                        onMouseLeave={() => setShowAdminPass(false)}
                        onTouchStart={() => setShowAdminPass(true)}
                        onTouchEnd={() => setShowAdminPass(false)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 cursor-pointer p-0.5 bg-white dark:bg-slate-900 rounded"
                    >
                        {showAdminPass ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                    <div className="mt-4">
                        <Button type="submit" variant="primary" className="w-full">{t('enter')}</Button>
                    </div>
                </form>
            </div>
            <p className="text-[10px] text-slate-400 italic text-center">{t('hold_eye_hint')}</p>
         </div>
      </Modal>
    </div>
  );
}
