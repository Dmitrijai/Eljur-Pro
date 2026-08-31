
import React, { useState } from 'react';
import { AppState, User } from '../types';
import * as DB from '../services/db';
import * as H from '../utils/helpers';
import { Button, Input, Select, Card, FileUploader } from '../components/ui';
import { Eye, EyeOff, Trash2, Check } from 'lucide-react';

interface SettingsProps {
  state: AppState;
  onUpdate: (s: AppState) => void;
  onBack: () => void;
  user: User; 
}

export default function Settings({ state, onUpdate, onBack, user }: SettingsProps) {
  // Use current school name if director, else first school or generic
  const currentSchool = state.schools.find(s => s.id === user.schoolId);
  const [localName, setLocalName] = useState(currentSchool?.name || 'ЭлЖур');
  const [fontList, setFontList] = useState<any[]>([]);
  const [showSecretPass, setShowSecretPass] = useState(false);

  const isDirector = user.role === 'director';
  const isCreator = user.role === 'creator';

  const refreshFonts = async () => {
    const assets = await DB.getAllAssets();
    setFontList(assets.filter(a => a.name.toLowerCase().endsWith('.ttf') || a.name.toLowerCase().endsWith('.woff') || a.name.toLowerCase().endsWith('.woff2')));
  };

  React.useEffect(() => {
    refreshFonts();
  }, []);

  const handleSaveName = () => {
    if (currentSchool) {
        currentSchool.name = localName;
        onUpdate(state);
        alert('Название школы сохранено');
    } else {
        alert('Ошибка: Школа не найдена для редактирования');
    }
  };

  const handleExport = async () => {
    if (!confirm('Экспортировать все данные и файлы? Это может занять время.')) return;
    try {
      const assets = await DB.getAllAssets();
      // Convert blobs to base64 for JSON storage (simplified for this demo)
      const assetsData = await Promise.all(assets.map(async (a) => {
        return new Promise<any>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve({ id: a.id, name: a.name, type: a.type, data: reader.result });
          reader.readAsDataURL(a.blob);
        });
      }));

      const exportObj = {
        state: state,
        assets: assetsData,
        timestamp: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(exportObj)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ElZhur_Backup_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Ошибка экспорта: ' + e);
    }
  };

  const handleImport = async (file: File) => {
    if (!confirm('ВНИМАНИЕ: Все текущие данные будут заменены! Продолжить?')) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (data.state) {
        // Clear DB
        const db = await DB.openDB();
        const tx = db.transaction(['assets', 'appStore'], 'readwrite');
        await tx.objectStore('assets').clear();
        await tx.objectStore('appStore').clear();

        // Restore assets
        if (data.assets && Array.isArray(data.assets)) {
           for (const a of data.assets) {
              const res = await fetch(a.data);
              const blob = await res.blob();
              await DB.saveAsset(a.id, a.name, a.type, blob);
           }
        }
        
        // Restore state
        await DB.saveState(data.state);
        alert('Импорт успешен. Страница будет перезагружена.');
        window.location.reload();
      } else {
        alert('Неверный формат файла');
      }
    } catch (e) {
      alert('Ошибка импорта: ' + e);
    }
  };

  const handleFontUpload = async (file: File) => {
    const id = H.uid('font');
    await DB.saveAsset(id, file.name, file.type, file);
    alert('Шрифт загружен.');
    refreshFonts();
  };

  const deleteFont = async (id: string) => {
    if (!confirm('Удалить шрифт?')) return;
    // Check if in use
    if (state.settings.bodyFontId === id) state.settings.bodyFontId = undefined;
    if (state.settings.headingFontId === id) state.settings.headingFontId = undefined;
    
    // Actually delete asset logic would require extending DB service to delete, currently we just remove usage
    // For now, let's pretend we delete it, but really just unlink it in settings as DB delete needs tx
    const db = await DB.openDB();
    const tx = db.transaction('assets', 'readwrite');
    await tx.objectStore('assets').delete(id);
    
    onUpdate(state);
    refreshFonts();
  };

  const setBodyFont = (id?: string) => {
      state.settings.bodyFontId = id;
      onUpdate(state);
  };

  const setHeadingFont = (id?: string) => {
      state.settings.headingFontId = id;
      onUpdate(state);
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white font-heading">Настройки</h2>
        <Button onClick={onBack}>← Назад</Button>
      </div>

      {(isDirector || isCreator) && (
        <Card className="p-8">
          <h3 className="font-bold text-lg mb-6 text-slate-800 dark:text-white font-heading">Общие настройки</h3>
          <div className="space-y-4">
             {isDirector && (
             <div>
               <label className="block text-sm font-bold text-slate-600 mb-2 dark:text-slate-300">Название школы</label>
               <div className="flex gap-4">
                 <Input value={localName} onChange={e => setLocalName(e.target.value)} />
                 <Button variant="primary" onClick={handleSaveName}>Сохранить</Button>
               </div>
             </div>
             )}
             
             <div>
                <label className="block text-sm font-bold text-slate-600 mb-2 dark:text-slate-300">Часовой пояс</label>
                <Select 
                   value={state.settings.timezone || 'UTC+3'} 
                   onChange={(e) => { state.settings.timezone = e.target.value; onUpdate(state); }}
                >
                   <option value="UTC+2">Калининград (MSK-1)</option>
                   <option value="UTC+3">Москва (MSK)</option>
                   <option value="UTC+4">Самара (MSK+1)</option>
                   <option value="UTC+5">Екатеринбург (MSK+2)</option>
                   <option value="UTC+6">Омск (MSK+3)</option>
                   <option value="UTC+7">Красноярск (MSK+4)</option>
                   <option value="UTC+8">Иркутск (MSK+5)</option>
                   <option value="UTC+9">Якутск (MSK+6)</option>
                   <option value="UTC+10">Владивосток (MSK+7)</option>
                   <option value="UTC+11">Магадан (MSK+8)</option>
                   <option value="UTC+12">Камчатка (MSK+9)</option>
                </Select>
                <p className="text-xs text-slate-400 mt-1">Определяет эталонное время для школы.</p>
             </div>
          </div>
        </Card>
      )}

      {isCreator && (
         <Card className="p-8 border-l-[6px] border-l-purple-500">
             <h3 className="font-bold text-lg mb-6 text-slate-800 dark:text-white font-heading">Настройки Создателя</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                     <label className="block text-sm font-bold text-slate-600 mb-2 dark:text-slate-300">Клавиша входа (Код)</label>
                     <Input 
                        value={state.settings.secretKey || 'Space'} 
                        onChange={e => { state.settings.secretKey = e.target.value; onUpdate(state); }} 
                        placeholder="Space"
                     />
                     <p className="text-xs text-slate-400 mt-1">Код клавиши (например: Space, Enter, KeyA)</p>
                 </div>
                 <div>
                     <label className="block text-sm font-bold text-slate-600 mb-2 dark:text-slate-300">Количество нажатий</label>
                     <Input 
                        type="number"
                        value={state.settings.secretCount || 4} 
                        onChange={e => { state.settings.secretCount = parseInt(e.target.value); onUpdate(state); }} 
                        className="bg-white text-slate-900 border border-slate-300 dark:bg-slate-950 dark:text-white dark:border-slate-700" 
                     />
                 </div>
                 <div className="col-span-2">
                     <label className="block text-sm font-bold text-slate-600 mb-2 dark:text-slate-300">Секретный пароль администратора</label>
                     <div className="relative">
                         <Input 
                            type={showSecretPass ? 'text' : 'password'}
                            value={state.settings.adminPassword || 'admin'} 
                            onChange={e => { state.settings.adminPassword = e.target.value; onUpdate(state); }} 
                         />
                         <button 
                            type="button"
                            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                            onClick={() => setShowSecretPass(!showSecretPass)}
                         >
                            {showSecretPass ? <EyeOff size={20} /> : <Eye size={20} />}
                         </button>
                     </div>
                 </div>
             </div>
         </Card>
      )}

      <Card className="p-8">
        <h3 className="font-bold text-lg mb-6 text-slate-800 dark:text-white font-heading">Внешний вид</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div>
             <label className="block text-sm font-bold text-slate-600 mb-2 dark:text-slate-300">Тема оформления</label>
             <Select 
               value={state.settings.theme} 
               onChange={(e) => { state.settings.theme = e.target.value as any; onUpdate(state); }}
             >
               <option value="light">Светлая</option>
               <option value="dark">Тёмная</option>
             </Select>
           </div>
        </div>
      </Card>

      <Card className="p-8">
        <h3 className="font-bold text-lg mb-6 text-slate-800 dark:text-white font-heading">Управление шрифтами</h3>
        <div className="space-y-6">
           <div className="flex flex-col gap-3">
             <label className="text-sm font-bold text-slate-600 dark:text-slate-300">Загрузить новый шрифт (.ttf, .woff)</label>
             <FileUploader onFileSelect={handleFontUpload} selectedFileName="" />
             <p className="text-xs text-slate-400">После загрузки выберите, куда применить шрифт в таблице ниже.</p>
           </div>
           
           <div className="mt-6 border rounded-xl overflow-hidden border-slate-200 dark:border-slate-700">
               <table className="w-full text-sm">
                   <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700">
                       <tr>
                           <th className="p-3 text-left">Имя файла</th>
                           <th className="p-3 text-center">Осн. текст</th>
                           <th className="p-3 text-center">Заголовки</th>
                           <th className="p-3 text-right">Действия</th>
                       </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                       <tr className="bg-white dark:bg-slate-900">
                           <td className="p-3 font-medium">Стандартный (Inter)</td>
                           <td className="p-3 text-center">
                               <button 
                                 onClick={() => setBodyFont(undefined)} 
                                 className={`p-1.5 rounded transition ${!state.settings.bodyFontId ? 'bg-green-100 text-green-700 font-bold' : 'text-slate-400 hover:bg-slate-100'}`}
                               >
                                  {!state.settings.bodyFontId ? <Check size={16}/> : 'Выбрать'}
                               </button>
                           </td>
                           <td className="p-3 text-center">
                               <button 
                                 onClick={() => setHeadingFont(undefined)} 
                                 className={`p-1.5 rounded transition ${!state.settings.headingFontId ? 'bg-green-100 text-green-700 font-bold' : 'text-slate-400 hover:bg-slate-100'}`}
                               >
                                  {!state.settings.headingFontId ? <Check size={16}/> : 'Выбрать'}
                               </button>
                           </td>
                           <td className="p-3 text-right text-xs text-slate-400 italic">Системный</td>
                       </tr>
                       {fontList.map(f => (
                           <tr key={f.id} className="bg-white dark:bg-slate-900">
                               <td className="p-3">{f.name}</td>
                               <td className="p-3 text-center">
                                   <button 
                                     onClick={() => setBodyFont(f.id)} 
                                     className={`p-1.5 rounded transition ${state.settings.bodyFontId === f.id ? 'bg-green-100 text-green-700 font-bold' : 'text-slate-400 hover:bg-slate-100'}`}
                                   >
                                      {state.settings.bodyFontId === f.id ? <Check size={16}/> : 'Выбрать'}
                                   </button>
                               </td>
                               <td className="p-3 text-center">
                                   <button 
                                     onClick={() => setHeadingFont(f.id)} 
                                     className={`p-1.5 rounded transition ${state.settings.headingFontId === f.id ? 'bg-green-100 text-green-700 font-bold' : 'text-slate-400 hover:bg-slate-100'}`}
                                   >
                                      {state.settings.headingFontId === f.id ? <Check size={16}/> : 'Выбрать'}
                                   </button>
                               </td>
                               <td className="p-3 text-right">
                                   <button onClick={() => deleteFont(f.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16}/></button>
                               </td>
                           </tr>
                       ))}
                   </tbody>
               </table>
           </div>
        </div>
      </Card>

      <Card className="p-8">
        <h3 className="font-bold text-lg mb-6 text-slate-800 dark:text-white font-heading">Резервное копирование</h3>
        <div className="space-y-6">
          <div className="flex flex-col gap-3">
            <label className="text-sm font-bold text-slate-600 dark:text-slate-300">Экспорт данных</label>
            <Button onClick={handleExport} variant="secondary" className="justify-start">Скачать полную резервную копию (JSON)</Button>
            <p className="text-xs text-slate-400">Включает базу данных, пользователей, оценки и все файлы.</p>
          </div>
          <hr className="border-slate-100 dark:border-slate-800" />
          <div className="flex flex-col gap-3">
             <label className="text-sm font-bold text-slate-600 dark:text-slate-300">Импорт данных</label>
             <FileUploader onFileSelect={handleImport} />
          </div>
        </div>
      </Card>
    </div>
  );
}
