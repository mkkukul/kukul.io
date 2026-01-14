import * as pdfjsLib from 'pdfjs-dist';

// Vite/Webpack ortamlarında worker dosyasını bundle içine almak yerine CDN'den çekiyoruz.
// Bu yöntem build hatalarını önler ve performansı artırır.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

/**
 * PDF dosyasından ham metni çıkarır.
 * Hız için font yüklemeyi devre dışı bırakır.
 */
export const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        
        // disableFontFace: true -> OCR/Metin çıkarma işleminde fontları yüklemekle vakit kaybetme
        // Bu ayar PDF işleme süresini önemli ölçüde hızlandırır.
        const loadingTask = pdfjsLib.getDocument({ 
            data: arrayBuffer,
            disableFontFace: true,
            rangeChunkSize: 65536*2 
        });
        
        const pdf = await loadingTask.promise;
        let fullText = '';

        // Sayfa sayfa metinleri çek
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            
            // Metin parçalarını birleştir (Satır sonlarını korumaya çalış)
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');
            
            // Sayfa ayracı ekle
            fullText += `\n--- SAYFA ${i} BAŞI ---\n${pageText}\n--- SAYFA ${i} SONU ---\n`;
        }

        return fullText.trim();
    } catch (error) {
        console.warn("PDF Metin Okuma Uyarısı (Görsel İşleme Devreye Girecek):", error);
        // Hata durumunda boş dönerek sistemin Image Fallback moduna geçmesini sağlıyoruz
        return "";
    }
};