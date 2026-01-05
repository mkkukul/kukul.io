
import React, { useState, useCallback, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import AnalysisDashboard from './components/AnalysisDashboard';
import HistoryDashboard from './components/HistoryDashboard';
import { analyzeExamFiles } from './services/geminiService';
import { ComprehensiveAnalysis, AppState } from './types';
import { AlertCircle, RefreshCcw } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [result, setResult] = useState<ComprehensiveAnalysis | null>(null);
  const [history, setHistory] = useState<ComprehensiveAnalysis[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  // Helper function to compress images
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // INCREASED MAX DIMENSION: 3072px ensures very high fidelity for dense text tables and PDFs.
          const MAX_DIMENSION = 3072;

          if (width > height) {
            if (width > MAX_DIMENSION) {
              height *= MAX_DIMENSION / width;
              width = MAX_DIMENSION;
            }
          } else {
            if (height > MAX_DIMENSION) {
              width *= MAX_DIMENSION / height;
              height = MAX_DIMENSION;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          // Use high quality smoothing
          if (ctx) ctx.imageSmoothingQuality = 'high';
          ctx?.drawImage(img, 0, 0, width, height);
          
          // High quality JPEG (0.90) to prevent compression artifacts
          resolve(canvas.toDataURL('image/jpeg', 0.90));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
      });
  };

  const handleFilesSelected = useCallback(async (files: File[]) => {
    setAppState(AppState.ANALYZING);
    setError(null);

    try {
      const base64Promises = files.map(async (file) => {
        if (file.type.startsWith('image/')) {
            return await compressImage(file);
        } else {
            return await readFileAsBase64(file);
        }
      });

      const base64DataArray = await Promise.all(base64Promises);
      
      const data = await analyzeExamFiles(base64DataArray);
      
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
      console.error("Stack Trace:", err.stack);
      
      if (err.cause) {
         console.error("Underlying Cause:", err.cause);
      }
      
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-brand-100 selection:text-brand-900">
      
      {/* Background decoration */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-200/30 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        
        {/* Navbar */}
        <header className="w-full glass-panel sticky top-0 z-50 border-b border-slate-200/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4 cursor-pointer group" onClick={handleReset}>
              <div className="relative">
                 <div className="absolute -inset-1 bg-brand-500 rounded-full blur opacity-25 group-hover:opacity-50 transition-opacity"></div>
                 <img 
                     src="https://api.dicebear.com/9.x/bottts/svg?seed=KukulAI&backgroundColor=e0f2fe" 
                     alt="Kukul.io" 
                     className="w-16 h-16 rounded-full border-2 border-white shadow-lg object-cover relative z-10 bg-white transition-transform group-hover:scale-105"
                 />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight group-hover:text-brand-700 transition-colors">
                    Kukul.io
                </h1>
                <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">LGS Performans Analisti</p>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-grow flex flex-col items-center justify-start p-6 md:p-12">
          
          {appState === AppState.IDLE && (
             <div className="w-full max-w-3xl mx-auto text-center mb-8 animate-fade-in-up">
                <h2 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight mb-2">
                  LGS Hazırlığında <span className="text-brand-600">Nokta Atışı</span> Yapın
                </h2>
                <p className="text-slate-600 mt-4 text-lg">Sınav sonucunu yükle, yapay zeka senin için analiz etsin, eksiklerini bulsun ve çalışma planını hazırlasın.</p>
             </div>
          )}

          {appState === AppState.IDLE || appState === AppState.ANALYZING ? (
            <div className="w-full max-w-4xl mx-auto">
                <FileUpload 
                  onFilesSelected={handleFilesSelected} 
                  isLoading={appState === AppState.ANALYZING} 
                />

                {/* Show History Dashboard if idle and history exists */}
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
            <div className="w-full max-w-md mx-auto mt-8 bg-red-50 border border-red-200 rounded-2xl p-6 text-center animate-shake">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-red-900 mb-2">Hata Oluştu</h3>
                <p className="text-red-700 mb-6">{error}</p>
                <button 
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-red-200 text-red-700 font-medium rounded-lg hover:bg-red-50 transition-colors shadow-sm"
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
        <footer className="py-6 text-center text-slate-400 text-sm">
          <p>© {new Date().getFullYear()} Kukul.io. kukul.ai 0.62 tarafından desteklenmektedir.</p>
        </footer>

      </div>
    </div>
  );
};

export default App;
