import React from 'react';
import { BarChart, Bar, ResponsiveContainer, Cell } from 'recharts';

const data = Array.from({ length: 15 }, (_, i) => ({
  day: i + 1,
  value: Math.floor(Math.random() * 100) + 20
}));

const Billing: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-stone-50 p-8 overflow-y-auto">
      <header className="flex justify-between items-center mb-8">
         <div>
            <h1 className="text-2xl font-display font-black">Google Cloud Billing</h1>
            <p className="text-sm text-stone-500">Monitor Vertex AI resource consumption.</p>
         </div>
         <div className="flex gap-3">
            <button className="px-4 py-2 bg-white border border-stone-200 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-stone-50">
               <span className="material-symbols-outlined text-lg">download</span> Invoice
            </button>
         </div>
      </header>

      <div className="grid grid-cols-3 gap-6 mb-8">
         <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
            <div className="flex justify-between mb-2">
               <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Current Spend</span>
               <span className="material-symbols-outlined text-herb">account_balance_wallet</span>
            </div>
            <div className="flex items-baseline gap-2">
               <span className="text-3xl font-black font-display">$1,248.62</span>
               <span className="text-xs font-bold text-herb bg-herb-light px-2 py-0.5 rounded">+12%</span>
            </div>
         </div>
         <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
            <div className="flex justify-between mb-2">
               <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Vertex AI Calls</span>
               <span className="material-symbols-outlined text-primary">hub</span>
            </div>
            <div className="flex items-baseline gap-2">
               <span className="text-3xl font-black font-display">842k</span>
               <span className="text-xs font-bold text-herb">Healthy</span>
            </div>
         </div>
         <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
             <div className="flex justify-between mb-2">
               <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Projected</span>
            </div>
            <span className="text-3xl font-black font-display">$1,850.00</span>
         </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm mb-8">
         <h3 className="text-sm font-bold uppercase tracking-widest mb-6">Daily Cost Trends</h3>
         <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
               <BarChart data={data}>
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                     {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill="#FDE047" fillOpacity={0.6 + (entry.value / 200)} />
                     ))}
                  </Bar>
               </BarChart>
            </ResponsiveContainer>
         </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
         <div className="col-span-2 bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-widest mb-6">Top Services</h3>
            <div className="space-y-4">
               {[
                  { name: 'Vertex AI (Generative)', cost: '$842.15', color: 'bg-herb', w: '68%' },
                  { name: 'Cloud Run', cost: '$241.20', color: 'bg-primary', w: '25%' },
                  { name: 'Cloud Storage', cost: '$102.30', color: 'bg-blue-400', w: '12%' }
               ].map(s => (
                  <div key={s.name} className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center"><span className="material-symbols-outlined text-stone-500">dns</span></div>
                     <div className="flex-1">
                        <div className="flex justify-between mb-1">
                           <span className="text-sm font-bold">{s.name}</span>
                           <span className="text-sm font-mono">{s.cost}</span>
                        </div>
                        <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
                           <div className={`h-full ${s.color}`} style={{ width: s.w }}></div>
                        </div>
                     </div>
                  </div>
               ))}
            </div>
         </div>
         <div className="bg-herb-mint p-6 rounded-xl border border-herb/20">
            <div className="flex justify-between items-start mb-4">
               <div>
                  <p className="text-xs font-bold text-herb uppercase">Monthly Cap</p>
                  <p className="text-xl font-black text-stone-900">$2,000</p>
               </div>
               <span className="material-symbols-outlined text-herb">notifications_active</span>
            </div>
            <div className="space-y-2">
               <div className="flex justify-between text-[10px] font-bold uppercase"><span>Spent: 62%</span></div>
               <div className="w-full bg-white/50 h-2 rounded-full overflow-hidden"><div className="bg-herb h-full w-[62%]"></div></div>
               <p className="text-[10px] text-herb/80 italic mt-2">Next alert at 80%</p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Billing;
