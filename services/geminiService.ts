
import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";
import { ComprehensiveAnalysis, ChatMessage } from "../types";
import { AppConfig, validateConfig } from "../config";
import { validateAndSanitizeAnalysis } from "./validationService";

// Initialize the client helper
const getClient = () => {
    validateConfig();
    return new GoogleGenAI({ apiKey: AppConfig.gemini.apiKey });
};

// --- PERFORMANCE OPTIMIZATION: IN-MEMORY CACHE ---
// Stores the last 5 analysis results to prevent redundant API calls for the same file set.
const analysisCache = new Map<string, ComprehensiveAnalysis>();
const MAX_CACHE_SIZE = 5;

const generateCacheKey = (base64DataUrls: string[]): string => {
    // Create a lightweight fingerprint based on file count, first file content snippet, and total length.
    // This avoids hashing the entire heavy base64 strings.
    if (base64DataUrls.length === 0) return "empty";
    const totalLength = base64DataUrls.reduce((acc, curr) => acc + curr.length, 0);
    const firstSnippet = base64DataUrls[0].substring(0, 30);
    return `${base64DataUrls.length}_${firstSnippet}_${totalLength}`;
};

export const analyzeExamFiles = async (base64DataUrls: string[]): Promise<ComprehensiveAnalysis> => {
  const logPrefix = "[GeminiService]";
  
  try {
    const ai = getClient();
    const parts = [];

    console.group(`${logPrefix} Starting Analysis`);
    console.log(`Files to process: ${base64DataUrls.length}`);

    // --- 0. Check Cache ---
    const cacheKey = generateCacheKey(base64DataUrls);
    if (analysisCache.has(cacheKey)) {
        console.log(`${logPrefix} ⚡ Cache Hit! Returning stored result.`);
        console.groupEnd();
        return analysisCache.get(cacheKey)!;
    }

    // --- 1. Pre-flight Validation & Logging ---
    // (Reduced detailed logging for performance, only basic stats)
    const totalSizeMB = base64DataUrls.reduce((acc, url) => acc + url.length, 0) / 1024 / 1024 * 0.75;
    console.log(`${logPrefix} Total Payload Approx: ${totalSizeMB.toFixed(2)} MB`);

    // Add all images/PDFs to the prompt parts
    for (const [index, base64Url] of base64DataUrls.entries()) {
        const match = base64Url.match(/^data:(.+?);base64,(.+)$/);
        if (match) {
            parts.push({
                inlineData: {
                    mimeType: match[1],
                    data: match[2]
                }
            });
        } else {
            throw new Error(`Dosya #${index + 1} formatı hatalı. Lütfen tekrar yükleyin.`);
        }
    }

    if (parts.length === 0) {
        throw new Error("Geçerli dosya verisi bulunamadı.");
    }

    // Add specific instruction for robust data extraction
    parts.push({ text: `
    GÖREV: Yüklenen sınav sonuç belgelerini ve konu analizi tablolarını analiz et.
    
    ÖNEMLİ YÖNERGELER:
    1. Görsellerdeki "Konu Analizi" veya "Ders Başarısı" tablolarını satır satır tara.
    2. Konu isimlerini doğru oku. Eğer görselde "Fiilimsiler-1", "Fiilimsiler-2" gibi parçalı satırlar varsa, bunları "Fiilimsiler" başlığı altında BİRLEŞTİR ve sayılarını topla.
    3. Tablodaki sayısal verileri (Doğru, Yanlış, Boş) değiştirmeden ve yuvarlamadan aktar.
    4. Görselde OLMAYAN hiçbir konuyu veya puanı uydurma.
    5. Öğrenci adını, şubesini ve sınav adını belgenin başlık kısımlarından bul.
    `});

    // Add system prompt at the end
    parts.push({ text: SYSTEM_PROMPT });

    console.log(`${logPrefix} Sending request to Gemini API (${AppConfig.gemini.modelName})...`);
    const startTime = Date.now();

    // --- 2. API Call ---
    const response = await ai.models.generateContent({
      model: AppConfig.gemini.modelName,
      contents: {
        parts: parts
      },
      config: {
        temperature: AppConfig.gemini.generationConfig.temperature,
        maxOutputTokens: AppConfig.gemini.generationConfig.maxOutputTokens,
        thinkingConfig: { thinkingBudget: AppConfig.gemini.generationConfig.thinkingBudget }, 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ogrenci_bilgi: { 
                type: Type.OBJECT, 
                properties: { 
                    ad_soyad: { type: Type.STRING }, 
                    sube: { type: Type.STRING }, 
                    numara: { type: Type.STRING } 
                },
                required: ["ad_soyad"]
            },
            executive_summary: {
                type: Type.OBJECT, 
                properties: {
                    mevcut_durum: { type: Type.STRING },
                    guclu_yonler: { type: Type.ARRAY, items: { type: Type.STRING } },
                    zayif_yonler: { type: Type.ARRAY, items: { type: Type.STRING } },
                    lgs_tahmini_yuzdelik: { type: Type.NUMBER }
                },
                required: ["mevcut_durum", "guclu_yonler", "zayif_yonler", "lgs_tahmini_yuzdelik"]
            },
            exams_history: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        sinav_adi: { type: Type.STRING },
                        yayin_evi: { type: Type.STRING },
                        tarih: { type: Type.STRING },
                        toplam_puan: { type: Type.NUMBER },
                        genel_yuzdelik: { type: Type.NUMBER },
                        ders_netleri: { 
                           type: Type.ARRAY, 
                           items: { 
                             type: Type.OBJECT,
                             properties: {
                                ders: { type: Type.STRING },
                                net: { type: Type.NUMBER }
                             },
                             required: ["ders", "net"]
                           } 
                        }
                    },
                    required: ["sinav_adi", "ders_netleri", "toplam_puan"]
                }
            },
            konu_analizi: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        ders: { type: Type.STRING },
                        konu: { type: Type.STRING },
                        dogru: { type: Type.NUMBER },
                        yanlis: { type: Type.NUMBER },
                        bos: { type: Type.NUMBER },
                        basari_yuzdesi: { type: Type.NUMBER },
                        lgs_kayip_puan: { type: Type.NUMBER },
                        durum: { type: Type.STRING }
                    },
                    required: ["ders", "konu", "lgs_kayip_puan", "durum"]
                }
            },
            calisma_plani: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        konu: { type: Type.STRING },
                        ders: { type: Type.STRING },
                        sebep: { type: Type.STRING },
                        tavsiye: { type: Type.STRING },
                        oncelik: { type: Type.NUMBER }
                    },
                    required: ["konu", "tavsiye", "oncelik", "sebep"]
                }
            },
            simulasyon: {
                type: Type.OBJECT,
                properties: {
                    senaryo: { type: Type.STRING },
                    hedef_yuzdelik: { type: Type.NUMBER },
                    hedef_puan: { type: Type.NUMBER },
                    puan_araligi: { type: Type.STRING },
                    gerekli_net_artisi: { type: Type.STRING },
                    gelisim_adimlari: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                baslik: { type: Type.STRING },
                                ne_yapmali: { type: Type.STRING },
                                nasil_yapmali: { type: Type.STRING },
                                sure: { type: Type.STRING },
                                ongoru: { type: Type.STRING }
                            },
                            required: ["baslik", "ne_yapmali", "nasil_yapmali", "sure", "ongoru"]
                        }
                    }
                },
                required: ["senaryo", "hedef_yuzdelik", "hedef_puan", "puan_araligi", "gerekli_net_artisi", "gelisim_adimlari"]
            }
          },
          required: ["ogrenci_bilgi", "executive_summary", "exams_history", "konu_analizi", "calisma_plani", "simulasyon"]
        }
      }
    });

    const duration = (Date.now() - startTime) / 1000;
    console.log(`${logPrefix} Response received in ${duration}s`);

    // --- 3. Safety & Response Validation ---
    if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        if (candidate.finishReason !== "STOP") {
            console.warn(`${logPrefix} Abnormal finish reason: ${candidate.finishReason}`);
            if (candidate.finishReason === "SAFETY") throw new Error("Görsel içerik güvenlik filtrelerine takıldı.");
            if (candidate.finishReason === "MAX_TOKENS") throw new Error("Analiz sonucu çok uzun olduğu için kesildi.");
            if (candidate.finishReason === "RECITATION") throw new Error("Telif hakkı koruması veya ezberlenmiş içerik tespit edildi.");
        }
    }

    const textResponse = response.text;
    if (!textResponse) {
      throw new Error("Model boş yanıt döndürdü. Görsel bulanık olabilir.");
    }

    // --- 4. Robust JSON Parsing (Optimization) ---
    // Instead of simple regex replace which can fail if model chats before JSON,
    // we extract the specific JSON block.
    let cleanJson = textResponse;
    const firstBrace = textResponse.indexOf('{');
    const lastBrace = textResponse.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1) {
        // Extract substring - Faster and safer than global regex on large strings
        cleanJson = textResponse.substring(firstBrace, lastBrace + 1);
    } else {
        // Fallback
        cleanJson = textResponse.replace(/```json|```/g, '').trim();
    }

    try {
        const rawResult = JSON.parse(cleanJson);
        const validatedResult = validateAndSanitizeAnalysis(rawResult);
        
        // --- 5. Cache Result ---
        if (analysisCache.size >= MAX_CACHE_SIZE) {
            const firstKey = analysisCache.keys().next().value;
            if (firstKey) analysisCache.delete(firstKey);
        }
        analysisCache.set(cacheKey, validatedResult);

        console.groupEnd();
        return validatedResult;
    } catch (parseError) {
        console.error(`${logPrefix} JSON Parse Error. Raw start: ${cleanJson.substring(0, 50)}...`);
        throw new Error("Yapay zeka çıktısı işlenemedi. Lütfen görseli daha net çekip tekrar deneyin.");
    }

  } catch (error: any) {
    console.groupEnd();
    console.error(`${logPrefix} Error details:`, error.message);
    
    const status = error.status || error.response?.status;
    const msg = error.message || "";
    let userMessage = "Analiz sırasında beklenmeyen bir teknik hata oluştu.";

    if (status === 400 || msg.includes("INVALID_ARGUMENT")) userMessage = "Görsel formatı geçersiz veya işlenemedi.";
    else if (status === 401) userMessage = "API Anahtarı hatası.";
    else if (status === 429 || msg.includes("Quota")) userMessage = "Sistem yoğun, lütfen biraz bekleyin.";
    else if (status === 503 || msg.includes("overloaded")) userMessage = "AI Servisi aşırı yoğun, lütfen tekrar deneyin.";
    else if (msg) {
        if (!msg.trim().startsWith('{')) userMessage = `${msg}`;
    }

    throw new Error(userMessage);
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
GÖREV TANIMI:
Sen **"Kukul AI"**, Türkiye'nin en sevilen, en samimi ve veri odaklı LGS Eğitim Koçusun.
Karşında bir öğrenci var ve senin amacın; elindeki analiz verilerini kullanarak ona rehberlik etmek.

---
ELİNDEKİ VERİLER (ÖĞRENCİ ANALİZİ):
${JSON.stringify(analysisData).substring(0, 15000)} // Truncate to save context tokens if too large
---

KURALLAR:
1. Adın Kukul AI. "Senin koçunum" de.
2. Öğrenciye ismiyle hitap et (İsim: ${studentName}). Samimi ol, emoji kullan (🚀, 💪).
3. Verilere atıfta bulun.
4. Cevapların kısa ve okunabilir olsun.
`;

    const formattedHistory = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));

    const chat = ai.chats.create({
      model: AppConfig.gemini.modelName,
      config: {
        systemInstruction: systemInstruction,
      },
      history: formattedHistory
    });

    const result = await chat.sendMessage({ message: currentMessage });
    return result.text || "Cevap alınamadı.";
  } catch (error) {
    console.error("Chat error:", error);
    throw new Error("Koç ile bağlantı kurulamadı.");
  }
};
