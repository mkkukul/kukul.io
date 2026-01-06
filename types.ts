
export interface StudentInfo {
  ad_soyad: string;
  sube: string;
  numara: string;
}

export interface TopicAnalysis {
  ders: string;
  konu: string;
  dogru: number;
  yanlis: number;
  bos: number;
  basari_yuzdesi: number;
  /**
   * Hesaplama: Ana dersler (Tr, Mat, Fen) için (Yanlış * 5.33 + Boş * 4.0),
   * Ara dersler (İnk, Din, İng) için (Yanlış * 1.33 + Boş * 1.0) formülü kullanılır.
   */
  lgs_kayip_puan: number;
  durum: 'Mükemmel' | 'İyi' | 'Geliştirilmeli' | 'Kritik'; 
}

export interface ExamPerformance {
  sinav_adi: string;
  yayin_evi: string;
  tarih: string; // YYYY-MM-DD
  toplam_puan: number;
  genel_yuzdelik: number;
  ders_netleri: { ders: string; net: number }[]; // Changed to array for better schema compliance
}

export interface SimulationStep {
  baslik: string; // Örn: "Matematik - İşlem Hatası Giderme"
  ne_yapmali: string; // Gelecekte ne yapmalı?
  nasil_yapmali: string; // Nasıl yapmalı?
  sure: string; // Ne kadar sürede ilerleyebilir?
  ongoru: string; // İstenilen çalışma gerçekleşirse öngörü ne olur?
}

export interface Simulation {
  senaryo: string; // Genel özet metni
  hedef_yuzdelik: number;
  hedef_puan: number; // Simülasyon sonucu tahmini puan
  puan_araligi: string; // Örn: "450 - 460"
  gerekli_net_artisi: string;
  gelisim_adimlari: SimulationStep[]; // Detaylı 6 maddelik yapı
}

export interface ActionItem {
  konu: string;
  ders: string;
  sebep: string; // "Kronik eksik", "Dikkat hatası potansiyeli" vb.
  tavsiye: string; // "50 soru çöz", "Konu tekrarı yap"
  oncelik: 1 | 2 | 3;
}

export interface ComprehensiveAnalysis {
  id?: string; // Unique ID for history tracking
  savedAt?: number; // Timestamp for when the analysis was saved
  ogrenci_bilgi: StudentInfo;
  executive_summary: {
    mevcut_durum: string;
    guclu_yonler: string[];
    zayif_yonler: string[];
    lgs_tahmini_yuzdelik: number;
  };
  exams_history: ExamPerformance[]; // For trend charts
  konu_analizi: TopicAnalysis[]; // Aggregated or latest detailed topic analysis
  calisma_plani: ActionItem[];
  simulasyon: Simulation;
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}