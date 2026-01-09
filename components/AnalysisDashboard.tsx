import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ComprehensiveAnalysis, TopicAnalysis, ChatMessage } from '../types';
import { chatWithCoach } from '../services/geminiService';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  BarChart, Bar, Cell, PieChart, Pie,
  ComposedChart, ReferenceLine
} from 'recharts';
import { 
  TrendingUp, Target, AlertTriangle, CheckCircle2, 
  BrainCircuit, ListTodo, BarChart2, GraduationCap, ArrowRight, User, Search,
  BookOpen, Calculator, FlaskConical, Globe, ScrollText, HeartHandshake,
  Lightbulb, ClipboardCheck, Stethoscope, Pill, Timer, BookMarked,
  ArrowUpDown, ArrowUp, ArrowDown, Calendar, History, Filter, Layers,
  LayoutGrid, Activity, Users, Star, Footprints, Clock, Rocket,
  CheckCircle, AlertCircle, HelpCircle, Trophy, ThumbsUp, Flame, Siren, Quote,
  Download, Loader2, MessageCircle, Send, Bot, Zap, X
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface Props {
  data: ComprehensiveAnalysis;
  history: ComprehensiveAnalysis[];
  onReset: () => void;
  onSelectHistory: (data: ComprehensiveAnalysis) => void;
}

// Standardized Lesson Names & Colors
const LESSON_CONFIG: Record<string, { color: string, icon: any, label: string }> = {
  'Türkçe': { color: '#ef4444', icon: BookOpen, label: 'Türkçe' },
  'Matematik': { color: '#3b82f6', icon: Calculator, label: 'Matematik' },
  'Fen Bilimleri': { color: '#10b981', icon: FlaskConical, label: 'Fen Bilimleri' },
  'T.C. İnkılap Tarihi': { color: '#f59e0b', icon: ScrollText, label: 'T.C. İnkılap Tarihi' },
  'Din Kültürü': { color: '#8b5cf6', icon: HeartHandshake, label: 'Din Kültürü' },
  'İngilizce': { color: '#ec4899', icon: Globe, label: 'İngilizce' },
};

// LGS Question Limits (Hard Rules)
const LGS_LIMITS: Record<string, number> = {
  'Türkçe': 20,
  'Matematik': 20,
  'Fen Bilimleri': 20,
  'T.C. İnkılap Tarihi': 10,
  'Din Kültürü': 10,
  'İngilizce': 10
};

// Fallback for non-standard names with improved matching for new subjects
const getLessonConfig = (lessonName: string) => {
  const lower = (lessonName || "").toLocaleLowerCase('tr-TR');
  
  // Science
  if (lower.includes('fen')) return LESSON_CONFIG['Fen Bilimleri'];
  
  // Math
  if (lower.includes('mat')) return LESSON_CONFIG['Matematik'];
  
  // Turkish
  if (lower.includes('türk') || lower.includes('turk') || lower.includes('edebiyat')) return LESSON_CONFIG['Türkçe'];
  
  // History / Revolution
  if (lower.includes('inkılap') || lower.includes('inkilap') || lower.includes('atatürk') || lower.includes('sosyal') || lower.includes('tarih')) {
      return LESSON_CONFIG['T.C. İnkılap Tarihi'];
  }
  
  // Religion
  if (lower.includes('din') || lower.includes('kültür') || lower.includes('ahlak') || lower.includes('dkab')) {
      return LESSON_CONFIG['Din Kültürü'];
  }
  
  // English / Language
  if (lower.includes('ingilizce') || lower.includes('yabancı') || lower.includes('dil') || lower.includes('english')) {
      return LESSON_CONFIG['İngilizce'];
  }

  return LESSON_CONFIG[lessonName] || { color: '#64748b', icon: BookOpen, label: lessonName || 'Ders' };
};

// Helper to get limit based on lesson name
const getLessonLimit = (lessonName: string) => {
    const config = getLessonConfig(lessonName);
    return LGS_LIMITS[config.label] || 20; // Default to 20 if unknown
};

// Helper to determine status based on percentage logic (Fail-safe for frontend)
const getStatusByPercentage = (percentage: number): 'Mükemmel' | 'İyi' | 'Geliştirilmeli' | 'Kritik' => {
    if (percentage >= 80) return 'Mükemmel';
    if (percentage >= 70) return 'İyi';
    if (percentage >= 50) return 'Geliştirilmeli';
    return 'Kritik';
};

// --- STRICT SCORE FORMATTER ---
const formatLGSScore = (value: number) => {
    if (!value || isNaN(value)) return "-";
    const val = Number(value);
    const integerPart = Math.floor(val);
    const decimalPart = val - integerPart;
    const roundedDecimal = Math.round(decimalPart * 1000) / 1000;
    return (integerPart + roundedDecimal).toFixed(3);
};

// Helper to safely render text with HTML spans (for colors) and Markdown-like bold
const SafeHtmlText = ({ content }: { content: string }) => {
    if (!content) return null;
    const parts = content.split(/(\*\*.*?\*\*)/g);
    
    return (
        <span>
            {parts.map((part, index) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    const inner = part.slice(2, -2);
                     return <strong key={index} className="font-bold text-inherit" dangerouslySetInnerHTML={{ __html: inner }} />;
                }
                return <span key={index} dangerouslySetInnerHTML={{ __html: part }} />;
            })}
        </span>
    );
};

