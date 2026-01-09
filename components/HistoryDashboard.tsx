
import React from 'react';
import { ComprehensiveAnalysis } from '../types';
import { Trash2, Calendar, TrendingUp, ChevronRight, BarChart2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  history: ComprehensiveAnalysis[];
  onSelect: (analysis: ComprehensiveAnalysis) => void;
  onDelete: (id: string) => void;
}

const HistoryDashboard: React.FC<Props> = ({ history, onSelect, onDelete }) => {
  if (history.length === 0) return null;

  // Prepare data for the aggregate chart (Progress over time based on analysis dates)
  // We use the 'savedAt' timestamp to order them, and take the latest exam score from each analysis
  const chartData = [...history]
    .sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0))
    .map(item => {
      const lastExam = item.exams_history && item.exams_history.length > 0 
        ? item.exams_history[item.exams_history.length - 1] 
        : null;
      
      return {
        date: new Date(item.savedAt || Date.now()).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
        score: lastExam ? lastExam.toplam_puan : 0,
        name: lastExam?.sinav_adi || 'Sınav'
      };
    })
    .filter(d => d.score > 0);

  return (
    <div className="w-full max-w-4xl mx-auto mt-12 animate-fade-in-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg">
          <TrendingUp className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">İlerleme Geçmişi</h2>
      </div>

      {/* Aggregate Trend Chart */}
      {chartData.length > 1 && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 mb-8">
           <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">Genel Puan Gelişimi</h3>
           <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.1} />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#64748b', fontSize: 12}} 
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#64748b', fontSize: 12}} 
                        domain={['dataMin - 20', 'dataMax + 20']}
                      />
                      <Tooltip 
                          contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--tooltip-bg, #fff)'}}
                          formatter={(value: any) => [`${value} Puan`, 'Puan']}
                      />
                      <Line 
                          type="monotone" 
                          dataKey="score" 
                          stroke="#4f46e5" 
                          strokeWidth={3}
                          dot={{r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff'}}
                          activeDot={{r: 6, strokeWidth: 0}}
                      />
                  </LineChart>
              </ResponsiveContainer>
           </div>
        </div>
      )}

      {/* History List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {history.map((item) => {
           const lastExam = item.exams_history && item.exams_history.length > 0 
             ? item.exams_history[item.exams_history.length - 1] 
             : null;
           
           return (
             <div 
                key={item.id} 
                className="group bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 hover:border-brand-300 dark:hover:border-brand-600 hover:shadow-md transition-all cursor-pointer relative"
                onClick={() => onSelect(item)}
             >
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <Calendar className="w-3 h-3" />
                        {new Date(item.savedAt || Date.now()).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); item.id && onDelete(item.id); }}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors z-10"
                        title="Bu analizi sil"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
                
                <div className="flex justify-between items-end">
                    <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                            {item.ogrenci_bilgi?.ad_soyad || "İsimsiz Öğrenci"}
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-1">
                            {lastExam?.sinav_adi || "Genel Analiz Raporu"}
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="flex items-center gap-1 justify-end text-brand-600 dark:text-brand-400 font-black text-2xl">
                             <BarChart2 className="w-5 h-5 opacity-50" />
                             {lastExam?.toplam_puan || 0}
                        </div>
                        <div className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase">TOPLAM PUAN</div>
                    </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        %{(item.executive_summary?.lgs_tahmini_yuzdelik || 0)} LGS Tahmini
                    </span>
                    <span className="text-brand-600 dark:text-brand-400 font-medium flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        Raporu Gör <ChevronRight className="w-4 h-4" />
                    </span>
                </div>
             </div>
           );
        })}
      </div>
    </div>
  );
};

export default HistoryDashboard;
