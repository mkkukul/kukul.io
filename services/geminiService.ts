import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";
import { ComprehensiveAnalysis } from "../types";
import { AppConfig, validateConfig } from "../config";

// Initialize the client helper
const getClient = () => {
    validateConfig();
    return new GoogleGenAI({ apiKey: AppConfig.gemini.apiKey });
};

export const analyzeExamFiles = async (base64DataUrls: string[]): Promise<ComprehensiveAnalysis> => {
  const logPrefix = "[GeminiService]";
  
  try {
    const ai = getClient();
    const parts = [];

    console.group(`${logPrefix} Starting Analysis`);
    console.log(`Files to process: ${base64DataUrls.length}`);

    // --- 1. Pre-flight Validation & Logging ---
    const debugFileStats = base64DataUrls.map((url, index) => {
        const mimeMatch = url.match(/^data:(.+?);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'unknown';
        const dataLength = url.length;
        const sizeInKB = Math.round((dataLength * 3) / 4 / 1024); // approx base64 size

        return {
            fileIndex: index + 1,
            mimeType,
            sizeKB: `${sizeInKB} KB`,
            isValidFormat: !!mimeMatch,
            dataPreview: url.substring(0, 50) + "..."
        };
    });

    console.table(debugFileStats);

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
            console.error(`${logPrefix} File at index ${index} has invalid base64 format.`);
            throw new Error(`Dosya #${index + 1} formatı hatalı. Lütfen tekrar yükleyin.`);
        }
    }

    if (parts.length === 0) {
        throw new Error("Geçerli dosya verisi bulunamadı. Lütfen yüklediğiniz dosyaların formatını kontrol edin.");
    }

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
        // Temperature 0 ensures the model is deterministic (stable) on the same input.
        temperature: AppConfig.gemini.generationConfig.temperature,
        // Increase maxOutputTokens to accommodate large JSON responses.
        maxOutputTokens: AppConfig.gemini.generationConfig.maxOutputTokens,
        // High thinking budget for complex analysis
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
                    mevcut_durum: { type: Type.STRING, description: "Markdown formatında, öğrencinin durumunu 4 ana başlık altında en az 400 kelime ile anlatan çok detaylı rapor." },
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
                description: "Sınav kağıdındaki konu analiz tablosunun OCR ile okunmuş BİREBİR KOPYASI. Tabloda kaç satır varsa o kadar obje oluştur. Aynı konudan birden fazla satır varsa (Örn: 'Çarpanlar ve Katlar' 3 kez geçiyorsa) hepsini ayrı ayrı yaz, asla birleştirme. Konu isimlerini belgeden harfiyen al.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        ders: { type: Type.STRING },
                        konu: { type: Type.STRING, description: "Belgedeki satırda yazan konu/kazanım adı. Asla özetleme, tabloda ne yazıyorsa aynen kopyala." },
                        dogru: { type: Type.NUMBER },
                        yanlis: { type: Type.NUMBER },
                        bos: { type: Type.NUMBER },
                        basari_yuzdesi: { type: Type.NUMBER },
                        lgs_kayip_puan: { type: Type.NUMBER },
                        durum: { type: Type.STRING, description: "Kritik (<%50), Geliştirilmeli (%50-%70), İyi (%70-%80), Mükemmel (>%80)" }
                    },
                    required: ["ders", "konu", "lgs_kayip_puan", "durum"]
                }
            },
            calisma_plani: {
                type: Type.ARRAY,
                description: "Öğrencinin girdiği sınavdaki HER BİR DERS için ayrı ayrı oluşturulmuş stratejik tavsiye listesi.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        konu: { type: Type.STRING },
                        ders: { type: Type.STRING },
                        sebep: { type: Type.STRING },
                        tavsiye: { type: Type.STRING, description: "3-4 maddelik; her maddede kaynak, süre ve uygulanacak tekniği içeren somut eylem planı." },
                        oncelik: { type: Type.NUMBER }
                    },
                    required: ["konu", "tavsiye", "oncelik", "sebep"]
                }
            },
            simulasyon: {
                type: Type.OBJECT,
                description: "Matematiksel hesaplamaya dayalı gelecek projeksiyonu.",
                properties: {
                    senaryo: { type: Type.STRING, description: "Genel özet metni." },
                    hedef_yuzdelik: { type: Type.NUMBER },
                    hedef_puan: { type: Type.NUMBER, description: "Simülasyon gerçekleşirse oluşacak tahmini LGS puanı (Örn: 425.5)" },
                    puan_araligi: { type: Type.STRING, description: "Puanın olası aralığı (Örn: '420 - 430')" },
                    gerekli_net_artisi: { type: Type.STRING },
                    gelisim_adimlari: {
                        type: Type.ARRAY,
                        description: "KESİNLİKLE SIRASIYLA (Matematik -> Türkçe -> Fen -> İnkılap -> İngilizce -> Din) şeklinde 6 maddelik gelişim planı.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                baslik: { type: Type.STRING, description: "Örn: Matematik - İşlem Hızı" },
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
            
            if (candidate.finishReason === "SAFETY") {
                console.error(`${logPrefix} Safety Ratings:`, candidate.safetyRatings);
                throw new Error("Görsel içerik güvenlik filtrelerine takıldı. Lütfen görselin net ve uygun olduğundan emin olun.");
            }
            if (candidate.finishReason === "MAX_TOKENS") {
                console.error(`${logPrefix} Output truncated due to MAX_TOKENS.`);
                throw new Error("Analiz sonucu çok uzun olduğu için kesildi. Lütfen daha az sayıda sınav yükleyin.");
            }
        }
    }

    const textResponse = response.text;
    if (!textResponse) {
      console.error(`${logPrefix} Empty text response. Full Response Object:`, JSON.stringify(response, null, 2));
      throw new Error("Model boş yanıt döndürdü. Görsel okunabilir olmayabilir veya içerik algılanamadı.");
    }

    const cleanJson = textResponse.replace(/```json|```/g, '').trim();

    // --- 4. JSON Parsing ---
    try {
        const result: ComprehensiveAnalysis = JSON.parse(cleanJson);
        console.groupEnd();
        return result;
    } catch (parseError) {
        console.error(`${logPrefix} JSON Parse Error:`, parseError);
        console.error(`${logPrefix} Raw Response Text (First 1000 chars):`, textResponse.substring(0, 1000));
        throw new Error("Veri analizi tamamlanamadı. Model çıktısı bozuk. Lütfen görseli kırparak veya daha net çekerek tekrar deneyin.");
    }

  } catch (error: any) {
    console.groupEnd();
    
    console.error(`${logPrefix} ---------------- CRITICAL API ERROR ----------------`);
    
    // 1. Log Raw Error Object (crucial for debugging)
    console.error(`${logPrefix} Raw Error Object:`, error);

    // Extract standard HTTP error fields
    const status = error.status || error.response?.status;
    const statusText = error.statusText || error.response?.statusText;
    
    console.error(`${logPrefix} Status:`, status, statusText);
    console.error(`${logPrefix} Message:`, error.message);
    
    // Debugging logs - Full details
    if (error.response) {
        try {
            console.error(`${logPrefix} Full API Response JSON:`, JSON.stringify(error.response, null, 2));
        } catch(e) { console.error(`${logPrefix} Could not stringify response`, e); }
    }
    if (error.body) {
         try {
            console.error(`${logPrefix} Error Body JSON:`, JSON.stringify(error.body, null, 2));
         } catch(e) { /* ignore circular */ }
    }
    if (error.errorDetails) {
         try {
            console.error(`${logPrefix} Error Details:`, JSON.stringify(error.errorDetails, null, 2));
         } catch(e) { /* ignore circular */ }
    }

    // --- CUSTOMIZED ERROR MESSAGES FOR UI ---
    let userMessage = "Analiz sırasında beklenmeyen bir teknik hata oluştu.";

    // 400 Bad Request
    if (status === 400 || (error.message && error.message.includes("400"))) {
        if (error.message?.includes("Image") || error.message?.includes("decode") || error.message?.includes("payload")) {
            userMessage = "Yüklenen görsel işlenemedi. Dosya bozuk olabilir veya formatı desteklenmiyor. Lütfen net bir JPG/PNG yükleyin (Max 20MB).";
        } else if (error.message?.includes("INVALID_ARGUMENT")) {
             userMessage = "Gönderilen veri formatı geçersiz. Sayfayı yenileyip tekrar denemenizi öneririz.";
        } else {
            userMessage = "İstek geçersiz (400). Görsel boyutu çok yüksek veya okunamaz durumda olabilir.";
        }
    } 
    // 401 Unauthorized
    else if (status === 401 || (error.message && error.message.includes("401"))) {
        userMessage = "Yetkilendirme Hatası: API Anahtarı geçersiz veya süresi dolmuş.";
    } 
    // 403 Forbidden
    else if (status === 403 || (error.message && error.message.includes("403"))) {
         userMessage = "Erişim Reddedildi: API anahtarının bu işlem için yetkisi yok veya fatura hesabı aktif değil.";
    }
    // 429 Too Many Requests
    else if (status === 429 || (error.message && error.message.includes("429"))) {
        userMessage = "Sistem şu an çok yoğun veya kota sınırına ulaşıldı. Lütfen 1 dakika bekleyip tekrar deneyin.";
    } 
    // 500 Internal Server Error
    else if (status === 500 || (error.message && error.message.includes("500"))) {
         userMessage = "Sunucu Hatası (500): Google AI servisinde geçici bir sorun var. Lütfen daha sonra tekrar deneyin.";
    } 
    // 503 Service Unavailable / 504 Gateway Timeout
    else if (status === 503 || status === 504 || (error.message && (error.message.includes("503") || error.message.includes("504")))) {
         userMessage = "Hizmet Kullanılamıyor: Servis şu an cevap veremiyor veya zaman aşımına uğradı. İnternet bağlantınızı kontrol edip tekrar deneyin.";
    }
    // Specific Gemini Safety/Finish Errors treated as thrown errors
    else if (error.message && error.message.includes("SAFETY")) {
         userMessage = "İçerik Güvenliği: Yüklenen görsel, güvenlik filtrelerine takıldı. Lütfen sadece eğitim materyali içerdiğinden emin olun.";
    }
    // Catch-all for other text errors
    else if (error.message) {
        // If it looks like a raw JSON object string, keep generic
        if (!error.message.trim().startsWith('{')) {
             userMessage = `Hata: ${error.message}`;
        }
    }

    console.error(`${logPrefix} Final User Message:`, userMessage);
    throw new Error(userMessage);
  }
};