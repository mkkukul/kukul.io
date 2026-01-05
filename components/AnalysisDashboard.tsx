import React, { useState, useEffect, useMemo } from 'react';
import { ComprehensiveAnalysis, TopicAnalysis } from '../types';
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
  CheckCircle, AlertCircle, HelpCircle, Trophy, ThumbsUp
} from 'lucide-react';

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
  const lower = lessonName.toLocaleLowerCase('tr-TR');
  
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

  return LESSON_CONFIG[lessonName] || { color: '#64748b', icon: BookOpen, label: lessonName };
};

// Helper to get limit based on lesson name
const getLessonLimit = (lessonName: string) => {
    const config = getLessonConfig(lessonName);
    return LGS_LIMITS[config.label] || 20; // Default to 20 if unknown
};

// Helper to determine icon for simulation step based on title
const getSimulationStepConfig = (title: string) => {
    // Try to find a lesson name within the title (e.g. "Matematik Net Artışı")
    const lessonConfig = getLessonConfig(title);
    
    // Check if the returned config is one of our known standard configs
    const isKnownConfig = Object.values(LESSON_CONFIG).some(conf => conf.label === lessonConfig.label);
    
    if (isKnownConfig) {
        return lessonConfig;
    }
    
    return { color: '#f59e0b', icon: Rocket, label: 'Genel Strateji' };
};

// Helper to determine status based on percentage logic (Fail-safe for frontend)
const getStatusByPercentage = (percentage: number): 'Mükemmel' | 'İyi' | 'Geliştirilmeli' | 'Kritik' => {
    if (percentage >= 80) return 'Mükemmel';
    if (percentage >= 70) return 'İyi';
    if (percentage >= 50) return 'Geliştirilmeli';
    return 'Kritik';
};

// --- STRICT SCORE FORMATTER ---
// 1. Noktadan önceki tam sayı kısmını al.
// 2. Noktadan sonraki kısmı matematiksel olarak yuvarlayarak tam 3 basamak yap.
const formatLGSScore = (value: number) => {
    if (!value || isNaN(value)) return "-";
    
    const val = Number(value);
    
    // 1. Integer part
    const integerPart = Math.floor(val);
    
    // 2. Decimal part
    const decimalPart = val - integerPart;
    
    // 3. Round decimal to 3 places
    const roundedDecimal = Math.round(decimalPart * 1000) / 1000;
    
    // Combine (Note: Math.round might carry over to integer, e.g. 0.9999 -> 1.0)
    // This is mathematically correct behavior for rounding.
    return (integerPart + roundedDecimal).toFixed(3);
};

// Helper to render Markdown-like text
const renderBold = (text: string) => {
  // Regex: 1. **Bold** patterns, 2. Duration patterns like (Süre: 20 dk) or (20 dk) or Süre: 15dk
  const parts = text.split(/(\*\*.*?\*\*|\(Süre:.*?\)|Süre:.*?dk|\d+\s*dk(?!\w))/g);
  
  return parts.map((part, j) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={j} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
    }
    // Highlight time duration patterns
    if (part.includes('dk') || part.includes('Süre:')) {
         return <span key={j} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-bold mx-1 border border-blue-100 whitespace-nowrap"><Timer className="w-3 h-3" /> {part.replace(/[()]/g, '')}</span>
    }
    return part;
  });
};

const FormattedText: React.FC<{ text: string, className?: string }> = ({ text, className = "" }) => {
  if (!text) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {text.split('\n').map((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('###')) {
          return (
            <h3 key={i} className="text-lg font-bold text-brand-700 mt-4 mb-2 border-b border-slate-200 pb-1 flex items-center gap-2">
              {trimmed.replace(/###/g, '').trim()}
            </h3>
          );
        }
        if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('* ')) {
          return (
            <div key={i} className="flex gap-3 ml-1 mb-2 items-start group">
              <span className="text-brand-500 mt-1.5 shrink-0 bg-brand-50 rounded-full p-0.5">
                  <CheckCircle2 className="w-3 h-3" />
              </span>
              <span className="leading-relaxed">{renderBold(trimmed.replace(/^[-•*]\s*/, ''))}</span>
            </div>
          );
        }
        if (/^\d+\./.test(trimmed)) {
           return (
            <div key={i} className="flex gap-4 ml-1 mb-3 items-start bg-slate-50 p-3 rounded-xl border border-slate-100 hover:border-brand-200 transition-colors">
               <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-white text-brand-600 text-sm font-bold shrink-0 shadow-sm border border-slate-200">
                   {trimmed.split('.')[0]}
               </span>
               <span className="leading-relaxed mt-0.5 text-slate-700 font-medium">{renderBold(trimmed.replace(/^\d+\.\s*/, ''))}</span>
            </div>
           )
        }
        if (!trimmed) return <div key={i} className="h-1"></div>;
        return <p key={i} className="leading-relaxed text-justify">{renderBold(line)}</p>;
      })}
    </div>
  );
};

// --- AGGREGATION LOGIC ---
const aggregateAnalyses = (analyses: ComprehensiveAnalysis[]): ComprehensiveAnalysis => {
    if (analyses.length === 0) return analyses[0]; // Should not happen
    if (analyses.length === 1) return analyses[0];

    // Use the latest analysis as the "base" for metadata, info, and latest comments
    const latest = analyses.reduce((prev, current) => (prev.savedAt || 0) > (current.savedAt || 0) ? prev : current);
    
    // Aggregate Topic Analysis
    const topicMap = new Map<string, TopicAnalysis>();
    
    // Calculate Average LGS Percentile
    const validPercentiles = analyses
        .map(a => a.executive_summary?.lgs_tahmini_yuzdelik)
        .filter(p => typeof p === 'number' && !isNaN(p));
    
    const avgPercentile = validPercentiles.length > 0
        ? validPercentiles.reduce((a, b) => a + b, 0) / validPercentiles.length
        : latest.executive_summary.lgs_tahmini_yuzdelik;

    analyses.forEach(analysis => {
        (analysis.konu_analizi || []).forEach(topic => {
            const key = `${topic.ders}-${topic.konu}`;
            if (!topicMap.has(key)) {
                topicMap.set(key, { ...topic });
            } else {
                const existing = topicMap.get(key)!;
                existing.dogru += topic.dogru;
                existing.yanlis += topic.yanlis;
                existing.bos += topic.bos;
                existing.lgs_kayip_puan += topic.lgs_kayip_puan;
            }
        });
    });

    const aggregatedTopics = Array.from(topicMap.values()).map(t => ({
        ...t,
        basari_yuzdesi: (t.dogru / (t.dogru + t.yanlis + t.bos)) * 100,
        lgs_kayip_puan: Number(t.lgs_kayip_puan.toFixed(2))
    }));

    return {
        ...latest,
        konu_analizi: aggregatedTopics,
        exams_history: analyses.flatMap(a => a.exams_history).filter((v,i,a)=>a.findIndex(t=>(t.tarih===v.tarih && t.sinav_adi===v.sinav_adi))===i),
        executive_summary: {
            ...latest.executive_summary,
            lgs_tahmini_yuzdelik: avgPercentile,
            mevcut_durum: `### 📊 GENEL BAKIŞ MODU (${analyses.length} Dosya Kaydı)\n\nŞu anda **tüm denemelerin ortalaması ve kümülatif verileri** üzerinden analiz yapıyorsunuz. Aşağıdaki veriler, yüklenen tüm sınavların toplam performansını yansıtır.\n\n` + latest.executive_summary.mevcut_durum
        }
    };
};

