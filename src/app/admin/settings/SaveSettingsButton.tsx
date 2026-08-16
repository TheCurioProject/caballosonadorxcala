'use client';

import React, { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check } from 'lucide-react';

export default function SaveSettingsButton() {
  const { pending } = useFormStatus();
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // If pending just transitioned from true to false, show success animation
    if (!pending) {
      const wasPending = sessionStorage.getItem('wasPending');
      if (wasPending === 'true') {
        setShowSuccess(true);
        sessionStorage.removeItem('wasPending');
        const timer = setTimeout(() => setShowSuccess(false), 2500);
        return () => clearTimeout(timer);
      }
    } else {
      sessionStorage.setItem('wasPending', 'true');
    }
  }, [pending]);

  return (
    <button 
      type="submit" 
      disabled={pending}
      className={`w-full font-bold text-xs tracking-widest uppercase py-3 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${
        showSuccess 
          ? 'bg-green-600 text-white hover:bg-green-700'
          : 'bg-[#23211F] hover:bg-[#9B7E67] text-white disabled:opacity-70 disabled:hover:bg-[#23211F]'
      }`}
    >
      {pending ? (
        <>
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          SAVING...
        </>
      ) : showSuccess ? (
        <>
          <Check className="w-4 h-4 animate-in zoom-in" />
          SAVED SUCCESSFULLY
        </>
      ) : (
        'SAVE SETTINGS'
      )}
    </button>
  );
}
