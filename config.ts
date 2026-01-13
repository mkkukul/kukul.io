
/**
 * Application Configuration
 * Centralizes environment variable access and global settings.
 */

export const AppConfig = {
  gemini: {
    // Accessing process.env.API_KEY here ensures it is captured correctly by build tools.
    apiKey: process.env.API_KEY || "",
    // Model configuration
    modelName: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.0,
      maxOutputTokens: 16384,
    }
  }
};

/**
 * Validates if critical configuration is present.
 * Should be called before making API requests.
 */
export const validateConfig = () => {
  if (!AppConfig.gemini.apiKey) {
    throw new Error("Sistem yapılandırma hatası: API Anahtarı bulunamadı. Lütfen yönetici ile iletişime geçin.");
  }
};