// --- CUSTOM TOOLTIP COMPONENT ---
const CustomTopicTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload as TopicAnalysis;
        
        // Ensure status is up to date based on percentage
        const derivedStatus = getStatusByPercentage(data.basari_yuzdesi);

        return (
            <div className="bg-white/95 backdrop-blur-sm p-4 rounded-2xl shadow-xl border border-slate-200 text-sm max-w-[280px] z-50 animate-fade-in">
                {/* Header */}
                <div className="border-b border-slate-100 pb-2 mb-2 flex justify-between items-start">
                    <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{data.ders}</p>
                        <h4 className="font-bold text-slate-800 text-base leading-tight mt-0.5">{data.konu}</h4>
                    </div>
                    {derivedStatus === 'Kritik' && <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-emerald-50 rounded-lg p-2 text-center border border-emerald-100">
                        <div className="text-emerald-700 font-black text-lg leading-none">{data.dogru}</div>
                        <div className="text-[9px] text-emerald-600 font-bold uppercase mt-1">Doğru</div>
                    </div>
                     <div className="bg-red-50 rounded-lg p-2 text-center border border-red-100">
                        <div className="text-red-600 font-black text-lg leading-none">{data.yanlis}</div>
                        <div className="text-[9px] text-red-500 font-bold uppercase mt-1">Yanlış</div>
                    </div>
                     <div className="bg-slate-50 rounded-lg p-2 text-center border border-slate-100">
                        <div className="text-slate-600 font-black text-lg leading-none">{data.bos}</div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">Boş</div>
                    </div>
                </div>

                {/* Comparison / Detail Section */}
                <div className="space-y-2 bg-slate-50 rounded-xl p-3">
                     <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">LGS'ye Etkisi (Kayıp)</span>
                        <span className="text-red-600 font-black bg-white px-1.5 py-0.5 rounded shadow-sm">-{data.lgs_kayip_puan} Puan</span>
                     </div>
                     <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">Başarı Yüzdesi</span>
                        <span className={`font-bold ${data.basari_yuzdesi >= 70 ? 'text-emerald-600' : data.basari_yuzdesi >= 50 ? 'text-amber-600' : 'text-red-600'}`}>%{data.basari_yuzdesi.toFixed(1)}</span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};


const AnalysisDashboard: React.FC<Props> = ({ data, history, onReset, onSelectHistory }) => {
  const [activeTab, setActiveTab] = useState<'ozet' | 'trend' | 'plan' | 'konu'>('ozet');
  
  // Trend Specific States
  const [trendSubTab, setTrendSubTab] = useState<'all' | 'last3' | 'individual'>('all');
  const [selectedLessonForTopic, setSelectedLessonForTopic] = useState<string>('Genel');
  const [selectedTrendLesson, setSelectedTrendLesson] = useState<string>('Tümü');
  
  // VIEW SCOPE: 'all' (Aggregate) or specific analysis ID
  const [viewScope, setViewScope] = useState<string>('all');

  // Sorting State - Defaults to LGS Kayıp Puan Descending
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'lgs_kayip_puan',
    direction: 'desc'
  });

  // Combine current data and history into a unique list
  const allAnalyses = useMemo(() => {
    const list = [data, ...history];
    return list.filter((v,i,a)=>a.findIndex(t=>(t.id===v.id))===i);
  }, [data, history]);

  // Determine ACTIVE DATA based on Scope
  const activeData = useMemo(() => {
      if (viewScope === 'all') {
          return aggregateAnalyses(allAnalyses);
      }
      return allAnalyses.find(a => a.id === viewScope) || data;
  }, [viewScope, allAnalyses, data]);

  // Reset sorting when scope changes or tab changes to ensure "LGS Loss" focus
  useEffect(() => {
    setSortConfig({ key: 'lgs_kayip_puan', direction: 'desc' });
  }, [viewScope, activeTab]);

  // --- DATA PREPARATION (Using activeData) ---

  // 1. Chart Data from GLOBAL HISTORY (Used for Trends)
  const globalTrendData = useMemo(() => {
      return allAnalyses
        .flatMap(analysis => {
            // Extract all exams from each analysis file
            return (analysis.exams_history || []).map((exam, index) => {
                const row: any = {
                    date: exam.tarih ? exam.tarih : new Date(analysis.savedAt || Date.now()).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
                    fullDate: analysis.savedAt || Date.now(), // Fallback sort by upload time if date missing
                    name: exam.sinav_adi?.length > 15 ? exam.sinav_adi.substring(0, 15) + '...' : (exam.sinav_adi || 'Sınav'),
                    id: analysis.id, // Keep reference to parent analysis
                    uniqueId: `${analysis.id}-${index}`, // Unique key for lists
                    totalScore: Number(exam.toplam_puan),
                    originalExam: exam
                };

                // Initialize all known lessons to 0
                Object.keys(LESSON_CONFIG).forEach(k => row[LESSON_CONFIG[k].label] = 0);

                (exam.ders_netleri || []).forEach(d => { 
                    if(d.ders) {
                        const config = getLessonConfig(d.ders);
                        row[config.label] = d.net; 
                    }
                });
                return row;
            });
        })
        .sort((a: any, b: any) => a.fullDate - b.fullDate);
  }, [allAnalyses]);

  // --- CRITICAL: PRECISE AVERAGE SCORE CALCULATION ---
  const averageScore = useMemo(() => {
    // 1. Filter exams that have a valid score > 0 (excludes parsing errors or empty placeholders)
    const validExams = globalTrendData.filter(e => {
        const score = Number(e.totalScore);
        // Ensure strictly numbers, finite, and positive
        return typeof score === 'number' && !isNaN(score) && isFinite(score) && score > 0;
    });
    
    if (validExams.length === 0) return 0;
    
    // 2. Sum up totals (ensure Number casting)
    const total = validExams.reduce((sum, exam) => sum + Number(exam.totalScore), 0);
    
    // 3. Return exact arithmetic mean
    return total / validExams.length;
  }, [globalTrendData]);

  // 2. Prepare Topic Data (from ACTIVE DATA)
  const allTopics = activeData.konu_analizi || [];
  
  // Calculate Status dynamically to ensure data consistency
  const processedTopics = useMemo(() => {
      return allTopics.map(topic => ({
          ...topic,
          // Force overwrite durum based on percentage if needed, or trust AI if it matches schema
          durum: getStatusByPercentage(topic.basari_yuzdesi)
      }));
  }, [allTopics]);
  
  let filteredTopics = [];
  if (selectedLessonForTopic === 'Genel') {
    filteredTopics = [...processedTopics];
  } else {
    filteredTopics = processedTopics.filter(t => {
       const config = getLessonConfig(t.ders);
       const selectedConfig = getLessonConfig(selectedLessonForTopic);
       return config.label === selectedConfig.label;
    });
  }

  // Calculate Summary Stats for Topic Tab - NEW 4-TIER LOGIC
  const topicStats = useMemo(() => {
      const total = filteredTopics.length;
      
      const excellent = filteredTopics.filter(t => t.durum === 'Mükemmel').length;
      const good = filteredTopics.filter(t => t.durum === 'İyi').length;
      const improve = filteredTopics.filter(t => t.durum === 'Geliştirilmeli').length;
      const critical = filteredTopics.filter(t => t.durum === 'Kritik').length;
      
      const pieData = [
          { name: 'Mükemmel (>%80)', value: excellent, color: '#10b981' }, // Emerald
          { name: 'İyi (%70-80)', value: good, color: '#3b82f6' },      // Blue
          { name: 'Geliştirilmeli (%50-70)', value: improve, color: '#f59e0b' }, // Amber
          { name: 'Kritik (<%50)', value: critical, color: '#ef4444' }    // Red
      ].filter(d => d.value > 0);

      return { total, excellent, good, improve, critical, pieData };
  }, [filteredTopics]);

  // Apply Sorting to Topics
  const sortedTopics = [...filteredTopics].sort((a, b) => {
    const { key, direction } = sortConfig;
    const multiplier = direction === 'asc' ? 1 : -1;

    if (key === 'konu' || key === 'ders' || key === 'durum') {
        const valA = (a[key as keyof typeof a] as string) || '';
        const valB = (b[key as keyof typeof b] as string) || '';
        return multiplier * valA.localeCompare(valB);
    }
    if (key === 'soru_dagilimi') {
        return multiplier * (a.yanlis - b.yanlis);
    }
    
    // Default numeric sort with safety check
    const valA = Number(a[key as keyof typeof a]) || 0;
    const valB = Number(b[key as keyof typeof b]) || 0;
    return multiplier * (valA - valB);
  });

  const chartData = selectedLessonForTopic === 'Genel'
    ? [...processedTopics].sort((a, b) => b.lgs_kayip_puan - a.lgs_kayip_puan).slice(0, 15)
    : sortedTopics;

  const handleSort = (key: string) => {
    setSortConfig(current => ({
        key,
        direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const RenderSortIcon = ({ columnKey }: { columnKey: string }) => {
      if (sortConfig.key !== columnKey) return <ArrowUpDown className="w-4 h-4 text-slate-300 opacity-50 group-hover:opacity-100" />;
      return sortConfig.direction === 'asc' 
        ? <ArrowUp className="w-4 h-4 text-brand-600" /> 
        : <ArrowDown className="w-4 h-4 text-brand-600" />;
  };

  const studyPlanByLesson: Record<string, any[]> = {};
  (activeData.calisma_plani || []).forEach(item => {
      const config = getLessonConfig(item.ders);
      const key = config.label;
      if (!studyPlanByLesson[key]) studyPlanByLesson[key] = [];
      studyPlanByLesson[key].push(item);
  });

  // ROBUST LAST EXAM SELECTION
  // Find the last exam that actually has a score > 0.
  // This prevents displaying "0" if the AI parsed a blank row at the end of a table.
  const lastExam = useMemo(() => {
    if (!activeData.exams_history || activeData.exams_history.length === 0) return null;
    
    // Filter exams with valid scores
    const validExams = activeData.exams_history.filter(e => e.toplam_puan > 0);
    
    // Return the last valid exam, or the last one if none are valid (fallback)
    return validExams.length > 0 
        ? validExams[validExams.length - 1] 
        : activeData.exams_history[activeData.exams_history.length - 1];
  }, [activeData]);
    
  // Scores for display - UPDATED with formatLGSScore logic
  const currentScoreDisplay = useMemo(() => {
    if (viewScope === 'all') {
        return averageScore > 0 ? formatLGSScore(averageScore) : "-";
    } else {
        return lastExam?.toplam_puan ? formatLGSScore(lastExam.toplam_puan) : "-";
    }
  }, [viewScope, averageScore, lastExam]);

  // Dynamic colors
  const currentLessonTheme = selectedLessonForTopic === 'Genel' 
    ? { color: '#10b981', fill: '#d1fae5' } 
    : (() => {
        const conf = getLessonConfig(selectedLessonForTopic);
        return { color: conf.color, fill: `${conf.color}33` };
    })();

  const displayedTrendLessons = selectedTrendLesson === 'Tümü'
      ? Object.entries(LESSON_CONFIG)
      : Object.entries(LESSON_CONFIG).filter(([key, config]) => config.label === selectedTrendLesson);

  const getTrendIcon = (data: any[], key: string) => {
      if (data.length < 2) return null;
      const last = data[data.length - 1][key] || 0;
      const prev = data[data.length - 2][key] || 0;
      const diff = last - prev;
      
      if (diff > 0.5) return <span className="flex items-center text-emerald-600 font-bold text-xs gap-1 bg-emerald-50 px-2 py-1 rounded"><ArrowUp className="w-3 h-3" /> +{diff.toFixed(1)}</span>;
      if (diff < -0.5) return <span className="flex items-center text-red-600 font-bold text-xs gap-1 bg-red-50 px-2 py-1 rounded"><ArrowDown className="w-3 h-3" /> {diff.toFixed(1)}</span>;
      return <span className="text-slate-400 font-bold text-xs bg-slate-50 px-2 py-1 rounded flex items-center gap-1"><ArrowRight className="w-3 h-3" /> Stabil</span>;
  };

  // --- NEW: POTENTIAL & RECOVERABLE SCORE ANALYSIS ---

  // Calculate Potentials based on activeData
  const potentials = useMemo(() => {
    const targetExams = viewScope === 'all' ? activeData.exams_history : [lastExam];
    if (!targetExams || targetExams.length === 0) return [];

    const lessonStats: Record<string, { totalNet: number, count: number }> = {};
    
    // Initialize with 0 for all lessons to ensure order
    Object.values(LESSON_CONFIG).forEach(c => {
        lessonStats[c.label] = { totalNet: 0, count: 0 };
    });

    targetExams.forEach(exam => {
        if(!exam) return;
        (exam.ders_netleri || []).forEach(d => {
            const conf = getLessonConfig(d.ders);
            if (lessonStats[conf.label]) {
                lessonStats[conf.label].totalNet += d.net;
                lessonStats[conf.label].count += 1;
            }
        });
    });

    return Object.entries(lessonStats)
        .filter(([_, stats]) => stats.count > 0) // Only show lessons present
        .map(([label, stats]) => {
            const limit = getLessonLimit(label); // 20 or 10
            
            // Average net for this lesson (clamped to limit to prevent data errors showing >20)
            const avgNet = Math.min(stats.totalNet / (stats.count || 1), limit);
            
            const conf = Object.values(LESSON_CONFIG).find(c => c.label === label) || { color: '#64748b' };
            const gap = limit - avgNet; // Realistic recoverable gap
            
            return {
                label,
                current: avgNet,
                limit,
                gap,
                percentage: (avgNet / limit) * 100,
                color: conf.color
            };
        }).sort((a, b) => {
            // Fixed display order: Mat, Fen, Tr, Ink, Din, Ing
            const order = [
                'Matematik',
                'Fen Bilimleri', 
                'Türkçe',
                'T.C. İnkılap Tarihi',
                'Din Kültürü',
                'İngilizce'
            ];
            const indexA = order.indexOf(a.label);
            const indexB = order.indexOf(b.label);
            
            // Handle cases where a label might not be in the list (put at end)
            const safeIndexA = indexA === -1 ? 999 : indexA;
            const safeIndexB = indexB === -1 ? 999 : indexB;
            
            return safeIndexA - safeIndexB;
        });
  }, [activeData, viewScope, lastExam]);

  // Calculate Recoverable Points (Approximate based on lost points derived from analysis)
  const recoverableInfo = useMemo(() => {
     // Total lost points from Topic Analysis (Wrong * 5.33 etc.)
     const totalLoss = (activeData.konu_analizi || []).reduce((sum, t) => sum + (t.lgs_kayip_puan || 0), 0);
     
     // Current Score Basis
     const current = viewScope === 'all' ? averageScore : (lastExam?.toplam_puan || 0);
     
     // Theoretical Max (capped at 500)
     const theoreticalMax = Math.min(500, current + totalLoss);
     
     return {
         loss: totalLoss,
         current,
         max: theoreticalMax
     };
  }, [activeData, averageScore, lastExam, viewScope]);

  return (
    <div className="w-full max-w-7xl mx-auto pb-12 animate-fade-in">
      
      {/* HEADER & SCOPE SELECTION */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 mb-8 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${viewScope === 'all' ? 'bg-indigo-100 text-indigo-600' : 'bg-brand-100 text-brand-600'}`}>
                {viewScope === 'all' ? <Layers className="w-8 h-8" /> : <User className="w-8 h-8" />}
            </div>
            <div>
                <h2 className="text-2xl font-bold text-slate-900">{activeData.ogrenci_bilgi?.ad_soyad || "Öğrenci"}</h2>
                <div className="flex gap-3 text-sm text-slate-500 mt-1">
                <span className="bg-slate-100 px-2 py-0.5 rounded">Şube: {activeData.ogrenci_bilgi?.sube || "-"}</span>
                <span className="bg-slate-100 px-2 py-0.5 rounded">No: {activeData.ogrenci_bilgi?.numara || "-"}</span>
                </div>
            </div>
            </div>
            
            <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                    <select 
                        value={viewScope}
                        onChange={(e) => setViewScope(e.target.value)}
                        className="w-full appearance-none bg-slate-50 border border-slate-300 text-slate-700 py-2.5 pl-4 pr-10 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer hover:border-brand-400 transition-colors"
                    >
                        <option value="all">📊 Tüm Denemeler (Genel)</option>
                        {allAnalyses
                            .sort((a,b) => (b.savedAt||0) - (a.savedAt||0))
                            .map(analysis => {
                                const examName = analysis.exams_history?.[0]?.sinav_adi || "Sınav";
                                const date = new Date(analysis.savedAt || 0).toLocaleDateString('tr-TR');
                                return <option key={analysis.id} value={analysis.id!}>{date} - {examName}</option>
                            })
                        }
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                        <ArrowUpDown className="h-4 w-4" />
                    </div>
                </div>
                {viewScope === 'all' && (
                    <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded">
                        {globalTrendData.length} Denemenin Ortalaması
                    </span>
                )}
            </div>
        </div>

        <div className="w-full h-px bg-slate-100"></div>

        <div className="flex flex-wrap gap-6 justify-between items-center text-sm md:text-base">
             <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Mevcut LGS Dilimi {viewScope === 'all' && '(Ort.)'}</p>
                <p className="text-3xl font-black text-brand-600">
                  {activeData.executive_summary?.lgs_tahmini_yuzdelik ? `%${activeData.executive_summary.lgs_tahmini_yuzdelik.toFixed(2)}` : '-'}
                </p>
             </div>
             <div className="hidden md:block w-px h-10 bg-slate-200"></div>
             <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                    {viewScope === 'all' ? 'Mevcut Ortalama Puan' : 'Bu Sınav Puanı'}
                </p>
                <p className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">
                    {currentScoreDisplay}
                </p>
             </div>
             <div className="ml-auto">
                 <button 
                    onClick={onReset}
                    className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    + Yeni Analiz Yükle
                  </button>
             </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 no-scrollbar">
        {[
          { id: 'ozet', label: 'Dedektif Raporu', icon: Search },
          { id: 'plan', label: 'Ders Bazlı Akıllı Strateji', icon: ListTodo },
          { id: 'konu', label: 'Konu Analizi', icon: BrainCircuit },
          { id: 'trend', label: 'İlerleme Geçmişi', icon: History },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap
              ${activeTab === tab.id 
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/30' 
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="space-y-6">
        
        {/* TAB 1: EXECUTIVE SUMMARY */}
        {activeTab === 'ozet' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
            <div className={`lg:col-span-2 text-white rounded-3xl p-8 relative overflow-hidden flex flex-col ${viewScope === 'all' ? 'bg-gradient-to-br from-indigo-900 to-slate-900' : 'bg-gradient-to-br from-brand-900 to-slate-900'}`}>
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                <h3 className="text-xl font-bold mb-6 flex items-center gap-3 relative z-10 border-b border-white/10 pb-4">
                    <Search className="text-brand-400 w-6 h-6" />
                    {viewScope === 'all' ? 'Genel Performans Analizi' : 'Sınav Detay Analizi'}
                </h3>
                <div className="relative z-10 text-slate-200">
                    <FormattedText text={activeData.executive_summary?.mevcut_durum} className="text-slate-200" />
                </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col">
                <div className="mb-6">
                    <div className="bg-amber-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                        <Target className="w-6 h-6 text-amber-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1">Gelecek Simülasyonu</h3>
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-bold">BU ADIMLARI UYGULARSAN</p>
                </div>
                
                {/* NEW: Potential Bars Section */}
                <div className="mb-6 bg-slate-50 border border-slate-100 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-2 uppercase tracking-wide">
                        <BarChart2 className="w-3 h-3" />
                        Ders Bazlı Gelişim Kapasitesi
                    </h4>
                    <div className="space-y-3">
                        {potentials.map((p, idx) => ( // Show all opportunities in fixed order
                            <div key={idx}>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="font-semibold text-slate-600">{p.label}</span>
                                    <span className="text-slate-500">
                                        <span className="font-medium text-slate-800">{p.current.toFixed(1)}</span> / <span className="font-bold">{p.limit} Net</span>
                                    </span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden flex">
                                     {/* Current Net */}
                                     <div className="h-full transition-all duration-500" style={{ width: `${p.percentage}%`, backgroundColor: p.color }}></div>
                                     {/* Potential (Gap) - Transparent color */}
                                     <div className="h-full relative transition-all duration-500" style={{ width: `${(p.gap / p.limit) * 100}%`, backgroundColor: `${p.color}33` }}> 
                                     </div>
                                </div>
                                <div className="text-[10px] text-right text-emerald-600 font-bold mt-0.5">
                                    +{p.gap.toFixed(1)} net kazanılabilir
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Score Comparison Section */}
                <div className="mb-6 bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-4">
                    
                    {/* Percentile Comparison */}
                    <div className="flex justify-between items-center border-b border-amber-200/50 pb-2">
                         <div className="text-center">
                            <div className="text-[10px] text-amber-800 font-bold uppercase">Şu An</div>
                            <div className="text-lg font-bold text-amber-900/60 line-through decoration-amber-500/50">
                                %{activeData.executive_summary?.lgs_tahmini_yuzdelik ? activeData.executive_summary.lgs_tahmini_yuzdelik.toFixed(2) : '-'}
                            </div>
                         </div>
                         <ArrowRight className="w-5 h-5 text-amber-500" />
                         <div className="text-center">
                             <div className="text-[10px] text-amber-800 font-bold uppercase">Hedef</div>
                             <div className="text-2xl font-black text-amber-600">
                                %{activeData.simulasyon?.hedef_yuzdelik}
                             </div>
                         </div>
                    </div>

                    {/* Score Comparison */}
                    <div className="flex justify-between items-center">
                         <div className="text-center">
                            <div className="text-[10px] text-amber-800 font-bold uppercase">Mevcut Puan</div>
                            <div className="text-lg font-bold text-amber-900/60 line-through decoration-amber-500/50">
                                {currentScoreDisplay}
                            </div>
                         </div>
                         <ArrowRight className="w-5 h-5 text-amber-500" />
                         <div className="text-center">
                             <div className="text-[10px] text-amber-800 font-bold uppercase">Maksimum Potansiyel</div>
                             <div className="text-xl font-black text-amber-600">
                                {recoverableInfo.max.toFixed(1)}
                             </div>
                             <div className="text-[9px] text-amber-600 font-bold bg-amber-100 px-2 py-0.5 rounded-full mt-1">
                                 +{recoverableInfo.loss.toFixed(1)} Kayıp Puan
                             </div>
                         </div>
                    </div>
                </div>

                {/* Structured Steps Section */}
                <div className="flex-grow flex flex-col gap-3 overflow-y-auto max-h-[400px] pr-2">
                    {activeData.simulasyon?.gelisim_adimlari?.map((step, idx) => {
                        const stepConfig = getSimulationStepConfig(step.baslik);
                        return (
                        <div key={idx} className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-sm hover:border-amber-200 transition-colors">
                             <div className="font-bold text-slate-800 mb-1 flex items-center gap-2">
                                 {/* Icon based on lesson */}
                                 <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 text-white" style={{ backgroundColor: stepConfig.color }}>
                                    <stepConfig.icon className="w-3 h-3" />
                                 </div>
                                 {step.baslik}
                             </div>
                             
                             <div className="space-y-2 mt-2 pl-7">
                                 <div className="flex gap-2 items-start">
                                     <Rocket className="w-3 h-3 text-brand-500 mt-1 shrink-0" />
                                     <p className="text-slate-600 leading-tight">
                                         <span className="font-semibold text-slate-700">Ne Yapmalı:</span> {step.ne_yapmali}
                                     </p>
                                 </div>
                                 <div className="flex gap-2 items-start">
                                     <Footprints className="w-3 h-3 text-amber-500 mt-1 shrink-0" />
                                     <p className="text-slate-600 leading-tight">
                                         <span className="font-semibold text-slate-700">Yöntem:</span> {step.nasil_yapmali}
                                     </p>
                                 </div>
                                 <div className="flex gap-2 items-center bg-white p-1.5 rounded border border-slate-100">
                                     <Clock className="w-3 h-3 text-emerald-500 shrink-0" />
                                     <span className="text-xs font-bold text-slate-500">{step.sure}</span>
                                     <span className="text-slate-300 mx-1">|</span>
                                     <span className="text-xs text-emerald-600 font-semibold">{step.ongoru}</span>
                                 </div>
                             </div>
                        </div>
                    )})}
                    {!activeData.simulasyon?.gelisim_adimlari && (
                        <p className="text-slate-500 italic text-sm p-2 text-center">
                            {activeData.simulasyon?.senaryo}
                        </p>
                    )}
                </div>
            </div>
          </div>
        )}

        {/* TAB 2: LESSON BASED STUDY PLAN */}
        {activeTab === 'plan' && (
            <div className="animate-fade-in-up">
                <div className="mb-6 p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <ClipboardCheck className="w-6 h-6 text-emerald-600" />
                        Ders ve Kazanım Odaklı Akıllı Çalışma Planı
                    </h3>
                    <p className="text-slate-500 mt-2 max-w-3xl">
                        {viewScope === 'all' 
                            ? 'Bu çalışma planı, tüm denemelerindeki ortak hataların ve kronik eksiklerin analiz edilerek oluşturulmuştur.' 
                            : 'Bu plan, sadece seçili denemedeki eksiklerin üzerine gitmen için hazırlanmıştır.'}
                    </p>
                </div>

                <div className="space-y-8">
                    {Object.values(LESSON_CONFIG).map((config) => {
                        let items = studyPlanByLesson[config.label];
                        
                        // IF no items are found for this lesson (perfect score or missing data), 
                        // CREATE a default "Maintenance" item so the lesson is always displayed.
                        if (!items || items.length === 0) {
                             items = [{
                                konu: "Tam Öğrenme / Rutin Kontrol",
                                sebep: "Bu derste belirgin bir konu eksiği bulunmamaktadır. Hedef: Formu korumak.",
                                tavsiye: `1. Haftalık branş denemesi çözerek hız kazan (Süre: 40 dk).\n2. MEB örnek sorularından geçmiş ayları tara (Süre: 30 dk).\n3. Yanlış yaptığın veya takıldığın eski soruları tekrar et (Süre: 20 dk).`,
                                oncelik: 3
                             }];
                        }

                        return (
                            <div key={config.label} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm ring-1 ring-slate-100">
                                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 rounded-xl text-white shadow-md transform rotate-3" style={{ backgroundColor: config.color }}>
                                            <config.icon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h4 className="text-2xl font-bold text-slate-900">{config.label}</h4>
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                                                <Target className="w-3 h-3" />
                                                {items[0].konu === "Tam Öğrenme / Rutin Kontrol" ? "Mevcut Durumu Koruma" : `${items.length} Kritik Kazanım Tespit Edildi`}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {items.map((item: any, idx: number) => (
                                        <div key={idx} className="p-6 md:p-8 hover:bg-slate-50/50 transition-colors grid grid-cols-1 md:grid-cols-12 gap-8">
                                            <div className="md:col-span-4 lg:col-span-4 flex flex-col">
                                                <div className="mb-3">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide mb-2 ${item.konu === "Tam Öğrenme / Rutin Kontrol" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                                                        {item.konu === "Tam Öğrenme / Rutin Kontrol" ? <Star className="w-3 h-3" /> : <BrainCircuit className="w-3 h-3" />}
                                                        {item.konu === "Tam Öğrenme / Rutin Kontrol" ? "Başarı Takibi" : "Kazanım / Konu"}
                                                    </span>
                                                    <h5 className="text-lg font-bold text-slate-900 leading-tight">
                                                        {item.konu}
                                                    </h5>
                                                </div>
                                                <div className={`rounded-2xl p-4 border mt-2 relative overflow-hidden group ${item.konu === "Tam Öğrenme / Rutin Kontrol" ? "bg-emerald-50 border-emerald-100" : "bg-amber-50 border-amber-100"}`}>
                                                    <div className={`absolute top-0 right-0 px-2 py-1 rounded-bl-lg text-[10px] font-bold uppercase ${item.konu === "Tam Öğrenme / Rutin Kontrol" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                                        {item.konu === "Tam Öğrenme / Rutin Kontrol" ? "Durum" : "Teşhis"}
                                                    </div>
                                                    <div className="flex items-start gap-3 relative z-10">
                                                        <div className="bg-white p-1.5 rounded-full shadow-sm shrink-0 mt-0.5">
                                                            <Stethoscope className={`w-4 h-4 ${item.konu === "Tam Öğrenme / Rutin Kontrol" ? "text-emerald-600" : "text-amber-600"}`} />
                                                        </div>
                                                        <div><p className={`text-sm font-medium leading-relaxed ${item.konu === "Tam Öğrenme / Rutin Kontrol" ? "text-emerald-900" : "text-amber-900"}`}>{item.sebep}</p></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="md:col-span-8 lg:col-span-8 relative">
                                                <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-100 -ml-4 hidden md:block"></div>
                                                <div className="flex items-center gap-2 mb-4">
                                                    <div className="bg-emerald-100 p-1.5 rounded-lg"><Pill className="w-5 h-5 text-emerald-700" /></div>
                                                    <h6 className="text-sm font-bold text-emerald-800 uppercase tracking-wide">Uygulanacak Adım Adım Reçete</h6>
                                                </div>
                                                <div className="bg-white rounded-xl text-slate-700 text-base leading-relaxed pl-1">
                                                    <FormattedText text={item.tavsiye} className="text-slate-700" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )}

        {/* TAB 3: TOPIC ANALYSIS */}
        {activeTab === 'konu' && (
            <div className="space-y-6 animate-fade-in-up">
                 
                 {/* Lesson Selector */}
                 <div className="flex flex-wrap gap-2 justify-between items-center">
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setSelectedLessonForTopic('Genel')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedLessonForTopic === 'Genel' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
                        >
                            Genel Bakış (Tümü)
                        </button>
                        {Object.values(LESSON_CONFIG).map((config) => (
                            <button
                                key={config.label}
                                onClick={() => setSelectedLessonForTopic(config.label)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all 
                                    ${selectedLessonForTopic === config.label 
                                        ? `bg-brand-50 text-brand-700 border border-brand-200 ring-2 ring-brand-100` 
                                        : 'bg-white text-slate-600 border border-slate-200'}`}
                            >
                                <config.icon className="w-4 h-4" style={{ color: selectedLessonForTopic === config.label ? config.color : undefined }} />
                                {config.label}
                            </button>
                        ))}
                    </div>
                 </div>

                 {/* SUMMARY CARDS - NEW 4 TIER SYSTEM */}
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex flex-col items-center text-center ring-2 ring-emerald-50">
                        <div className="bg-emerald-100 p-2 rounded-lg mb-2 text-emerald-600">
                             <Trophy className="w-5 h-5" />
                        </div>
                        <div className="text-2xl font-black text-emerald-600">{topicStats.excellent}</div>
                        <div className="text-[10px] text-emerald-600/80 font-bold uppercase mt-1">Mükemmel (%80+)</div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm flex flex-col items-center text-center">
                        <div className="bg-blue-100 p-2 rounded-lg mb-2 text-blue-600">
                             <ThumbsUp className="w-5 h-5" />
                        </div>
                        <div className="text-2xl font-black text-blue-600">{topicStats.good}</div>
                        <div className="text-[10px] text-blue-600/80 font-bold uppercase mt-1">İyi (%70-80)</div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm flex flex-col items-center text-center">
                        <div className="bg-amber-100 p-2 rounded-lg mb-2 text-amber-600">
                             <TrendingUp className="w-5 h-5" />
                        </div>
                        <div className="text-2xl font-black text-amber-600">{topicStats.improve}</div>
                        <div className="text-[10px] text-amber-600/80 font-bold uppercase mt-1">Geliştirilmeli (%50-70)</div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm flex flex-col items-center text-center">
                        <div className="bg-red-100 p-2 rounded-lg mb-2 text-red-600">
                             <AlertCircle className="w-5 h-5" />
                        </div>
                        <div className="text-2xl font-black text-red-600">{topicStats.critical}</div>
                        <div className="text-[10px] text-red-600/80 font-bold uppercase mt-1">Kritik (%50 Altı)</div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Performance Chart */}
                    <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <BrainCircuit className="w-5 h-5 text-purple-600" />
                                    {selectedLessonForTopic} Performansı {viewScope === 'all' && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded ml-2">Kümülatif</span>}
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    {selectedLessonForTopic === 'Genel' 
                                        ? 'En çok puan kaybedilen 15 kritik konu' 
                                        : `${selectedLessonForTopic} dersindeki tüm konuların analizi`}
                                </p>
                            </div>
                        </div>

                        <div className="h-[350px] w-full">
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={chartData} margin={{top: 20, right: 30, left: 20, bottom: 60}}>
                                        <CartesianGrid stroke="#f1f5f9" vertical={false} />
                                        <XAxis 
                                            dataKey="konu" 
                                            angle={-45} 
                                            textAnchor="end" 
                                            height={80} 
                                            interval={0}
                                            tick={{fill: '#64748b', fontSize: 10}} 
                                            tickFormatter={(value) => value.length > 20 ? `${value.substring(0, 20)}...` : value}
                                        />
                                        <YAxis 
                                            yAxisId="left" 
                                            orientation="left" 
                                            stroke={currentLessonTheme.color} 
                                            tick={{fill: currentLessonTheme.color, fontSize: 12}}
                                            label={{ value: 'Başarı %', angle: -90, position: 'insideLeft', fill: currentLessonTheme.color, fontSize: 12 }}
                                        />
                                        <YAxis 
                                            yAxisId="right" 
                                            orientation="right" 
                                            stroke="#ef4444" 
                                            tick={{fill: '#ef4444', fontSize: 12}}
                                            label={{ value: 'Kayıp Puan', angle: 90, position: 'insideRight', fill: '#ef4444', fontSize: 12 }}
                                        />
                                        <Tooltip content={<CustomTopicTooltip />} cursor={{fill: 'transparent'}} />
                                        
                                        <Bar 
                                            yAxisId="left" 
                                            dataKey="basari_yuzdesi" 
                                            fill={currentLessonTheme.fill} 
                                            stroke={currentLessonTheme.color} 
                                            barSize={30} 
                                            radius={[4, 4, 0, 0]} 
                                        />
                                        <Line yAxisId="right" type="monotone" dataKey="lgs_kayip_puan" stroke="#ef4444" strokeWidth={3} dot={{r: 4, fill: '#ef4444'}} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-400 flex-col gap-2">
                                    <AlertTriangle className="w-8 h-8 opacity-50" />
                                    <p>Bu ders için yeterli konu verisi bulunamadı.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Status Distribution Pie Chart */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col">
                         <h3 className="text-lg font-bold text-slate-800 mb-2">Başarı Durumu Dağılımı</h3>
                         <div className="flex-grow flex items-center justify-center min-h-[300px]">
                            {topicStats.total > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={topicStats.pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={90}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {topicStats.pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip 
                                            formatter={(value, name) => [`${value} Konu`, name]}
                                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                        />
                                        <Legend 
                                            verticalAlign="bottom" 
                                            height={70} 
                                            iconType="circle"
                                            layout="horizontal"
                                            wrapperStyle={{ fontSize: '11px', bottom: 0 }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="text-slate-400 text-sm">Veri yok</div>
                            )}
                         </div>
                    </div>
                 </div>

                 {/* Detailed Table */}
                 <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                         <div>
                            <h3 className="text-lg font-bold text-slate-800">Detaylı Konu Karnesi ({selectedLessonForTopic})</h3>
                            <p className="text-xs text-slate-500 mt-1">Renkli etiketler başarı durumunu gösterir.</p>
                         </div>
                         <span className="text-xs text-slate-500 italic">Sıralamak için başlıklara tıklayın</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                            <tr>
                                <th 
                                    className="px-6 py-4 w-1/4 cursor-pointer hover:bg-slate-100 transition-colors group"
                                    onClick={() => handleSort('konu')}
                                >
                                    <div className="flex items-center gap-2">
                                        Konu
                                        <RenderSortIcon columnKey="konu" />
                                    </div>
                                </th>
                                {selectedLessonForTopic === 'Genel' && (
                                    <th 
                                        className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                                        onClick={() => handleSort('ders')}
                                    >
                                        <div className="flex items-center gap-2">
                                            Ders
                                            <RenderSortIcon columnKey="ders" />
                                        </div>
                                    </th>
                                )}
                                <th 
                                    className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100 transition-colors group"
                                    onClick={() => handleSort('soru_dagilimi')}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        {viewScope === 'all' ? 'Top. Soru (D/Y/B)' : 'Soru (D/Y/B)'}
                                        <RenderSortIcon columnKey="soru_dagilimi" />
                                    </div>
                                </th>
                                <th 
                                    className="px-6 py-4 w-1/4 cursor-pointer hover:bg-slate-100 transition-colors group"
                                    onClick={() => handleSort('basari_yuzdesi')}
                                >
                                    <div className="flex items-center gap-2">
                                        Başarı Yüzdesi
                                        <RenderSortIcon columnKey="basari_yuzdesi" />
                                    </div>
                                </th>
                                <th 
                                    className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100 transition-colors group"
                                    onClick={() => handleSort('lgs_kayip_puan')}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        LGS Kayıp
                                        <RenderSortIcon columnKey="lgs_kayip_puan" />
                                    </div>
                                </th>
                                <th 
                                    className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100 transition-colors group"
                                    onClick={() => handleSort('durum')}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        Durum
                                        <RenderSortIcon columnKey="durum" />
                                    </div>
                                </th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                            {sortedTopics.map((konu, idx) => (
                                <tr key={idx} className={`hover:bg-slate-50 transition-colors ${konu.durum === 'Kritik' ? 'bg-red-50/30' : ''}`}>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-700">{konu.konu}</div>
                                    </td>
                                    {selectedLessonForTopic === 'Genel' && (
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-medium px-2 py-1 rounded bg-slate-100 text-slate-600">
                                                {konu.ders}
                                            </span>
                                        </td>
                                    )}
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-2 text-sm">
                                            <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">{konu.dogru} D</span>
                                            <span className="text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded">{konu.yanlis} Y</span>
                                            <span className="text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded">{konu.bos} B</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-middle">
                                        <div className="w-full bg-slate-100 rounded-full h-2.5 mb-1 overflow-hidden">
                                            <div 
                                                className={`h-2.5 rounded-full ${
                                                    konu.basari_yuzdesi >= 80 ? 'bg-emerald-500' :
                                                    konu.basari_yuzdesi >= 70 ? 'bg-blue-500' :
                                                    konu.basari_yuzdesi >= 50 ? 'bg-amber-400' : 'bg-red-500'
                                                }`} 
                                                style={{ width: `${konu.basari_yuzdesi}%` }}
                                            ></div>
                                        </div>
                                        <div className="text-xs text-slate-500 font-medium text-right">
                                            %{konu.basari_yuzdesi?.toFixed(1) || 0}
                                        </div>
                                    </td>
                                    <td className={`px-6 py-4 text-center ${sortConfig.key === 'lgs_kayip_puan' ? 'bg-slate-100/50' : ''}`}>
                                        <span className={`text-base font-bold ${konu.lgs_kayip_puan > 0.5 ? 'text-red-600' : 'text-slate-600'}`}>
                                            -{konu.lgs_kayip_puan}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {konu.durum === 'Mükemmel' && (
                                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md text-xs font-bold whitespace-nowrap">
                                                <Trophy className="w-3 h-3" /> MÜKEMMEL
                                            </span>
                                        )}
                                        {konu.durum === 'İyi' && (
                                            <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-100 px-2 py-1 rounded-md text-xs font-bold whitespace-nowrap">
                                                <ThumbsUp className="w-3 h-3" /> İYİ
                                            </span>
                                        )}
                                        {konu.durum === 'Geliştirilmeli' && (
                                            <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-100 px-2 py-1 rounded-md text-xs font-bold whitespace-nowrap">
                                                <TrendingUp className="w-3 h-3" /> GELİŞTİRİLMELİ
                                            </span>
                                        )}
                                        {konu.durum === 'Kritik' && (
                                            <span className="inline-flex items-center gap-1 text-red-700 bg-red-100 px-2 py-1 rounded-md text-xs font-bold whitespace-nowrap">
                                                <AlertTriangle className="w-3 h-3" /> KRİTİK
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                     </div>
                </div>
            </div>
        )}

        {/* TAB 4: TRENDS (Completely Redesigned) */}
        {activeTab === 'trend' && (
            <div className="animate-fade-in-up space-y-6">

               {/* Trend Sub-Navigation */}
               <div className="flex flex-wrap items-center justify-between gap-4 p-1 bg-slate-100 rounded-xl w-full md:w-fit">
                  <button 
                    onClick={() => setTrendSubTab('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${trendSubTab === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <Activity className="w-4 h-4" /> Tüm Gelişim
                  </button>
                  <button 
                    onClick={() => setTrendSubTab('last3')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${trendSubTab === 'last3' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <TrendingUp className="w-4 h-4" /> Son 3 Sınav Analizi
                  </button>
                  <button 
                    onClick={() => setTrendSubTab('individual')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${trendSubTab === 'individual' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <LayoutGrid className="w-4 h-4" /> Sınav Karneleri (Tek Tek)
                  </button>
               </div>

               {/* SUB-VIEW 1: ALL TIME TRENDS */}
               {trendSubTab === 'all' && (
                 <div className="space-y-6">
                     <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setSelectedTrendLesson('Tümü')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedTrendLesson === 'Tümü' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
                        >
                            Tüm Dersler
                        </button>
                        {Object.values(LESSON_CONFIG).map((config) => (
                            <button
                                key={config.label}
                                onClick={() => setSelectedTrendLesson(config.label)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all 
                                    ${selectedTrendLesson === config.label 
                                        ? `bg-brand-50 text-brand-700 border border-brand-200 ring-2 ring-brand-100` 
                                        : 'bg-white text-slate-600 border border-slate-200'}`}
                            >
                                <config.icon className="w-4 h-4" style={{ color: selectedTrendLesson === config.label ? config.color : undefined }} />
                                {config.label}
                            </button>
                        ))}
                    </div>

                    <div className={`grid gap-6 ${selectedTrendLesson === 'Tümü' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                        {displayedTrendLessons.map(([lessonKey, config]) => (
                            <div key={lessonKey} className={`bg-white p-6 rounded-3xl shadow-sm border border-slate-200 ${selectedTrendLesson !== 'Tümü' ? 'min-h-[400px]' : ''}`}>
                                <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                                    <config.icon className="w-5 h-5" style={{ color: config.color }} />
                                    {config.label} Gelişimi
                                </h3>
                                <div className={`${selectedTrendLesson !== 'Tümü' ? 'h-[350px]' : 'h-[250px]'} w-full`}>
                                    {globalTrendData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={globalTrendData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} dy={10} interval="preserveStartEnd" />
                                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} domain={[0, 'auto']} width={30} />
                                            <Tooltip 
                                                contentStyle={{backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                                formatter={(value: any) => [`${value} Net`, 'Net']}
                                                labelStyle={{color: '#64748b', marginBottom: '0.25rem'}}
                                            />
                                            {/* Highlight if viewScope matches the analysis ID (parent) of this data point */}
                                            {viewScope !== 'all' && (
                                                <ReferenceLine x={activeData.exams_history?.[0]?.sinav_adi?.substring(0, 15) + '...'} stroke="red" strokeDasharray="3 3" />
                                            )}
                                            <Line 
                                                type="monotone" 
                                                dataKey={lessonKey} 
                                                stroke={config.color} 
                                                strokeWidth={3}
                                                dot={{r: 4, fill: config.color}}
                                                activeDot={{r: 6, strokeWidth: 0}}
                                                connectNulls={true} 
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                    ) : <div className="h-full flex items-center justify-center text-slate-400">Veri yok.</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                 </div>
               )}

               {/* SUB-VIEW 2: LAST 3 EXAMS */}
               {trendSubTab === 'last3' && (
                   <div className="space-y-6">
                       <div className="bg-gradient-to-r from-brand-600 to-indigo-700 text-white p-6 rounded-3xl mb-6">
                           <h3 className="text-xl font-bold mb-2">Son 3 Deneme Performans Özeti</h3>
                           <p className="text-brand-100">Son 3 sınavındaki net değişimlerini analiz ederek anlık durumunu tespit ettik.</p>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                           {Object.values(LESSON_CONFIG).map((config) => {
                               const last3Data = globalTrendData.slice(-3);
                               if (last3Data.length === 0) return null;

                               return (
                                   <div key={config.label} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                                       <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 rounded-lg bg-slate-50 text-slate-600">
                                                    <config.icon className="w-5 h-5" style={{ color: config.color }} />
                                                </div>
                                                <span className="font-bold text-slate-700">{config.label}</span>
                                            </div>
                                            {getTrendIcon(last3Data, config.label)}
                                       </div>
                                       
                                       <div className="h-[150px] w-full mt-4">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={last3Data}>
                                                    <XAxis dataKey="date" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                                                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px'}} />
                                                    <Bar dataKey={config.label} fill={config.color} radius={[4, 4, 0, 0]} barSize={40}>
                                                        <Cell key={`cell-${0}`} fillOpacity={0.4} />
                                                        <Cell key={`cell-${1}`} fillOpacity={0.6} />
                                                        <Cell key={`cell-${2}`} fillOpacity={1} />
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                       </div>
                                   </div>
                               )
                           })}
                       </div>
                   </div>
               )}

               {/* SUB-VIEW 3: INDIVIDUAL CARDS (Updated for interactivity) */}
               {trendSubTab === 'individual' && (
                   <div className="grid grid-cols-1 gap-6">
                       {[...globalTrendData].reverse().map((exam, idx) => (
                           <div 
                                key={idx} 
                                className={`bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col md:flex-row gap-8 items-center transition-all hover:border-brand-300 hover:shadow-md cursor-pointer ${viewScope === exam.id ? 'ring-2 ring-brand-500' : ''}`}
                                onClick={() => setViewScope(exam.id)} // Click to focus this exam set context
                           >
                               {/* Exam Info */}
                               <div className="w-full md:w-1/4 flex flex-col gap-2 border-b md:border-b-0 md:border-r border-slate-100 pb-4 md:pb-0 md:pr-4">
                                   <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-lg text-slate-800 line-clamp-2">{exam.name}</h4>
                                        {viewScope === exam.id && <span className="bg-brand-100 text-brand-700 text-xs px-2 py-0.5 rounded-full font-bold">Seçili</span>}
                                   </div>
                                   <div className="flex items-center gap-2 text-slate-500 text-sm">
                                       <Calendar className="w-4 h-4" />
                                       {exam.date}
                                   </div>
                                   <div className="mt-2 bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                                       <span className="block text-xs text-slate-400 font-bold uppercase">Toplam Puan</span>
                                       <span className="text-2xl font-black text-brand-600">{exam.totalScore}</span>
                                   </div>
                                   <div className="text-xs text-slate-400 mt-2 flex items-center gap-1 justify-center md:justify-start">
                                       <LayoutGrid className="w-3 h-3" />
                                       Detaylı analiz için tıklayın
                                   </div>
                               </div>

                               {/* Mini Bar Chart for Exam Nets */}
                               <div className="w-full md:w-3/4 h-[180px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart 
                                            data={Object.values(LESSON_CONFIG).map(conf => ({ name: conf.label, net: exam[conf.label], color: conf.color }))}
                                            layout="horizontal"
                                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="name" tick={{fontSize: 11}} axisLine={false} tickLine={false} interval={0} />
                                            <YAxis hide />
                                            <Tooltip cursor={{fill: 'transparent'}} formatter={(val) => [`${val} Net`, '']} />
                                            <Bar dataKey="net" radius={[4, 4, 0, 0]}>
                                                {Object.values(LESSON_CONFIG).map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                               </div>
                           </div>
                       ))}
                   </div>
               )}

            </div>
        )}

      </div>
    </div>
  );
};

export default AnalysisDashboard;