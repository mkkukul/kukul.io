
import { ComprehensiveAnalysis, ExamPerformance, TopicAnalysis, Simulation, ActionItem } from "../types";

/**
 * Helper: Ensure value is a safe number with optional range clamping
 */
const safeNumber = (val: any, fallback = 0, min?: number, max?: number): number => {
    let num = fallback;
    if (typeof val === 'number' && !isNaN(val)) {
        num = val;
    } else if (typeof val === 'string') {
        // Handle "15,5" or "15.5" or "15%"
        const clean = val.replace(/,/g, '.').replace(/%/g, '');
        const parsed = parseFloat(clean);
        if (!isNaN(parsed)) num = parsed;
    }
    
    if (min !== undefined && num < min) return min;
    if (max !== undefined && num > max) return max;
    return num;
};

/**
 * Helper: Ensure value is a clean string
 */
const safeString = (val: any, fallback = ""): string => {
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'number') return String(val);
    if (val === null || val === undefined) return fallback;
    return String(val).trim();
};

/**
 * Helper: Ensure value is an array
 */
const safeArray = <T>(val: any): T[] => {
    if (Array.isArray(val)) return val;
    return [];
};

/**
 * Helper: Detect if a lesson is a "Main" lesson (Türkçe, Mat, Fen) for scoring formulas
 */
const isMainLesson = (lessonName: string): boolean => {
    const lower = safeString(lessonName).toLowerCase();
    return (
        lower.includes('mat') || 
        lower.includes('fen') || 
        lower.includes('türk') || 
        lower.includes('turk')
    );
};

/**
 * Enforces the LGS Lost Points Formula defined in constants.ts
 * Mat, Fen, Tr: (Yanlış * 5.33) + (Boş * 4.0)
 * Others: (Yanlış * 1.33) + (Boş * 1.0)
 */
const calculateLostPoints = (lessonName: string, wrong: number, empty: number): number => {
    const w = safeNumber(wrong, 0, 0); // Cannot be negative
    const e = safeNumber(empty, 0, 0); // Cannot be negative
    
    if (isMainLesson(lessonName)) {
        return (w * 5.33) + (e * 4.0);
    } else {
        return (w * 1.33) + (e * 1.0);
    }
};

/**
 * Validates and Sanitizes a Topic Analysis Row
 */
const sanitizeTopic = (raw: any): TopicAnalysis => {
    const ders = safeString(raw.ders, "Genel");
    const konu = safeString(raw.konu, "Belirsiz Konu");
    const dogru = safeNumber(raw.dogru, 0, 0);
    const yanlis = safeNumber(raw.yanlis, 0, 0);
    const bos = safeNumber(raw.bos, 0, 0);
    
    // Recalculate percentage to ensure math accuracy
    const totalQuestions = dogru + yanlis + bos;
    const calculatedPercent = totalQuestions > 0 ? (dogru / totalQuestions) * 100 : 0;
    
    // Prioritize AI's percentage if it exists and is close, otherwise use calculated
    // Clamp to 0-100
    const aiPercent = safeNumber(raw.basari_yuzdesi, -1);
    const basari_yuzdesi = (aiPercent !== -1 && Math.abs(aiPercent - calculatedPercent) < 5) 
        ? safeNumber(aiPercent, 0, 0, 100)
        : safeNumber(calculatedPercent, 0, 0, 100);

    // Strict Formula Enforcement for Lost Points
    const lgs_kayip_puan = calculateLostPoints(ders, yanlis, bos);

    // Derive Status if missing or invalid
    let durum: TopicAnalysis['durum'] = raw.durum;
    if (!['Mükemmel', 'İyi', 'Geliştirilmeli', 'Kritik'].includes(durum)) {
        if (basari_yuzdesi >= 80) durum = 'Mükemmel';
        else if (basari_yuzdesi >= 70) durum = 'İyi';
        else if (basari_yuzdesi >= 50) durum = 'Geliştirilmeli';
        else durum = 'Kritik';
    }

    return {
        ders,
        konu,
        dogru,
        yanlis,
        bos,
        basari_yuzdesi: parseFloat(basari_yuzdesi.toFixed(2)),
        lgs_kayip_puan: parseFloat(lgs_kayip_puan.toFixed(2)),
        durum
    };
};

/**
 * Validates and Sanitizes Exam History
 */
