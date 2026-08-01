'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useDragControls } from 'framer-motion';
import { X, CalendarDays, ArrowRight, Check, ChefHat, CreditCard, User, Map, Utensils, Minus, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { ActionLoadingScreen } from '../ui/ActionLoadingScreen';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/style.css';
import dynamic from 'next/dynamic';
import { CountryCodeDropdown } from './CountryCodeDropdown';

const FluidHorseAnimation = dynamic(() => import('../FluidHorseAnimation'), {
  ssr: false,
});
import { format, differenceInDays } from 'date-fns';
import { es, enUS, de } from 'date-fns/locale';
import { useDictionary } from '@/i18n/DictionaryContext';
import { useScrollLock } from '@/hooks/useScrollLock';
/* ─── Hook: useMediaQuery ─── */
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);
  return matches;
}

/* ─── Confetti Particle ─── */
const ConfettiParticle = ({ delay, index }: { delay: number; index: number }) => {
  const colors = ['#9B7E67', '#D4A574', '#C9B99A', '#E8D5B7', '#F5E6D0', '#B8956A'];
  const color = colors[index % colors.length];
  
  // Use window size if available (safe since this only renders on client interaction)
  const w = typeof window !== 'undefined' ? window.innerWidth : 1000;
  const h = typeof window !== 'undefined' ? window.innerHeight : 800;
  
  const x = (Math.random() - 0.5) * w;
  const y = -(Math.random() * (h / 2) + 100);
  const rotate = Math.random() * 720 - 360;
  const size = Math.random() * 8 + 6;

  return (
    <motion.div
      initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
      animate={{ opacity: [1, 1, 0], x, y: [0, y, y + 200], rotate, scale: [1, 1.2, 0.5] }}
      transition={{ duration: 2.5, delay, ease: 'easeOut' }}
      className="fixed top-1/2 left-1/2 z-[999999] pointer-events-none"
      style={{
        width: size,
        height: size * 1.5,
        backgroundColor: color,
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
        transform: 'translate(-50%, -50%)',
      }}
    />
  );
};

/* ─── Animated Counter ─── */
const AnimatedCounter = ({ value, prefix = '$' }: { value: number; prefix?: string }) => {
  const motionValue = useMotionValue(0);
  const [display, setDisplay] = useState(`${prefix}0`);

  useEffect(() => {
    const controls = motionValue;
    const start = controls.get();
    const duration = 800;
    const startTime = performance.now();

    let frameId: number;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      controls.set(start + (value - start) * eased);
      setDisplay(`${prefix}${Math.round(controls.get()).toLocaleString('en-US')}`);
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };
    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [value, motionValue, prefix]);

  return <span>{display}</span>;
};

