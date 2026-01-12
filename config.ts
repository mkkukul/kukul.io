
/**
 * Application Configuration
 * Centralizes environment variable access and global settings.
 */

export const AppConfig = {
  gemini: {
    // Accessing process.env.API_KEY here ensures it is captured correctly by build tools.
    apiKey: process.env.API_KEY || "",
    // Model configuration
    modelName: 'gemini-1.5-flash',
    generationConfig: {
      temperature: 0.0,
      maxOutputTokens: 16384, // Artırıldı: Büyük analizler için geniş alan
      thinkingBudget: 0,      // HIZ OPTİMİZASYONU: Düşünme bütçesi 0 yapıldı (devre dışı). Flash modeli yeterince hızlı ve akıllı.
    }
  }
};

/**
 * Validates if critical configuration is present.
 * Should be called before making API requests.
 */
export const validateConfig = () => {
  if (!AppConfig.gemini.apiKey) {
    throw new Error("API Anahtarı (API_KEY) yapılandırması eksik. Lütfen ortam değişkenlerini kontrol edin.");
  }
};