'use client';

import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

export const RevealText = ({ children, delay = 0, className = "" }: { children: React.ReactNode, delay?: number, className?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });
  
  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <motion.div
        initial={{ y: "120%", opacity: 0 }}
        animate={isInView ? { y: 0, opacity: 1 } : { y: "120%", opacity: 0 }}
        transition={{ duration: 1, delay, ease: [0.33, 1, 0.68, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
};
