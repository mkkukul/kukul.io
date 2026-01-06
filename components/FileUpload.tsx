
import React, { useRef, useState, useEffect } from 'react';
import { UploadCloud, FileImage, FileText, Loader2, Plus, X, BarChart3 } from 'lucide-react';

interface Props {
  onFilesSelected: (files: File[]) => void;
  isLoading: boolean;
}

const loadingMessages = [
  "Dosyalar işleniyor...",
  "Görüntüler taranıyor...",
  "Sınav sonuçları okunuyor...",
  "Konu analizleri yapılıyor...",
  "Kayıp puanlar hesaplanıyor...",
  "Akıllı çalışma planı hazırlanıyor..."
];

const FileUpload: React.FC<Props> = ({ onFilesSelected, isLoading }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // Cycle through loading messages and simulate progress
  useEffect(() => {
    let messageInterval: any;
    let animationFrame: number;
    let startTime: number;

    if (isLoading) {
      // Reset states
      setCurrentMessageIndex(0);
      setProgress(0);
      
      // Cycle messages
      messageInterval = setInterval(() => {
        setCurrentMessageIndex((prev) => (prev + 1) % loadingMessages.length);
      }, 2500); // Slightly faster message cycling

      // Simulate progress curve
      const animateProgress = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        
        // Simulation logic: fast at first, slows down as it approaches 90%
        // Using an inverse exponential curve: 95 * (1 - e^(-t/5000))
        const newProgress = Math.min(95, 95 * (1 - Math.exp(-elapsed / 5000)));
        
        setProgress(newProgress);
        
        if (isLoading) {
          animationFrame = requestAnimationFrame(animateProgress);
        }
      };
      
      animationFrame = requestAnimationFrame(animateProgress);
    }

    return () => {
      clearInterval(messageInterval);
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [isLoading]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files) as File[];
      addFiles(newFiles);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files) {
      const newFiles = Array.from(e.target.files) as File[];
      addFiles(newFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    // Filter duplicates based on name and size
    const uniqueFiles = newFiles.filter(
        newFile => !selectedFiles.some(
            existing => existing.name === newFile.name && existing.size === newFile.size
        )
    );
    setSelectedFiles(prev => [...prev, ...uniqueFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const onButtonClick = () => {
    inputRef.current?.click();
  };

  const handleAnalyzeClick = () => {
    if (selectedFiles.length > 0) {
      onFilesSelected(selectedFiles);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div 
        className={`relative group flex flex-col items-center justify-center w-full min-h-[300px] rounded-3xl border-2 border-dashed transition-all duration-300 ease-in-out cursor-pointer
          ${dragActive 
            ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-xl scale-[1.02]' 
            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:shadow-lg'
          }
          ${isLoading ? 'pointer-events-none opacity-80 border-transparent bg-slate-50 dark:bg-slate-900' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/*,application/pdf"
          multiple
          onChange={handleChange}
          disabled={isLoading}
        />

        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-6 w-full max-w-md">
            {isLoading ? (
                <>
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-brand-200 dark:bg-brand-900 rounded-full blur-xl opacity-50 animate-pulse"></div>
                        <Loader2 className="w-16 h-16 text-brand-600 dark:text-brand-400 animate-spin relative z-10" />
                    </div>
                    
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 transition-all duration-500">
                        {loadingMessages[currentMessageIndex]}
                    </h3>
                    
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 h-5">
                       Bu işlem belgenin yoğunluğuna göre 10-20 saniye sürebilir.
                    </p>

                    {/* Progress Bar Container */}
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden mb-2">
                        <div 
                            className="bg-brand-600 dark:bg-brand-500 h-2.5 rounded-full transition-all duration-300 ease-out relative" 
                            style={{ width: `${progress}%` }}
                        >
                            <div className="absolute top-0 right-0 bottom-0 w-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]"></div>
                        </div>
                    </div>
                    
                    <div className="flex justify-between w-full text-xs text-slate-400 dark:text-slate-500 font-mono px-1">
                        <span>Analiz Başladı</span>
                        <span>%{Math.round(progress)}</span>
                    </div>
                </>
            ) : (
                <>
                    <div className="mb-4 p-4 bg-brand-50 dark:bg-slate-800 rounded-full group-hover:scale-110 transition-transform duration-300">
                        <UploadCloud className="w-10 h-10 text-brand-600 dark:text-brand-400" />
                    </div>
                    <div className="flex gap-2">
                        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs text-slate-500 dark:text-slate-400 font-mono">JPG</span>
                        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs text-slate-500 dark:text-slate-400 font-mono">PDF</span>
                        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs text-slate-500 dark:text-slate-400 font-mono">Çoklu Dosya</span>
                    </div>
                </>
            )}
        </div>
      </div>

      {/* File List & Action Button */}
      {selectedFiles.length > 0 && !isLoading && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm animate-fade-in-up">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Seçilen Dosyalar ({selectedFiles.length})
            </h4>
            <div className="flex flex-wrap gap-2 mb-4">
                {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200">
                        <span className="truncate max-w-[150px]">{file.name}</span>
                        <button 
                            onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                            className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors"
                        >
                            <X className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                        </button>
                    </div>
                ))}
            </div>
            
            <button 
                onClick={handleAnalyzeClick}
                className="w-full py-3 bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 text-white rounded-xl font-semibold shadow-lg shadow-brand-500/30 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.01]"
            >
                <BarChart3 className="w-5 h-5" />
                {selectedFiles.length > 1 ? `${selectedFiles.length} Sınavı Karşılaştır ve Analiz Et` : 'Sınavı Analiz Et'}
            </button>
        </div>
      )}
      
      {!isLoading && selectedFiles.length === 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Trend Analizi</h3>
            </div>
            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">LGS Simülasyonu</h3>
            </div>
            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Nokta Atışı</h3>
            </div>
          </div>
      )}
    </div>
  );
};

export default FileUpload;
