'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useInstallApp } from './install-provider';

export function InstallPrompt() {
  const { isReadyForInstall, downloadApp } = useInstallApp();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <AnimatePresence>
      {isReadyForInstall && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 md:bottom-4 md:left-auto md:right-4 md:translate-x-0 z-50 flex items-center gap-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800"
        >
          <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-xl text-blue-600 dark:text-blue-400">
            <Download size={24} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <h3 className="font-semibold text-sm">Install App</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Add to home screen for quick access</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={downloadApp} className="rounded-xl">
              Install
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="rounded-xl h-8 w-8 text-slate-500"
              onClick={() => setDismissed(true)}
            >
              <X size={16} />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