const FormattedText: React.FC<{ text: string, className?: string, textColor?: string }> = ({ text, className = "", textColor }) => {
  if (!text) return null;
  const colorClass = textColor || "text-slate-700 dark:text-slate-300";

  return (
    <div className={`space-y-4 ${className}`}>
      {text.split('\n').map((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('###')) {
          return (
            <h3 key={i} className={`text-xl font-bold mt-6 mb-3 border-b border-white/20 pb-2 flex items-center gap-2 ${textColor || 'text-brand-700 dark:text-brand-400'}`}>
              <SafeHtmlText content={trimmed.replace(/###/g, '').trim()} />
            </h3>
          );
        }
        if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('* ')) {
          return (
            <div key={i} className="flex gap-3 ml-1 mb-3 items-start group">
              <span className={`mt-1.5 shrink-0 rounded-full p-0.5 ${textColor ? 'text-white/80 bg-white/20' : 'text-brand-500 bg-brand-50 dark:bg-brand-900'}`}>
                  <CheckCircle2 className="w-4 h-4" />
              </span>
              <span className={`leading-relaxed ${colorClass}`}>
                  <SafeHtmlText content={trimmed.replace(/^[-•*]\s*/, '')} />
              </span>
            </div>
          );
        }
        if (/^\d+\./.test(trimmed)) {
           return (
            <div key={i} className={`flex gap-4 ml-1 mb-4 items-start p-4 rounded-xl transition-colors shadow-sm ${textColor ? 'bg-white/10 border border-white/10 hover:bg-white/20' : 'bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 hover:border-brand-200 dark:hover:border-brand-800'}`}>
               <span className={`flex items-center justify-center w-8 h-8 rounded-lg text-base font-bold shrink-0 shadow-sm ${textColor ? 'bg-white text-indigo-900' : 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 border border-slate-200 dark:border-slate-600'}`}>
                   {trimmed.split('.')[0]}
               </span>
               <span className={`leading-relaxed mt-0.5 font-medium ${colorClass}`}>
                   <SafeHtmlText content={trimmed.replace(/^\d+\.\s*/, '')} />
               </span>
            </div>
           )
        }
        if (!trimmed) return <div key={i} className="h-2"></div>;
        return (
            <p key={i} className={`leading-relaxed text-justify mb-4 ${colorClass}`}>
                <SafeHtmlText content={trimmed} />
            </p>
        );
      })}
    </div>
  );
};

