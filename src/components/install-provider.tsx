'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface InstallContextType {
  isReadyForInstall: boolean;
  downloadApp: () => Promise<void>;
}

const InstallContext = createContext<InstallContextType>({
  isReadyForInstall: false,
  downloadApp: async () => {},
});

export const useInstallApp = () => useContext(InstallContext);

export function InstallProvider({ children }: { children: React.ReactNode }) {
  const [isReadyForInstall, setIsReadyForInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Register Service Worker
    if ("serviceWorker" in navigator && /^https?:/.test(location.protocol)) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("Service worker registration failed", err);
      });
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsReadyForInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      setIsReadyForInstall(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  async function downloadApp() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsReadyForInstall(false);
    }
  }

  return (
    <InstallContext.Provider value={{ isReadyForInstall, downloadApp }}>
      {children}
    </InstallContext.Provider>
  );
}
