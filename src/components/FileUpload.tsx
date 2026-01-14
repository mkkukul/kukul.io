
import React, { useState, useEffect } from 'react';
import { UploadCloud, FileText, Loader2, X, BarChart3, Zap } from 'lucide-react';
import { extractTextFromPDF } from '../utils/pdfExtractor';

interface AnalysisPayload {
    images: string[];
    text?: string;
}

interface Props {
  onFilesSelected: (payload: AnalysisPayload) => void;
  isLoading: boolean;
}

const loadingMessages = [
  "Dosyalar taranıyor...",
  "Metinler ayrıştırılıyor (OCR)...",
  "Veriler yapay zekaya iletiliyor...",
  "Sınav sonuçları okunuyor...",
  "Puan hesaplamaları yapılıyor...",
  "Analiz raporu oluşturuluyor..."
];

const FileUpload: React.FC<Props> = ({ onFilesSelected, isLoading }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<string>("");

  useEffect(() => {
    let messageInterval: any;
    let animationFrame: number;
    let startTime: number;

    if (isLoading) {
      setCurrentMessageIndex(0);
      setProgress(0);
      
      messageInterval = setInterval(() => {
        setCurrentMessageIndex((prev) => (prev + 1) % loadingMessages.length);
      }, 1500); // Faster cycle

      const animateProgress = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        // Faster progress curve for text-based analysis
        const newProgress = Math.min(95, 95 * (1 - Math.exp(-elapsed / 3000)));
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

  // Image Helper
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
          const MAX_DIMENSION = 1280;

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
          if (ctx) {
             ctx.imageSmoothingEnabled = true;
             ctx.imageSmoothingQuality = 'medium';
             ctx.fillStyle = '#FFFFFF';
             ctx.fillRect(0, 0, width, height);
             ctx.drawImage(img, 0, 0, width, height);
          }
          resolve(canvas.toDataURL('image/jpeg', 0.4));
        };
        img.onerror = () => reject(new Error("Görsel işlenemedi."));
      };
      reader.onerror = () => reject(new Error("Dosya okunamadı."));
    });
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Dosya okunamadı."));
      });
  };

  const handleAnalyzeClick = async () => {
    if (selectedFiles.length === 0) return;

    setProcessingStatus("Dosyalar ön işleme alınıyor...");
    const images: string[] = [];
    let combinedText = "";

    try {
        for (const file of selectedFiles) {
            const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
            const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|heic|webp)$/i.test(file.name);

            if (isPDF) {
                setProcessingStatus(`PDF Metni Okunuyor: ${file.name}`);
                
                // 1. Text Extraction (Primary)
                const text = await extractTextFromPDF(file);
                
                if (text && text.length > 100) {
                    combinedText += `\n--- DOSYA: ${file.name} ---\n${text}\n`;
                } else {
                    // 2. Image Fallback (Secondary)
                    console.warn(`PDF metin içermiyor: ${file.name}. Görsele çevriliyor...`);
                    setProcessingStatus(`Taranmış Belge İşleniyor: ${file.name}`);
                    const base64 = await readFileAsBase64(file);
                    images.push(base64);
                }
            } 
            else if (isImage) {
                setProcessingStatus(`Görsel Optimize Ediliyor: ${file.name}`);
                const compressed = await compressImage(file);
                images.push(compressed);
            }
        }

        setProcessingStatus("");
        
        onFilesSelected({
            images,
            text: combinedText
        });

    } catch (error) {
        console.error("Dosya hazırlama hatası:", error);
        alert("Dosyalar işlenirken bir sorun oluştu.");
        setProcessingStatus("");
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        addFiles(Array.from(e.target.files));
        e.target.value = "";
    }
  };

  const addFiles = (newFiles: File[]) => {
    const uniqueFiles = newFiles.filter(
        newFile => !selectedFiles.some(existing => existing.name === newFile.name && existing.size === newFile.size)
    );
    setSelectedFiles(prev => [...prev, ...uniqueFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <label
        htmlFor="file-upload-input"
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
      >
        <input
          id="file-upload-input"
          type="file"
          className="hidden"
          accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.heic"
          multiple
          onChange={handleChange}
          disabled={isLoading}
        />

        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-6 w-full max-w-md">
            {isLoading || processingStatus ? (
                <>
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-brand-200 dark:bg-brand-900 rounded-full blur-xl opacity-50 animate-pulse"></div>
                        <Loader2 className="w-16 h-16 text-brand-600 dark:text-brand-400 animate-spin relative z-10" />
                    </div>
                    
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 transition-all duration-500">
                        {processingStatus || loadingMessages[currentMessageIndex]}
                    </h3>
                    
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 h-5">
                       {processingStatus ? "Döküman içeriği okunuyor..." : "Yapay zeka verilerinizi analiz ediyor..."}
                    </p>

                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden mb-2">
                        <div 
                            className="bg-brand-600 dark:bg-brand-500 h-2.5 rounded-full transition-all duration-300 ease-out relative" 
                            style={{ width: `${progress}%` }}
                        >
                            <div className="absolute top-0 right-0 bottom-0 w-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]"></div>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div className="mb-4 p-4 bg-brand-50 dark:bg-slate-800 rounded-full group-hover:scale-110 transition-transform duration-300">
                        <UploadCloud className="w-10 h-10 text-brand-600 dark:text-brand-400" />
                    </div>
                    <p className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-2">
                        Sınav kağıdı veya PDF yükle
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-xs mx-auto leading-relaxed">
                        PDF'leriniz Metin Modu ile 20 kata kadar daha hızlı analiz edilir!
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs text-slate-500 dark:text-slate-400 font-mono border border-slate-200 dark:border-slate-600">PDF (Ultra Hızlı)</span>
                        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs text-slate-500 dark:text-slate-400 font-mono border border-slate-200 dark:border-slate-600">JPG/PNG</span>
                    </div>
                </>
            )}
        </div>
      </label>

      {/* File List & Action Button */}
      {selectedFiles.length > 0 && !isLoading && !processingStatus && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm animate-fade-in-up">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Seçilen Dosyalar ({selectedFiles.length})
            </h4>
            <div className="flex flex-wrap gap-2 mb-4">
                {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200">
                        <span className="truncate max-w-[150px]">{file.name}</span>
                        {file.type === 'application/pdf' && <Zap className="w-3 h-3 text-amber-500" fill="currentColor" />}
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
                Analizi Başlat
            </button>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