// --- AGGREGATION LOGIC ---
const aggregateAnalyses = (analyses: ComprehensiveAnalysis[]): ComprehensiveAnalysis => {
    if (!analyses || analyses.length === 0) return {} as ComprehensiveAnalysis;
    if (analyses.length === 1) return analyses[0];

    const validAnalyses = analyses.filter(a => a && a.savedAt);
    if (validAnalyses.length === 0) return analyses[0];

    const latest = validAnalyses.reduce((prev, current) => (prev.savedAt || 0) > (current.savedAt || 0) ? prev : current);
    
    // Average Percentile
    const validPercentiles = validAnalyses
        .map(a => a.executive_summary?.lgs_tahmini_yuzdelik)
        .filter(p => typeof p === 'number' && !isNaN(p));
    
    const avgPercentile = validPercentiles.length > 0
        ? validPercentiles.reduce((a, b) => a + b, 0) / validPercentiles.length
        : latest.executive_summary?.lgs_tahmini_yuzdelik || 0;

    const topicMap = new Map<string, TopicAnalysis>();

    validAnalyses.forEach(analysis => {
        (analysis.konu_analizi || []).forEach(topic => {
            const key = `${topic.ders}-${topic.konu}`;
            if (!topicMap.has(key)) {
                topicMap.set(key, { ...topic });
            } else {
                const existing = topicMap.get(key)!;
                existing.dogru += topic.dogru || 0;
                existing.yanlis += topic.yanlis || 0;
                existing.bos += topic.bos || 0;
                existing.lgs_kayip_puan += topic.lgs_kayip_puan || 0;
            }
        });
    });

    const aggregatedTopics = Array.from(topicMap.values()).map(t => ({
        ...t,
        basari_yuzdesi: ((t.dogru || 0) / ((t.dogru || 0) + (t.yanlis || 0) + (t.bos || 0) || 1)) * 100,
        lgs_kayip_puan: Number((t.lgs_kayip_puan || 0).toFixed(2))
    }));

    return {
        ...latest,
        konu_analizi: aggregatedTopics,
        exams_history: validAnalyses.flatMap(a => a.exams_history || []).filter((v,i,a)=> v && a.findIndex(t=>(t && v && t.tarih===v.tarih && t.sinav_adi===v.sinav_adi))===i),
        executive_summary: {
            ...latest.executive_summary,
            lgs_tahmini_yuzdelik: avgPercentile,
            mevcut_durum: `### 📊 GENEL BAKIŞ MODU (${validAnalyses.length} Dosya Kaydı)\n\nŞu anda **tüm denemelerin ortalaması ve kümülatif verileri** üzerinden analiz yapıyorsunuz. Aşağıdaki veriler, yüklenen tüm sınavların toplam performansını yansıtır.\n\n` + (latest.executive_summary?.mevcut_durum || "")
        }
    };
};

