'use client';

import { motion } from 'framer-motion';

export default function FloatingWhatsApp() {
  return (
    <motion.a
      href="https://wa.me/message/UHSDYFMOOVTJI1"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 bg-green-500 hover:bg-green-600 text-white rounded-full p-4 shadow-lg flex items-center justify-center transition-colors"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-8 h-8"
      >
        <path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.124.553 4.195 1.603 6.012L.15 23.46l5.57-1.463c1.761.968 3.754 1.481 5.807 1.481 6.645 0 12.031-5.385 12.031-12.031C23.559 5.385 18.173 0 12.031 0zm.004 21.46c-1.782 0-3.528-.481-5.061-1.39l-.363-.216-3.766.989.998-3.673-.237-.376A9.975 9.975 0 0 1 2.052 12.03c0-5.509 4.484-9.994 9.994-9.994 5.51 0 9.994 4.485 9.994 9.994 0 5.51-4.484 9.995-9.994 9.995zm5.485-7.498c-.301-.151-1.781-.88-2.056-.98-.276-.1-.477-.151-.678.151-.201.301-.778.98-.953 1.18-.175.201-.351.226-.652.075-2.08-.941-3.541-2.056-4.502-3.834-.176-.301.196-.282.637-.932.126-.176.063-.326-.012-.477-.075-.151-.678-1.631-.929-2.234-.244-.588-.492-.508-.678-.517-.176-.009-.377-.009-.578-.009s-.527.075-.803.376c-.276.301-1.054 1.029-1.054 2.509s1.079 2.91 1.23 3.111c.151.201 2.121 3.238 5.138 4.542.718.311 1.278.498 1.716.637.721.229 1.378.196 1.895.119.578-.086 1.781-.728 2.032-1.431.251-.703.251-1.306.176-1.431-.075-.126-.276-.201-.577-.352z" />
      </svg>
    </motion.a>
  );
}
