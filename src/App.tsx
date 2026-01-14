
import React, { useState, useCallback, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import AnalysisDashboard from './components/AnalysisDashboard';
import HistoryDashboard from './components/HistoryDashboard';
import { analyzeExamFiles, AnalysisPayload } from './services/geminiService';
import { ComprehensiveAnalysis, AppState } from './types';
import { AlertCircle, RefreshCcw, Brain, Moon, Sun } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [result, setResult] = useState<ComprehensiveAnalysis | null>(null);
  const [history, setHistory] = useState<ComprehensiveAnalysis[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });

  // Apply Theme Class
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Load history from local storage on mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('exam_analysis_history');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
  }, []);

  // Save history to local storage whenever it changes
  const saveHistoryToStorage = (newHistory: ComprehensiveAnalysis[]) => {
    try {
      localStorage.setItem('exam_analysis_history', JSON.stringify(newHistory));
      setHistory(newHistory);
    } catch (e) {
      console.error("Failed to save history", e);
    }
  };

  const deleteHistoryItem = (id: string) => {
    const updatedHistory = history.filter(item => item.id !== id);
    saveHistoryToStorage(updatedHistory);
  };

  const handleFilesSelected = useCallback(async (payload: AnalysisPayload) => {
    setAppState(AppState.ANALYZING);
    setError(null);

    try {
      // Direct call to analysis service - processing is now handled in FileUpload
      const data = await analyzeExamFiles(payload);
      
      // Add ID and Timestamp
      const analysisWithMeta: ComprehensiveAnalysis = {
        ...data,
        id: crypto.randomUUID(),
        savedAt: Date.now()
      };

      setResult(analysisWithMeta);
      
      // Update History
      const updatedHistory = [analysisWithMeta, ...history];
      saveHistoryToStorage(updatedHistory);

      setAppState(AppState.SUCCESS);

    } catch (err: any) {
      // Extensive logging for debugging in production
      console.error("--- APPLICATION ERROR DETECTED ---");
      console.error("User Message:", err.message);
      
      // Use the specific error message from the service
      setError(err.message || "Analiz sırasında beklenmeyen bir sorun oluştu.");
      setAppState(AppState.ERROR);
    }
  }, [history]);

  const handleReset = () => {
    setAppState(AppState.IDLE);
    setResult(null);
    setError(null);
  };

  const handleSelectFromHistory = (analysis: ComprehensiveAnalysis) => {
    setResult(analysis);
    setAppState(AppState.SUCCESS);
    // Optional: Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-brand-100 selection:text-brand-900 transition-colors duration-300">
      
      {/* Background decoration */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-200/30 dark:bg-blue-900/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-200/30 dark:bg-purple-900/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        
        {/* Navbar */}
        <header className="w-full glass-panel sticky top-0 z-50 border-b border-slate-200/60 dark:border-slate-800/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4 cursor-pointer group" onClick={handleReset}>
              <div className="relative flex items-center justify-center w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl border-2 border-brand-100 dark:border-slate-700 shadow-lg group-hover:scale-105 transition-transform">
                 <Brain className="w-10 h-10 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">
                    Kukul.io
                </h1>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold tracking-widest uppercase">Yapay Zeka Destekli LGS Platformu</p>
              </div>
            </div>

            <button 
              onClick={toggleTheme}
              className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
              aria-label="Toggle Dark Mode"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-grow flex flex-col items-center justify-start p-6 md:p-12">
          
          {appState === AppState.IDLE && (
             <div className="w-full max-w-3xl mx-auto text-center mb-8 animate-fade-in-up">
                <h2 className="text-4xl md:text-5xl font-black text-slate-800 dark:text-slate-100 tracking-tight mb-2">
                  Sınav ve Ödevlerinizde <span className="text-brand-600 dark:text-brand-400">Nokta Atışı</span> Yapın
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mt-4 text-lg">Ödevini veya sınav sonucunu yükle, yapay zeka senin için analiz etsin, eksiklerini bulsun ve çalışma planını hazırlasın.</p>
             </div>
          )}

          {appState === AppState.IDLE || appState === AppState.ANALYZING ? (
            <div className="w-full max-w-4xl mx-auto">
                <FileUpload 
                  onFilesSelected={handleFilesSelected} 
                  isLoading={appState === AppState.ANALYZING} 
                />

                {appState === AppState.IDLE && history.length > 0 && (
                   <HistoryDashboard 
                      history={history} 
                      onSelect={handleSelectFromHistory} 
                      onDelete={deleteHistoryItem}
                   />
                )}
            </div>
          ) : null}

          {appState === AppState.ERROR && (
            <div className="w-full max-w-md mx-auto mt-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 text-center animate-shake">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">Hata Oluştu</h3>
                <p className="text-red-700 dark:text-red-300 mb-6">{error}</p>
                <button 
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 font-medium rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors shadow-sm"
                >
                  <RefreshCcw className="w-4 h-4" />
                  Tekrar Dene
                </button>
            </div>
          )}

          {appState === AppState.SUCCESS && result && (
            <AnalysisDashboard 
              data={result} 
              history={history}
              onReset={handleReset} 
              onSelectHistory={handleSelectFromHistory}
            />
          )}

        </main>
        
        {/* Footer */}
        <footer className="py-6 text-center text-slate-400 dark:text-slate-600 text-sm">
          <div className="flex flex-col gap-1">
            <p>Bu Uygulama Beta Test Aşamasındadır.</p>
            <p>© 2026 Kukul.io Beta 0.63 (Fast Engine) sürümüdür.</p>
          </div>
        </footer>

      </div>
    </div>
  );
};

export default App;
