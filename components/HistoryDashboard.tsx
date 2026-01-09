
import React, { useMemo, useState } from 'react';
import { ComprehensiveAnalysis, ExamPerformance } from '../types';
import { Trash2, Calendar, TrendingUp, ChevronRight, BarChart2, List, ChevronDown, ChevronUp, Lightbulb, TrendingDown } from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell 
} from 'recharts';

interface Props {
  history: ComprehensiveAnalysis[];
  onSelect: (analysis: ComprehensiveAnalysis) => void;
  onDelete: (id: string) => void;
}

const HistoryDashboard: React.FC<Props> = ({ history, onSelect, onDelete }) => {
  const [showAllTable, setShowAllTable] = useState(false);

  // --- 1. VERİ HAZIRLIĞI VE İŞLEME ---
  const allExams = useMemo(() => {
    const uniqueExams = new Map<string, ExamPerformance>();
    
    // Geçmiş verileri tara ve sınavları ayıkla
    history.forEach(analysis => {
      if (analysis.exams_history && analysis.exams_history.length > 0) {
        analysis.exams_history.forEach(exam => {
          // Benzersizlik Anahtarı: Tarih + İsim
          const key = `${exam.tarih}-${exam.sinav_adi}`;
          if (!uniqueExams.has(key)) {
            uniqueExams.set(key, exam);
          }
        });
      }
    });

    // Tarihe göre eskiden yeniye sırala
    return Array.from(uniqueExams.values()).sort((a, b) => 
      new Date(a.tarih).getTime() - new Date(b.tarih).getTime()
    );
  }, [history]);

  if (history.length === 0) return null;

  // Grafik verilerini formatla
  const prepareChartData = (exams: ExamPerformance[]) => {
    return exams.map(exam => {
      const dataPoint: any = {
        date: new Date(exam.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
        // Grafikte taşmaması için isimleri kısaltıyoruz (Tooltip'te tam hali görünecek)
        name: exam.sinav_adi.length > 15 ? exam.sinav_adi.substring(0, 15) + '...' : exam.sinav_adi,
        fullName: exam.sinav_adi, // Tooltip için tam isim
        puan: exam.toplam_puan,
      };

      // Ders netlerini eşleştir
      exam.ders_netleri.forEach(d => {
        const dersAdi = d.ders.toLowerCase();
        if (dersAdi.includes('türkçe') || dersAdi.includes('turkce')) dataPoint.Turkce = d.net;
        else if (dersAdi.includes('mat')) dataPoint.Matematik = d.net;
        else if (dersAdi.includes('fen')) dataPoint.Fen = d.net;
        else if (dersAdi.includes('inkılap') || dersAdi.includes('tarih')) dataPoint.Inkilap = d.net;
        else if (dersAdi.includes('din')) dataPoint.Din = d.net;
        else if (dersAdi.includes('ing')) dataPoint.Ingilizce = d.net;
      });
      return dataPoint;
    });
  };

  // ✅ KRİTİK DEĞİŞİKLİK: LİMİT YOK, TÜM VERİYİ KULLAN
  const fullChartData = prepareChartData(allExams);
  const lastExamData = allExams.length > 0 ? prepareChartData([allExams[allExams.length - 1]])[0] : null;

  // --- 2. ANALİZ YORUMU OLUŞTURUCU (YENİ ÖZELLİK) ---
  const getProgressComment = () => {
    if (fullChartData.length < 2) return "Gelişim analizi için en az 2 deneme verisi gerekiyor.";
    
    const firstScore = fullChartData[0].puan;
    const lastScore = fullChartData[fullChartData.length - 1].puan;
    const diff = lastScore - firstScore;

    if (diff > 15) return `Harika gidiyorsun! 🚀 İlk denemeye göre tam **${diff.toFixed(1)} puanlık** ciddi bir artış yakaladın. Bu ivmeyi korursan hedefine ulaşman kesin.`;
    if (diff > 0) return `İlerleme var. 👍 İlk denemeden bu yana **${diff.toFixed(1)} puanlık** bir artış söz konusu. Biraz daha gaza basma zamanı!`;
    if (diff > -10) return "Puanların dengeli seyrediyor. ⚖️ Sıçrama yapmak için en çok yanlış yaptığın tek bir derse odaklanmalısın.";
    return `Dikkat! ⚠️ İlk denemeye göre **${Math.abs(diff).toFixed(1)} puanlık** bir gerileme var. Konu eksiklerini acilen gözden geçirmelisin.`;
  };

  // Son sınav detayları (Bar Chart için)
  const lastExamBarData = lastExamData ? [
    { name: 'Türkçe', net: lastExamData.Turkce || 0, fill: '#ef4444' },
    { name: 'Matematik', net: lastExamData.Matematik || 0, fill: '#3b82f6' },
    { name: 'Fen', net: lastExamData.Fen || 0, fill: '#10b981' },
    { name: 'İnkılap', net: lastExamData.Inkilap || 0, fill: '#f59e0b' },
    { name: 'Din', net: lastExamData.Din || 0, fill: '#8b5cf6' },
    { name: 'İngilizce', net: lastExamData.Ingilizce || 0, fill: '#ec4899' },
  ] : [];

  return (
    <div className="w-full max-w-6xl mx-auto mt-12 pb-20 animate-fade-in-up space-y-8">
      
      {/* BAŞLIK */}
      <div className="flex items-center gap-3">
        <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg">
          <TrendingUp className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
           <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">İlerleme Geçmişi</h2>
           <p className="text-slate-500 dark:text-slate-400">Toplam {allExams.length} deneme analizi</p>
        </div>
      </div>

      {/* --- GRAFİK 1: GENEL GELİŞİM & YORUM --- */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
         <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">📈 Genel Gelişim Grafiği (Tümü)</h3>
         </div>
         
         <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={fullChartData} margin={{ top: 5, right: 10, bottom: 60, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={true} strokeOpacity={0.1} />
                    {/* ✅ X EKSENİ: SINAV ADLARI, ÇAPRAZ YAZI, HEPSİNİ GÖSTER */}
                    <XAxis 
                      dataKey="name" 
                      angle={-45} 
                      textAnchor="end" 
                      height={70} 
                      interval={0} // Zorla göster
                      tick={{fontSize: 11, fill: '#64748b'}} 
                    />
                    <YAxis domain={['dataMin - 30', 'dataMax + 20']} hide />
                    <Tooltip 
                      labelFormatter={(label, payload) => payload[0]?.payload?.fullName || label} // Tooltipte tam isim
                      contentStyle={{borderRadius: '10px'}} 
                    />
                    <Line type="monotone" dataKey="puan" name="Puan" stroke="#4f46e5" strokeWidth={3} dot={{r:5, fill:'#4f46e5', stroke:'#fff', strokeWidth:2}} activeDot={{r:7}} />
                </LineChart>
            </ResponsiveContainer>
         </div>

         {/* ✅ ANALİZ YORUM KUTUSU */}
         <div className="mt-2 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 flex gap-4 items-start animate-fade-in">
            <div className="bg-indigo-100 dark:bg-indigo-800 p-2 rounded-lg shrink-0">
               <Lightbulb className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
            </div>
            <div>
               <h4 className="font-bold text-indigo-800 dark:text-indigo-300 text-sm mb-1">Yapay Zeka Görüşü</h4>
               <p className="text-indigo-700 dark:text-indigo-200 text-sm leading-relaxed">
                  <span dangerouslySetInnerHTML={{ __html: getProgressComment().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
               </p>
            </div>
         </div>
      </div>

      {/* --- GRAFİK 2 & 3: PUAN SÜTUNLARI & SON KARNE --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SÜTUN GRAFİĞİ (TÜMÜ) */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
             <h3 className="text-sm font-bold text-slate-500 uppercase mb-4">📊 Puan Kıyaslaması (Sütun)</h3>
             <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fullChartData} margin={{bottom: 40}}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                        <XAxis 
                          dataKey="name" 
                          angle={-45} 
                          textAnchor="end" 
                          height={60} 
                          interval={0} 
                          tick={{fontSize: 10}} 
                        />
                        <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '10px'}} />
                        <Bar dataKey="puan" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={30} />
                    </BarChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* SON KARNE */}
          {lastExamData && (
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-slate-500 uppercase">🏆 Son Sınav: {lastExamData.fullName}</h3>
                  <span className="text-xl font-black text-brand-600">{lastExamData.puan} Puan</span>
               </div>
               <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={lastExamBarData} layout="vertical" margin={{left: 10}}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} strokeOpacity={0.1} />
                          <XAxis type="number" domain={[0, 'dataMax']} hide />
                          <YAxis dataKey="name" type="category" tick={{fontSize: 12, fontWeight: 600}} width={80} />
                          <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '10px'}} />
                          <Bar dataKey="net" radius={[0, 6, 6, 0]} barSize={20}>
                             {lastExamBarData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                             ))}
                          </Bar>
                      </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
          )}
      </div>

      {/* --- GRAFİK 4 & 5: DERS BAZLI GELİŞİM --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ANA DERSLER (0-20 ÖLÇEK) */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
             <div className="flex justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-500 uppercase">Ana Dersler</h3>
                <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-500">Max 20 Net</span>
             </div>
             <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={fullChartData}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                        <XAxis dataKey="name" hide /> 
                        <YAxis domain={[0, 20]} tickCount={5} />
                        <Tooltip contentStyle={{borderRadius: '10px'}} />
                        <Legend />
                        <Line type="monotone" dataKey="Turkce" name="Tr" stroke="#ef4444" strokeWidth={2} dot={{r:3}} />
                        <Line type="monotone" dataKey="Matematik" name="Mat" stroke="#3b82f6" strokeWidth={2} dot={{r:3}} />
                        <Line type="monotone" dataKey="Fen" name="Fen" stroke="#10b981" strokeWidth={2} dot={{r:3}} />
                    </LineChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* ARA DERSLER (0-10 ÖLÇEK) */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
             <div className="flex justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-500 uppercase">Sözel Dersler</h3>
                <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-500">Max 10 Net</span>
             </div>
             <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={fullChartData}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                        <XAxis dataKey="name" hide />
                        <YAxis domain={[0, 10]} tickCount={6} />
                        <Tooltip contentStyle={{borderRadius: '10px'}} />
                        <Legend />
                        <Line type="monotone" dataKey="Inkilap" name="İnk" stroke="#f59e0b" strokeWidth={2} dot={{r:3}} />
                        <Line type="monotone" dataKey="Din" name="Din" stroke="#8b5cf6" strokeWidth={2} dot={{r:3}} />
                        <Line type="monotone" dataKey="Ingilizce" name="İng" stroke="#ec4899" strokeWidth={2} dot={{r:3}} />
                    </LineChart>
                </ResponsiveContainer>
             </div>
          </div>
      </div>

      {/* --- TABLO: LİSTE --- */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <button 
           onClick={() => setShowAllTable(!showAllTable)}
           className="w-full flex items-center justify-between p-6 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
           <div className="flex items-center gap-3">
              <List className="w-5 h-5 text-slate-400" />
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Bütün Deneme Listesi</h3>
           </div>
           {showAllTable ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {showAllTable && (
          <div className="overflow-x-auto">
             <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-semibold uppercase text-xs">
                   <tr>
                      <th className="px-6 py-4">Sınav Adı</th>
                      <th className="px-4 py-4 text-center">Tr</th>
                      <th className="px-4 py-4 text-center">Mat</th>
                      <th className="px-4 py-4 text-center">Fen</th>
                      <th className="px-4 py-4 text-center">İnk</th>
                      <th className="px-4 py-4 text-center">Din</th>
                      <th className="px-4 py-4 text-center">İng</th>
                      <th className="px-6 py-4 text-right">Puan</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                   {allExams.map((exam, idx) => {
                      const data = prepareChartData([exam])[0];
                      return (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                           <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">{data.fullName}</td>
                           <td className="px-4 py-4 text-center font-bold text-slate-500">{data.Turkce || '-'}</td>
                           <td className="px-4 py-4 text-center font-bold text-slate-500">{data.Matematik || '-'}</td>
                           <td className="px-4 py-4 text-center font-bold text-slate-500">{data.Fen || '-'}</td>
                           <td className="px-4 py-4 text-center font-bold text-slate-500">{data.Inkilap || '-'}</td>
                           <td className="px-4 py-4 text-center font-bold text-slate-500">{data.Din || '-'}</td>
                           <td className="px-4 py-4 text-center font-bold text-slate-500">{data.Ingilizce || '-'}</td>
                           <td className="px-6 py-4 text-right font-black text-brand-600">{data.puan}</td>
                        </tr>
                      );
                   })}
                </tbody>
             </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default HistoryDashboard;
