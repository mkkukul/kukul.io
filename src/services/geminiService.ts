
import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";
import { ComprehensiveAnalysis, ChatMessage } from "../types";
import { AppConfig, validateConfig } from "../config";
import { validateAndSanitizeAnalysis } from "./validationService";

export interface AnalysisPayload {
    images: string[];
    text?: string;
}

const getClient = () => {
    validateConfig();
    return new GoogleGenAI({ apiKey: AppConfig.gemini.apiKey });
};

export const analyzeExamFiles = async (payload: AnalysisPayload | string[]): Promise<ComprehensiveAnalysis> => {
  try {
    const ai = getClient();
    const parts = [];

    let images: string[] = [];
    let extractedText = "";

    if (Array.isArray(payload)) {
        images = payload;
    } else {
        images = payload.images || [];
        extractedText = payload.text || "";
    }

    if (extractedText && extractedText.length > 100) {
        parts.push({ text: `HAM METİN VERİSİ:\n${extractedText}` });
    } else if (images.length > 0) {
        for (const base64Url of images) {
            const match = base64Url.match(/^data:(.+?);base64,(.+)$/);
            if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
        }
    } else {
        throw new Error("Veri yok.");
    }

    parts.push({ text: SYSTEM_PROMPT });

    const response = await ai.models.generateContent({
      model: AppConfig.gemini.modelName,
      contents: { parts },
      config: {
        temperature: AppConfig.gemini.generationConfig.temperature,
        maxOutputTokens: AppConfig.gemini.generationConfig.maxOutputTokens,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ogrenci_bilgi: { type: Type.OBJECT, properties: { ad_soyad: { type: Type.STRING }, sube: { type: Type.STRING }, numara: { type: Type.STRING } }, required: ["ad_soyad"] },
            executive_summary: { type: Type.OBJECT, properties: { mevcut_durum: { type: Type.STRING }, guclu_yonler: { type: Type.ARRAY, items: { type: Type.STRING } }, zayif_yonler: { type: Type.ARRAY, items: { type: Type.STRING } }, lgs_tahmini_yuzdelik: { type: Type.NUMBER } }, required: ["mevcut_durum", "lgs_tahmini_yuzdelik"] },
            exams_history: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { sinav_adi: { type: Type.STRING }, toplam_puan: { type: Type.NUMBER }, ders_netleri: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { ders: { type: Type.STRING }, net: { type: Type.NUMBER } } } } } } },
            konu_analizi: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { ders: { type: Type.STRING }, konu: { type: Type.STRING }, dogru: { type: Type.NUMBER }, yanlis: { type: Type.NUMBER }, bos: { type: Type.NUMBER }, basari_yuzdesi: { type: Type.NUMBER }, lgs_kayip_puan: { type: Type.NUMBER }, durum: { type: Type.STRING } } } },
            calisma_plani: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { konu: { type: Type.STRING }, ders: { type: Type.STRING }, sebep: { type: Type.STRING }, tavsiye: { type: Type.STRING }, oncelik: { type: Type.NUMBER }, onem_derecesi: { type: Type.NUMBER }, gorev_tipi: { type: Type.STRING } } } },
            simulasyon: { type: Type.OBJECT, properties: { senaryo: { type: Type.STRING }, hedef_puan: { type: Type.NUMBER }, gerekli_net_artisi: { type: Type.STRING }, gelisim_adimlari: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { baslik: { type: Type.STRING }, ne_yapmali: { type: Type.STRING }, nasil_yapmali: { type: Type.STRING }, sure: { type: Type.STRING }, ongoru: { type: Type.STRING } } } } } }
          },
          required: ["ogrenci_bilgi", "executive_summary", "konu_analizi", "calisma_plani", "simulasyon"]
        }
      }
    });

    const textResponse = response.text;
    if (!textResponse) throw new Error("Cevap yok.");

    const rawResult = JSON.parse(textResponse.replace(/```json|```/g, '').trim());
    return validateAndSanitizeAnalysis(rawResult);
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const chatWithCoach = async (currentMessage: string, history: ChatMessage[], analysisData: ComprehensiveAnalysis): Promise<string> => {
  try {
    const ai = getClient();
    const chat = ai.chats.create({
        model: AppConfig.gemini.modelName,
        config: { systemInstruction: `Sen Kukul AI Koçusun. Öğrenci: ${analysisData.ogrenci_bilgi.ad_soyad}. Kısa ve samimi ol.` },
        history: history.map(msg => ({ role: msg.role, parts: [{ text: msg.text }] }))
    });
    const result = await chat.sendMessage({ message: currentMessage });
    return result.text || "Hata.";
  } catch (e) {
    return "Bağlantı sorunu.";
  }
};
