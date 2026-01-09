import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa'; // PWA Eklentisi

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        // --- PWA AYARLARI BAŞLANGICI ---
        VitePWA({ 
            registerType: 'autoUpdate',
            includeAssets: ['kukul-icon.png'], 
            manifest: {
              name: 'LGS Analiz',
              short_name: 'LGS',
              description: 'LGS Karne Analiz ve Takip Uygulaması',
              theme_color: '#ffffff',
              background_color: '#ffffff',
              display: 'standalone',
              icons: [
                {
                  src: 'kukul-icon.png',
                  sizes: '192x192',
                  type: 'image/png'
                },
                {
                  src: 'kukul-icon.png',
                  sizes: '512x512',
                  type: 'image/png'
                }
              ]
            }
        })
        // --- PWA AYARLARI BİTİŞİ ---
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
