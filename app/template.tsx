'use client';

import React from 'react';
import { motion } from 'framer-motion';

/**
 * App Router template: re-mounts on every navigation, so each page gets a
 * short, consistent slide-in. Keeps route changes feeling connected on mobile
 * without a heavy transition. Honors reduce-motion via the app-wide MotionConfig.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
