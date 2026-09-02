import React from 'react';

const Branding: React.FC = () => {
  return (
    <div className="p-8 h-full overflow-y-auto bg-stone-50">
      <div className="max-w-6xl mx-auto">
         <div className="flex justify-between items-end mb-8">
            <div>
               <h1 className="text-4xl font-display font-black text-stone-900 tracking-tight">Branding & Theme</h1>
               <p className="text-stone-500">Manage brand identity across platforms.</p>
            </div>
            <button className="px-8 py-2.5 bg-primary text-primary-content rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all">Save & Publish</button>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 flex flex-col gap-8">
               <section className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
                  <h2 className="text-xl font-bold mb-6">Identity</h2>
                  <div className="grid grid-cols-3 gap-6">
                     <div className="aspect-square border-2 border-dashed border-stone-200 rounded-xl flex flex-col items-center justify-center gap-2 text-stone-400 hover:border-primary cursor-pointer hover:bg-stone-50 transition-colors">
                        <span className="material-symbols-outlined text-4xl">upload_file</span>
                        <span className="text-[10px] font-bold uppercase">Upload Logo</span>
                     </div>
                     <div className="aspect-square border-2 border-stone-200 rounded-xl relative bg-stone-50 flex items-center justify-center">
                        <div className="w-16 h-16 bg-primary text-primary-content rounded-lg flex items-center justify-center"><span className="material-symbols-outlined text-2xl font-bold">skillet</span></div>
                        <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-0.5 scale-75"><span className="material-symbols-outlined text-sm">check</span></div>
                     </div>
                  </div>
               </section>
               <section className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
                  <h2 className="text-xl font-bold mb-6">Look & Feel</h2>
                  <div className="grid grid-cols-2 gap-6 mb-6">
                     <div>
                        <label className="text-sm font-bold mb-2 block">Primary Color</label>
                        <div className="flex items-center gap-3">
                           <div className="w-12 h-12 rounded-lg bg-primary border border-stone-200"></div>
                           <input type="text" defaultValue="#174F35" className="flex-1 rounded-lg border-stone-200 font-mono text-sm bg-stone-50" />
                        </div>
                     </div>
                     <div>
                        <label className="text-sm font-bold mb-2 block">Secondary Color</label>
                        <div className="flex items-center gap-3">
                           <div className="w-12 h-12 rounded-lg bg-herb-mint border border-stone-200"></div>
                           <input type="text" defaultValue="#DFF36C" className="flex-1 rounded-lg border-stone-200 font-mono text-sm bg-stone-50" />
                        </div>
                     </div>
                  </div>
               </section>
            </div>

            <div className="lg:col-span-5">
               <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden sticky top-8">
                  <div className="bg-stone-100 px-6 py-4 border-b border-stone-200 flex justify-between items-center">
                     <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Live Preview</span>
                     <div className="flex gap-1"><div className="w-2 h-2 rounded-full bg-red-400"></div><div className="w-2 h-2 rounded-full bg-yellow-400"></div></div>
                  </div>
                  <div className="p-8 bg-stone-200 flex justify-center">
                     <div className="w-[240px] h-[480px] bg-white rounded-[2rem] border-[6px] border-stone-800 shadow-2xl relative overflow-hidden flex flex-col">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-stone-800 rounded-b-xl z-10"></div>
                        <div className="p-4 pt-10 flex flex-col h-full">
                           <div className="flex items-center gap-2 mb-6">
                              <div className="w-6 h-6 bg-primary text-primary-content rounded flex items-center justify-center"><span className="material-symbols-outlined text-[10px]">skillet</span></div>
                              <span className="text-[10px] font-black uppercase">Benkut</span>
                           </div>
                           <div className="w-full aspect-video bg-stone-100 rounded-lg mb-4 bg-cover bg-center" style={{backgroundImage: 'url(https://loremflickr.com/200/100/food,cooking)'}}></div>
                           <h3 className="font-bold text-lg leading-none mb-4">What are you cooking?</h3>
                           <button className="w-full py-2 bg-primary text-primary-content text-xs font-bold rounded-lg shadow-sm mt-auto">Start Recipe</button>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Branding;