
import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";
import { ComprehensiveAnalysis, ChatMessage } from "../types";
import { AppConfig, validateConfig } from "../config";
import { validateAndSanitizeAnalysis } from "./validationService";

// --- TYPES ---
export interface AnalysisPayload {
    images: string[];
    text?: string;
}

// Initialize the client helper
const getClient = () => {
    validateConfig();
    return new GoogleGenAI({ apiKey: AppConfig.gemini.apiKey });
};

/**
 * Hibrit Analiz Fonksiyonu
 * Strateji: Önce metin. Metin varsa görsel gönderme (Hız artışı). Metin yoksa görsel gönder.
 */
export const analyzeExamFiles = async (payload: AnalysisPayload | string[]): Promise<ComprehensiveAnalysis> => {
  const logPrefix = "[GeminiService]";
  
  try {
    const ai = getClient();
    const parts = [];

    // --- 1. Payload Normalization ---
    let images: string[] = [];
    let extractedText = "";

    if (Array.isArray(payload)) {
        images = payload;
    } else {
        images = payload.images || [];
        extractedText = payload.text || "";
    }

    console.group(`${logPrefix} Starting Hybrid Analysis`);
    
    // --- 2. Hibrit Karar Mekanizması ---
    const isTextSufficient = extractedText && extractedText.length > 100;

    if (isTextSufficient) {
        // SENARYO A: Metin Başarıyla Çıkarıldı (PDF) -> Sadece Metin Gönder (Çok Hızlı)
        console.log(`${logPrefix} ⚡ FAST TRACK: Yüksek kaliteli metin bulundu (${extractedText.length} karakter). Görsel yükleme atlanıyor.`);
        parts.push({ 
            text: `Aşağıda dijital bir sınav sonuç belgesinden veya ödevden çıkarılmış HAM METİN verisi bulunmaktadır. 
            Lütfen bu metindeki tabloları, netleri ve analizleri sistem talimatlarına göre işle.
            
            --- BAŞLANGIÇ ---
            ${extractedText}
            --- BİTİŞ ---` 
        });
    } else {
        // SENARYO B: Metin Yetersiz veya Yok (Fotoğraf/Taranmış Belge) -> Görsel Gönder
        if (images.length > 0) {
            console.log(`${logPrefix} 📸 VISION TRACK: Metin yetersiz. ${images.length} adet görsel işleniyor...`);
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
            // Metin az da olsa varsa görseli desteklemesi için ekle
            if (extractedText) {
                parts.push({ text: `Ek bağlam için OCR metni: ${extractedText}` });
            }
        } else {
             throw new Error("Analiz edilecek veri bulunamadı. Lütfen dosyanın içeriğinin dolu olduğundan emin olun.");
        }
    }

    // System prompt ekle
    parts.push({ text: SYSTEM_PROMPT });

    console.log(`${logPrefix} Sending request to Gemini API (${AppConfig.gemini.modelName})...`);
    const startTime = Date.now();

    // --- 3. API Call ---
    const response = await ai.models.generateContent({
      model: AppConfig.gemini.modelName,
      contents: {
        parts: parts
      },
      config: {
        temperature: AppConfig.gemini.generationConfig.temperature,
        maxOutputTokens: AppConfig.gemini.generationConfig.maxOutputTokens,
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
                    mevcut_durum: { type: Type.STRING, description: "HTML etiketli string. Öğrenciye 'Sen' diye hitap eden, koçluk diliyle yazılmış, motivasyon dolu analiz." },
                    guclu_yonler: { type: Type.ARRAY, items: { type: Type.STRING } },
                    zayif_yonler: { type: Type.ARRAY, items: { type: Type.STRING } },
                    lgs_tahmini_yuzdelik: { type: Type.NUMBER }
                },
                required: ["mevcut_durum", "guclu_yonler", "zayif_yonler", "lgs_tahmini_yuzdelik"]
            },
            exams_history: {
                type: Type.ARRAY,
                description: "Belgedeki 'Sınav Listesi' veya 'Geçmiş Sınavlar' tablosunu bul. En güncel 10 sınavı ekle (fazlasını alma).",
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
                             properties: { ders: { type: Type.STRING }, net: { type: Type.NUMBER } },
                             required: ["ders", "net"]
                           } 
                        }
                    },
                    required: ["sinav_adi", "ders_netleri", "toplam_puan"]
                }
            },
            konu_analizi: {
                type: Type.ARRAY,
                description: "DİKKAT: Sadece öğrencinin YANLIŞ veya BOŞ yaptığı konuları ve Başarısı <%100 olanları listele. Tam puan (Full) çekilen konuları listeye EKLEME. Bu liste sadece eksikleri göstermelidir.",
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
                        oncelik: { type: Type.NUMBER },
                        onem_derecesi: { type: Type.NUMBER }
                    },
                    required: ["konu", "tavsiye", "oncelik", "sebep", "onem_derecesi"]
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

    const textResponse = response.text;
    if (!textResponse) throw new Error("Model boş yanıt döndürdü.");

    const cleanJson = textResponse.replace(/```json|```/g, '').trim();

    try {
        const rawResult = JSON.parse(cleanJson);
        const validatedResult = validateAndSanitizeAnalysis(rawResult);
        console.groupEnd();
        return validatedResult;
    } catch (parseError) {
        console.error(`${logPrefix} JSON Error:`, parseError);
        // Hata durumunda ham metni logla
        console.debug("Raw Text:", textResponse.substring(0, 500));
        throw new Error("Veri formatı işlenemedi. Lütfen daha net bir belge yükleyin.");
    }

  } catch (error: any) {
    console.groupEnd();
    console.error(`${logPrefix} API Error:`, error.message);
    
    let userMessage = error.message;
    // Özel MAX_TOKENS mesajını yakala
    if (error.message.includes("MAX_TOKENS") || error.message.includes("truncated")) {
        userMessage = "Belge çok uzun olduğu için analiz sınırına takıldı. (MAX_TOKENS). Lütfen daha az sayfa yüklemeyi deneyin.";
    }
    else if (error.message.includes("400")) userMessage = "Dosya formatı veya içeriği model tarafından kabul edilmedi.";
    else if (error.message.includes("429")) userMessage = "Sistem yoğunluğu var, lütfen 10 saniye bekleyip tekrar deneyin.";
    
    throw new Error(userMessage);
  }
};

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
    Öğrenci: ${studentName}
    Veri: ${JSON.stringify(analysisData.executive_summary)}
    Kısa, motive edici konuş.
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
    return result.text || "Cevap yok.";
  } catch (e) {
    return "Bağlantı hatası.";
  }
};