const AnalysisDashboard: React.FC<Props> = ({ data, history, onReset, onSelectHistory }) => {
  const [activeTab, setActiveTab] = useState<'ozet' | 'plan' | 'konu' | 'koc'>('koc');
  const [selectedLessonForTopic, setSelectedLessonForTopic] = useState<string>('Genel');
  const [viewScope, setViewScope] = useState<string>('all');
  const [isDownloading, setIsDownloading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'lgs_kayip_puan',
    direction: 'desc'
  });

  const allAnalyses = useMemo(() => {
    const list = [data, ...history].filter(Boolean);
    return list.filter((v,i,a)=>a.findIndex(t=>(t.id===v.id))===i);
  }, [data, history]);

  const activeData = useMemo(() => {
      if (!allAnalyses || allAnalyses.length === 0) return data;
      if (viewScope === 'all') return aggregateAnalyses(allAnalyses);
      return allAnalyses.find(a => a.id === viewScope) || data;
  }, [viewScope, allAnalyses, data]);

  useEffect(() => {
    setSortConfig({ key: 'lgs_kayip_puan', direction: 'desc' });
  }, [viewScope, activeTab]);

  useEffect(() => {
    if (activeData) {
      const studentName = activeData.ogrenci_bilgi?.ad_soyad?.split(' ')[0] || "Öğrenci";
      setChatHistory([{
        role: 'model',
        text: `Merhaba ${studentName}! 🚀 Analiz raporunu inceledim. Sonuçların hakkında konuşmak veya çalışma planı yapmak için buradayım. Nereden başlayalım?`
      }]);
    }
  }, [activeData.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setChatHistory(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsChatLoading(true);

    try {
        const response = await chatWithCoach(userMessage, chatHistory, activeData);
        setChatHistory(prev => [...prev, { role: 'model', text: response }]);
    } catch (error) {
        setChatHistory(prev => [...prev, { role: 'model', text: "Üzgünüm, şu an bağlantıda bir sorun yaşıyorum. Lütfen biraz sonra tekrar dene. 😔" }]);
    } finally {
        setIsChatLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!contentRef.current) return;
    setIsDownloading(true);
    try {
        const element = contentRef.current;
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210; 
        const pageHeight = 295; 
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const pdf = new jsPDF('p', 'mm', [imgWidth, Math.max(imgHeight, pageHeight)]);
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        const fileName = `${activeData.ogrenci_bilgi?.ad_soyad || 'analiz'}_rapor.pdf`.replace(/\s+/g, '_');
        pdf.save(fileName);
    } catch (error) {
        console.error("PDF hatası:", error);
        alert("PDF oluşturulurken hata.");
    } finally {
        setIsDownloading(false);
    }
  };

  // --- DATA PREPARATION ---
  const globalTrendData = useMemo(() => {
      const uniqueExamsMap = new Map<string, any>();
      const sortedAnalyses = [...allAnalyses].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));

      sortedAnalyses.forEach(analysis => {
          (analysis.exams_history || []).forEach((exam) => {
              if (!exam) return;
              const dateKey = exam.tarih ? exam.tarih.replace(/\s/g, '') : 'no-date';
              const nameKey = (exam.sinav_adi || 'sinav').trim().toLowerCase().replace(/\s+/g, '-');
              const scoreKey = exam.toplam_puan ? exam.toplam_puan.toString() : '0';
              const uniqueKey = `${dateKey}_${nameKey}_${scoreKey}`;

              if (!uniqueExamsMap.has(uniqueKey)) {
                  let examTotalNet = 0;
                  const row: any = {
                    date: exam.tarih ? exam.tarih : new Date(analysis.savedAt || Date.now()).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
                    fullDate: exam.tarih ? new Date(exam.tarih).getTime() : (analysis.savedAt || Date.now()),
                    name: exam.sinav_adi?.length > 15 ? exam.sinav_adi.substring(0, 15) + '...' : (exam.sinav_adi || 'Sınav'),
                    fullName: exam.sinav_adi,
                    id: analysis.id,
                    uniqueId: uniqueKey,
                    totalScore: Number(exam.toplam_puan),
                    originalExam: exam
                  };
                  Object.keys(LESSON_CONFIG).forEach(k => row[LESSON_CONFIG[k].label] = 0);
                  (exam.ders_netleri || []).forEach(d => { 
                      if(d && d.ders) {
                          const config = getLessonConfig(d.ders);
                          row[config.label] = d.net; 
                          examTotalNet += d.net || 0;
                      }
                  });
                  row.totalNet = examTotalNet;
                  uniqueExamsMap.set(uniqueKey, row);
              }
          });
      });
      return Array.from(uniqueExamsMap.values()).sort((a: any, b: any) => a.fullDate - b.fullDate);
  }, [allAnalyses]);

  const averageScore = useMemo(() => {
    const validExams = globalTrendData.filter(e => {
        const score = Number(e.totalScore);
        return typeof score === 'number' && !isNaN(score) && isFinite(score) && score > 0;
    });
    if (validExams.length === 0) return 0;
    const total = validExams.reduce((sum, exam) => sum + Number(exam.totalScore), 0);
    return total / validExams.length;
  }, [globalTrendData]);

  // Topic List with Sorting
  const sortedTopics = useMemo(() => {
    let items = [...(activeData.konu_analizi || [])];
    
    // 1. Filter
    if (selectedLessonForTopic !== 'Genel') {
      items = items.filter(t => getLessonConfig(t.ders).label === selectedLessonForTopic);
    }

    // 2. Sort
    items.sort((a, b) => {
      let aVal = a[sortConfig.key as keyof TopicAnalysis];
      let bVal = b[sortConfig.key as keyof TopicAnalysis];

      if (sortConfig.key === 'basari_yuzdesi') {
        const calculatePercent = (t: TopicAnalysis) => ((t.dogru || 0) / ((t.dogru || 0) + (t.yanlis || 0) + (t.bos || 0) || 1)) * 100;
        aVal = calculatePercent(a);
        bVal = calculatePercent(b);
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return items;
  }, [activeData.konu_analizi, sortConfig, selectedLessonForTopic]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-12 transition-colors">
      {/* Header & Controls */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Left: User Info */}
            <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="p-2.5 bg-brand-100 dark:bg-brand-900 rounded-full">
                    <GraduationCap className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                        {activeData.ogrenci_bilgi?.ad_soyad || 'LGS Öğrencisi'}
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        LGS Analiz Raporu &bull; {new Date().toLocaleDateString('tr-TR')}
                    </p>
                </div>
            </div>

            {/* Middle: Scope Selector */}
            <div className="flex items-center gap-2 w-full md:w-auto bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700 overflow-x-auto max-w-full">
               <button
                  onClick={() => setViewScope('all')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-all ${
                      viewScope === 'all' 
                      ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
               >
                   Genel Bakış ({allAnalyses.length})
               </button>
               {allAnalyses.slice(0, 3).map((analysis, idx) => (
                   <button
                       key={analysis.id || idx}
                       onClick={() => setViewScope(analysis.id!)}
                       className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-all ${
                         viewScope === analysis.id
                         ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                         : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                       }`}
                   >
                       {analysis.exams_history?.[0]?.sinav_adi?.substring(0,10) || 'Sınav'}...
                   </button>
               ))}
            </div>

            {/* Right: Actions */}
            <div className="flex gap-2 w-full md:w-auto">
                <button
                    onClick={downloadPDF}
                    disabled={isDownloading}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 dark:shadow-none disabled:opacity-50"
                >
                    {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    <span className="text-sm font-medium">PDF İndir</span>
                </button>
                <button
                    onClick={onReset}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                    <ArrowRight className="w-4 h-4 rotate-180" />
                    <span className="text-sm font-medium">Çıkış</span>
                </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 mt-6 overflow-x-auto pb-1 scrollbar-hide">
            {[
              { id: 'koc', label: 'Yapay Zeka Koç', icon: Bot },
              { id: 'ozet', label: 'Özet Durum', icon: Activity },
              { id: 'konu', label: 'Konu Analizi', icon: Target },
              { id: 'plan', label: 'Çalışma Planı', icon: Calendar },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 ring-1 ring-brand-200 dark:ring-brand-700/50'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-brand-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8" ref={contentRef}>
        
        {/* --- TAB: KOÇ (CHAT) --- */}
        {activeTab === 'koc' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)] min-h-[600px]">
             {/* Left: Quick Stats Summary for Context */}
             <div className="lg:col-span-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                         <div className="p-2 bg-white/20 rounded-lg">
                             <Trophy className="w-6 h-6 text-yellow-300" />
                         </div>
                         <h3 className="text-lg font-bold">Son Durum</h3>
                    </div>
                    <div className="text-4xl font-bold tracking-tight mb-1">
                        {formatLGSScore(activeData.exams_history?.[0]?.toplam_puan || 0)}
                    </div>
                    <p className="text-indigo-100 text-sm font-medium opacity-90">
                        Genel Ortalama: {averageScore > 0 ? formatLGSScore(averageScore) : '-'}
                    </p>
                    
                    <div className="mt-6 pt-6 border-t border-white/20">
                         <div className="flex items-center justify-between mb-2">
                             <span className="text-sm text-indigo-100">Tahmini Yüzdelik</span>
                             <span className="font-bold bg-white/20 px-2 py-0.5 rounded text-sm">
                                 %{activeData.executive_summary?.lgs_tahmini_yuzdelik?.toFixed(2) || '-'}
                             </span>
                         </div>
                         <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                             <div 
                               className="h-full bg-yellow-400 rounded-full transition-all duration-1000"
                               style={{ width: `${Math.min(100, Math.max(5, 100 - (activeData.executive_summary?.lgs_tahmini_yuzdelik || 50)))}%` }}
                             />
                         </div>
                         <p className="text-xs text-indigo-200 mt-2 text-center italic">
                            Daha iyi bir yüzdelik için çubuk sağa dolmalı
                         </p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                        Odaklanılması Gerekenler
                    </h4>
                    <div className="space-y-3">
                         {activeData.konu_analizi
                            ?.sort((a,b) => (b.lgs_kayip_puan || 0) - (a.lgs_kayip_puan || 0))
                            .slice(0, 4)
                            .map((topic, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-3">
                                         <div className="w-2 h-8 rounded-full" style={{ backgroundColor: getLessonConfig(topic.ders).color }}></div>
                                         <div>
                                             <p className="text-xs font-bold text-slate-500 uppercase">{topic.ders}</p>
                                             <p className="text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-1">{topic.konu}</p>
                                         </div>
                                    </div>
                                    <div className="text-right">
                                         <span className="text-xs font-bold text-rose-500">-{topic.lgs_kayip_puan?.toFixed(1)} Puan</span>
                                    </div>
                                </div>
                            ))
                         }
                    </div>
                </div>
             </div>

             {/* Chat Interface */}
             <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden relative">
                 {/* Chat Messages */}
                 <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
                    {chatHistory.map((msg, idx) => (
                        <div key={idx} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                msg.role === 'user' 
                                ? 'bg-indigo-600 text-white' 
                                : 'bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-300'
                            }`}>
                                {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                            </div>
                            <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${
                                msg.role === 'user'
                                ? 'bg-indigo-600 text-white rounded-tr-none'
                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-tl-none'
                            }`}>
                                <FormattedText text={msg.text} textColor={msg.role === 'user' ? 'text-white' : undefined} />
                            </div>
                        </div>
                    ))}
                    {isChatLoading && (
                        <div className="flex items-start gap-3">
                             <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
                                 <Bot className="w-5 h-5 text-brand-600" />
                             </div>
                             <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-200 dark:border-slate-700 shadow-sm">
                                 <div className="flex gap-1.5">
                                     <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms'}}></span>
                                     <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms'}}></span>
                                     <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms'}}></span>
                                 </div>
                             </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                 </div>

                 {/* Input Area */}
                 <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                     <form onSubmit={handleSendMessage} className="relative">
                         <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Koçuna bir soru sor... (Örn: Matematik netlerimi nasıl artırırım?)"
                            className="w-full pl-4 pr-12 py-3.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                            disabled={isChatLoading}
                         />
                         <button
                            type="submit"
                            disabled={!chatInput.trim() || isChatLoading}
                            className="absolute right-2 top-2 p-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:hover:bg-brand-600 transition-colors"
                         >
                             <Send className="w-5 h-5" />
                         </button>
                     </form>
                     <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {['Matematik netimi nasıl artırırım?', 'Haftalık planımı revize et', 'Hangi konulara odaklanmalıyım?'].map((q, i) => (
                            <button 
                                key={i}
                                onClick={() => { setChatInput(q); }}
                                className="text-xs px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-slate-600 dark:text-slate-400 hover:border-brand-300 hover:text-brand-600 whitespace-nowrap transition-colors"
                            >
                                {q}
                            </button>
                        ))}
                     </div>
                 </div>
             </div>
          </div>
        )}

        {/* --- TAB: ÖZET --- */}
        {activeTab === 'ozet' && (
           <div className="space-y-6">
              {/* Score Trend Chart */}
              {globalTrendData.length > 1 && (
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <div className="flex items-center justify-between mb-6">
                          <div>
                              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                  <TrendingUp className="w-5 h-5 text-brand-600" />
                                  Puan Gelişim Grafiği
                              </h3>
                              <p className="text-sm text-slate-500">Son {globalTrendData.length} sınavın LGS puan değişimi</p>
                          </div>
                      </div>
                      <div className="h-[300px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={globalTrendData}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
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
                                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                      cursor={{ stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '4 4' }}
                                  />
                                  <Legend />
                                  <Line 
                                      type="monotone" 
                                      dataKey="totalScore" 
                                      name="LGS Puanı"
                                      stroke="#4f46e5" 
                                      strokeWidth={3}
                                      activeDot={{ r: 8, strokeWidth: 0 }}
                                      dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#4f46e5' }}
                                  />
                              </LineChart>
                          </ResponsiveContainer>
                      </div>
                  </div>
              )}

              {/* Coach's Executive Summary */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-brand-50/50 dark:bg-brand-900/20">
                      <h3 className="text-lg font-bold text-brand-800 dark:text-brand-300 flex items-center gap-2">
                          <Quote className="w-5 h-5" />
                          Koç'un Analiz Özeti
                      </h3>
                  </div>
                  <div className="p-6">
                      <FormattedText text={activeData.executive_summary?.mevcut_durum || "Veri analiz ediliyor..."} />
                  </div>
              </div>
           </div>
        )}

        {/* --- TAB: KONU ANALİZİ --- */}
        {activeTab === 'konu' && (
            <div className="space-y-6">
                {/* Filters */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <button
                        onClick={() => setSelectedLessonForTopic('Genel')}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                            selectedLessonForTopic === 'Genel' 
                            ? 'bg-slate-800 text-white shadow-lg shadow-slate-200' 
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        Tümü
                    </button>
                    {Object.values(LESSON_CONFIG).map((lesson) => (
                        <button
                            key={lesson.label}
                            onClick={() => setSelectedLessonForTopic(lesson.label)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                                selectedLessonForTopic === lesson.label
                                ? 'text-white shadow-lg'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                            style={selectedLessonForTopic === lesson.label ? { backgroundColor: lesson.color, borderColor: lesson.color } : {}}
                        >
                            <lesson.icon className="w-4 h-4" />
                            {lesson.label}
                        </button>
                    ))}
                </div>

                {/* Table */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ders & Konu</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center cursor-pointer hover:text-brand-600" onClick={() => handleSort('dogru')}>
                                        <div className="flex items-center justify-center gap-1">Doğru <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center cursor-pointer hover:text-brand-600" onClick={() => handleSort('yanlis')}>
                                        <div className="flex items-center justify-center gap-1">Yanlış <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center cursor-pointer hover:text-brand-600" onClick={() => handleSort('basari_yuzdesi')}>
                                        <div className="flex items-center justify-center gap-1">Başarı % <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right cursor-pointer hover:text-brand-600" onClick={() => handleSort('lgs_kayip_puan')}>
                                        <div className="flex items-center justify-end gap-1">LGS Kayıp <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {sortedTopics.map((topic, idx) => {
                                    const config = getLessonConfig(topic.ders);
                                    const percentage = ((topic.dogru || 0) / ((topic.dogru || 0) + (topic.yanlis || 0) + (topic.bos || 0) || 1)) * 100;
                                    
                                    return (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                        <config.icon className="w-5 h-5" style={{ color: config.color }} />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-900 dark:text-white">{topic.konu}</p>
                                                        <p className="text-xs text-slate-500">{topic.ders}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-center font-medium text-emerald-600">{topic.dogru}</td>
                                            <td className="p-4 text-center font-medium text-rose-600">{topic.yanlis}</td>
                                            <td className="p-4 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className={`text-sm font-bold ${
                                                        percentage >= 80 ? 'text-emerald-600' : 
                                                        percentage >= 50 ? 'text-amber-600' : 'text-rose-600'
                                                    }`}>
                                                        %{percentage.toFixed(0)}
                                                    </span>
                                                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full ${
                                                                percentage >= 80 ? 'bg-emerald-500' : 
                                                                percentage >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                                            }`} 
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-xs font-bold border border-rose-100 dark:border-rose-800">
                                                    -{topic.lgs_kayip_puan?.toFixed(2) || '0.00'} Puan
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* --- TAB: ÇALIŞMA PLANI --- */}
        {activeTab === 'plan' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
                            <ListTodo className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Haftalık Çalışma Önerisi</h3>
                    </div>
                    <FormattedText text={activeData.executive_summary?.oneri_program || "Program oluşturuluyor..."} />
                </div>
                
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
                     <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                            <Target className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Stratejik Hedefler</h3>
                    </div>
                     <FormattedText text={activeData.executive_summary?.gelisim_stratejisi || "Strateji belirleniyor..."} />
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default AnalysisDashboard;
