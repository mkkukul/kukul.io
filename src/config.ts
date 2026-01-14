
/**
 * Application Configuration
 * Centralizes environment variable access and global settings.
 */

export const AppConfig = {
  gemini: {
    // Accessing process.env.API_KEY here ensures it is captured correctly by build tools.
    apiKey: process.env.API_KEY || "",
    // Model configuration
    modelName: 'gemini-2.0-flash', // Updated for maximum speed and stability
    generationConfig: {
      temperature: 0.1,       // Reduced for deterministic results
      maxOutputTokens: 16384, // Optimized limit to prevent truncation without over-allocating
      thinkingBudget: 0,      // Thinking disabled for speed
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
