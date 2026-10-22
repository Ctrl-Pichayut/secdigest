'use client';

import React from 'react';
import { MotionConfig } from 'framer-motion';

/**
 * App-wide motion settings. `reducedMotion="user"` makes every framer-motion
 * animation honor the OS "reduce motion" accessibility setting automatically,
 * so the polish never becomes a problem for motion-sensitive readers.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
