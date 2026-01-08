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
                    mevcut_durum: { type: Type.STRING, description: "HTML etiketli string. Öğrenciye 'Sen' diye hitap eden, koçluk diliyle yazılmış, motivasyon dolu analiz. 6 dersi (Mat, Fen, Tr, İnk, İng, Din) ayrı paragraflarda ele al. Ders adlarını <span class='text-blue-300 font-bold'>Matematik</span> vb. ile renklendir." },
                    guclu_yonler: { type: Type.ARRAY, items: { type: Type.STRING } },
                    zayif_yonler: { type: Type.ARRAY, items: { type: Type.STRING } },
                    lgs_tahmini_yuzdelik: { type: Type.NUMBER }
                },
                required: ["mevcut_durum", "guclu_yonler", "zayif_yonler", "lgs_tahmini_yuzdelik"]
            },
            exams_history: {
                type: Type.ARRAY,
                description: "Belgedeki 'Sınav Listesi' veya 'Geçmiş Sınavlar' tablosunu bul. Sadece son sınavı değil, tablodaki TÜM GEÇMİŞ SINAVLARI satır satır buraya ekle. Ortalama hesabı için kritiktir.",
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
                           description: "Bu sınav satırında yer alan ders netleri.",
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
                description: "OCR Veri Motoru çıktısı. Belgedeki TÜM konu satırlarını eksiksiz içerir. İki sütunlu tabloları atlamadan, satır satır tara. Özetleme yapma.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        ders: { type: Type.STRING },
                        konu: { type: Type.STRING, description: "Belgedeki satırda yazan tam konu adı." },
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
                description: "Ders bazlı eksik giderme planı.",
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
                description: "6 Adımlık (Mat, Tr, Fen, İnk, İng, Din) gelişim simülasyonu.",
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
        
        // Handle specific finish reasons
        if (candidate.finishReason !== "STOP") {
            console.warn(`${logPrefix} Abnormal finish reason: ${candidate.finishReason}`);
            
            if (candidate.finishReason === "SAFETY") {
                console.error(`${logPrefix} Safety Ratings:`, candidate.safetyRatings);
                throw new Error("Görsel içerik güvenlik filtrelerine takıldı (Şiddet, Nefret söylemi vb.). Lütfen sadece eğitim materyali içerdiğinden emin olun.");
            }
            if (candidate.finishReason === "MAX_TOKENS") {
                console.error(`${logPrefix} Output truncated due to MAX_TOKENS.`);
                throw new Error("Analiz sonucu çok uzun olduğu için kesildi. Lütfen daha az sayıda sayfa yüklemeyi deneyin.");
            }
            if (candidate.finishReason === "RECITATION") {
                throw new Error("Model, içerikteki metnin telif hakkı veya ezberlenmiş içerik korumasına takıldığını tespit etti. Lütfen farklı bir görsel deneyin.");
            }
            if (candidate.finishReason === "OTHER") {
                throw new Error("Analiz işlemi teknik bir nedenden dolayı tamamlanamadı. Lütfen tekrar deneyin.");
            }
        }
    }

    const textResponse = response.text;
    if (!textResponse) {
      console.error(`${logPrefix} Empty text response. Full Response Object:`, JSON.stringify(response, null, 2));
      throw new Error("Model boş yanıt döndürdü. Görsel bulanık olabilir veya metin içerip içermediğini kontrol edin.");
    }

    const cleanJson = textResponse.replace(/```json|```/g, '').trim();

    // --- 4. JSON Parsing & Validating ---
    try {
        const rawResult = JSON.parse(cleanJson);
        
        // Pass through the validation service to ensure data integrity and type safety
        const validatedResult = validateAndSanitizeAnalysis(rawResult);
        
        console.groupEnd();
        return validatedResult;
    } catch (parseError) {
        console.error(`${logPrefix} JSON Parse/Validation Error:`, parseError);
        console.error(`${logPrefix} Raw Response Text (First 1000 chars):`, textResponse.substring(0, 1000));
        throw new Error("Yapay zeka çıktısı işlenemedi. Genellikle görselin net olmaması buna neden olur. Lütfen fotoğrafı daha net çekip tekrar deneyin.");
    }

  } catch (error: any) {
    console.groupEnd();
    
    console.error(`${logPrefix} ---------------- CRITICAL API ERROR ----------------`);
    
    // Extract standard HTTP error fields
    const status = error.status || error.response?.status;
    const msg = error.message || "";
    
    // Log details
    console.error(`${logPrefix} Status:`, status);
    console.error(`${logPrefix} Message:`, msg);
    
    // --- CUSTOMIZED USER-FRIENDLY ERROR MESSAGES ---
    let userMessage = "Analiz sırasında beklenmeyen bir teknik hata oluştu.";

    // 400 Bad Request
    if (status === 400 || msg.includes("400") || msg.includes("INVALID_ARGUMENT")) {
        if (msg.includes("Image") || msg.includes("media") || msg.includes("decode")) {
            userMessage = "Yüklenen görsel formatı geçersiz veya dosya bozuk. Lütfen standart JPG/PNG formatında, net bir fotoğraf yükleyin.";
        } else if (msg.includes("API key")) {
            userMessage = "API Anahtarı yapılandırmasında hata var.";
        } else {
            userMessage = "İstek geçersiz (400). Görsel içeriği model tarafından işlenemedi.";
        }
    } 
    // 401 Unauthorized
    else if (status === 401 || msg.includes("401")) {
        userMessage = "Yetkilendirme Hatası: API Anahtarı geçersiz veya süresi dolmuş. Lütfen sistem yöneticisi ile iletişime geçin.";
    } 
    // 403 Forbidden
    else if (status === 403 || msg.includes("403")) {
         userMessage = "Erişim Engellendi: Bu API anahtarının bu işlem için yetkisi yok veya fatura hesabı aktif değil (Quota sorunu olabilir).";
    }
    // 413 Payload Too Large
    else if (status === 413 || msg.includes("413")) {
        userMessage = "Dosya boyutu çok büyük. Lütfen 4MB'dan küçük bir görsel yüklemeyi deneyin.";
    }
    // 429 Too Many Requests
    else if (status === 429 || msg.includes("429") || msg.includes("Quota")) {
        userMessage = "Sistem şu an çok yoğun veya kota sınırına ulaşıldı. Lütfen 1-2 dakika bekleyip tekrar deneyin.";
    } 
    // 500 Internal Server Error
    else if (status === 500 || msg.includes("500")) {
         userMessage = "Sunucu Hatası (500): Google AI servisinde geçici bir sorun var. Lütfen daha sonra tekrar deneyin.";
    } 
    // 503/504 Service Unavailable / Timeout
    else if (status === 503 || status === 504 || msg.includes("503") || msg.includes("504") || msg.includes("overloaded")) {
         userMessage = "AI Servisi şu an cevap veremiyor (Aşırı Yüklenme). İnternet bağlantınızı kontrol edip 30 saniye sonra tekrar deneyin.";
    }
    // Safety / Content Policy
    else if (msg.includes("SAFETY") || msg.includes("blocked")) {
         userMessage = "İçerik Güvenliği: Yüklenen görsel, güvenlik filtrelerine takıldı. Sınav kağıdının net ve uygun olduğundan emin olun.";
    }
    // Client Side Errors
    else if (msg.includes("NetworkError") || msg.includes("fetch")) {
        userMessage = "İnternet bağlantısı hatası. Lütfen ağ bağlantınızı kontrol edin.";
    }
    else if (msg) {
        // Fallback: If it's a simple string message, show it. If it's a JSON string, try to parse or hide it.
        if (!msg.trim().startsWith('{')) {
             userMessage = `${msg}`;
        }
    }

    console.error(`${logPrefix} Final User Message:`, userMessage);
    throw new Error(userMessage);
  }
};

