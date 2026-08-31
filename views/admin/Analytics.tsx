
import React from 'react';
import { AppState } from '../../types';
import * as H from '../../utils/helpers';
import { Card } from '../../components/ui';

export const Analytics = ({ state, lang }: { state: AppState, lang: any }) => {
    const t = (k: string) => H.t(k, lang);
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6 border-l-[6px] border-l-blue-500">
                <h3 className="text-slate-500 text-sm font-bold uppercase dark:text-slate-400">{t('schools_count')}</h3>
                <p className="text-4xl font-bold mt-2 text-slate-800 dark:text-white">{state.schools.length}</p>
            </Card>
            <Card className="p-6 border-l-[6px] border-l-green-500">
                <h3 className="text-slate-500 text-sm font-bold uppercase dark:text-slate-400">{t('total_users')}</h3>
                <p className="text-4xl font-bold mt-2 text-slate-800 dark:text-white">{state.users.length}</p>
            </Card>
             <Card className="p-6 border-l-[6px] border-l-orange-500">
                <h3 className="text-slate-500 text-sm font-bold uppercase dark:text-slate-400">{t('directors_count')}</h3>
                <p className="text-4xl font-bold mt-2 text-slate-800 dark:text-white">{state.users.filter(u=>u.role==='director').length}</p>
            </Card>
            <Card className="p-6 border-l-[6px] border-l-purple-500">
                <h3 className="text-slate-500 text-sm font-bold uppercase dark:text-slate-400">{t('messages_count')}</h3>
                <p className="text-4xl font-bold mt-2 text-slate-800 dark:text-white">{state.messages.length}</p>
            </Card>
        </div>
    );
};
