
/**
 * Application Configuration
 */

export const AppConfig = {
  gemini: {
    apiKey: process.env.API_KEY || "",
    modelName: 'gemini-2.0-flash', 
    generationConfig: {
      temperature: 0.1,       
      maxOutputTokens: 4096,  // Ultra hız için limit minimize edildi
      thinkingBudget: 0,      
    }
  }
};

export const validateConfig = () => {
  if (!AppConfig.gemini.apiKey) {
    throw new Error("API Anahtarı eksik.");
  }
};