/**
 * Chat with Coach implementation
 * Uses the analyzed data to contextually chat with the student.
 */
export const chatWithCoach = async (
  currentMessage: string,
  history: ChatMessage[],
  analysisData: ComprehensiveAnalysis
): Promise<string> => {
  try {
    const ai = getClient();
    const studentName = analysisData.ogrenci_bilgi?.ad_soyad?.split(' ')[0] || "Öğrenci";
    
    // System instruction for the coach persona
    const systemInstruction = `
GÖREV TANIMI:
Sen **"Kukul AI"**, Türkiye'nin en sevilen, en samimi ve veri odaklı LGS Eğitim Koçusun.
Karşında bir öğrenci var ve senin amacın; elindeki analiz verilerini kullanarak ona rehberlik etmek, sorularını yanıtlamak ve motivasyonunu yükseltmek.

---

ELİNDEKİ VERİLER (ÖĞRENCİ ANALİZİ):
${JSON.stringify(analysisData)}

---

İLETİŞİM KURALLARI (BUNLARA KESİN UY):
1.  **KİMLİK:** Adın Kukul AI. Robot gibi konuşma. "Ben bir yapay zekayım" deme. "Senin koçunum, yol arkadaşınım" de.
2.  **HİTABET:** Öğrenciye ismiyle hitap et (İsim: ${studentName}). "Sen" dili kullan. Samimi, enerjik ve abla/abi sıcaklığında ol. Bolca emoji kullan (🚀, 💪, ✨, 🎯).
3.  **VERİ ODAKLI CEVAP:** Asla genel geçer konuşma.
    * Öğrenci "Matematiğim nasıl?" derse, JSON'daki matematik netine ve konu eksiklerine bakarak cevap ver.
    * Örn: "Matematik genel olarak iyi ama 'Üslü İfadeler' konusunda 2 yanlışın var, orayı tamir edersek netlerin uçar!"
4.  **KAPSAYICILIK:** Sadece eksikleri söyleme. Başarılı olduğu dersleri de öv. "Türkçe'de harikasın, paragrafları silip süpürmüşsün!" gibi.
5.  **KISALIK:** Sohbet ediyoruz, makale yazmıyoruz. Cevapların kısa, net ve okunabilir (paragraflı) olsun.
6.  **HAREKETE GEÇİR:** Öğrenciye her cevabının sonunda harekete geçirici küçük bir soru sor. (Örn: "Hemen 10 soru çözelim mi?")

SENARYOLAR VE TEPKİLER:
* **Motivasyon İsterse:** "Yapamayacağım" derse, geçmiş sınavlarındaki yükselişini veya güçlü olduğu bir dersi örnek göstererek onu ayağa kaldır.
* **Plan İsterse:** "Bugün ne yapayım?" derse, konu analizindeki en zayıf konusunu ve en güçlü dersinden bir tekrar öner.
* **Sohbet Ederse:** "Nasılsın?" derse, "Senin analiz sonuçlarını görünce harika oldum! Çalışmaya hazır mısın?" de.
`;

    // Map history to GoogleGenAI format
    const formattedHistory = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));

    // Create chat session with system instruction
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
    throw new Error("Koç ile bağlantı kurulurken bir sorun oluştu.");
  }
};
