
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
  "Dosyalar okunuyor...",
  "Hızlı analiz yapılıyor...",
  "Rapor hazırlanıyor..."
];

const FileUpload: React.FC<Props> = ({ onFilesSelected, isLoading }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let messageInterval: any;
    let animationFrame: number;
    let startTime: number;

    if (isLoading) {
      setCurrentMessageIndex(0);
      setProgress(0);
      messageInterval = setInterval(() => {
        setCurrentMessageIndex((prev) => (prev + 1) % loadingMessages.length);
      }, 800); // Daha hızlı geçiş

      const animateProgress = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const newProgress = Math.min(99, 99 * (1 - Math.exp(-elapsed / 1500))); // Daha dik eğri
        setProgress(newProgress);
        if (isLoading) animationFrame = requestAnimationFrame(animateProgress);
      };
      animationFrame = requestAnimationFrame(animateProgress);
    }

    return () => {
      clearInterval(messageInterval);
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [isLoading]);

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
          const MAX_DIMENSION = 1024; // OCR için ideal hız sınırı

          if (width > height) {
            if (width > MAX_DIMENSION) { height *= MAX_DIMENSION / width; width = MAX_DIMENSION; }
          } else {
            if (height > MAX_DIMENSION) { width *= MAX_DIMENSION / height; height = MAX_DIMENSION; }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
             ctx.fillStyle = '#FFFFFF';
             ctx.fillRect(0, 0, width, height);
             ctx.drawImage(img, 0, 0, width, height);
          }
          resolve(canvas.toDataURL('image/jpeg', 0.3)); // %30 kalite = ultra hızlı upload
        };
        img.onerror = () => reject(new Error("Hata."));
      };
      reader.onerror = () => reject(new Error("Hata."));
    });
  };

  const handleAnalyzeClick = async () => {
    if (selectedFiles.length === 0) return;

    const images: string[] = [];
    let combinedText = "";

    try {
        for (const file of selectedFiles) {
            const isPDF = file.name.toLowerCase().endsWith('.pdf');
            const isImage = file.type.startsWith('image/');

            if (isPDF) {
                const text = await extractTextFromPDF(file);
                if (text && text.length > 50) combinedText += text + "\n";
                else {
                  const reader = new FileReader();
                  const base64 = await new Promise<string>((res) => {
                    reader.onload = () => res(reader.result as string);
                    reader.readAsDataURL(file);
                  });
                  images.push(base64);
                }
            } else if (isImage) {
                const compressed = await compressImage(file);
                images.push(compressed);
            }
        }
        onFilesSelected({ images, text: combinedText });
    } catch (error) {
        alert("Dosya okunamadı.");
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <label
        htmlFor="file-upload-input"
        className={`relative flex flex-col items-center justify-center w-full min-h-[200px] rounded-3xl border-2 border-dashed transition-all cursor-pointer
          ${dragActive ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/50'}
          ${isLoading ? 'pointer-events-none opacity-80' : ''}
        `}
      >
        <input id="file-upload-input" type="file" className="hidden" accept="image/*,application/pdf" multiple onChange={(e) => e.target.files && setSelectedFiles(Array.from(e.target.files))} disabled={isLoading} />
        <div className="flex flex-col items-center justify-center text-center px-6">
            {isLoading ? (
                <>
                    <Loader2 className="w-10 h-10 text-brand-600 animate-spin mb-3" />
                    <h3 className="text-md font-bold text-slate-800 dark:text-slate-100 mb-2">{loadingMessages[currentMessageIndex]}</h3>
                    <div className="w-32 bg-slate-200 dark:bg-slate-700 rounded-full h-1 overflow-hidden">
                        <div className="bg-brand-600 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                </>
            ) : (
                <>
                    <UploadCloud className="w-10 h-10 text-brand-500 mb-3" />
                    <p className="font-semibold text-slate-700 dark:text-slate-200">Sınav Kağıdını Seç</p>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-tighter">Işık hızında analiz için PDF yükle</p>
                </>
            )}
        </div>
      </label>
      {selectedFiles.length > 0 && !isLoading && (
        <button onClick={handleAnalyzeClick} className="w-full py-4 bg-brand-600 text-white rounded-2xl font-bold shadow-xl flex items-center justify-center gap-2 hover:bg-brand-700 transition-all transform active:scale-95">
            <BarChart3 className="w-5 h-5" /> ANALİZİ BAŞLAT
        </button>
      )}
    </div>
  );
};

export default FileUpload;
