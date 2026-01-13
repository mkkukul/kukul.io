import * as pdfjsLib from 'pdfjs-dist';

// Vite/Webpack ortamlarında worker dosyasını build içine almak bazen sorun yaratır.
// Bu yüzden CDN üzerinden sürüm uyumlu worker'ı dinamik olarak tanımlıyoruz.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

/**
 * PDF dosyasından ham metni çıkarır.
 * Eğer PDF taranmış bir görsele sahipse (OCR yoksa), boş string dönebilir.
 */
export const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        
        // PDF'i yükle
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        let fullText = '';

        // Tüm sayfaları gez
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            
            // Sayfadaki metin parçalarını birleştir
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');
            
            fullText += `--- Sayfa ${i} ---\n${pageText}\n\n`;
        }

        return fullText.trim();
    } catch (error) {
        console.error("PDF Metin Okuma Hatası:", error);
        // Hata durumunda boş dönerek sistemin Image Fallback (Görsel İşleme) moduna geçmesini sağlıyoruz
        return "";
    }
};