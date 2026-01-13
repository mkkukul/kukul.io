import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";
import { ComprehensiveAnalysis, ChatMessage } from "../types";
import { AppConfig, validateConfig } from "../config";
import { validateAndSanitizeAnalysis } from "./validationService";

// --- HELPERS ---

const cleanAndParseJSON = (text: string): any => {
    try {
        let cleaned = text.replace(/```json/g, '').replace(/```/g, '');
        cleaned = cleaned.trim();
        return JSON.parse(cleaned);
    } catch (error) {
        console.error("JSON Parse Error. Raw Text:", text);
        throw new Error("Yapay zeka yanıtı okunabilir formatta gelmedi. Lütfen tekrar deneyin.");
    }
};

const getClient = () => {
    try {
        validateConfig();
        return new GoogleGenAI({ apiKey: AppConfig.gemini.apiKey });
    } catch (e: any) {
        throw new Error(e.message || "API İstemcisi oluşturulamadı.");
    }
};

// --- TYPES ---
// Yeni analiz yükü yapısı: Hem metin hem görsel destekler
export interface AnalysisPayload {
    images: string[];
    text?: string;
}

// --- MAIN SERVICE ---

/**
 * Analyze Exam Content (Hybrid Mode)
 * Supports both Base64 Images (Slow/Vision) and Raw Text (Fast/Native).
 */
export const analyzeExamFiles = async (payload: AnalysisPayload | string[]): Promise<ComprehensiveAnalysis> => {
    const logPrefix = "[GeminiService]";
    console.group(`${logPrefix} Starting Hybrid Analysis`);

    try {
        const ai = getClient();
        const parts = [];

        // Normalize Input: Support legacy array call or new object payload
        let images: string[] = [];
        let extractedText = "";

        if (Array.isArray(payload)) {
            images = payload;
        } else {
            images = payload.images || [];
            extractedText = payload.text || "";
        }

        // 1. Add Text Context (Fast Path)
        // Eğer metin varsa, vizyon işlemini azaltmak için metni öncelikli ekle.
        if (extractedText && extractedText.length > 50) {
            console.log(`${logPrefix} Using Extracted Text (${extractedText.length} chars)`);
            parts.push({ 
                text: `Aşağıda PDF'ten çıkarılmış sınav metni bulunmaktadır. Lütfen bu metni analiz et:\n\n${extractedText}` 
            });
        }

        // 2. Add Images (Fallback or Supplemental)
        // Metin olsa bile grafikler/şekiller için görselleri de ekleyebiliriz,
        // ancak performans için metin varsa görselleri prompt'ta ikinci plana atabiliriz.
        if (images.length > 0) {
             console.log(`${logPrefix} Processing ${images.length} images`);
             for (const [index, base64Url] of images.entries()) {
                const match = base64Url.match(/^data:(.+?);base64,(.+)$/);
                if (match) {
                    parts.push({
                        inlineData: {
                            mimeType: match[1],
                            data: match[2]
                        }
                    });
                }
            }
        }

        if (parts.length === 0) {
            throw new Error("Analiz edilecek veri bulunamadı (Ne metin ne de görsel).");
        }

        // 3. Construct the System Prompt
        const JSON_INSTRUCTION = `
        ÖNEMLİ: Çıktıyı SADECE ve SADECE saf JSON formatında ver. 
        Markdown (kb) veya açıklama metni ekleme.
        
        Beklenen JSON Şeması:
        {
          "ogrenci_bilgi": { "ad_soyad": "string", "sube": "string", "numara": "string" },
          "executive_summary": {
            "mevcut_durum": "HTML span etiketli detaylı analiz metni",
            "guclu_yonler": ["string"],
            "zayif_yonler": ["string"],
            "lgs_tahmini_yuzdelik": number
          },
          "exams_history": [
            { "sinav_adi": "string", "tarih": "string", "toplam_puan": number, "genel_yuzdelik": number, "ders_netleri": [{ "ders": "string", "net": number }] }
          ],
          "konu_analizi": [
            { "ders": "string", "konu": "string", "dogru": number, "yanlis": number, "bos": number, "basari_yuzdesi": number, "lgs_kayip_puan": number, "durum": "Mükemmel|İyi|Geliştirilmeli|Kritik" }
          ],
          "calisma_plani": [
            { "konu": "string", "ders": "string", "sebep": "string", "tavsiye": "string", "oncelik": 1-3, "onem_derecesi": 1-10 }
          ],
          "simulasyon": {
             "senaryo": "string",
             "hedef_puan": number,
             "puan_araligi": "string",
             "gerekli_net_artisi": "string",
             "gelisim_adimlari": [{ "baslik": "string", "ne_yapmali": "string", "nasil_yapmali": "string", "sure": "string", "ongoru": "string" }]
          }
        }
        `;

        parts.push({ text: SYSTEM_PROMPT });
        parts.push({ text: JSON_INSTRUCTION });

        console.log(`${logPrefix} Sending request to Gemini... Model: ${AppConfig.gemini.modelName}`);

        const response = await ai.models.generateContent({
            model: AppConfig.gemini.modelName,
            contents: { parts },
            config: {
                responseMimeType: "application/json", 
                temperature: 0.1, 
                maxOutputTokens: 16384,
            }
        });

        const textResponse = response.text;
        if (!textResponse) throw new Error("Model boş yanıt döndürdü.");

        const rawJson = cleanAndParseJSON(textResponse);
        const validatedData = validateAndSanitizeAnalysis(rawJson);

        console.log(`${logPrefix} Analysis Successful.`);
        console.groupEnd();

        return validatedData;

    } catch (error: any) {
        console.error(`${logPrefix} Critical Error:`, error);
        console.groupEnd();
        
        // Error Mapping
        let userMsg = "Analiz sırasında beklenmeyen bir hata oluştu.";
        const msg = (error.message || "").toLowerCase();

        if (msg.includes("400")) userMsg = "Veri formatı hatası. PDF metni çok uzun veya görsel formatı bozuk olabilir.";
        else if (msg.includes("404")) userMsg = "Model Bulunamadı (404).";
        else if (msg.includes("429")) userMsg = "Sistem yoğun, lütfen bekleyip tekrar deneyin.";
        else if (msg.includes("safety")) userMsg = "İçerik politikaları nedeniyle işlem durduruldu.";
        else userMsg = error.message;

        throw new Error(userMsg);
    }
};

/**
 * Chat with Coach implementation
 */
export const chatWithCoach = async (
  currentMessage: string,
  history: ChatMessage[],
  analysisData: ComprehensiveAnalysis
): Promise<string> => {
  try {
    const ai = getClient();
    const studentName = analysisData.ogrenci_bilgi?.ad_soyad?.split(' ')[0] || "Öğrenci";
    
    const systemInstruction = `
    Sen Kukul AI, LGS Koçusun.
    Öğrenci Adı: ${studentName}
    Öğrenci Verisi: ${JSON.stringify(analysisData.executive_summary)}
    Kısa, motive edici ve emojili cevaplar ver.
    `;

    const formattedHistory = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));

    const chat = ai.chats.create({
      model: AppConfig.gemini.modelName,
      config: { systemInstruction },
      history: formattedHistory
    });

    const result = await chat.sendMessage({ message: currentMessage });
    return result.text || "Cevap alınamadı.";
  } catch (error) {
    console.error("Chat error:", error);
    return "Bağlantı hatası, tekrar dener misin? 😔";
  }
};