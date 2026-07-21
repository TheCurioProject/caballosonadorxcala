'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminLoading() {
  return (
    <div className="w-full min-h-[60vh] flex flex-col items-center justify-center py-16 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-white/80 backdrop-blur-md p-8 md:p-12 rounded-3xl shadow-xl border border-gray-100 flex flex-col items-center max-w-sm w-full text-center space-y-6"
      >
        <div className="relative flex items-center justify-center">
          {/* Animated pulsing outer ring */}
          <div className="w-16 h-16 rounded-full bg-[#9B7E67]/15 animate-ping absolute" />
          <div className="w-14 h-14 rounded-2xl bg-[#2C2927] text-[#9B7E67] flex items-center justify-center shadow-lg relative z-10">
            <Loader2 className="w-7 h-7 animate-spin text-[#9B7E67]" />
          </div>
        </div>

        <div>
          <h3 className="font-serif text-xl font-bold text-[#23211F]">Loading Section...</h3>
          <p className="text-xs text-gray-400 font-light mt-1 uppercase tracking-widest">Casa Caballo Soñador</p>
        </div>

        {/* Skeleton lines for dynamic feel */}
        <div className="w-full space-y-2 pt-2">
          <div className="h-2 bg-gray-100 rounded-full w-full animate-pulse" />
          <div className="h-2 bg-gray-100 rounded-full w-3/4 mx-auto animate-pulse" />
        </div>
      </motion.div>
    </div>
  );
}