/* ─── Premium Input ─── */
const PremiumInput = ({
  id,
  type,
  label,
  placeholder,
  value,
  onChange,
  isValid,
  delay = 0,
  errorMessage,
  className = '',
}: {
  id: string;
  type: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  isValid: boolean;
  delay?: number;
  errorMessage?: string;
  className?: string;
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`relative group pt-6 ${className}`}
    >
      <div className="relative">
        <input
          type={type}
          id={id}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="w-full bg-transparent border-b-2 border-gray-200 py-4 pr-10 text-[#23211F] text-xl md:text-2xl focus:outline-none transition-colors peer font-light placeholder:text-transparent"
          placeholder={placeholder}
        />
        <motion.div
          className="absolute bottom-0 left-0 h-[2px] bg-[#9B7E67]"
          initial={{ width: '0%' }}
          animate={{ width: isFocused ? '100%' : value ? '100%' : '0%' }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        />
        <motion.label
          htmlFor={id}
          className="absolute left-0 text-gray-400 pointer-events-none origin-left whitespace-nowrap truncate max-w-[90%]"
          animate={{
            y: isFocused || value ? -28 : 0,
            scale: isFocused || value ? 0.7 : 1,
            color: isFocused ? '#9B7E67' : value ? '#9B7E67' : '#9ca3af',
            fontWeight: isFocused || value ? 700 : 300,
            letterSpacing: isFocused || value ? '0.15em' : '0em',
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          style={{ top: '1rem' }}
        >
          {isFocused || value ? (label?.toUpperCase() || '') : placeholder}
        </motion.label>
        <AnimatePresence>
          {isValid && value && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9B7E67]"
            >
              <Check size={18} strokeWidth={3} />
            </motion.div>
          )}
        </AnimatePresence>
        <div className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-in-out ${!isValid && value.length > 0 && errorMessage ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
          <div className="overflow-hidden">
            <p className="text-red-500 text-[10px] md:text-[11px] font-bold tracking-widest uppercase">
              {errorMessage}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ─── Step Progress Indicator ─── */
const StepIndicator = ({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) => (
  <div className="flex items-center justify-between w-full gap-1 md:gap-2 mb-6 md:mb-8">
    {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
      <React.Fragment key={step}>
        <motion.div
          className="flex items-center justify-center relative shrink-0"
          animate={{
            scale: currentStep === step ? 1 : 0.85,
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <motion.div
            className="w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[10px] md:text-[11px] font-bold relative overflow-hidden shrink-0"
            animate={{
              backgroundColor: currentStep >= step ? '#23211F' : '#E5E7EB',
              color: currentStep >= step ? '#F9F7F4' : '#9CA3AF',
            }}
            transition={{ duration: 0.4 }}
          >
            <AnimatePresence mode="wait">
              {currentStep > step ? (
                <motion.div
                  key="check"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  <Check size={14} strokeWidth={3} />
                </motion.div>
              ) : (
                <motion.span
                  key="number"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  {step}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
          {currentStep === step && (
            <motion.div
              className="absolute inset-[-4px] md:inset-[-6px] rounded-full border-[1.5px] border-[#9B7E67] shrink-0"
              animate={{ 
                scale: [0.95, 1, 1.05, 1, 0.95],
                opacity: [0.2, 0.6, 1, 0.6, 0.2]
              }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            />
          )}
        </motion.div>
        {step < totalSteps && (
          <motion.div
            className="h-[2px] flex-1 min-w-[8px] max-w-full rounded-full overflow-hidden bg-gray-200"
          >
            <motion.div
              className="h-full bg-[#23211F] rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: currentStep > step ? '100%' : '0%' }}
              transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            />
          </motion.div>
        )}
      </React.Fragment>
    ))}
  </div>
);

/* ─── Premium Button ─── */
const PremiumButton = ({
  children,
  onClick,
  disabled = false,
  type = 'button',
  variant = 'primary',
  backText = 'Volver'
}: {
  children?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'back';
  backText?: string;
}) => {
  if (variant === 'back') {
    return (
      <motion.button
        onClick={onClick}
        type={type}
        whileHover={{ x: -4 }}
        className="text-[10px] md:text-[11px] font-bold text-gray-400 hover:text-[#23211F] uppercase tracking-widest mb-6 md:mb-8 text-left transition-colors flex items-center gap-2"
      >
        <motion.span
          animate={{ x: [0, -3, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          ←
        </motion.span>
        {backText}
      </motion.button>
    );
  }

  return (
    <motion.button
      onClick={onClick}
      type={type}
      disabled={disabled}
      whileHover={disabled ? {} : { scale: 1.02, y: -2 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      className={`w-full py-4 rounded-full font-bold text-base md:text-lg uppercase tracking-widest flex items-center justify-center gap-3 transition-all relative overflow-hidden ${
        disabled
          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
          : 'bg-[#23211F] text-[#F9F7F4] shadow-xl hover:shadow-2xl'
      }`}
    >
      {!disabled && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ x: '-100%' }}
          whileHover={{ x: '100%' }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
          }}
        />
      )}
      <span className="relative z-10 flex items-center gap-2">
        {children}
      </span>
    </motion.button>
  );
};

/* ─── Dynamic DB Translation Helper ─── */
const dbTranslations: Record<string, { en: string, es: string }> = {
  // Food Service Types
  "Personalized Service": {
    en: "Personalized Service",
    es: "Servicio Personalizado"
  },
  "Servicio Personalizado": {
    en: "Personalized Service",
    es: "Servicio Personalizado"
  },
  "Dinner Service": {
    en: "Dinner Service",
    es: "Servicio de Cena"
  },
  "Servicio de Cena": {
    en: "Dinner Service",
    es: "Servicio de Cena"
  },
  // Catering price names (plain text from DB)
  "Asistencia de desayuno": {
    en: "Breakfast Assistance",
    es: "Asistencia de desayuno"
  },
  "Asistencia para la cena": {
    en: "Dinner Assistance",
    es: "Asistencia para la cena"
  },
  "Asistencia para desayuno y cena": {
    en: "Breakfast & Dinner Assistance",
    es: "Asistencia para desayuno y cena"
  },
  "Servicio de Cena (6 a 8 personas)": {
    en: "Dinner Service (6 to 8 people)",
    es: "Servicio de Cena (6 a 8 personas)"
  },
  "Servicio de Cena (10 a 12 personas)": {
    en: "Dinner Service (10 to 12 people)",
    es: "Servicio de Cena (10 a 12 personas)"
  },
  // English variants (in case admin writes in English)
  "Breakfast Assistance": {
    en: "Breakfast Assistance",
    es: "Asistencia de desayuno"
  },
  "Dinner Assistance": {
    en: "Dinner Assistance",
    es: "Asistencia para la cena"
  },
  "Breakfast & Dinner Assistance": {
    en: "Breakfast & Dinner Assistance",
    es: "Asistencia para desayuno y cena"
  },
  "Dinner Service (6 to 8 people)": {
    en: "Dinner Service (6 to 8 people)",
    es: "Servicio de Cena (6 a 8 personas)"
  },
  "Dinner Service (10 to 12 people)": {
    en: "Dinner Service (10 to 12 people)",
    es: "Servicio de Cena (10 a 12 personas)"
  },
  // Descriptions
  "Large groups and families often purchase ingredients and prepare their own meals. Select from our Personalized Service options to request extra help in the kitchen. Our staff will assist you with preparations, service and clean up allowing more for more time with family and less stress in the kitchen.": {
    en: "Large groups and families often purchase ingredients and prepare their own meals. Select from our Personalized Service options to request extra help in the kitchen. Our staff will assist you with preparations, service and clean up allowing more for more time with family and less stress in the kitchen.",
    es: "Los grupos grandes y las familias a menudo compran ingredientes y preparan sus propias comidas. Elija entre nuestras opciones de Servicio Personalizado para solicitar ayuda adicional en la cocina. Nuestro personal lo asistirá con las preparaciones, el servicio y la limpieza, permitiendo más tiempo con la familia y menos estrés en la cocina."
  },
  "Los grupos grandes y las familias a menudo compran ingredientes y preparan sus propias comidas. Elija entre nuestras opciones de Servicio Personalizado para solicitar ayuda adicional en la cocina. Nuestro personal lo asistirá con las preparaciones, el servicio y la limpieza, permitiendo más tiempo con la familia y menos estrés en la cocina.": {
    en: "Large groups and families often purchase ingredients and prepare their own meals. Select from our Personalized Service options to request extra help in the kitchen. Our staff will assist you with preparations, service and clean up allowing more for more time with family and less stress in the kitchen.",
    es: "Los grupos grandes y las familias a menudo compran ingredientes y preparan sus propias comidas. Elija entre nuestras opciones de Servicio Personalizado para solicitar ayuda adicional en la cocina. Nuestro personal lo asistirá con las preparaciones, el servicio y la limpieza, permitiendo más tiempo con la familia y menos estrés en la cocina."
  },
  "For groups wanting to maximize daily activities we offer dinner Service between 5:00 and 7:00 PM (Pacific Time). Our chef will prepare a meal from our dinner menu and look after the kitchen for you. Treat your family to an evening of Authentic Mexican Cuisine! This Service is perfect for groups of 6-12 people.": {
    en: "For groups wanting to maximize daily activities we offer dinner Service between 5:00 and 7:00 PM. Our chef will prepare a meal from our dinner menu and look after the kitchen for you. Treat your family to an evening of Authentic Mexican Cuisine! This Service is perfect for groups of 6-12 people.",
    es: "Para los grupos que desean maximizar las actividades diarias, ofrecemos servicio de cena entre las 5:00 y las 7:00 PM. Nuestro chef preparará una comida de nuestro menú de cena y se encargará de la cocina por usted. ¡Invite a su familia a una noche de auténtica cocina mexicana! Este servicio es perfecto para grupos de 6 a 12 personas."
  },
  "Para los grupos que desean maximizar las actividades diarias, ofrecemos servicio de cena entre las 5:00 y las 7:00 PM (hora del Pacífico). Nuestro chef preparará una comida de nuestro menú de cena y se encargará de la cocina por usted. ¡Invite a su familia a una noche de auténtica cocina mexicana! Este servicio es perfecto para grupos de 6 a 12 personas.": {
    en: "For groups wanting to maximize daily activities we offer dinner Service between 5:00 and 7:00 PM. Our chef will prepare a meal from our dinner menu and look after the kitchen for you. Treat your family to an evening of Authentic Mexican Cuisine! This Service is perfect for groups of 6-12 people.",
    es: "Para los grupos que desean maximizar las actividades diarias, ofrecemos servicio de cena entre las 5:00 y las 7:00 PM. Nuestro chef preparará una comida de nuestro menú de cena y se encargará de la cocina por usted. ¡Invite a su familia a una noche de auténtica cocina mexicana! Este servicio es perfecto para grupos de 6 a 12 personas."
  },
  "For groups wanting to maximize daily activities we offer dinner Service between 5:00 and 7:00 PM. Our chef will prepare a meal from our dinner menu and look after the kitchen for you. Treat your family to an evening of Authentic Mexican Cuisine! This Service is perfect for groups of 6-12 people.": {
    en: "For groups wanting to maximize daily activities we offer dinner Service between 5:00 and 7:00 PM. Our chef will prepare a meal from our dinner menu and look after the kitchen for you. Treat your family to an evening of Authentic Mexican Cuisine! This Service is perfect for groups of 6-12 people.",
    es: "Para los grupos que desean maximizar las actividades diarias, ofrecemos servicio de cena entre las 5:00 y las 7:00 PM. Nuestro chef preparará una comida de nuestro menú de cena y se encargará de la cocina por usted. ¡Invite a su familia a una noche de auténtica cocina mexicana! Este servicio es perfecto para grupos de 6 a 12 personas."
  },
  "Para los grupos que desean maximizar las actividades diarias, ofrecemos servicio de cena entre las 5:00 y las 7:00 PM. Nuestro chef preparará una comida de nuestro menú de cena y se encargará de la cocina por usted. ¡Invite a su familia a una noche de auténtica cocina mexicana! Este servicio es perfecto para grupos de 6 a 12 personas.": {
    en: "For groups wanting to maximize daily activities we offer dinner Service between 5:00 and 7:00 PM. Our chef will prepare a meal from our dinner menu and look after the kitchen for you. Treat your family to an evening of Authentic Mexican Cuisine! This Service is perfect for groups of 6-12 people.",
    es: "Para los grupos que desean maximizar las actividades diarias, ofrecemos servicio de cena entre las 5:00 y las 7:00 PM. Nuestro chef preparará una comida de nuestro menú de cena y se encargará de la cocina por usted. ¡Invite a su familia a una noche de auténtica cocina mexicana! Este servicio es perfecto para grupos de 6 a 12 personas."
  },
  "Personalized service for your group": {
    en: "Personalized service for your group",
    es: "Servicio personalizado para tu grupo"
  },
  "Dinner service for your group": {
    en: "Dinner service for your group",
    es: "Servicio de cena para tu grupo"
  },
  // Tour destinations (plain text from DB)
  "Ojo de Agua": { en: "Water Eye", es: "Ojo de Agua" },
  "Río Molote": { en: "Molote River", es: "Río Molote" },
  "El Capomo": { en: "El Capomo", es: "El Capomo" },
  "Las Cuevas": { en: "The Caves", es: "Las Cuevas" },
  "Jumurrca": { en: "Jumurrca", es: "Jumurrca" },
  "Alta Vista": { en: "Alta Vista", es: "Alta Vista" },
  "Volcán": { en: "Volcano", es: "Volcán" },
  // Dish names (plain text from DB)
  "Enchiladas rojas": { en: "Red Enchiladas", es: "Enchiladas rojas" },
  "Chiles rellenos": { en: "Stuffed Chiles", es: "Chiles rellenos" },
  "Filete en alcaparras": { en: "Fillet in Capers", es: "Filete en alcaparras" },
  "Tacos de asada y adobada": { en: "Asada and Adobada Tacos", es: "Tacos de asada y adobada" },
  "Spaguetti con camarones": { en: "Shrimp Spaghetti", es: "Spaguetti con camarones" },
  "Filete empapelado": { en: "Paper-Wrapped Fillet", es: "Filete empapelado" },
  // Dish descriptions
  "Tortilla enrollada, rellena de pollo, bañadas de salsa roja sin picante, acompañadas de lechuga, crema, queso y cebolla.": {
    en: "Rolled tortilla stuffed with chicken, bathed in non-spicy red sauce, accompanied by lettuce, cream, cheese, and onion.",
    es: "Tortilla enrollada, rellena de pollo, bañadas de salsa roja sin picante, acompañadas de lechuga, crema, queso y cebolla."
  },
  "Chile poblano relleno de un guiso de camarón y queso gratinado, bañados de una salsa cremosa roja, acompañado con arroz rojo.": {
    en: "Poblano chile stuffed with shrimp stew and gratin cheese, bathed in creamy red sauce, accompanied with red rice.",
    es: "Chile poblano relleno de un guiso de camarón y queso gratinado, bañados de una salsa cremosa roja, acompañado con arroz rojo."
  },
  "Filete a la plancha sobre una cama de puré de papa, bañado de una salsa con mantequilla y alcaparras.": {
    en: "Grilled steak on a bed of mashed potatoes, bathed in a sauce with butter and capers.",
    es: "Filete a la plancha sobre una cama de puré de papa, bañado de una salsa con mantequilla y alcaparras."
  },
  "Tortilla de maíz con carne, cilantro y cebolla. Se acompaña con variedad de salsas.": {
    en: "Corn tortilla with meat, cilantro, and onion. Accompanied with a variety of sauces.",
    es: "Tortilla de maíz con carne, cilantro y cebolla. Se acompaña con variedad de salsas."
  },
  "Spaguetti con camarones en salsa Alfredo.": {
    en: "Spaghetti with shrimp in Alfredo sauce.",
    es: "Spaguetti con camarones en salsa Alfredo."
  },
  "Filete sazonado con finas hierbas, envuelto en papel y acompañado de verduras salteadas y arroz.": {
    en: "Steak seasoned with fine herbs, wrapped in paper, accompanied by sautéed vegetables and rice.",
    es: "Filete sazonado con finas hierbas, envuelto en papel y acompañado de verduras salteadas y arroz."
  }
};

const translateDB = (text: string | undefined | null, isEn: boolean): string => {
  if (!text) return text || '';
  const trimmed = text.trim();
  
  // 1. Legacy support: JSON from DB ({"en":"...","es":"..."})
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.en !== undefined && parsed.es !== undefined) {
        return isEn ? parsed.en : parsed.es;
      }
    } catch (e) {
      // Not valid JSON, try to extract values using regex to avoid showing weird format
      try {
        const enMatch = trimmed.match(/['"]?en['"]?\s*:\s*['"](.*?)['"]/i);
        const esMatch = trimmed.match(/['"]?es['"]?\s*:\s*['"](.*?)['"]/i);
        if (enMatch && esMatch) {
          return isEn ? enMatch[1] : esMatch[1];
        }
      } catch (err) {}
    }
  }

  // 2. Custom bilingual separator support "English / Español" or "English | Español"
  if (trimmed.includes(' | ')) {
    const parts = trimmed.split(' | ');
    return isEn ? parts[0].trim() : (parts[1] || parts[0]).trim();
  }
  if (trimmed.includes(' / ')) {
    const parts = trimmed.split(' / ');
    return isEn ? parts[0].trim() : (parts[1] || parts[0]).trim();
  }

  // 3. Exact match in dictionary
  if (dbTranslations[trimmed]) {
    return isEn ? dbTranslations[trimmed].en : dbTranslations[trimmed].es;
  }

  // 4. Case-insensitive match
  for (const [key, val] of Object.entries(dbTranslations)) {
    if (key.toLowerCase() === trimmed.toLowerCase()) {
      return isEn ? val.en : val.es;
    }
  }
  
  return text;
};

/* ─── Animated Day Button for Calendar ─── */
const AnimatedDayButton = (props: any) => {
  return (
    <motion.button
      {...props}
      whileHover={props.disabled ? {} : { scale: 1.15 }}
      whileTap={props.disabled ? {} : { scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    />
  );
};

/* ─── Main Modal ─── */
export const PremiumBookingModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const dragControls = useDragControls();
  const dictContext = useDictionary();
  const dict = dictContext as any; // Cast for dynamic additions

  // Detect correct locale based on dictionary (fallback to es)
  const currentLangCode = dict.nav?.rooms === 'Rooms' ? 'en' : dict.nav?.rooms === 'Zimmer' ? 'de' : 'es';
  const isEn = currentLangCode === 'en';
  const localeObj = currentLangCode === 'en' ? enUS : currentLangCode === 'de' ? de : es;

  const [step, setStep] = useState<string>('dates');
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [disabledRanges, setDisabledRanges] = useState<{from: Date, to: Date}[]>([]);
  const [bookedRanges, setBookedRanges] = useState<{from: Date, to: Date}[]>([]);
  const [bufferRanges, setBufferRanges] = useState<DateRange[]>([]);
  const [blockedRanges, setBlockedRanges] = useState<DateRange[]>([]);
  const [tourBookedDates, setTourBookedDates] = useState<string[]>([]);
  const [propertySettings, setPropertySettings] = useState<any>(null);
  
  // Form Data
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+52');
  const [guestPhone, setGuestPhone] = useState('');
  
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Extras state
  const [foodServices, setFoodServices] = useState<any[]>([]);
  const [tours, setTours] = useState<any[]>([]);
  
  const [wantsCook, setWantsCook] = useState<boolean | null>(null);
  const [selectedCookService, setSelectedCookService] = useState<any | null>(null);
  const [expandedDishId, setExpandedDishId] = useState<number | null>(null);
  const [planByDate, setPlanByDate] = useState<Record<string, string>>({});
  const [selectedDateForPlan, setSelectedDateForPlan] = useState<string>('');
  const [selectedDishes, setSelectedDishes] = useState<number[]>([]);
  const [dinnerGroupSize, setDinnerGroupSize] = useState<string>(''); // '6-8' or '10-12'
  const [dishesByDate, setDishesByDate] = useState<Record<string, number>>({});
  const [selectedDateForMenu, setSelectedDateForMenu] = useState<string>('');

  const [wantsATV, setWantsATV] = useState<boolean | null>(null);
  const [minTourPax, setMinTourPax] = useState(3);
  const [maxTourPax, setMaxTourPax] = useState(10);
  const [atvPeople, setAtvPeople] = useState(3);
  const [atvByDate, setAtvByDate] = useState<Record<string, string>>({});
  const [selectedDateForAtv, setSelectedDateForAtv] = useState<string>('');

  useEffect(() => {
    if (isMobile && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [step, isMobile, wantsCook, wantsATV]);

  const currency = 'MXN';
  const formatPrice = (amountInMxn: number) => `$${Math.round(amountInMxn).toLocaleString()} MXN`;
  const getConvertedPrice = (amountInMxn: number) => amountInMxn;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useScrollLock(isOpen);

  useEffect(() => {
    Promise.all([
      fetch('/api/services/food').then(res => res.json()),
      fetch('/api/services/tours').then(res => res.json()),
      fetch('/api/settings/tours').then(res => res.json())
    ]).then(([foodData, toursData, settingsData]) => {
      if (Array.isArray(foodData)) setFoodServices(foodData);
      if (Array.isArray(toursData)) setTours(toursData);
      if (settingsData) {
        const min = settingsData.minTourPax || 3;
        setMinTourPax(min);
        setMaxTourPax(settingsData.maxTourPax || 10);
        setAtvPeople(min);
      }
    }).catch(console.error);
  }, []);

  // Fetch blocked dates on open
  useEffect(() => {
    if (isOpen) {
      fetch('/api/availability')
        .then(res => res.json())
        .then(data => {
          if (data.disabledRanges) {
            setDisabledRanges(data.disabledRanges.map((r: any) => ({ from: new Date(r.from), to: new Date(r.to) })));
          }
          if (data.bookedRanges) {
            setBookedRanges(data.bookedRanges.map((r: any) => ({ from: new Date(r.from), to: new Date(r.to) })));
          }
          setBufferRanges(data.bufferRanges || []);
          setBlockedRanges(data.blockedRanges || []);
          setTourBookedDates(data.tourBookedDates || []);
          if (data.propertySettings) {
            setPropertySettings(data.propertySettings);
          }
        })
        .catch(console.error);
    } else {
      setTimeout(() => {
        setStep('dates');
        setRange(undefined);
        setGuestName('');
        setGuestEmail('');
        setGuestPhone('');
        setWantsCook(null);
        setSelectedCookService(null);
        setExpandedDishId(null);
        setPlanByDate({});
        setSelectedDateForPlan('');
        setSelectedDishes([]);
        setWantsATV(null);
        setAtvPeople(1);
        setAtvByDate({});
        setSelectedDateForAtv('');
        setError(null);
        setIsSuccess(false);
        setShowConfetti(false);
      }, 500);
    }
  }, [isOpen]);

  const isTourBookedOnSelectedDates = React.useMemo(() => {
    if (!range?.from || !range?.to || !tourBookedDates.length) return false;
    let current = new Date(range.from);
    current.setHours(0,0,0,0);
    const end = new Date(range.to);
    end.setHours(0,0,0,0);
    while (current <= end) {
      if (tourBookedDates.includes(current.toISOString())) {
        return true;
      }
      current.setDate(current.getDate() + 1);
    }
    return false;
  }, [range, tourBookedDates]);

  useEffect(() => {
    if (isTourBookedOnSelectedDates && wantsATV === true) {
      setWantsATV(false);
      setAtvByDate({});
      setSelectedDateForAtv('');
    }
  }, [isTourBookedOnSelectedDates, wantsATV]);

  const basePrice = useMemo(() => {
    return getConvertedPrice(propertySettings?.basePrice || 15000); // Dynamic base price from settings
  }, [getConvertedPrice, propertySettings]);

  const nights = (range?.from && range?.to) ? differenceInDays(range.to, range.from) : 0;
  const isDinnerService = (name: string | undefined | null) => name?.toLowerCase().includes('dinner') || name?.toLowerCase().includes('cena');

  // Helper to match dinner group size patterns regardless of language
  // dinnerGroupSize is '6-8' or '10-12', DB name could contain '6 to 8', '6 a 8', '6-8', etc.
  const matchesDinnerSize = (name: string | undefined | null, size: string): boolean => {
    if (!name || !size) return false;
    const n = name.toLowerCase();
    if (n.includes(size)) return true; // Direct match: '6-8' in name
    const [min, max] = size.split('-');
    if (min && max) {
      // Match patterns: '6 to 8', '6 a 8', '6-8', '(6 a 8', '10 to 12', etc.
      if (n.includes(`${min} to ${max}`) || n.includes(`${min} a ${max}`)) return true;
    }
    return false;
  };

  // Helper to check if a food price is a specific dinner size option (not the generic catering prices)
  const isDinnerSizeOption = (name: string | undefined | null): boolean => {
    if (!name) return false;
    return matchesDinnerSize(name, '6-8') || matchesDinnerSize(name, '10-12');
  };

  const accommodationTotal = nights > 0 ? nights * basePrice : 0;

  let cookTotal = 0;
  if (wantsCook) {
    if (isDinnerService(selectedCookService?.name) && dinnerGroupSize) {
      const service = foodServices.find(s => s.serviceType === 'FOOD_PRICE' && isDinnerService(s.name) && matchesDinnerSize(s.name, dinnerGroupSize));
      if (service) {
        const selectedDaysCount = Object.keys(dishesByDate).length;
        cookTotal += selectedDaysCount * getConvertedPrice(service.price);
      }
    } else {
      Object.entries(planByDate).forEach(([dateStr, id]) => {
        const service = foodServices.find(s => s.id.toString() === id);
        if (service) {
          cookTotal += getConvertedPrice(service.price);
        }
      });
    }
  }
  
  let atvTotal = 0;
  if (wantsATV) {
    Object.values(atvByDate).forEach(tourId => {
      const tour = tours.find(t => t.id.toString() === tourId);
      if (tour) atvTotal += atvPeople * getConvertedPrice(tour.pricePerPax);
    });
  }
  
  const grandTotal = accommodationTotal + cookTotal + atvTotal;

  const isNameValid = guestName.trim().length >= 2;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail);
  const isPhoneValid = guestPhone.trim().length >= 7;
  const isFormValid = isNameValid && isEmailValid && isPhoneValid;

  const handleCheckout = async () => {
    if (!range?.from || !range?.to || !isFormValid) return;

    setIsLoading(true);
    setError(null);

    const selectedAddons: any[] = [];
    if (wantsCook) {
      if (isDinnerService(selectedCookService?.name) && dinnerGroupSize) {
        const service = foodServices.find(s => s.serviceType === 'FOOD_PRICE' && isDinnerService(s.name) && matchesDinnerSize(s.name, dinnerGroupSize));
        if (service) {
          const unitPrice = getConvertedPrice(service.price);
          const selectedDaysCount = Object.keys(dishesByDate).length;
          selectedAddons.push({ 
            type: `FOOD_${service.id}`, 
            name: service.name, 
            quantity: selectedDaysCount, 
            unitPrice, 
            price: selectedDaysCount * unitPrice, 
            details: JSON.stringify({ service: selectedCookService.name, groupSize: dinnerGroupSize }) 
          });
        }
        // Register dishes for each date
        Object.entries(dishesByDate).forEach(([dateStr, dishId]) => {
          const dish = foodServices.find(s => s.id === dishId);
          if (dish) {
            const unitPrice = getConvertedPrice(dish.price || 0);
            selectedAddons.push({
              type: `FOOD_DISH_${dish.id}`,
              name: dish.name,
              quantity: 1,
              unitPrice,
              price: unitPrice, // dishes might be 0 cost depending on how price is handled, assuming base is in service
              details: JSON.stringify({ plan: selectedCookService?.name || 'Chef', type: 'Dish Selection', date: dateStr })
            });
          }
        });
      } else {
        Object.entries(planByDate).forEach(([dateStr, id]) => {
          const service = foodServices.find(s => s.id.toString() === id);
          if (service) {
            const unitPrice = getConvertedPrice(service.price);
            selectedAddons.push({ 
              type: `FOOD_${service.id}_${dateStr}`, 
              name: service.name, 
              quantity: 1, 
              unitPrice, 
              price: unitPrice, 
              details: JSON.stringify({ service: service.name, date: dateStr }) 
            });
          }
        });
      }
    }
    if (wantsATV) {
      Object.entries(atvByDate).forEach(([dateStr, tourId]) => {
        const tour = tours.find(t => t.id.toString() === tourId);
        if (tour) {
          const unitPrice = getConvertedPrice(tour.pricePerPax);
          selectedAddons.push({
            type: `TOUR_${tour.id}_${dateStr}`,
            name: tour.name,
            quantity: atvPeople,
            unitPrice,
            price: atvPeople * unitPrice,
            details: JSON.stringify({ people: atvPeople, destination: tour.name, date: dateStr })
          });
        }
      });
    }

    try {
      const res = await fetch('/api/checkout_sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkIn: format(range.from, 'yyyy-MM-dd'),
          checkOut: format(range.to, 'yyyy-MM-dd'),
          guestName,
          guestEmail,
          guestPhone: `${countryCode} ${guestPhone}`,
          accommodationTotal,
          totalPrice: grandTotal,
          addons: selectedAddons,
          currency: currency.toLowerCase(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout initialization failed');
      
      setIsSuccess(true);
      setShowConfetti(true);
      setTimeout(() => {
        window.location.href = data.url;
      }, 2500);
    } catch (err: any) {
      setError(err.message || dict.modal?.errorTitle || 'Error occurred while booking. Please try again.');
      setIsLoading(false);
    }
  };

  const totalCookServices = Object.keys(planByDate).length;

  const stayDates = useMemo(() => {
    if (!range?.from || !range?.to) return [];
    const dates = [];
    let currentDate = new Date(range.from);
    while (currentDate <= range.to) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    if (dates.length > 0) dates.pop();
    return dates;
  }, [range]);

  const globalMaxDishes = (totalCookServices === 0 && !isDinnerService(selectedCookService?.name)) 
    ? 0 
    : (isDinnerService(selectedCookService?.name) ? stayDates.length : Math.max(1, nights + 1));

  const getActiveSteps = useCallback(() => {
    const steps = ['dates', 'guest_data', 'food_prompt'];
    if (wantsCook) {
      steps.push('food_service');
      if (selectedCookService) {
        const isDinner = selectedCookService.name?.toLowerCase().includes('dinner') || selectedCookService.name?.toLowerCase().includes('cena');
        if (isDinner) {
          steps.push('menu');
        } else {
          steps.push('food_plan');
        }
      }
    }
    steps.push('tours', 'summary');
    return steps;
  }, [wantsCook, selectedCookService, totalCookServices]);

  const activeSteps = getActiveSteps();
  const currentStepIndex = activeSteps.indexOf(step) + 1;
  const totalStepsCount = activeSteps.length - 1; // Exclude success

  const nextStep = () => setStep(s => {
    const steps = getActiveSteps();
    const idx = steps.indexOf(s);
    if (idx >= 0 && idx < steps.length - 1) {
      return steps[idx + 1];
    }
    return s;
  });

  const prevStep = () => {
    setStep(s => {
      const steps = getActiveSteps();
      const idx = steps.indexOf(s);
      
      let nextStepId = s;
      if (idx > 0) {
        nextStepId = steps[idx - 1];
      }
      
      if (nextStepId === 'food_prompt') setWantsCook(null);
      if (nextStepId === 'tours') setWantsATV(null);
      
      return nextStepId;
    });
  };

  const getBackButtonText = () => {
    return isEn ? 'Back' : 'Volver';
  };

  const showBackButton = () => {
    return true;
  };

  const getBackButtonAction = () => {
    if (step === 'food_prompt' && wantsCook !== null) return () => setWantsCook(null);
    if (step === 'tours' && wantsATV !== null) return () => setWantsATV(null);
    return prevStep;
  };

  const handleWantsCook = (wants: boolean) => {
    setWantsCook(wants);
    if (!wants) {
      setPlanByDate({});
      setDishesByDate({});
      setSelectedCookService(null);
      setSelectedDishes([]);
      setStep('tours');
    } else {
      setStep('food_service');
    }
  };

  const handleWantsATV = (wants: boolean) => {
    setWantsATV(wants);
    if (!wants) {
      setAtvByDate({});
      setSelectedDateForAtv('');
      nextStep();
    }
  };

  const Counter = ({ label, value, onChange, max, sublabel = null }: { label: string, value: number, onChange: (v: number) => void, max: number, sublabel?: string | null }) => (
    <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="flex flex-col">
        <span className="font-bold text-lg md:text-xl text-[#23211F]">{label}</span>
        {sublabel && <span className="text-base md:text-lg text-gray-400 mt-1">{sublabel}</span>}
      </div>
      <div className="flex items-center gap-3">
        <button 
          onClick={() => onChange(Math.max(0, value - 1))}
          className={`w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 border border-gray-200 text-gray-500 hover:text-black hover:border-gray-400 transition-colors shrink-0 ${value <= 0 ? 'invisible' : ''}`}
        >
          <Minus size={16} />
        </button>
        <span className="w-4 text-center font-bold text-[#9B7E67]">{value}</span>
        <button 
          onClick={() => onChange(Math.min(max, value + 1))}
          className={`w-8 h-8 flex items-center justify-center rounded-full bg-[#23211F] text-white hover:bg-[#9B7E67] transition-colors shrink-0 ${value >= max ? 'invisible' : ''}`}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );

  const handleAtvChange = (type: string, val: number) => {
    // legacy unused
  };

  const totalAtvTours = Object.keys(atvByDate).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center md:items-center p-0 md:p-2 lg:p-6 perspective-[1000px]">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(12px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="absolute inset-0 bg-[#23211F]/60"
            onClick={onClose}
          />

          {/* Modal Container */}
          <motion.div
            initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.92, y: 30 }}
            animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.92, y: 30 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            drag={isMobile ? 'y' : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(e, info) => {
              if (info.offset.y > 100 && info.velocity.y > 20) {
                onClose();
              }
            }}
            className="relative w-full lg:max-w-6xl bg-[#F9F7F4] rounded-t-[2rem] md:rounded-[3rem] shadow-[0_-20px_40px_rgba(0,0,0,0.2)] md:shadow-2xl overflow-hidden flex flex-col md:flex-row h-[100dvh] max-h-[100dvh] md:h-[650px] lg:h-[750px] md:max-h-[90vh] mt-auto md:mt-0 z-10"
          >
            {isMobile && (
              <div
                className="w-full flex justify-center py-4 bg-[#F9F7F4] rounded-t-[2rem] md:hidden cursor-grab active:cursor-grabbing touch-none shrink-0"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="w-12 h-1.5 bg-black/20 rounded-full" />
              </div>
            )}

            <button
              onClick={onClose}
              className={`absolute top-4 right-4 md:top-6 md:right-6 w-10 h-10 flex items-center justify-center rounded-full bg-black/10 backdrop-blur-md md:bg-transparent shadow-sm sm:shadow-none sm:hover:bg-gray-200 transition-colors z-[60] text-gray-700 md:text-gray-500`}
            >
              <X size={20} />
            </button>

            {/* Left Panel */}
            <div className="hidden md:flex w-5/12 bg-[#23211F] text-[#F9F7F4] flex-col justify-between p-12 relative overflow-hidden shrink-0 min-h-0">
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <svg viewBox="0 0 800 1200" preserveAspectRatio="xMidYMid slice" className="w-full h-full opacity-10">
                  <path d="M-100,200 C200,0 600,400 900,200" fill="none" stroke="#F9F7F4" strokeWidth="2" />
                  <path d="M-100,250 C200,50 600,450 900,250" fill="none" stroke="#F9F7F4" strokeWidth="1.5" />
                  <path d="M-100,300 C200,100 600,500 900,300" fill="none" stroke="#F9F7F4" strokeWidth="1" />
                  <path d="M-100,350 C200,150 600,550 900,350" fill="none" stroke="#F9F7F4" strokeWidth="0.5" />
                  
                  <path d="M-100,800 C300,1000 500,600 900,800" fill="none" stroke="#9B7E67" strokeWidth="2" />
                  <path d="M-100,850 C300,1050 500,650 900,850" fill="none" stroke="#9B7E67" strokeWidth="1.5" />
                  <path d="M-100,900 C300,1100 500,700 900,900" fill="none" stroke="#9B7E67" strokeWidth="1" />
                </svg>
                <div className="absolute inset-0 bg-gradient-to-br from-[#23211F]/50 via-transparent to-[#23211F]" />
              </div>
              <div className="relative z-10 flex-1 flex flex-col min-h-0">
                <motion.div
                  className="shrink-0"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <h3 className="text-[10px] md:text-[11px] uppercase tracking-[0.3em] font-bold text-[#9B7E67] mb-2">{dict.modal?.hotelName}</h3>
                  <h2 className="text-4xl font-serif leading-tight">
                    {isEn ? <>Your Private<br/>Refuge in<br/>Chacala</> : <>Tu Refugio<br/>Privado en<br/>Chacala</>}
                  </h2>
                </motion.div>
                
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="mt-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-4 pb-4"
                >
                  <div className="flex items-start gap-4 text-base md:text-lg font-light text-gray-300">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                      <CalendarDays size={16} className="text-[#9B7E67]" />
                    </div>
                    <div>
                      <p className="font-bold text-white mb-1 uppercase tracking-widest text-[10px] md:text-[11px]">{dict.modal?.dates}</p>
                      <p>{range?.from ? format(range.from, "d MMM yyyy", { locale: localeObj }) : '-'} — {range?.to ? format(range.to, "d MMM yyyy", { locale: localeObj }) : '-'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4 text-base md:text-lg font-light text-gray-300">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                      <User size={16} className="text-[#9B7E67]" />
                    </div>
                    <div>
                      <p className="font-bold text-white mb-1 uppercase tracking-widest text-[10px] md:text-[11px]">{dict.modal?.guests}</p>
                      <p>{dict.modal?.guestsCount}</p>
                    </div>
                  </div>

                  <AnimatePresence>
                    {wantsCook && (totalCookServices > 0 || isDinnerService(selectedCookService?.name)) && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-start gap-4 text-base md:text-lg font-light text-gray-300 overflow-hidden">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                          <Utensils size={16} className="text-[#9B7E67]" />
                        </div>
                        <div className="pb-2">
                          <p className="font-bold text-white mb-1 uppercase tracking-widest text-[10px] md:text-[11px]">{dict.addons?.foodServicesTitle || (isEn ? 'Food Services' : 'Servicios de Comida')}</p>
                          <p>{selectedCookService?.name ? translateDB(selectedCookService.name, isEn) : (isEn ? 'Selected' : 'Seleccionado')}</p>
                        </div>
                      </motion.div>
                    )}
                    
                    {wantsATV && totalAtvTours > 0 && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-start gap-4 text-base md:text-lg font-light text-gray-300 overflow-hidden">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                          <Map size={16} className="text-[#9B7E67]" />
                        </div>
                        <div className="pb-2">
                          <p className="font-bold text-white mb-1 uppercase tracking-widest text-[10px] md:text-[11px]">{dict.addons?.atvTitle || (isEn ? 'Tours' : 'Tours')}</p>
                          <p>{totalAtvTours} {isEn ? 'tour(s) selected' : 'tour(s) seleccionado(s)'}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>

              <div className="relative z-10 pt-8 mt-auto border-t border-white/10 shrink-0">
                <div className="flex justify-between items-end mb-2">
                  <div className="flex flex-col gap-1">
                    <p className="text-[10px] md:text-[11px] uppercase tracking-widest font-bold text-gray-400">{dict.modal?.total} {nights > 0 && `(${nights} ${dict.modal?.nights})`}</p>
                    <div className="flex gap-2 items-center mt-2">
                      <span className="text-[10px] md:text-[11px] uppercase text-[#9B7E67] font-bold tracking-widest max-w-[200px]">
                        {isEn ? '* Stripe will handle the currency conversion at checkout' : '* Stripe aplicará el tipo de cambio correspondiente al momento del pago'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-serif text-3xl text-[#9B7E67] flex items-baseline gap-1">
                      <AnimatedCounter value={grandTotal} prefix={'$'} />
                    </span>
                    <span className="text-[10px] md:text-[11px] text-gray-500 uppercase tracking-widest mt-1">{dict.modal?.taxesIncluded}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel */}
            <div className="w-full md:w-7/12 flex flex-col h-full bg-[#F9F7F4] text-[#23211F] relative min-h-0">
              {/* Mobile Fixed Header */}
              <div className="shrink-0 z-20 p-6 pb-2 md:hidden relative bg-[#F9F7F4]">
                {currentStepIndex > 1 && showBackButton() && (
                  <PremiumButton variant="back" onClick={getBackButtonAction()} backText={getBackButtonText()} />
                )}
                {currentStepIndex <= totalStepsCount && <StepIndicator currentStep={currentStepIndex} totalSteps={totalStepsCount} />}
              </div>

              <div ref={scrollContainerRef} id="scroll-container" className="flex-1 overflow-y-auto overflow-x-hidden p-6 pb-6 md:p-12 md:pb-12 scroll-smooth flex flex-col relative custom-scrollbar overscroll-contain [-webkit-overflow-scrolling:touch]">
                {/* Desktop Header */}
                <div className="shrink-0 z-10 hidden md:block">
                  {currentStepIndex > 1 && showBackButton() && (
                    <PremiumButton variant="back" onClick={getBackButtonAction()} backText={getBackButtonText()} />
                  )}
                  {currentStepIndex <= totalStepsCount && <StepIndicator currentStep={currentStepIndex} totalSteps={totalStepsCount} />}
                </div>
                <AnimatePresence mode="wait">
                  {step === 'dates' && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                      className="min-h-full flex flex-col flex-grow shrink-0 w-full"
                    >
                      <div className="mb-6 shrink-0">
                        <h3 className="text-2xl font-serif text-[#23211F]">{dict.modal?.selectDates}</h3>
                      </div>
                      <div className="flex-none h-fit w-full flex flex-col items-center justify-start md:justify-center bg-white rounded-2xl md:rounded-3xl p-5 md:p-10 shadow-sm border border-gray-100 min-h-[400px] md:min-h-[500px]">
                        {/* Mobile Calendar */}
                        <div className="block md:hidden w-full max-w-[320px] mx-auto">
                          <DayPicker
                            mode="range"
                            selected={range}
                            onSelect={setRange}
                            disabled={[{ before: new Date() }, ...disabledRanges]}
                            modifiers={{ booked: bookedRanges, buffer: bufferRanges, blocked: blockedRanges }}
                            numberOfMonths={1}
                            className="premium-calendar !m-0"
                            components={{ DayButton: AnimatedDayButton }}
                          />
                        </div>

                        {/* Desktop Calendar */}
                        <div className="hidden md:block w-full max-w-[420px] mx-auto">
                          <DayPicker
                            mode="range"
                            selected={range}
                            onSelect={setRange}
                            disabled={[{ before: new Date() }, ...disabledRanges]}
                            modifiers={{ booked: bookedRanges, buffer: bufferRanges, blocked: blockedRanges }}
                            numberOfMonths={1}
                            className="premium-calendar !m-0"
                            components={{ DayButton: AnimatedDayButton }}
                          />
                        </div>
                        {range?.from && !range?.to && (
                          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[#9B7E67] text-[10px] md:text-[11px] mt-6 font-medium animate-pulse text-center w-full">
                            {dict.modal?.minStay}
                          </motion.p>
                        )}
                        <div className="flex flex-row flex-wrap items-center justify-center gap-x-4 gap-y-4 md:gap-x-8 mt-10 md:mt-14 pt-8 md:pt-10 border-t border-gray-100 text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-gray-500 w-full max-w-[300px] md:max-w-full mx-auto">
                          <div className="flex items-center gap-2.5 md:gap-3">
                            <div className="w-2.5 h-2.5 md:w-3 md:h-3 shrink-0 rounded-full bg-red-500 opacity-80 shadow-sm"></div>
                            <span>{isEn ? 'Booked' : 'Reservado'}</span>
                          </div>
                          <div className="flex items-center gap-2.5 md:gap-3">
                            <div className="w-2.5 h-2.5 md:w-3 md:h-3 shrink-0 rounded-full bg-[#D4A574] opacity-80 shadow-sm"></div>
                            <span>{isEn ? 'Cleaning / Buffer' : 'Limpieza / Margen'}</span>
                          </div>
                          <div className="flex items-center gap-2.5 md:gap-3">
                            <div className="w-2.5 h-2.5 md:w-3 md:h-3 shrink-0 rounded-full bg-gray-400 opacity-60 shadow-sm"></div>
                            <span>{isEn ? 'Blocked' : 'Bloqueado'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-8 shrink-0 pb-8 hidden md:block">
                        {(!range?.from || !range?.to) && (
                          <p className="text-amber-600 text-[10px] md:text-[11px] font-bold mb-3 text-center">
                            {isEn ? 'Please select your check-in and check-out dates' : 'Por favor selecciona tus fechas de entrada y salida'}
                          </p>
                        )}
                        {range?.from && range?.to && nights < 2 && (
                          <p className="text-red-500 text-[10px] md:text-[11px] font-bold mb-3 text-center">
                            {dict.modal?.minStay || (isEn ? 'Minimum 2 nights required' : 'Mínimo 2 noches requeridas')}
                          </p>
                        )}
                        <PremiumButton onClick={nextStep} disabled={!range?.from || !range?.to || nights < 2}>
                          {isEn ? 'Proceed' : 'Proceder'} <ArrowRight size={16} />
                        </PremiumButton>
                      </div>
                    </motion.div>
                  )}

                  {step === 'food_prompt' && (
                    <motion.div
                      key="step_food_prompt"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                      className="min-h-full flex flex-col flex-grow shrink-0 w-full"
                    >
                      <div className="shrink-0 mb-4 md:mb-8">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-[#F9F7F4] rounded-full flex items-center justify-center text-[#9B7E67] shadow-sm border border-[#E8D5B7]">
                            <Utensils size={24} />
                          </div>
                        </div>
                        <h3 className="text-3xl font-serif text-[#23211F] mb-2">
                          {dict.addons?.chefTitle}
                        </h3>
                        <p className="text-gray-500 font-light">
                          {dict.addons?.chefDesc}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-auto md:mt-0 pb-4">
                        <button type="button" onClick={() => handleWantsCook(true)} className="p-6 md:p-8 border-2 border-gray-200 rounded-2xl hover:border-[#9B7E67] text-[#23211F] font-bold text-base md:text-lg transition-colors flex flex-col items-center gap-2 group bg-white">
                          <span className="w-8 h-8 rounded-full border-2 border-gray-300 group-hover:border-[#9B7E67] flex items-center justify-center text-transparent group-hover:bg-[#9B7E67] group-hover:text-white transition-all">✓</span>
                          {dict.addons?.yesPlease}
                        </button>
                        <button type="button" onClick={() => handleWantsCook(false)} className="p-6 md:p-8 border-2 border-gray-200 rounded-2xl hover:border-gray-400 text-gray-500 font-bold text-base md:text-lg transition-colors flex flex-col items-center gap-2 group bg-white">
                          <span className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center text-transparent group-hover:bg-gray-400 group-hover:text-white transition-all">✕</span>
                          {dict.addons?.noThanks}
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {step === 'food_service' && (
                    <motion.div
                      key="step_food_service"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                      className="min-h-full flex flex-col flex-grow shrink-0 w-full"
                    >
                      <div className="shrink-0 mb-4 md:mb-8">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-[#F9F7F4] rounded-full flex items-center justify-center text-[#9B7E67] shadow-sm border border-[#E8D5B7]">
                            <Utensils size={24} />
                          </div>
                        </div>
                        <h3 className="text-3xl font-serif text-[#23211F] mb-2">
                          {isEn ? "Choose Your Service" : "Elige tu Servicio"}
                        </h3>
                      </div>

                      <div className="space-y-4 md:space-y-6 flex-grow shrink-0 pb-4 w-full">
                        <div className="grid gap-3">
                          {foodServices.filter(s => s.serviceType === 'FOOD_SERVICE').map(service => (
                            <button 
                              key={service.id}
                              onClick={() => {
                                setSelectedCookService(service);
                                const isDinner = service.name?.toLowerCase().includes('dinner') || service.name?.toLowerCase().includes('cena');
                                if (isDinner) {
                                  setStep('menu');
                                } else {
                                  setStep('food_plan');
                                }
                              }}
                              className="p-5 border border-[#E8D5B7] rounded-xl hover:bg-[#F9F7F4] text-left transition-colors flex flex-col group bg-white"
                            >
                              <span className="font-bold text-[#23211F] group-hover:text-[#9B7E67] transition-colors">{translateDB(service.name, isEn)}</span>
                              {service.description && <span className="text-base md:text-lg text-gray-500 mt-1">{translateDB(service.description, isEn)}</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 'food_plan' && (
                    <motion.div
                      key="step_food_plan"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                      className="min-h-full flex flex-col flex-grow shrink-0 w-full"
                    >
                      <div className="shrink-0 mb-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-[#F9F7F4] rounded-full flex items-center justify-center text-[#9B7E67] shadow-sm border border-[#E8D5B7]">
                            <Utensils size={24} />
                          </div>
                        </div>
                        <h3 className="text-3xl font-serif text-[#23211F] mb-2">
                          {isEn ? "Select Assistant" : "Seleccionar Asistente"}
                        </h3>
                        <p className="text-base md:text-lg text-gray-500 font-light mb-4">
                          {isEn ? "Request Assistant to help in the kitchen" : "Solicitar asistente para ayudar en la cocina"}
                        </p>
                      </div>

                      <div className="bg-[#FAF8F5] p-5 rounded-3xl border border-[#E8D5B7] mb-4 md:mb-8">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="text-base md:text-lg font-bold uppercase tracking-widest text-[#9B7E67]">
                            {isEn ? 'Your Stay Dates' : 'Fechas de Estancia'}
                          </h4>
                          <span className="text-base md:text-lg font-bold text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">
                            {Object.keys(planByDate).length} / {stayDates.length} {isEn ? 'days planned' : 'días planeados'}
                          </span>
                        </div>
                        <p className="text-base md:text-lg text-gray-500 font-light mb-4 italic">
                          {isEn ? (
                            <>
                              By selecting a personal assistant you are purchasing help in the kitchen, not a meal plan.
                              <br />
                              The assistant will help you prepare the food you have purchased. In addition the assistant will help you clean up afterward.
                            </>
                          ) : (
                            <>
                              Al seleccionar un asistente personal está contratando ayuda en la cocina, no un plan de comidas.
                              <br />
                              El asistente le ayudará a preparar la comida que usted haya comprado. Además el asistente le ayudará a limpiar después.
                            </>
                          )}
                        </p>
                        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                          {stayDates.map((date, idx) => {
                            const dateStr = date.toISOString().split('T')[0];
                            const isSelected = selectedDateForPlan === dateStr;
                            const hasPlan = !!planByDate[dateStr];
                            return (
                              <button
                                key={dateStr}
                                onClick={() => {
                                  if (isSelected && hasPlan) {
                                    setPlanByDate(prev => {
                                      const next = { ...prev };
                                      delete next[dateStr];
                                      return next;
                                    });
                                  } else {
                                    setSelectedDateForPlan(dateStr);
                                  }
                                }}
                                className={`shrink-0 flex flex-col items-center justify-center min-w-[80px] p-3 rounded-2xl border transition-all ${
                                  isSelected 
                                    ? 'border-[#9B7E67] bg-[#9B7E67] text-white shadow-md' 
                                    : hasPlan
                                      ? 'border-[#9B7E67] bg-white text-[#9B7E67]'
                                      : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                                }`}
                              >
                                <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest opacity-80 mb-1">
                                  {isEn ? `Day ${idx + 1}` : `Día ${idx + 1}`}
                                </span>
                                <span className="text-xl font-serif">
                                  {date.getDate()}
                                </span>
                                <span className="text-[10px] md:text-[11px] font-bold uppercase">
                                  {date.toLocaleDateString(isEn ? 'en-US' : 'es-MX', { month: 'short' })}
                                </span>
                                {hasPlan && (
                                  <div className={`mt-2 w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-[#9B7E67]'}`} />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-4 md:space-y-6 flex-grow shrink-0 pb-8 w-full">
                        {selectedDateForPlan && (
                          <div className="space-y-3 mb-4 md:mb-8">
                            {foodServices.filter(s => s.serviceType === 'FOOD_PRICE' && !isDinnerSizeOption(s.name)).map(priceOption => {
                              const optionId = priceOption.id.toString();
                              const isSelectedForDay = planByDate[selectedDateForPlan] === optionId;
                              
                              return (
                                <button
                                  key={optionId}
                                  onClick={() => {
                                    setPlanByDate(prev => {
                                      const next = { ...prev };
                                      if (next[selectedDateForPlan] === optionId) {
                                        delete next[selectedDateForPlan];
                                      } else {
                                        next[selectedDateForPlan] = optionId;
                                      }
                                      
                                      if (Object.keys(next).length < stayDates.length) {
                                        const dates = stayDates.map(d => d.toISOString().split('T')[0]);
                                        const nextEmpty = dates.find(d => !next[d]);
                                        if (nextEmpty) {
                                          setTimeout(() => setSelectedDateForPlan(nextEmpty), 400);
                                        }
                                      }
                                      return next;
                                    });
                                  }}
                                  className={`w-full p-5 rounded-2xl border transition-all flex justify-between items-center ${
                                    isSelectedForDay
                                      ? 'bg-[#9B7E67] border-[#9B7E67] text-white shadow-md'
                                      : 'bg-white border-gray-100 hover:border-[#E8D5B7] text-[#23211F]'
                                  }`}
                                >
                                  <div className="text-left">
                                    <p className="font-bold">{translateDB(priceOption.name, isEn)}</p>
                                  </div>
                                  <div className={`text-[10px] md:text-[11px] font-bold px-3 py-1 rounded-full border ${
                                    isSelectedForDay
                                      ? 'bg-white/20 border-transparent text-white'
                                      : 'bg-[#FAF8F5] border-[#E8D5B7] text-[#9B7E67]'
                                  }`}>
                                    +{formatPrice(priceOption.price || 0)}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        
                        <div className="shrink-0 mt-4 pb-8 hidden md:block">
                          {Object.keys(planByDate).length === 0 && (
                            <p className="text-amber-600 text-[10px] md:text-[11px] font-bold mb-3 text-center animate-pulse">
                              {isEn ? `Select at least 1 day to advance` : `Selecciona al menos 1 dia para avanzar`}
                            </p>
                          )}
                          <PremiumButton onClick={nextStep} disabled={Object.keys(planByDate).length === 0}>
                            {isEn ? 'Proceed' : 'Proceder'} <ArrowRight size={16} />
                          </PremiumButton>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 'menu' && (
                    <motion.div
                      key="stepMenu"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                      className="min-h-full flex flex-col flex-grow shrink-0 w-full"
                    >
                      <div className="mb-6 shrink-0 flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#F9F7F4] rounded-full flex items-center justify-center text-[#9B7E67] shadow-sm border border-[#E8D5B7]">
                          <Utensils size={24} />
                        </div>
                        <h3 className="text-3xl font-serif text-[#23211F]">{isEn ? 'Dinner Service Menu' : 'Menú del Servicio de Cena'}</h3>
                      </div>
                      
                      {isDinnerService(selectedCookService?.name) && (
                        <div className="bg-[#FAF8F5] p-5 rounded-3xl border border-[#E8D5B7] mb-4 md:mb-8">
                          <h4 className="text-xl md:text-2xl font-serif text-[#2C2621] mb-2">
                            {isEn ? 'Select group size, date of service and entree from each day' : 'Seleccione el tamaño del grupo, la fecha del servicio y el plato principal de cada día'}
                          </h4>
                          <div className="flex gap-4 mt-4">
                            {['6-8', '10-12'].map((size) => {
                              const servicePrice = foodServices.find(s => s.serviceType === 'FOOD_PRICE' && isDinnerService(s.name) && matchesDinnerSize(s.name, size))?.price || 0;
                              return (
                                <button
                                  key={size}
                                  onClick={() => setDinnerGroupSize(prev => prev === size ? '' : size)}
                                  className={`flex-1 flex flex-col items-center justify-center py-4 px-4 rounded-xl border-2 transition-all font-bold tracking-widest text-base md:text-lg uppercase ${
                                    dinnerGroupSize === size 
                                      ? 'border-[#9B7E67] bg-[#9B7E67] text-white shadow-md' 
                                      : 'border-gray-200 bg-white text-gray-500 hover:border-[#9B7E67] hover:text-[#9B7E67]'
                                  }`}
                                >
                                  <span>{size} {isEn ? 'People' : 'Personas'}</span>
                                  <span className={`text-sm md:text-base mt-2 normal-case font-bold ${dinnerGroupSize === size ? 'text-white' : 'text-[#9B7E67]'}`}>
                                    +{formatPrice(servicePrice)} / {isEn ? 'day' : 'día'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {(!isDinnerService(selectedCookService?.name) || dinnerGroupSize) && (
                        <div className="bg-[#FAF8F5] p-5 rounded-3xl border border-[#E8D5B7] mb-4 md:mb-8">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="text-base md:text-lg font-bold uppercase tracking-widest text-[#9B7E67]">
                              {isEn ? 'Dinner Service' : 'Servicio de Cena'}
                            </h4>
                            <span className="text-base md:text-lg font-bold text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">
                              {isDinnerService(selectedCookService?.name) 
                                ? `${Object.keys(dishesByDate).length} / ${stayDates.length} ${isEn ? 'days planned' : 'días planeados'}`
                                : `${selectedDishes.length} / ${globalMaxDishes} ${isEn ? 'selected' : 'seleccionados'}`
                              }
                            </span>
                          </div>
                          <p className="text-base md:text-lg text-gray-500 mb-4 font-light">
                            {isDinnerService(selectedCookService?.name)
                              ? (isEn ? "Select date and entree" : "Selecciona fecha y plato principal")
                              : (isEn ? `Based on your selections, please pick ${globalMaxDishes} dish(es).` : `Basado en tus selecciones, elige ${globalMaxDishes} platillo(s).`)
                            }
                            <br/>
                            {isDinnerService(selectedCookService?.name) && (
                              <span className="font-medium mt-2 inline-block text-[#9B7E67]">
                                {isEn 
                                  ? "Dinner includes an afternoon appetizer, fresh salad, your choice of main course, and dessert."
                                  : "La cena incluye un aperitivo por la tarde, ensalada fresca, su elección de plato principal y postre."}
                              </span>
                            )}
                          </p>

                          {isDinnerService(selectedCookService?.name) && (
                            <div className="mb-6 flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                              {stayDates.map((date, idx) => {
                                const dateStr = date.toISOString().split('T')[0];
                                const isSelected = selectedDateForMenu === dateStr;
                                const hasDish = !!dishesByDate[dateStr];
                                return (
                                  <button
                                    key={dateStr}
                                    onClick={() => {
                                      if (isSelected && hasDish) {
                                        setDishesByDate(prev => {
                                          const next = { ...prev };
                                          delete next[dateStr];
                                          return next;
                                        });
                                      } else {
                                        setSelectedDateForMenu(dateStr);
                                        const preSelectedDish = dishesByDate[dateStr];
                                        if (preSelectedDish) {
                                          setExpandedDishId(preSelectedDish);
                                          setTimeout(() => {
                                            document.getElementById(`dish-${preSelectedDish}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                          }, 150);
                                        } else {
                                          setExpandedDishId(null);
                                        }
                                      }
                                    }}
                                    className={`shrink-0 flex flex-col items-center justify-center min-w-[80px] p-3 rounded-2xl border transition-all ${
                                      isSelected 
                                        ? 'border-[#9B7E67] bg-[#9B7E67] text-white shadow-md' 
                                        : hasDish
                                          ? 'border-[#9B7E67] bg-white text-[#9B7E67]'
                                          : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                                    }`}
                                  >
                                    <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest opacity-80 mb-1">
                                      {isEn ? `Day ${idx + 1}` : `Día ${idx + 1}`}
                                    </span>
                                    <span className="text-xl font-serif">
                                      {date.getDate()}
                                    </span>
                                    <span className="text-[10px] md:text-[11px] font-bold uppercase">
                                      {date.toLocaleDateString(isEn ? 'en-US' : 'es-MX', { month: 'short' })}
                                    </span>
                                    {hasDish && (
                                      <div className={`mt-2 w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-[#9B7E67]'}`} />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {(!isDinnerService(selectedCookService?.name) || selectedDateForMenu) && (
                            <div className="space-y-3">
                              {foodServices.filter(s => s.serviceType === 'FOOD_DISH').map(dish => {
                                const isExpanded = expandedDishId === dish.id;
                                const isDinner = isDinnerService(selectedCookService?.name);
                                
                                const dishQuantity = isDinner ? 0 : selectedDishes.filter(id => id === dish.id).length;
                                const isSelectedForDay = isDinner && dishesByDate[selectedDateForMenu] === dish.id;
                                const isSelectedGen = !isDinner && dishQuantity > 0;
                                
                                const isSelected = isDinner ? isSelectedForDay : isSelectedGen;

                                return (
                                  <motion.div 
                                    layout
                                    id={`dish-${dish.id}`}
                                    key={dish.id} 
                                    className={`bg-white border rounded-[2rem] overflow-hidden shadow-sm transition-colors ${isSelected ? 'border-[#9B7E67] ring-1 ring-[#9B7E67]' : 'border-gray-100 hover:border-gray-200'}`}
                                  >
                                    <button 
                                      onClick={() => setExpandedDishId(isExpanded ? null : dish.id)}
                                      className="w-full px-6 py-4 text-left font-medium text-[#23211F] flex justify-between items-center"
                                    >
                                      <span className="flex items-center gap-3">
                                        {translateDB(dish.name, isEn)}
                                        {dishQuantity > 0 && (
                                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#9B7E67] text-white flex items-center justify-center text-[10px] md:text-[11px] font-bold">
                                            {dishQuantity}
                                          </motion.div>
                                        )}
                                        {isSelectedForDay && (
                                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="min-w-[20px] h-5 px-2 rounded-full bg-[#9B7E67] text-white flex items-center justify-center text-[10px] md:text-[11px] font-bold uppercase tracking-widest">
                                            {isEn ? 'Selected' : 'Elegido'}
                                          </motion.div>
                                        )}
                                      </span>
                                      <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                                        <ChevronDown size={16} className="text-gray-400" />
                                      </motion.div>
                                    </button>
                                    <AnimatePresence>
                                      {isExpanded && (
                                        <motion.div 
                                          initial={{ height: 0, opacity: 0 }}
                                          animate={{ height: 'auto', opacity: 1 }}
                                          exit={{ height: 0, opacity: 0 }}
                                          className="overflow-hidden bg-gray-50 rounded-b-[2rem]"
                                        >
                                          <div className="p-6 border-t border-gray-100 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                                            <p className="text-lg md:text-xl text-gray-600 font-light leading-relaxed flex-1 whitespace-pre-wrap">
                                              {translateDB(dish.description, isEn)}
                                            </p>
                                            <div className="shrink-0">
                                              {isDinner ? (
                                                <button
                                                  onClick={() => {
                                                    setDishesByDate(prev => {
                                                      const next = { ...prev };
                                                      if (next[selectedDateForMenu] === dish.id) {
                                                        delete next[selectedDateForMenu];
                                                      } else {
                                                        next[selectedDateForMenu] = dish.id;
                                                      }
                                                      
                                                      // Auto-advance to next empty day if not fully planned
                                                      if (Object.keys(next).length < stayDates.length) {
                                                        const dates = stayDates.map(d => d.toISOString().split('T')[0]);
                                                        const nextEmpty = dates.find(d => !next[d]);
                                                        if (nextEmpty) {
                                                          setTimeout(() => {
                                                            setSelectedDateForMenu(nextEmpty);
                                                            setExpandedDishId(null);
                                                          }, 400);
                                                        }
                                                      }

                                                      return next;
                                                    });
                                                  }}
                                                  className={`px-6 py-2 rounded-full text-base md:text-lg font-bold uppercase tracking-widest transition-all ${
                                                    isSelectedForDay 
                                                      ? 'bg-[#23211F] text-white' 
                                                      : 'bg-white border border-[#23211F] text-[#23211F] hover:bg-[#F9F7F4]'
                                                  }`}
                                                >
                                                  {isSelectedForDay 
                                                    ? (isEn ? 'Deselect' : 'Quitar') 
                                                    : (isEn ? 'Select' : 'Seleccionar')}
                                                </button>
                                              ) : (
                                                <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-full p-1 shadow-sm">
                                                  <motion.button 
                                                    whileTap={{ scale: 0.9 }}
                                                    onClick={() => {
                                                      setSelectedDishes(prev => {
                                                        const idx = prev.lastIndexOf(dish.id);
                                                        if (idx !== -1) {
                                                          const next = [...prev];
                                                          next.splice(idx, 1);
                                                          return next;
                                                        }
                                                        return prev;
                                                      });
                                                    }}
                                                    disabled={dishQuantity === 0}
                                                    className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                                                  >
                                                    <Minus size={16} />
                                                  </motion.button>
                                                  
                                                  <span className="font-serif text-xl w-6 text-center text-[#23211F]">
                                                    {dishQuantity}
                                                  </span>
                                                  
                                                  <motion.button 
                                                    whileTap={{ scale: 0.9 }}
                                                    onClick={() => {
                                                      if (selectedDishes.length < globalMaxDishes) {
                                                        setSelectedDishes(prev => {
                                                          const next = [...prev, dish.id];
                                                          if (next.length === globalMaxDishes) {
                                                            setTimeout(() => nextStep(), 800);
                                                          }
                                                          return next;
                                                        });
                                                      }
                                                    }}
                                                    disabled={selectedDishes.length >= globalMaxDishes}
                                                    className="w-10 h-10 rounded-full flex items-center justify-center text-[#23211F] hover:bg-gray-100 disabled:opacity-50 transition-colors"
                                                  >
                                                    <Plus size={16} />
                                                  </motion.button>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </motion.div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="shrink-0 mt-4 pb-8 hidden md:block">
                        {isDinnerService(selectedCookService?.name) ? (
                          Object.keys(dishesByDate).length === 0 && dinnerGroupSize && (
                            <p className="text-amber-600 text-[10px] md:text-[11px] font-bold mb-3 text-center animate-pulse">
                              {isEn ? `Select at least 1 day to advance` : `Selecciona al menos 1 dia para avanzar`}
                            </p>
                          )
                        ) : (
                          selectedDishes.length < globalMaxDishes && (
                            <p className="text-amber-600 text-[10px] md:text-[11px] font-bold mb-3 text-center animate-pulse">
                              {isEn ? `Please select ${globalMaxDishes - selectedDishes.length} more dish(es)` : `Por favor selecciona ${globalMaxDishes - selectedDishes.length} platillo(s) más`}
                            </p>
                          )
                        )}
                        <PremiumButton 
                          onClick={nextStep} 
                          disabled={
                            isDinnerService(selectedCookService?.name)
                              ? (!dinnerGroupSize || Object.keys(dishesByDate).length === 0)
                              : selectedDishes.length < globalMaxDishes
                          }
                        >
                          {isEn ? 'Proceed' : 'Proceder'} <ArrowRight size={16} />
                        </PremiumButton>
                      </div>
                    </motion.div>
                  )}

                  {step === 'tours' && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                      className="min-h-full flex flex-col flex-grow shrink-0 w-full"
                    >
                      <div className="mb-6 shrink-0">
                        <div className="w-12 h-12 bg-[#F9F7F4] rounded-full flex items-center justify-center text-[#9B7E67] mb-4 shadow-sm border border-[#E8D5B7]">
                          <Map size={24} />
                        </div>
                        <h3 className="text-3xl font-serif text-[#23211F] mb-2">{dict.addons?.atvTitle}</h3>
                        <p className="text-gray-500 font-light">{dict.addons?.atvDesc}</p>
                      </div>

                      {isTourBookedOnSelectedDates ? (
                        <div className="bg-[#FAF8F5] border border-[#D4A574] text-[#9B7E67] p-4 rounded-xl mb-6 text-lg md:text-xl">
                          <strong>{isEn ? 'Tour already booked' : 'Tour ya reservado'}</strong>
                          <p className="mt-1 opacity-80">
                            {isEn 
                              ? 'There is already a tour booked for these dates. You can still book the accommodation, but the ATV tour option is currently unavailable.' 
                              : 'Ya hay un tour reservado para estas fechas. Puedes reservar el alojamiento, pero la opción de tour en cuatrimoto no está disponible actualmente.'}
                          </p>
                        </div>
                      ) : wantsATV === null ? (
                        <div className="grid grid-cols-2 gap-4 mt-auto md:mt-0 pb-4">
                          <button type="button" onClick={() => handleWantsATV(true)} className="p-6 md:p-8 border-2 border-gray-200 rounded-2xl hover:border-[#9B7E67] text-[#23211F] font-bold text-base md:text-lg transition-colors flex flex-col items-center gap-2 group bg-white">
                            <span className="w-8 h-8 rounded-full border-2 border-gray-300 group-hover:border-[#9B7E67] flex items-center justify-center text-transparent group-hover:bg-[#9B7E67] group-hover:text-white transition-all">✓</span>
                            {dict.addons?.yesExplore}
                          </button>
                          <button type="button" onClick={() => handleWantsATV(false)} className="p-6 md:p-8 border-2 border-gray-200 rounded-2xl hover:border-gray-400 text-gray-500 font-bold text-base md:text-lg transition-colors flex flex-col items-center gap-2 group bg-white">
                            <span className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center text-transparent group-hover:bg-gray-400 group-hover:text-white transition-all">✕</span>
                            {dict.addons?.noThanks}
                          </button>
                        </div>
                      ) : wantsATV === true ? (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 flex-1 flex flex-col">
                          
                          <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm shrink-0">
                            <div className="font-bold text-lg md:text-xl text-[#23211F] mb-2 flex items-baseline gap-2 flex-wrap">
                              {dict.addons?.howManyPeople} 
                              <span className="text-xs md:text-sm uppercase tracking-widest font-bold text-gray-400">
                                (Min {minTourPax}, Max {maxTourPax})
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <button 
                                onClick={() => setAtvPeople(Math.max(minTourPax, atvPeople - 1))}
                                className={`w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 border border-gray-200 text-gray-500 hover:text-black transition-colors ${atvPeople <= minTourPax ? 'opacity-30 cursor-not-allowed' : ''}`}
                              >
                                <Minus size={16} />
                              </button>
                              <span className="w-4 text-center font-bold text-[#9B7E67]">{atvPeople}</span>
                              <button 
                                onClick={() => setAtvPeople(Math.min(maxTourPax, atvPeople + 1))}
                                className={`w-8 h-8 flex items-center justify-center rounded-full bg-[#23211F] text-white hover:bg-[#9B7E67] transition-colors ${atvPeople >= maxTourPax ? 'opacity-30 cursor-not-allowed' : ''}`}
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                          </div>

                          <div className="bg-[#FAF8F5] p-5 rounded-3xl border border-[#E8D5B7] mb-4 shrink-0">
                            <div className="flex justify-between items-center mb-4">
                              <h4 className="text-base md:text-lg font-bold uppercase tracking-widest text-[#9B7E67]">
                                {isEn ? 'Your Stay Dates' : 'Fechas de Estancia'}
                              </h4>
                              <span className="text-base md:text-lg font-bold text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">
                                {Object.keys(atvByDate).length} / {stayDates.length} {isEn ? 'days planned' : 'días planeados'}
                              </span>
                            </div>
                            <p className="text-base md:text-lg text-gray-500 font-light mb-4 italic">
                              {isEn 
                                ? 'Select the dates of your stay and the destination you want to visit. Only one destination per day is allowed.' 
                                : 'Selecciona las fechas en tu estancia y el destino que quieras visitar. Solo se puede seleccionar un destino por día.'}
                            </p>
                            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                              {stayDates.map((date, idx) => {
                                const dateStr = date.toISOString().split('T')[0];
                                const isSelected = selectedDateForAtv === dateStr;
                                const hasPlan = !!atvByDate[dateStr];
                                return (
                                  <button
                                    key={dateStr}
                                    onClick={() => {
                                      if (isSelected && hasPlan) {
                                        setAtvByDate(prev => {
                                          const next = { ...prev };
                                          delete next[dateStr];
                                          return next;
                                        });
                                      } else {
                                        setSelectedDateForAtv(dateStr);
                                      }
                                    }}
                                    className={`shrink-0 flex flex-col items-center justify-center min-w-[80px] p-3 rounded-2xl border transition-all ${
                                      isSelected 
                                        ? 'border-[#9B7E67] bg-[#9B7E67] text-white shadow-md' 
                                        : hasPlan
                                          ? 'border-[#9B7E67] bg-white text-[#9B7E67]'
                                          : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                                    }`}
                                  >
                                    <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest opacity-80 mb-1">
                                      {isEn ? `Day ${idx + 1}` : `Día ${idx + 1}`}
                                    </span>
                                    <span className="text-xl font-serif">
                                      {date.getDate()}
                                    </span>
                                    <span className="text-[10px] md:text-[11px] font-bold uppercase">
                                      {date.toLocaleDateString(isEn ? 'en-US' : 'es-MX', { month: 'short' })}
                                    </span>
                                    {hasPlan && (
                                      <div className={`mt-2 w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-[#9B7E67]'}`} />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex-grow shrink-0 space-y-3 pb-4 w-full">
                            {selectedDateForAtv && (
                              <div className="space-y-3 mb-4 md:mb-8">
                                <p className="font-bold text-lg md:text-xl text-[#23211F] mb-2">{dict.addons?.selectDestination}</p>
                                {tours.map(tour => {
                                  const optionId = tour.id.toString();
                                  const isSelectedForDay = atvByDate[selectedDateForAtv] === optionId;
                                  
                                  return (
                                    <button
                                      key={optionId}
                                      onClick={() => {
                                        setAtvByDate(prev => {
                                          const next = { ...prev };
                                          if (next[selectedDateForAtv] === optionId) {
                                            delete next[selectedDateForAtv];
                                          } else {
                                            next[selectedDateForAtv] = optionId;
                                          }
                                          
                                          if (Object.keys(next).length < stayDates.length) {
                                            const dates = stayDates.map(d => d.toISOString().split('T')[0]);
                                            const nextEmpty = dates.find(d => !next[d]);
                                            if (nextEmpty) {
                                              setTimeout(() => setSelectedDateForAtv(nextEmpty), 400);
                                            }
                                          }
                                          return next;
                                        });
                                      }}
                                      className={`w-full p-5 rounded-2xl border transition-all flex justify-between items-center ${
                                        isSelectedForDay
                                          ? 'bg-[#9B7E67] border-[#9B7E67] text-white shadow-md'
                                          : 'bg-white border-gray-100 hover:border-[#E8D5B7] text-[#23211F]'
                                      }`}
                                    >
                                      <div className="text-left">
                                        <p className="font-bold">{translateDB(tour.name, isEn)}</p>
                                      </div>
                                      <div className={`text-[10px] md:text-[11px] font-bold px-3 py-1 rounded-full border ${
                                        isSelectedForDay
                                          ? 'bg-white/20 border-transparent text-white'
                                          : 'bg-[#FAF8F5] border-[#E8D5B7] text-[#9B7E67]'
                                      }`}>
                                        +{formatPrice(tour.pricePerPax || 0)} / {isEn ? 'Person' : 'Persona'}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="mt-4 pb-8 shrink-0 hidden md:block">
                            {(totalAtvTours === 0 || atvPeople < minTourPax) && (
                              <p className="text-amber-600 text-[10px] md:text-[11px] font-bold mb-3 text-center animate-pulse">
                                {isEn ? 'Please select at least one destination and number of people' : 'Por favor selecciona al menos un destino y personas'}
                              </p>
                            )}
                            <PremiumButton onClick={nextStep} disabled={totalAtvTours === 0 || atvPeople < minTourPax}>
                              {isEn ? 'Proceed' : 'Proceder'} <ArrowRight size={16} />
                            </PremiumButton>
                          </div>
                        </motion.div>
                      ) : null}
                    </motion.div>
                  )}

                  {step === 'guest_data' && (
                    <motion.div
                      key="step_guest_data"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                      className="min-h-full flex flex-col flex-grow shrink-0 w-full"
                    >
                      <h3 className="text-3xl font-serif text-[#23211F] mb-4 md:mb-8 shrink-0">{dict.modal?.yourData || (isEn ? 'Your Data' : 'Tus Datos')}</h3>
                      
                      <form 
                        onSubmit={(e) => { 
                          e.preventDefault(); 
                          if (isFormValid) nextStep(); 
                        }} 
                        className="space-y-4 md:space-y-6 flex-grow shrink-0 pb-12 md:pb-4 w-full"
                      >
                        <PremiumInput
                          id="name"
                          type="text"
                          label={dict.modal?.fullName}
                          placeholder="Ej. Juan Pérez"
                          value={guestName}
                          onChange={setGuestName}
                          isValid={isNameValid}
                          delay={0.1}
                        />
                        <PremiumInput
                          id="email"
                          type="email"
                          label={dict.modal?.email}
                          placeholder="ejemplo@dominio.com"
                          value={guestEmail}
                          onChange={setGuestEmail}
                          isValid={isEmailValid}
                          delay={0.2}
                          errorMessage={isEn ? "Invalid email format" : "Formato de correo inválido"}
                        />
                        <div className="flex gap-4 items-end">
                          <div className="w-1/3">
                            <CountryCodeDropdown 
                              label={isEn ? 'Country Code' : 'Prefijo'} 
                              value={countryCode} 
                              onChange={setCountryCode} 
                            />
                          </div>
                          <div className="w-2/3">
                            <PremiumInput
                              id="phone"
                              type="tel"
                              label={isEn ? 'Phone (10 digits)' : 'Teléfono (10 dígitos)'}
                              placeholder="55 1234 5678"
                              value={guestPhone}
                              onChange={(val) => {
                                const onlyNums = val.replace(/\D/g, '');
                                if (onlyNums.length <= 10) {
                                  setGuestPhone(onlyNums);
                                }
                              }}
                              isValid={guestPhone.length === 10}
                              delay={0.3}
                            />
                          </div>
                        </div>

                        <div className="mt-8 pb-8 shrink-0 hidden md:block">
                          {!isFormValid && (
                            <p className="text-amber-600 text-[10px] md:text-[11px] font-bold mb-3 text-center">
                              {isEn ? 'Please fill in all required fields correctly' : 'Por favor completa todos los campos requeridos correctamente'}
                            </p>
                          )}
                          <PremiumButton onClick={nextStep} disabled={!isFormValid}>
                            {isEn ? 'Proceed' : 'Proceder'} <ArrowRight size={16} />
                          </PremiumButton>
                        </div>
                      </form>
                    </motion.div>
                  )}

                  {step === 'summary' && (
                    <motion.div
                      key="step_summary"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                      className="min-h-full flex flex-col flex-grow shrink-0 w-full"
                    >
                      {showConfetti && Array.from({ length: 40 }).map((_, i) => (
                        <ConfettiParticle key={i} index={i} delay={Math.random() * 0.5} />
                      ))}

                      <div className="flex flex-col h-full">
                        <h3 className="text-3xl font-serif text-[#23211F] mb-6 shrink-0">{dict.modal?.summary || (isEn ? 'Summary' : 'Resumen')}</h3>
                        
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex-1 flex flex-col mb-4 md:mb-8 overflow-hidden">
                          <div className="overflow-y-auto custom-scrollbar flex-1 space-y-4 md:space-y-6 pr-2 max-h-[300px]">
                          
                          {/* Guest Data Review */}
                          <div className="pb-6 border-b border-gray-100">
                            <h4 className="font-bold text-[#23211F] mb-2">{isEn ? 'Guest Details' : 'Tus Datos'}</h4>
                            <p className="text-lg md:text-xl text-gray-500 font-medium">{guestName}</p>
                            <p className="text-lg md:text-xl text-gray-500">{guestEmail}</p>
                            <p className="text-lg md:text-xl text-gray-500">{countryCode} {guestPhone}</p>
                          </div>
                          <div className="flex justify-between items-center pb-6 border-b border-gray-100">
                            <div>
                              <h4 className="font-bold text-[#23211F]">{dict.addons?.accommodation}</h4>
                              <p className="text-lg md:text-xl text-gray-500">{nights} {dict.modal?.nights}</p>
                            </div>
                            <div className="font-serif text-xl text-[#9B7E67]">${accommodationTotal.toLocaleString('en-US')} {currency}</div>
                          </div>
                          
                          {wantsCook && (totalCookServices > 0 || isDinnerService(selectedCookService?.name)) && (
                            <div className="pb-6 border-b border-gray-100">
                              <h4 className="font-bold text-[#23211F] mb-3 flex items-center gap-2"><Utensils size={16}/> {dict.addons?.foodServicesTitle || (isEn ? 'Food Services' : 'Servicios de Comida')}</h4>
                              {isDinnerService(selectedCookService?.name) && (
                                (() => {
                                  const service = foodServices.find(s => s.serviceType === 'FOOD_PRICE' && isDinnerService(s.name) && matchesDinnerSize(s.name, dinnerGroupSize));
                                  const selectedDaysCount = Object.keys(dishesByDate).length;
                                  const price = service ? selectedDaysCount * getConvertedPrice(service.price) : 0;
                                  return (
                                    <div className="flex justify-between text-lg md:text-xl text-gray-600 mb-1">
                                      <span className="font-medium text-[#9B7E67]">{selectedDaysCount}x {translateDB(selectedCookService.name, isEn)} ({dinnerGroupSize} {isEn ? 'Guests' : 'Personas'})</span>
                                      <span className="font-bold text-[#9B7E67]">{formatPrice(price)}</span>
                                    </div>
                                  );
                                })()
                              )}
                              {(() => {
                                const counts: Record<string, number> = {};
                                Object.values(planByDate).forEach(id => {
                                  counts[id] = (counts[id] || 0) + 1;
                                });
                                return Object.entries(counts).map(([id, count]) => {
                                  const service = foodServices.find(s => s.id.toString() === id);
                                  if (!service) return null;
                                  return (
                                    <div key={id} className="flex justify-between items-center text-base md:text-lg py-1">
                                      <span className="text-[#23211F]">{count}x {translateDB(service.name, isEn)}</span>
                                      <span className="font-bold text-[#9B7E67]">{formatPrice(service.price * count)}</span>
                                    </div>
                                  );
                                });
                              })()}
                              {selectedDishes.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-50">
                                  <p className="text-base md:text-lg uppercase tracking-widest text-gray-400 font-bold mb-1">{isEn ? 'Selected Dishes:' : 'Platillos Seleccionados:'}</p>
                                  {Array.from(new Set(selectedDishes)).map(dishId => {
                                    const dish = foodServices.find(s => s.id === dishId);
                                    const count = selectedDishes.filter(id => id === dishId).length;
                                    if (dish) {
                                      return (
                                        <div key={dishId} className="flex justify-between text-lg md:text-xl text-gray-500 mb-0.5 ml-2">
                                          <span>• {count}x {translateDB(dish.name, isEn)}</span>
                                          {(dish.price || 0) > 0 && <span>${(count * (dish.price || 0)).toLocaleString('en-US')}</span>}
                                        </div>
                                      );
                                    }
                                    return null;
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {wantsATV && Object.keys(atvByDate).length > 0 && (
                            <div className="pb-6 border-b border-gray-100">
                              <h4 className="font-bold text-[#23211F] mb-3 flex items-center gap-2"><Map size={16}/> {dict.addons?.atvTitle || (isEn ? 'Tours' : 'Tours')}</h4>
                              {Object.entries(atvByDate).map(([dateStr, id]) => {
                                const tour = tours.find(t => t.id.toString() === id);
                                if (tour) {
                                  return (
                                    <div key={dateStr} className="flex justify-between text-lg md:text-xl text-gray-600 mb-1">
                                      <span>{atvPeople} {isEn ? 'Guests' : 'Personas'} - {translateDB(tour.name, isEn)} ({dateStr})</span>
                                      <span>${(atvPeople * (tour.pricePerPax || 0)).toLocaleString('en-US')}</span>
                                    </div>
                                  );
                                }
                                return null;
                              })}
                            </div>
                          )}

                          </div>
  <div className="flex justify-between items-center pt-4 border-t border-gray-100 mt-4 shrink-0">
    <div>
      <h4 className="font-bold text-2xl text-[#23211F]">{dict.modal?.total}</h4>
                              <p className="text-base md:text-lg text-gray-400 uppercase tracking-widest">{dict.modal?.taxesIncluded}</p>
                            </div>
                            <div className="font-serif text-3xl text-[#23211F]">${grandTotal.toLocaleString('en-US')} {currency}</div>
                          </div>
                        </div>

                        {error && (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 text-red-600 p-4 rounded-xl text-lg md:text-xl font-medium mb-6 text-center shrink-0">
                            {error}
                          </motion.div>
                        )}

                        <div className="shrink-0 pb-4 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-6 mt-8 w-full">
                          
                          <div className="flex flex-col sm:items-end w-full sm:w-auto min-w-[260px]">
                            {!isFormValid && (
                              <p className="text-amber-600 text-[10px] md:text-[11px] font-bold tracking-widest uppercase text-left sm:text-right mb-2 animate-pulse">
                                {isEn ? 'Please fill in all required fields' : 'Por favor completa todos los campos'}
                              </p>
                            )}
                            <div className="w-full">
                              <PremiumButton onClick={handleCheckout} disabled={!isFormValid || isLoading || grandTotal === 0}>
                                <CreditCard size={18} />
                                {isEn ? 'Checkout' : 'Checkout'}
                              </PremiumButton>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {/* Safari Mobile scroll spacer to clear bottom bar */}
                <div className="h-40 shrink-0 w-full md:hidden" />
              </div>
            </div>

            {/* Mobile Fixed Bottom Summary */}
            {isMobile && currentStepIndex <= totalStepsCount && (
              <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-8 flex justify-between items-center shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-20"
              >
                <div>
                  <p className="text-[10px] md:text-[11px] uppercase tracking-widest font-bold text-gray-400 mb-1">{isEn ? 'Subtotal' : 'Total Parcial'}</p>
                  <div className="font-serif text-xl text-[#23211F] leading-none">${grandTotal.toLocaleString('en-US')}</div>
                </div>
                {step === 'dates' && (
                  <div className="flex flex-col items-end">
                    {range?.from && range?.to && nights < 2 && <span className="text-red-500 text-[10px] md:text-[11px] font-bold mb-1 mr-2">{isEn ? 'Min 2 nights' : 'Mínimo 2 noches'}</span>}
                    <button onClick={nextStep} disabled={!range?.from || !range?.to || nights < 2} className="bg-[#23211F] text-white px-6 py-3 rounded-full text-base md:text-lg font-bold uppercase tracking-widest disabled:opacity-50 transition-colors">
                      {isEn ? 'Proceed' : 'Proceder'}
                    </button>
                  </div>
                )}
                {step === 'food_plan' && (
                  <div className="flex flex-col items-end">
                    {totalCookServices === 0 ? <span className="text-amber-600 text-[10px] md:text-[11px] font-bold mb-1 mr-2">{isEn ? 'Select service' : 'Selecciona servicio'}</span> : null}
                    <button onClick={nextStep} disabled={totalCookServices === 0} className="bg-[#23211F] text-white px-6 py-3 rounded-full text-base md:text-lg font-bold uppercase tracking-widest disabled:opacity-50 transition-colors">
                      {isEn ? 'Proceed' : 'Proceder'}
                    </button>
                  </div>
                )}

                  {step === 'menu' && (
                  <div className="flex flex-col items-end">
                    {(isDinnerService(selectedCookService?.name) ? (!dinnerGroupSize || Object.keys(dishesByDate).length === 0) : selectedDishes.length < globalMaxDishes) ? <span className="text-amber-600 text-[10px] md:text-[11px] font-bold mb-1 mr-2">{isEn ? 'Select your dishes' : 'Selecciona tus platillos'}</span> : null}
                    <button onClick={nextStep} disabled={isDinnerService(selectedCookService?.name) ? (!dinnerGroupSize || Object.keys(dishesByDate).length === 0) : selectedDishes.length < globalMaxDishes} className="bg-[#23211F] text-white px-6 py-3 rounded-full text-base md:text-lg font-bold uppercase tracking-widest disabled:opacity-50 transition-colors">
                      {isEn ? 'Proceed' : 'Proceder'}
                    </button>
                  </div>
                )}
                {step === 'tours' && (
                  <div className="flex flex-col items-end">
                    {(!isTourBookedOnSelectedDates && wantsATV === null) ? <span className="text-amber-600 text-[10px] md:text-[11px] font-bold mb-1 mr-2">{isEn ? 'Select an option' : 'Selecciona una opción'}</span> : (wantsATV === true && (totalAtvTours === 0 || atvPeople < minTourPax)) ? <span className="text-amber-600 text-[10px] md:text-[11px] font-bold mb-1 mr-2">{isEn ? 'Select destination' : 'Selecciona un destino'}</span> : null}
                    <button onClick={nextStep} disabled={(!isTourBookedOnSelectedDates && wantsATV === null) || (wantsATV === true && (totalAtvTours === 0 || atvPeople < minTourPax))} className="bg-[#23211F] text-white px-6 py-3 rounded-full text-base md:text-lg font-bold uppercase tracking-widest disabled:opacity-50 transition-colors">
                      {isEn ? 'Proceed' : 'Proceder'}
                    </button>
                  </div>
                )}
                {step === 'guest_data' && (
                  <div className="flex flex-col items-end">
                    {!isFormValid && <span className="text-amber-600 text-[10px] md:text-[11px] font-bold mb-1 mr-2">{isEn ? 'Fill required fields' : 'Llena los campos'}</span>}
                    <button onClick={nextStep} disabled={!isFormValid} className="bg-[#23211F] text-white px-6 py-3 rounded-full text-base md:text-lg font-bold uppercase tracking-widest disabled:opacity-50 transition-colors">
                      {isEn ? 'Proceed' : 'Proceder'}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
            <ActionLoadingScreen 
              isOpen={isLoading || isSuccess} 
              message={isSuccess ? (isEn ? "Booking Confirmed" : "Reserva Confirmada") : dictContext?.modal?.redirecting}
              subMessage={isSuccess ? (isEn ? "All set!" : "¡Todo listo!") : dictContext?.modal?.securePayments}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
