'use client';

import { motion } from 'framer-motion';

export default function AuroraBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        animate={{ x: [0, 60, 0], y: [0, -40, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        className="aurora-glow absolute left-[-12%] top-[-10%] h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl"
      />
      <motion.div
        animate={{ x: [0, -70, 0], y: [0, 50, 0], scale: [1, 1.06, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        className="aurora-glow absolute bottom-[-10%] right-[-5%] h-80 w-80 rounded-full bg-violet-500/20 blur-3xl"
      />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.04)_0%,transparent_40%,rgba(255,255,255,0.03)_100%)]" />
    </div>
  );
}
