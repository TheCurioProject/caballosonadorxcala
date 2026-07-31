'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminLoading() {
  return (
    <div className="w-full py-8 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="inline-flex items-center gap-2.5 px-4 py-2 bg-white/90 backdrop-blur-md rounded-full shadow-sm border border-gray-200 text-[#23211F]"
      >
        <Loader2 className="w-4 h-4 animate-spin text-[#9B7E67]" />
        <span className="text-sm md:text-base font-medium text-gray-600">Loading section...</span>
      </motion.div>
    </div>
  );
}
