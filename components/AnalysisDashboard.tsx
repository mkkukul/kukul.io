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
  Download, Loader2, MessageCircle, Send, Bot
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

// Helper to safely render text with HTML spans (for colors) and Markdown-like bold
const SafeHtmlText = ({ content }: { content: string }) => {
    if (!content) return null;
    // 1. Split by **bold**
    const parts = content.split(/(\*\*.*?\*\*)/g);
    
    return (
        <span>
            {parts.map((part, index) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    // Remove asterisks and check for HTML
                    const inner = part.slice(2, -2);
                     return <strong key={index} className="font-bold text-inherit" dangerouslySetInnerHTML={{ __html: inner }} />;
                }
                // Render regular text, allowing HTML spans to work
                return <span key={index} dangerouslySetInnerHTML={{ __html: part }} />;
            })}
        </span>
    );
};

const FormattedText: React.FC<{ text: string, className?: string, textColor?: string }> = ({ text, className = "", textColor }) => {
  if (!text) return null;

  // Use passed textColor or default to slate-700/300 if not provided
  // When textColor="text-white" is passed, it forces white text even for regular paragraphs
  const colorClass = textColor || "text-slate-700 dark:text-slate-300";

  return (
    <div className={`space-y-4 ${className}`}>
      {text.split('\n').map((line, i) => {
        const trimmed = line.trim();
        
        // Headers
        if (trimmed.startsWith('###')) {
          return (
            <h3 key={i} className={`text-xl font-bold mt-6 mb-3 border-b border-white/20 pb-2 flex items-center gap-2 ${textColor || 'text-brand-700 dark:text-brand-400'}`}>
              <SafeHtmlText content={trimmed.replace(/###/g, '').trim()} />
            </h3>
          );
        }
        
        // List items
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
        
        // Numbered lists (likely the 4-5 key points)
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
        
        // Empty lines
        if (!trimmed) return <div key={i} className="h-2"></div>;
        
        // Regular paragraphs - Added mb-4 to ensure clear separation between lesson paragraphs
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

    // Use the latest analysis as the "base" for metadata, info, and latest comments
    // Filter out invalid entries first
    const validAnalyses = analyses.filter(a => a && a.savedAt);
    if (validAnalyses.length === 0) return analyses[0];

    const latest = validAnalyses.reduce((prev, current) => (prev.savedAt || 0) > (current.savedAt || 0) ? prev : current);
    
    // Aggregate Topic Analysis
    const topicMap = new Map<string, TopicAnalysis>();
    
    // Calculate Average LGS Percentile
    const validPercentiles = validAnalyses
        .map(a => a.executive_summary?.lgs_tahmini_yuzdelik)
        .filter(p => typeof p === 'number' && !isNaN(p));
    
    const avgPercentile = validPercentiles.length > 0
        ? validPercentiles.reduce((a, b) => a + b, 0) / validPercentiles.length
        : latest.executive_summary?.lgs_tahmini_yuzdelik || 0;

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
  const [activeTab, setActiveTab] = useState<'ozet' | 'trend' | 'plan' | 'konu' | 'koc'>('ozet');
  
  // Trend Specific States
  const [trendSubTab, setTrendSubTab] = useState<'all' | 'last3' | 'individual'>('all');
  const [selectedLessonForTopic, setSelectedLessonForTopic] = useState<string>('Genel');
  const [selectedTrendLesson, setSelectedTrendLesson] = useState<string>('Tümü');
  
  // VIEW SCOPE: 'all' (Aggregate) or specific analysis ID
  const [viewScope, setViewScope] = useState<string>('all');
  
  // PDF Download State
  const [isDownloading, setIsDownloading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sorting State - Defaults to LGS Kayıp Puan Descending
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'lgs_kayip_puan',
    direction: 'desc'
  });

  // Combine current data and history into a unique list
  const allAnalyses = useMemo(() => {
    // Filter out nulls just in case
    const list = [data, ...history].filter(Boolean);
    return list.filter((v,i,a)=>a.findIndex(t=>(t.id===v.id))===i);
  }, [data, history]);

  // Determine ACTIVE DATA based on Scope
  const activeData = useMemo(() => {
      if (!allAnalyses || allAnalyses.length === 0) return data;
      
      if (viewScope === 'all') {
          return aggregateAnalyses(allAnalyses);
      }
      return allAnalyses.find(a => a.id === viewScope) || data;
  }, [viewScope, allAnalyses, data]);

  // Reset sorting when scope changes or tab changes to ensure "LGS Loss" focus
  useEffect(() => {
    setSortConfig({ key: 'lgs_kayip_puan', direction: 'desc' });
  }, [viewScope, activeTab]);

  // Initialize Chat History
  useEffect(() => {
    if (activeData) {
      const studentName = activeData.ogrenci_bilgi?.ad_soyad?.split(' ')[0] || "Öğrenci";
      // Reset chat when scope/data changes
      setChatHistory([{
        role: 'model',
        text: `Merhaba ${studentName}! 🚀 Analiz raporunu inceledim. Sonuçların hakkında konuşmak veya çalışma planı yapmak için buradayım. Nereden başlayalım?`
      }]);
    }
  }, [activeData.id]);

  // Scroll to bottom of chat
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

  // --- PDF DOWNLOAD HANDLER ---
  const downloadPDF = async () => {
    if (!contentRef.current) return;
    
    setIsDownloading(true);
    
    try {
        const element = contentRef.current;
        
        // Use html2canvas to capture the element
        const canvas = await html2canvas(element, {
            scale: 2, // High resolution
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff' // Force white background for PDF
        });
        
        const imgData = canvas.toDataURL('image/png');
        
        // Calculate dimensions to fit in a PDF (Custom Height logic to avoid splitting charts)
        // We use A4 width (210mm) as base, but height will be dynamic
        const imgWidth = 210; 
        const pageHeight = 295; 
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        // Determine PDF format: if content is long, make a long page, otherwise A4
        const pdf = new jsPDF('p', 'mm', [imgWidth, Math.max(imgHeight, pageHeight)]);
        
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        
        const fileName = `${activeData.ogrenci_bilgi?.ad_soyad || 'analiz'}_rapor.pdf`.replace(/\s+/g, '_');
        pdf.save(fileName);
        
    } catch (error) {
        console.error("PDF oluşturma hatası:", error);
        alert("PDF oluşturulurken bir hata oluştu.");
    } finally {
        setIsDownloading(false);
    }
  };

  // --- DATA PREPARATION (Using activeData) ---

  // 1. Chart Data from GLOBAL HISTORY (Used for Trends) - WITH STRICT DEDUPLICATION
  const globalTrendData = useMemo(() => {
      const uniqueExamsMap = new Map<string, any>();
      
      // Sort analyses by saved date (newest first)
      const sortedAnalyses = [...allAnalyses].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));

      sortedAnalyses.forEach(analysis => {
          (analysis.exams_history || []).forEach((exam, index) => {
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
                    id: analysis.id, // Keep reference to parent analysis
                    uniqueId: uniqueKey, // Unique key for lists
                    totalScore: Number(exam.toplam_puan),
                    originalExam: exam
                  };

                  // Initialize all known lessons to 0
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
      
      return Array.from(uniqueExamsMap.values())
        .sort((a: any, b: any) => a.fullDate - b.fullDate);
  }, [allAnalyses]);

  // --- CRITICAL: PRECISE AVERAGE SCORE CALCULATION ---
  const averageScore = useMemo(() => {
    // 1. Filter exams with valid scores
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

  // --- NEW: AVERAGE NET CALCULATION ---
  const averageNet = useMemo(() => {
    const validExams = globalTrendData.filter(e => {
        const score = Number(e.totalScore);
        return typeof score === 'number' && !isNaN(score) && isFinite(score) && score > 0;
    });
    
    if (validExams.length === 0) return 0;
    
    const total = validExams.reduce((sum, exam) => sum + Number(exam.totalNet || 0), 0);
    return total / validExams.length;
  }, [globalTrendData]);

  // 2. Prepare Topic Data (from ACTIVE DATA)
  const allTopics = activeData.konu_analizi || [];
  
  // Calculate Status dynamically to ensure data consistency
  const processedTopics = useMemo(() => {
      return allTopics.map(topic => ({
          ...topic,
          // Force overwrite durum based on percentage if needed, or trust AI if it matches schema
          durum: getStatusByPercentage(topic.basari_yuzdesi || 0)
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

  // --- NEW: Identify Top 5 Critical Weaknesses (More than 1 wrong answer) ---
  const criticalWeaknesses = useMemo(() => {
    return (activeData.konu_analizi || [])
        .filter(t => (t.yanlis || 0) > 1) // Must have at least 2 wrong answers to be critical
        .sort((a, b) => (b.yanlis || 0) - (a.yanlis || 0)) // Sort descending by wrong count
        .slice(0, 5); // Take top 5
  }, [activeData]);

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
        return multiplier * ((a.yanlis || 0) - (b.yanlis || 0));
    }
    
    // Custom sort for the new "Net Kaybı" column
    if (key === 'net_kaybi') {
        const valA = (a.yanlis || 0) / 3;
        const valB = (b.yanlis || 0) / 3;
        return multiplier * (valA - valB);
    }
    
    // Default numeric sort with safety check
    const valA = Number(a[key as keyof typeof a]) || 0;
    const valB = Number(b[key as keyof typeof b]) || 0;
    return multiplier * (valA - valB);
  });

  const chartData = selectedLessonForTopic === 'Genel'
    ? [...processedTopics].sort((a, b) => (b.lgs_kayip_puan || 0) - (a.lgs_kayip_puan || 0)).slice(0, 15)
    : sortedTopics;

  const handleSort = (key: string) => {
    setSortConfig(current => ({
        key,
        direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const RenderSortIcon = ({ columnKey }: { columnKey: string }) => {
      if (sortConfig.key !== columnKey) return <ArrowUpDown className="w-4 h-4 text-slate-300 dark:text-slate-600 opacity-50 group-hover:opacity-100" />;
      return sortConfig.direction === 'asc' 
        ? <ArrowUp className="w-4 h-4 text-brand-600 dark:text-brand-400" /> 
        : <ArrowDown className="w-4 h-4 text-brand-600 dark:text-brand-400" />;
  };

  const studyPlanByLesson: Record<string, any[]> = {};
  (activeData.calisma_plani || []).forEach(item => {
      const config = getLessonConfig(item.ders);
      const key = config.label;
      if (!studyPlanByLesson[key]) studyPlanByLesson[key] = [];
      studyPlanByLesson[key].push(item);
  });

  // ROBUST LAST EXAM SELECTION
  const lastExam = useMemo(() => {
    if (!activeData.exams_history || activeData.exams_history.length === 0) return null;
    
    // Filter exams with valid scores
    const validExams = activeData.exams_history.filter(e => e && e.toplam_puan > 0);
    
    // Return the last valid exam, or the last one if none are valid (fallback)
    return validExams.length > 0 
        ? validExams[validExams.length - 1] 
        : activeData.exams_history[activeData.exams_history.length - 1];
  }, [activeData]);

  const lastExamNet = useMemo(() => {
    if (!lastExam) return 0;
    return (lastExam.ders_netleri || []).reduce((sum, d) => sum + (d.net || 0), 0);
  }, [lastExam]);
    
  // Scores for display - UPDATED with formatLGSScore logic
  const currentScoreDisplay = useMemo(() => {
    if (viewScope === 'all') {
        return averageScore > 0 ? formatLGSScore(averageScore) : "-";
    } else {
        return lastExam?.toplam_puan ? formatLGSScore(lastExam.toplam_puan) : "-";
    }
  }, [viewScope, averageScore, lastExam]);

  const currentNetDisplay = useMemo(() => {
      if (viewScope === 'all') {
          return averageNet > 0 ? averageNet.toFixed(2) : "-";
      } else {
          return lastExamNet ? lastExamNet.toFixed(2) : "-";
      }
  }, [viewScope, averageNet, lastExamNet]);

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
      if (!data || data.length < 2) return null;
      const last = data[data.length - 1][key] || 0;
      const prev = data[data.length - 2][key] || 0;
      const diff = last - prev;
      
      if (diff > 0.5) return <span className="flex items-center text-emerald-600 dark:text-emerald-400 font-bold text-xs gap-1 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded"><ArrowUp className="w-3 h-3" /> +{diff.toFixed(1)}</span>;
      if (diff < -0.5) return <span className="flex items-center text-red-600 dark:text-red-400 font-bold text-xs gap-1 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded"><ArrowDown className="w-3 h-3" /> {diff.toFixed(1)}</span>;
      return <span className="text-slate-400 dark:text-slate-500 font-bold text-xs bg-slate-50 dark:bg-slate-700 px-2 py-1 rounded flex items-center gap-1"><ArrowRight className="w-3 h-3" /> Stabil</span>;
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
    <div ref={contentRef} className="w-full max-w-7xl mx-auto pb-12 animate-fade-in">
      
      {/* HEADER & SCOPE SELECTION */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 mb-8 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${viewScope === 'all' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'}`}>
                {viewScope === 'all' ? <Layers className="w-8 h-8" /> : <User className="w-8 h-8" />}
            </div>
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{activeData.ogrenci_bilgi?.ad_soyad || "Öğrenci"}</h2>
                <div className="flex gap-3 text-sm text-slate-500 dark:text-slate-400 mt-1">
                <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">Şube: {activeData.ogrenci_bilgi?.sube || "-"}</span>
                <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">No: {activeData.ogrenci_bilgi?.numara || "-"}</span>
                </div>
            </div>
            </div>
            
            <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                    <select 
                        value={viewScope}
                        onChange={(e) => setViewScope(e.target.value)}
                        className="w-full appearance-none bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 py-2.5 pl-4 pr-10 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer hover:border-brand-400 dark:hover:border-brand-500 transition-colors"
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
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 dark:text-slate-400">
                        <ArrowUpDown className="h-4 w-4" />
                    </div>
                </div>
                {viewScope === 'all' && (
                    <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded">
                        {globalTrendData.length} Denemenin Ortalaması
                    </span>
                )}
            </div>
        </div>

        <div className="w-full h-px bg-slate-100 dark:bg-slate-700"></div>

        <div className="flex flex-wrap gap-6 justify-between items-center text-sm md:text-base">
             <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Mevcut LGS Dilimi {viewScope === 'all' && '(Ort.)'}</p>
                <p className="text-3xl font-black text-brand-600 dark:text-brand-400">
                  {activeData.executive_summary?.lgs_tahmini_yuzdelik ? `%${activeData.executive_summary.lgs_tahmini_yuzdelik.toFixed(2)}` : '-'}
                </p>
             </div>
             <div className="hidden md:block w-px h-10 bg-slate-200 dark:bg-slate-700"></div>
             <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                    {viewScope === 'all' ? 'Mevcut Ortalama Puan' : 'Bu Sınav Puanı'}
                </p>
                <p className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
                    {currentScoreDisplay}
                </p>
             </div>
             <div className="hidden md:block w-px h-10 bg-slate-200 dark:bg-slate-700"></div>
             <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                    {viewScope === 'all' ? 'Mevcut Ortalama Net' : 'Bu Sınav Neti'}
                </p>
                <p className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
                    {currentNetDisplay}
                </p>
             </div>
             <div className="ml-auto flex items-center gap-2">
                 <button 
                    onClick={downloadPDF}
                    disabled={isDownloading}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    PDF İndir
                  </button>
                 <button 
                    onClick={onReset}
                    className="px-4 py-2 text-sm font-medium text-white bg-brand-600 dark:bg-brand-500 rounded-lg hover:bg-brand-700 dark:hover:bg-brand-600 transition-colors shadow-sm"
                  >
                    + Yeni Analiz Yükle
                  </button>
             </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 no-scrollbar" data-html2canvas-ignore>
        {[
          { id: 'ozet', label: 'Stratejik Performans', icon: Search },
          { id: 'koc', label: 'Kukul AI Koç', icon: MessageCircle },
          { id: 'plan', label: 'Ders Bazlı Akıllı Strateji', icon: ListTodo },
          { id: 'konu', label: 'Konu Analizi', icon: BrainCircuit },
          { id: 'trend', label: 'İlerleme Geçmişi', icon: History },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap
              ${activeTab === tab.id 
                ? 'bg-brand-600 dark:bg-brand-500 text-white shadow-lg shadow-brand-500/30' 
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'}`}
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
          <div className="animate-fade-in-up">
            
            {/* NEW: CRITICAL WEAKNESSES ALERT SECTION */}
            {criticalWeaknesses.length > 0 && (
                <div className="mb-6 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-3xl p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-red-100 dark:bg-red-900/40 p-2 rounded-xl text-red-600 dark:text-red-400 animate-pulse">
                            <Siren className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-red-900 dark:text-red-200">
                                ACİL MÜDAHALE LİSTESİ (TOP {criticalWeaknesses.length})
                            </h3>
                            <p className="text-sm text-red-700 dark:text-red-300/80">
                                Bu konularda ciddi kayıplar var (1'den fazla yanlış). Çözüm önerisi için karta tıkla.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        {criticalWeaknesses.map((topic, idx) => {
                            const conf = getLessonConfig(topic.ders);
                            return (
                                <div 
                                    key={idx}
                                    onClick={() => setActiveTab('plan')}
                                    className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-red-100 dark:border-red-900/30 hover:border-red-300 dark:hover:border-red-600 hover:shadow-md cursor-pointer transition-all group flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: conf.color }}></div>
                                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">{conf.label}</span>
                                        </div>
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight mb-3 line-clamp-2">
                                            {topic.konu}
                                        </h4>
                                    </div>
                                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-3 mt-1">
                                        <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-black text-lg">
                                            <AlertCircle className="w-4 h-4" />
                                            {topic.yanlis} Y
                                        </div>
                                        <div className="text-xs text-brand-600 dark:text-brand-400 font-medium group-hover:underline flex items-center gap-0.5">
                                            Çözüm <ArrowRight className="w-3 h-3" />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="space-y-6">
                 
                 {/* --- STRATEJİK PERFORMANS ANALİZİ (YENİ KAPSAYICI) --- */}
                 <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl">
                            <Search className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                                STRATEJİK PERFORMANS ANALİZİ
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                                Yapay zeka destekli detaylı durum tespiti ve gelişim önerileri
                            </p>
                        </div>
                    </div>

                    {/* --- KARTLAR (GRID LAYOUT) --- */}
                    <div className="relative z-10 mt-4">
                        {(() => {
                            // Prompt'tan gelen HTML etiketlerini parçalayan Fonksiyon
                            const parseLessonCards = (text: string) => {
                                if (!text) return [];
                                // -500 ve -300 renk kodlarının ikisini de yakalar, hata payını sıfırlar
                                const regex = /<span class='.*?text-(.*?)-(?:500|300).*?'>(.*?)<\/span>/gi; 
                                const matches = Array.from(text.matchAll(regex));
                                
                                if (matches.length === 0) return [{ type: 'intro', lesson: 'Genel Bakış', content: text }];
                                
                                const cards = [];
                                // Giriş kısmı varsa al
                                if (matches[0].index! > 0) {
                                    const introContent = text.substring(0, matches[0].index).trim();
                                    if (introContent) cards.push({ type: 'intro', lesson: 'Genel Özet', content: introContent });
                                }
                                // Dersleri al
                                for (let i = 0; i < matches.length; i++) {
                                    const match = matches[i];
                                    const lessonName = match[2];
                                    const startOfContent = match.index! + match[0].length;
                                    const endOfContent = (i < matches.length - 1) ? matches[i+1].index : text.length;
                                    const content = text.substring(startOfContent, endOfContent).trim();
                                    cards.push({ type: 'lesson', lesson: lessonName, content });
                                }
                                return cards;
                            };

                            const reportCards = parseLessonCards(activeData.executive_summary?.mevcut_durum || "");

                            return (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
                                    {reportCards.map((card, idx) => {
                                        const isIntro = card.type === 'intro';
                                        const config = getLessonConfig(card.lesson || "Genel");
                                        const Icon = isIntro ? Search : config.icon;
                                        
                                        // Ana Renk (Videodaki gibi canlı renkler)
                                        const baseColor = isIntro ? "#6366f1" : config.color;

                                        return (
                                            <div 
                                                key={idx} 
                                                className={`
                                                    relative group
                                                    rounded-[2.5rem] p-8 
                                                    transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]
                                                    border border-slate-100 dark:border-slate-700
                                                    overflow-hidden hover:z-10 hover:shadow-2xl hover:-translate-y-2
                                                    ${isIntro ? 'col-span-1 md:col-span-2 lg:col-span-3 text-white' : 'bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur-sm'}
                                                `}
                                                style={{ 
                                                    // Giriş kartı mor gradient, diğerleri cam efekti
                                                    background: isIntro 
                                                        ? 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)' 
                                                        : undefined,
                                                    // Hover yapınca kart yukarı kalkar ve gölgesi büyür
                                                    boxShadow: isIntro ? '0 10px 30px -10px #4f46e550' : `0 10px 30px -10px ${baseColor}15`,
                                                    animation: `fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.1}s backwards`
                                                }}
                                            >
                                                {/* AMBIENT GLOW EFEKTİ (Arkaplanda yüzen renk topu) */}
                                                {!isIntro && (
                                                    <div 
                                                        className="absolute -right-16 -top-16 w-48 h-48 rounded-full blur-[60px] opacity-20 group-hover:opacity-40 transition-opacity duration-700 pointer-events-none"
                                                        style={{ backgroundColor: baseColor }}
                                                    />
                                                )}

                                                {/* İKON VE BAŞLIK */}
                                                <div className="relative z-10 flex items-center gap-5 mb-6">
                                                    <div 
                                                        className={`
                                                            w-16 h-16 rounded-[1.2rem] flex items-center justify-center shadow-lg
                                                            transform group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500
                                                        `}
                                                        style={{ 
                                                            backgroundColor: isIntro ? 'rgba(255,255,255,0.2)' : 'white',
                                                            color: isIntro ? 'white' : baseColor,
                                                            boxShadow: `0 8px 20px -5px ${baseColor}30`
                                                        }}
                                                    >
                                                        <Icon className="w-8 h-8" />
                                                    </div>
                                                    <div>
                                                        <h3 
                                                            className="text-2xl font-black tracking-tight"
                                                            style={{ color: isIntro ? 'white' : baseColor }}
                                                        >
                                                            {card.lesson}
                                                        </h3>
                                                        {!isIntro && (
                                                            <div className="flex items-center gap-2 mt-1.5 opacity-60">
                                                                <span className="w-2 h-2 rounded-full animate-pulse" style={{backgroundColor: baseColor}}></span>
                                                                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                                                    Performans
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* İÇERİK (MADDELER) */}
                                                <div className="relative z-10 text-[15px] font-medium leading-relaxed custom-scrollbar max-h-[400px] overflow-y-auto pr-2">
                                                    <div className={`whitespace-pre-line space-y-4 ${isIntro ? 'text-white/90' : 'text-slate-600 dark:text-slate-300'}`}>
                                                        <FormattedText 
                                                            text={card.content} 
                                                            textColor={isIntro ? "text-white" : undefined}
                                                        />
                                                    </div>
                                                </div>
                                                
                                                {/* ALTTAKİ HOVER ÇİZGİSİ */}
                                                <div 
                                                    className="absolute bottom-0 left-0 w-full h-1.5 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left ease-out"
                                                    style={{ backgroundColor: isIntro ? 'white' : baseColor }}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                 </div>
                 
                    {/* GELECEK SİMÜLASYONU (HOVER GLOW GRID) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                        {activeData.simulasyon?.gelisim_adimlari?.map((step, idx) => {
                            const stepConfig = getSimulationStepConfig(step.baslik);
                            const Icon = stepConfig.icon;
                            
                            return (
                                <div 
                                    key={idx} 
                                    className="group relative bg-white/50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-white/60 dark:border-slate-700 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 backdrop-blur-md overflow-hidden"
                                    style={{ animation: `fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.1}s backwards` }}
                                >
                                    {/* MOUSE HOVER GRADYAN EFEKTİ */}
                                    <div 
                                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                        style={{ background: `linear-gradient(135deg, ${stepConfig.color}15 0%, transparent 100%)` }}
                                    />
                                    
                                    {/* SAĞ ÜST KÖŞE SÜSLEMESİ */}
                                    <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                                        <TrendingUp className="w-12 h-12 opacity-10 group-hover:opacity-20 transform group-hover:scale-110 transition-all" style={{color: stepConfig.color}} />
                                    </div>

                                    <div className="relative z-10">
                                        {/* Başlık ve İkon */}
                                        <div className="flex items-center gap-3 mb-4">
                                            <div 
                                                className="p-3 rounded-2xl bg-white dark:bg-slate-700 shadow-sm group-hover:scale-110 transition-transform duration-300"
                                            >
                                                <Icon className="w-6 h-6" style={{ color: stepConfig.color }} />
                                            </div>
                                            <span 
                                                className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-slate-100 dark:bg-slate-700/50 text-slate-500"
                                            >
                                                Adım {idx + 1}
                                            </span>
                                        </div>

                                        <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 line-clamp-1 group-hover:text-brand-600 transition-colors">
                                            {step.baslik}
                                        </h4>
                                        
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6 line-clamp-2 min-h-[40px]">
                                            {step.ne_yapmali}
                                        </p>
                                        
                                        {/* Alt Bilgiler */}
                                        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700/50">
                                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-700/30">
                                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">⏱️ {step.sure}</span>
                                            </div>
                                            <div 
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transform group-hover:translate-x-1 transition-transform"
                                                style={{ backgroundColor: `${stepConfig.color}15` }}
                                            >
                                                <TrendingUp className="w-3.5 h-3.5" style={{ color: stepConfig.color }} />
                                                <span className="text-xs font-bold" style={{ color: stepConfig.color }}>{step.ongoru}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
            </div>
          </div>
        )}

        {/* TAB 2: COACHING CHAT (NEW) */}
        {activeTab === 'koc' && (
             <div className="animate-fade-in-up">
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Chat Window */}
                    <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col h-[600px] overflow-hidden relative">
                         {/* Header */}
                         <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 flex items-center gap-3">
                             <div className="bg-gradient-to-tr from-brand-500 to-indigo-500 p-2 rounded-xl text-white shadow-lg shadow-brand-500/20">
                                 <Bot className="w-6 h-6" />
                             </div>
                             <div>
                                 <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                     Kukul AI Koç
                                     <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Online</span>
                                 </h3>
                                 <p className="text-xs text-slate-500 dark:text-slate-400">Verilerine dayalı kişisel eğitim danışmanın</p>
                             </div>
                         </div>
                         
                         {/* Messages Area */}
                         <div className="flex-grow overflow-y-auto p-6 space-y-4 bg-slate-50/30 dark:bg-slate-900/30">
                             {chatHistory.map((msg, idx) => (
                                 <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                     <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm ${
                                         msg.role === 'user' 
                                            ? 'bg-brand-600 dark:bg-brand-600 text-white rounded-tr-none' 
                                            : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-600'
                                     }`}>
                                         {msg.role === 'model' ? (
                                             <FormattedText text={msg.text} textColor={msg.role === 'user' ? 'text-white' : undefined} />
                                         ) : (
                                             msg.text
                                         )}
                                     </div>
                                 </div>
                             ))}
                             {isChatLoading && (
                                 <div className="flex justify-start w-full">
                                     <div className="bg-white dark:bg-slate-700 rounded-2xl rounded-tl-none p-4 border border-slate-100 dark:border-slate-600 flex items-center gap-2 shadow-sm">
                                         <Loader2 className="w-4 h-4 text-brand-600 dark:text-brand-400 animate-spin" />
                                         <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Kukul AI yazıyor...</span>
                                     </div>
                                 </div>
                             )}
                             <div ref={chatEndRef} />
                         </div>

                         {/* Input Area */}
                         <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
                             <form onSubmit={handleSendMessage} className="flex gap-3">
                                 <input 
                                     type="text" 
                                     value={chatInput}
                                     onChange={(e) => setChatInput(e.target.value)}
                                     placeholder="Merak ettiğin her şeyi sorabilirsin..."
                                     className="flex-grow bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all"
                                     disabled={isChatLoading}
                                 />
                                 <button 
                                     type="submit" 
                                     disabled={!chatInput.trim() || isChatLoading}
                                     className="bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 text-white p-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-brand-500/20"
                                 >
                                     <Send className="w-5 h-5" />
                                 </button>
                             </form>
                         </div>
                    </div>

                    {/* Sidebar Suggestions */}
                    <div className="bg-gradient-to-br from-indigo-900 to-brand-900 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col justify-between">
                         <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                         
                         <div className="relative z-10">
                             <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
                                 <Lightbulb className="w-5 h-5 text-yellow-300" />
                                 Neler Sorabilirsin?
                             </h4>
                             <div className="space-y-3">
                                 {[
                                     "📝 Detaylı karne raporumu yaz",
                                     "🎯 Matematiği nasıl düzeltirim?",
                                     "📅 Bana günlük plan yap",
                                     "🚀 Motivasyonum düştü",
                                     "🏫 LGS hedefime nasıl ulaşırım?"
                                 ].map((suggestion, idx) => (
                                     <button 
                                         key={idx}
                                         onClick={() => {
                                             setChatInput(suggestion);
                                             // Optional: auto submit
                                             // handleSendMessage(); 
                                         }}
                                         className="w-full text-left bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl p-3 text-xs md:text-sm transition-all"
                                     >
                                         {suggestion}
                                     </button>
                                 ))}
                             </div>
                         </div>

                         <div className="relative z-10 mt-6 pt-6 border-t border-white/10 text-center">
                             <p className="text-xs text-white/60 italic">
                                 "Kukul AI, senin verilerine göre konuşur. Ne kadar çok deneme yüklersen, seni o kadar iyi tanır."
                             </p>
                         </div>
                    </div>
                 </div>
             </div>
        )}

        {/* Tab 3: Plan */}
        {activeTab === 'plan' && (
             <div className="animate-fade-in-up">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {Object.keys(studyPlanByLesson).map((lessonLabel, idx) => {
                         const lessonPlan = studyPlanByLesson[lessonLabel];
                         const lessonConf = Object.values(LESSON_CONFIG).find(c => c.label === lessonLabel) || { color: '#64748b', icon: BookOpen };
                         
                         return (
                             <div key={idx} className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 h-full">
                                 <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                                     <div className="p-1.5 rounded-lg text-white" style={{ backgroundColor: lessonConf.color }}>
                                         <lessonConf.icon className="w-4 h-4" />
                                     </div>
                                     <h3 className="font-bold text-slate-800 dark:text-slate-100">{lessonLabel}</h3>
                                     <span className="ml-auto text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full text-slate-500 font-bold">{lessonPlan.length} Görev</span>
                                 </div>
                                 <div className="space-y-4">
                                     {lessonPlan.sort((a,b) => a.oncelik - b.oncelik).map((item, i) => (
                                         <div key={i} className={`p-3 rounded-xl border-l-4 ${item.oncelik === 1 ? 'bg-red-50 dark:bg-red-900/10 border-red-500' : item.oncelik === 2 ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-500' : 'bg-blue-50 dark:bg-blue-900/10 border-blue-500'}`}>
                                             <div className="flex justify-between items-start mb-1">
                                                 <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{item.konu}</span>
                                                 {item.oncelik === 1 && <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded">ACİL</span>}
                                             </div>
                                             <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">{item.tavsiye}</p>
                                             <p className="text-xs text-slate-500 dark:text-slate-400 italic">"{item.sebep}"</p>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                         )
                     })}
                     {Object.keys(studyPlanByLesson).length === 0 && (
                         <div className="col-span-full text-center p-12 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
                             <ListTodo className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                             <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400">Bu analiz için özel bir çalışma planı oluşturulamadı.</h3>
                             <p className="text-slate-500 text-sm">Genel eksiklerini konu analizi sekmesinden inceleyebilirsin.</p>
                         </div>
                     )}
                 </div>
             </div>
        )}
        
        {/* Tab 4: Konu */}
        {activeTab === 'konu' && (
             <div className="animate-fade-in-up space-y-6">
                 {/* Filters & Summary */}
                 <div className="flex flex-col md:flex-row gap-6">
                     <div className="w-full md:w-1/4 space-y-4">
                         <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                             <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                                 <Filter className="w-4 h-4" /> Ders Filtrele
                             </h4>
                             <div className="space-y-2">
                                 <button 
                                    onClick={() => setSelectedLessonForTopic('Genel')}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedLessonForTopic === 'Genel' ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'}`}
                                 >
                                     Tüm Dersler
                                 </button>
                                 {Object.keys(LESSON_CONFIG).map(lesson => (
                                     <button 
                                        key={lesson}
                                        onClick={() => setSelectedLessonForTopic(lesson)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${selectedLessonForTopic === lesson ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'}`}
                                     >
                                         <div className="w-2 h-2 rounded-full" style={{ backgroundColor: LESSON_CONFIG[lesson].color }}></div>
                                         {lesson}
                                     </button>
                                 ))}
                             </div>
                         </div>
                         
                         {/* Stats Summary Card */}
                         <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                             <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-4">Durum Özeti</h4>
                             <div className="h-40 relative">
                                  <ResponsiveContainer width="100%" height="100%">
                                     <PieChart>
                                         <Pie
                                             data={topicStats.pieData}
                                             cx="50%"
                                             cy="50%"
                                             innerRadius={40}
                                             outerRadius={60}
                                             paddingAngle={5}
                                             dataKey="value"
                                         >
                                             {topicStats.pieData.map((entry, index) => (
                                                 <Cell key={`cell-${index}`} fill={entry.color} />
                                             ))}
                                         </Pie>
                                         <Tooltip />
                                     </PieChart>
                                  </ResponsiveContainer>
                                  <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                                      <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{topicStats.total}</span>
                                      <span className="text-[10px] text-slate-400 uppercase font-bold">Konu</span>
                                  </div>
                             </div>
                             <div className="grid grid-cols-2 gap-2 mt-4">
                                 <div className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded text-center font-bold">{topicStats.excellent} Mükemmel</div>
                                 <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded text-center font-bold">{topicStats.good} İyi</div>
                                 <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded text-center font-bold">{topicStats.improve} Gelişmeli</div>
                                 <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded text-center font-bold">{topicStats.critical} Kritik</div>
                             </div>
                         </div>
                     </div>

                     {/* Topic Table */}
                     <div className="flex-grow bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
                         <div className="overflow-x-auto">
                             <table className="w-full text-sm text-left">
                                 <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 uppercase text-xs font-bold tracking-wider">
                                     <tr>
                                         <th onClick={() => handleSort('konu')} className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 group">
                                             <div className="flex items-center gap-1">Konu <RenderSortIcon columnKey="konu"/></div>
                                         </th>
                                         <th onClick={() => handleSort('ders')} className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 group">
                                             <div className="flex items-center gap-1">Ders <RenderSortIcon columnKey="ders"/></div>
                                         </th>
                                         <th className="px-6 py-4 text-center">Soru Dağılımı</th>
                                         <th onClick={() => handleSort('net_kaybi')} className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 group">
                                             <div className="flex items-center gap-1 justify-center">Net Kaybı <RenderSortIcon columnKey="net_kaybi"/></div>
                                         </th>
                                         <th onClick={() => handleSort('basari_yuzdesi')} className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 group">
                                             <div className="flex items-center gap-1 justify-center">Başarı <RenderSortIcon columnKey="basari_yuzdesi"/></div>
                                         </th>
                                         <th onClick={() => handleSort('lgs_kayip_puan')} className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 group">
                                             <div className="flex items-center gap-1 justify-center">LGS Kayıp <RenderSortIcon columnKey="lgs_kayip_puan"/></div>
                                         </th>
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                     {chartData.length === 0 ? (
                                         <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Bu filtrede konu bulunamadı.</td></tr>
                                     ) : (
                                         chartData.map((topic, i) => (
                                             <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                                 <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200 max-w-[200px] truncate" title={topic.konu}>
                                                     {topic.konu}
                                                 </td>
                                                 <td className="px-6 py-4">
                                                     <span className="text-[10px] font-bold px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase">
                                                         {getLessonConfig(topic.ders).label}
                                                     </span>
                                                 </td>
                                                 <td className="px-6 py-4">
                                                     <div className="flex items-center justify-center gap-1">
                                                         <div className="flex flex-col items-center w-8">
                                                             <span className="text-emerald-600 font-bold">{topic.dogru}</span>
                                                             <span className="text-[9px] text-slate-400">D</span>
                                                         </div>
                                                         <div className="flex flex-col items-center w-8 border-x border-slate-100 dark:border-slate-700">
                                                             <span className="text-red-500 font-bold">{topic.yanlis}</span>
                                                             <span className="text-[9px] text-slate-400">Y</span>
                                                         </div>
                                                         <div className="flex flex-col items-center w-8">
                                                             <span className="text-slate-400 font-bold">{topic.bos}</span>
                                                             <span className="text-[9px] text-slate-400">B</span>
                                                         </div>
                                                     </div>
                                                 </td>
                                                 <td className="px-6 py-4 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded text-xs">
                                                            -{((topic.yanlis || 0) / 3).toFixed(2)}
                                                        </span>
                                                        <span className="text-[9px] text-slate-400 mt-0.5">Net</span>
                                                    </div>
                                                 </td>
                                                 <td className="px-6 py-4 text-center">
                                                     <div className="relative w-12 h-12 mx-auto">
                                                        <ResponsiveContainer>
                                                            <PieChart>
                                                                <Pie
                                                                    data={[{value: topic.basari_yuzdesi}, {value: 100-topic.basari_yuzdesi}]}
                                                                    innerRadius={18}
                                                                    outerRadius={24}
                                                                    dataKey="value"
                                                                    startAngle={90}
                                                                    endAngle={-270}
                                                                    stroke="none"
                                                                >
                                                                    <Cell fill={
                                                                        topic.basari_yuzdesi >= 80 ? '#10b981' : 
                                                                        topic.basari_yuzdesi >= 70 ? '#3b82f6' : 
                                                                        topic.basari_yuzdesi >= 50 ? '#f59e0b' : '#ef4444'
                                                                    } />
                                                                    <Cell fill="#e2e8f0" />
                                                                </Pie>
                                                            </PieChart>
                                                        </ResponsiveContainer>
                                                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                                            %{Math.round(topic.basari_yuzdesi)}
                                                        </div>
                                                     </div>
                                                 </td>
                                                 <td className="px-6 py-4 text-center">
                                                     <span className="text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                                                         -{topic.lgs_kayip_puan.toFixed(2)}
                                                     </span>
                                                 </td>
                                             </tr>
                                         ))
                                     )}
                                 </tbody>
                             </table>
                         </div>
                     </div>
                 </div>
             </div>
        )}

        {/* Tab 5: Trend */}
        {activeTab === 'trend' && (
            <div className="animate-fade-in-up space-y-8">
                {globalTrendData.length < 2 ? (
                    <div className="text-center p-12 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
                        <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400">Yeterli veri yok</h3>
                        <p className="text-slate-500 text-sm">Trend analizi için en az 2 farklı sınav yüklemelisin.</p>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Gelişim Grafiği</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">{globalTrendData.length} sınav üzerinden değerlendirme</p>
                            </div>
                            <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                                <button 
                                    onClick={() => setSelectedTrendLesson('Tümü')} 
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${selectedTrendLesson === 'Tümü' ? 'bg-white dark:bg-slate-600 text-brand-600 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                                >
                                    Genel Puan
                                </button>
                                {Object.keys(LESSON_CONFIG).map(l => (
                                    <button 
                                        key={l} 
                                        onClick={() => setSelectedTrendLesson(l)} 
                                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${selectedTrendLesson === l ? 'bg-white dark:bg-slate-600 text-brand-600 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                                    >
                                        {l}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={globalTrendData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} domain={['auto', 'auto']} />
                                    <Tooltip 
                                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--tooltip-bg, #fff)'}}
                                        cursor={{stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4'}}
                                    />
                                    <Legend iconType="circle" />
                                    {selectedTrendLesson === 'Tümü' ? (
                                        <Line 
                                            type="monotone" 
                                            dataKey="totalScore" 
                                            name="Toplam Puan" 
                                            stroke="#4f46e5" 
                                            strokeWidth={4} 
                                            dot={{r: 4, strokeWidth: 2, fill: '#fff'}} 
                                            activeDot={{r: 6}}
                                        />
                                    ) : (
                                        <Line 
                                            type="monotone" 
                                            dataKey={selectedTrendLesson} 
                                            name={`${selectedTrendLesson} Net`} 
                                            stroke={LESSON_CONFIG[selectedTrendLesson].color} 
                                            strokeWidth={4} 
                                            dot={{r: 4, strokeWidth: 2, fill: '#fff'}} 
                                            activeDot={{r: 6}} 
                                        />
                                    )}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisDashboard;