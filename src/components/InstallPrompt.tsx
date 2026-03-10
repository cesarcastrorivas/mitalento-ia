'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Registro del Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
          console.error('[PWA] Error en registro de Service Worker:', err);
        });
      });
    }

    // 2. Verificar estado Standalone
    const checkIsStandalone = () => {
      const isAppStandalone = window.matchMedia('(display-mode: standalone)').matches 
        || ('standalone' in window.navigator && (window.navigator as any).standalone === true);
      setIsStandalone(isAppStandalone);
      return isAppStandalone;
    };

    if (checkIsStandalone()) return;

    // 3. Capturar evento de instalación
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      setIsVisible(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('[PWA] App instalada con éxito por el usuario corporativo');
    }
    
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  if (isStandalone || !isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] md:bottom-8 md:right-8 md:left-auto md:w-[400px]">
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-2xl rounded-2xl p-5 flex flex-col gap-3 relative animate-in fade-in slide-in-from-bottom-5 duration-500">
        <button 
          onClick={() => setIsVisible(false)}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>
        
        <div className="flex items-center gap-4">
          <div className="bg-[#4C1D95]/10 dark:bg-[#4C1D95]/30 p-3 rounded-xl flex-shrink-0 text-[#4C1D95] dark:text-[#9F7AEA]">
            <Download size={24} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 leading-tight">
              Instala PROLEV AI
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Optimiza tu entorno corporativo. Instala la app para acceso nativo y rápido desde tu dispositivo.
            </p>
          </div>
        </div>

        <button
          onClick={handleInstallClick}
          className="mt-2 w-full bg-[#4C1D95] hover:bg-[#3B1575] active:scale-[0.98] text-white font-medium py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
        >
          <Download size={18} />
          Instalar Aplicación
        </button>
      </div>
    </div>
  );
}