const sanitizeExam = (raw: any): ExamPerformance => {
    const ders_netleri = safeArray(raw.ders_netleri).map((d: any) => ({
        ders: safeString(d.ders, "Ders"),
        net: safeNumber(d.net, 0) // Net can theoretically be negative (e.g. 3 wrongs 1 right = -0.66)
    }));

    return {
        sinav_adi: safeString(raw.sinav_adi, "Deneme Sınavı"),
        yayin_evi: safeString(raw.yayin_evi, "Bilinmiyor"),
        tarih: safeString(raw.tarih),
        toplam_puan: safeNumber(raw.toplam_puan, 0, 0, 500), // Max 500
        genel_yuzdelik: safeNumber(raw.genel_yuzdelik, 0, 0, 100), // Max 100%
        ders_netleri
    };
};

/**
 * Main Validation Entry Point
 */
export const validateAndSanitizeAnalysis = (raw: any): ComprehensiveAnalysis => {
    if (!raw || typeof raw !== 'object') {
        throw new Error("Geçersiz veri formatı: AI yanıtı bir nesne değil.");
    }

    // 1. Student Info
    const ogrenci_bilgi = {
        ad_soyad: safeString(raw.ogrenci_bilgi?.ad_soyad, "Öğrenci"),
        sube: safeString(raw.ogrenci_bilgi?.sube, "-"),
        numara: safeString(raw.ogrenci_bilgi?.numara, "-")
    };

    // 2. Executive Summary
    const rawSummary = raw.executive_summary || {};
    const executive_summary = {
        mevcut_durum: safeString(rawSummary.mevcut_durum, "Analiz hazırlanıyor..."),
        guclu_yonler: safeArray(rawSummary.guclu_yonler).map(s => safeString(s)),
        zayif_yonler: safeArray(rawSummary.zayif_yonler).map(s => safeString(s)),
        lgs_tahmini_yuzdelik: safeNumber(rawSummary.lgs_tahmini_yuzdelik, 0, 0, 100)
    };

    // 3. Exam History
    const exams_history = safeArray(raw.exams_history).map(sanitizeExam);

    // 4. Topic Analysis
    const konu_analizi = safeArray(raw.konu_analizi).map(sanitizeTopic);

    // 5. Action Plan
    const calisma_plani = safeArray(raw.calisma_plani).map((item: any) => {
        // Enforce 1, 2, 3 priority
        let priority = safeNumber(item.oncelik, 2);
        if (![1, 2, 3].includes(priority)) priority = 2;

        return {
            konu: safeString(item.konu, "Konu"),
            ders: safeString(item.ders, "Ders"),
            sebep: safeString(item.sebep, "Gelişim alanı."),
            tavsiye: safeString(item.tavsiye, "Tekrar yapın."),
            oncelik: priority as 1 | 2 | 3,
            onem_derecesi: safeNumber(item.onem_derecesi, 5, 1, 10), // 1-10 range, default 5
            gorev_tipi: safeString(item.gorev_tipi, "Genel Çalışma")
        };
    });

    // 6. Simulation
    const rawSim = raw.simulasyon || {};
    const simulasyon: Simulation = {
        senaryo: safeString(rawSim.senaryo, "Simülasyon senaryosu hazırlanıyor..."),
        hedef_yuzdelik: safeNumber(rawSim.hedef_yuzdelik, 0, 0, 100),
        hedef_puan: safeNumber(rawSim.hedef_puan, 0, 0, 500),
        puan_araligi: safeString(rawSim.puan_araligi, "-"),
        gerekli_net_artisi: safeString(rawSim.gerekli_net_artisi, "-"),
        gelisim_adimlari: safeArray(rawSim.gelisim_adimlari).map((step: any) => ({
            baslik: safeString(step.baslik, "Adım"),
            ne_yapmali: safeString(step.ne_yapmali, "-"),
            nasil_yapmali: safeString(step.nasil_yapmali, "-"),
            sure: safeString(step.sure, "-"),
            ongoru: safeString(step.ongoru, "-")
        }))
    };

    return {
        // ID and Timestamp are passed through if present (handled by App.tsx)
        id: raw.id, 
        savedAt: raw.savedAt,
        ogrenci_bilgi,
        executive_summary,
        exams_history,
        konu_analizi,
        calisma_plani,
        simulasyon
    };
};
