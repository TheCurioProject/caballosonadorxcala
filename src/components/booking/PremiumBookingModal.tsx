'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useDragControls } from 'framer-motion';
import { X, CalendarDays, ArrowRight, Check, ChefHat, CreditCard, User, Map, Utensils, Minus, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { ActionLoadingScreen } from '../ui/ActionLoadingScreen';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import dynamic from 'next/dynamic';

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
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative group"
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
          className="w-full bg-transparent border-b-2 border-gray-200 py-4 pr-10 text-[#23211F] text-lg focus:outline-none transition-colors peer font-light placeholder:text-transparent"
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
          className="absolute left-0 text-gray-400 pointer-events-none origin-left"
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
            <p className="text-red-500 text-[10px] font-bold tracking-widest uppercase">
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
  <div className="flex items-center gap-2 md:gap-3 mb-6 md:mb-8">
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
            className="w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[10px] md:text-xs font-bold relative overflow-hidden shrink-0"
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
              className="absolute inset-0 rounded-full border-2 border-[#9B7E67] shrink-0"
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
        </motion.div>
        {step < totalSteps && (
          <motion.div
            className="h-[2px] w-full min-w-[20px] max-w-full rounded-full overflow-hidden bg-gray-200"
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
        className="text-[10px] md:text-xs font-bold text-gray-400 hover:text-[#23211F] uppercase tracking-widest mb-6 md:mb-8 text-left transition-colors flex items-center gap-2"
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
      className={`w-full py-4 rounded-full font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all relative overflow-hidden ${
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
  "Large groups and families often purchase their own ingredients. Upon request we provide Personalized Service to manage preparations allowing more time with family and less Stress in the Kitchen.": {
    en: "Large groups and families often purchase their own ingredients. Upon request we provide Personalized Service to manage preparations allowing more time with family and less Stress in the Kitchen.",
    es: "Los grupos grandes y las familias a menudo compran sus propios ingredientes. A pedido, brindamos un Servicio Personalizado para administrar las preparaciones, lo que permite más tiempo con la familia y menos estrés en la cocina."
  },
  "For groups wanting to maximize daily activities we offer dinner Service between 5:00 and 7:00 PM (Pacific Time). Our chef will prepare a meal from our dinner menu and look after the kitchen for you. Treat your family to an evening of Authentic Mexican Cuisine! This Service is perfect for groups of 6-12 people. Select these Service Options when booking your stay!": {
    en: "For groups wanting to maximize daily activities we offer dinner Service between 5:00 and 7:00 PM (Pacific Time). Our chef will prepare a meal from our dinner menu and look after the kitchen for you. Treat your family to an evening of Authentic Mexican Cuisine! This Service is perfect for groups of 6-12 people. Select these Service Options when booking your stay!",
    es: "Para los grupos que desean maximizar las actividades diarias, ofrecemos servicio de cena entre las 5:00 y las 7:00 PM (hora del Pacífico). Nuestro chef preparará una comida de nuestro menú de cena y se encargará de la cocina por usted. ¡Invite a su familia a una noche de auténtica cocina mexicana! Este servicio es perfecto para grupos de 6 a 12 personas. ¡Seleccione estas opciones de servicio al reservar su estadía!"
  },
  "Catering Breakfast": {
    en: "Catering Breakfast",
    es: "Catering de Desayuno"
  },
  "Catering Dinner": {
    en: "Catering Dinner",
    es: "Catering de Cena"
  },
  "Both": {
    en: "Both",
    es: "Ambos"
  }
};

const translateDB = (text: string | undefined | null, isEn: boolean): string => {
  if (!text) return text || '';
  const trimmed = text.trim();
  
  if (dbTranslations[trimmed]) {
    return isEn ? dbTranslations[trimmed].en : dbTranslations[trimmed].es;
  }

  for (const [key, val] of Object.entries(dbTranslations)) {
    if (key.toLowerCase() === trimmed.toLowerCase()) {
      return isEn ? val.en : val.es;
    }
  }
  
  return text;
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

  const [step, setStep] = useState(1);
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
  
  // Extras state
  const [foodServices, setFoodServices] = useState<any[]>([]);
  const [tours, setTours] = useState<any[]>([]);
  
  const [wantsCook, setWantsCook] = useState<boolean | null>(null);
  const [selectedCookService, setSelectedCookService] = useState<any | null>(null);
  const [expandedDishId, setExpandedDishId] = useState<number | null>(null);
  const [cookSelections, setCookSelections] = useState<Record<string, number>>({});
  const [selectedDishes, setSelectedDishes] = useState<number[]>([]);

  const [wantsATV, setWantsATV] = useState<boolean | null>(null);
  const [minTourPax, setMinTourPax] = useState(3);
  const [maxTourPax, setMaxTourPax] = useState(10);
  const [atvPeople, setAtvPeople] = useState(3);
  const [atvSelections, setAtvSelections] = useState<Record<string, number>>({});

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
        setStep(1);
        setRange(undefined);
        setGuestName('');
        setGuestEmail('');
        setGuestPhone('');
        setWantsCook(null);
        setSelectedCookService(null);
        setExpandedDishId(null);
        setCookSelections({});
        setSelectedDishes([]);
        setWantsATV(null);
        setAtvPeople(1);
        setAtvSelections({});
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
      setAtvSelections({});
    }
  }, [isTourBookedOnSelectedDates, wantsATV]);

  const basePrice = useMemo(() => {
    return getConvertedPrice(propertySettings?.basePrice || 15000); // Dynamic base price from settings
  }, [getConvertedPrice, propertySettings]);

  const nights = (range?.from && range?.to) ? differenceInDays(range.to, range.from) : 0;
  const accommodationTotal = nights > 0 ? nights * basePrice : 0;

  let cookTotal = 0;
  if (wantsCook) {
    Object.entries(cookSelections).forEach(([id, count]) => {
      if (count > 0) {
        const service = foodServices.find(s => s.id.toString() === id);
        if (service) cookTotal += count * getConvertedPrice(service.price);
      }
    });
  }
  
  let atvTotal = 0;
  if (wantsATV) {
    Object.entries(atvSelections).forEach(([id, count]) => {
      if (count > 0) {
        const tour = tours.find(t => t.id.toString() === id);
        if (tour) atvTotal += count * atvPeople * getConvertedPrice(tour.pricePerPax);
      }
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
      Object.entries(cookSelections).forEach(([id, count]) => {
        if (count > 0) {
          const service = foodServices.find(s => s.id.toString() === id);
          if (service) {
            const unitPrice = getConvertedPrice(service.price);
            selectedAddons.push({ type: `FOOD_${service.id}`, name: service.name, quantity: count, unitPrice, price: count * unitPrice, details: selectedCookService ? JSON.stringify({ service: selectedCookService.name }) : null });
          }
        }
      });
      // Register selected dishes for database and invoice
      selectedDishes.forEach(dishId => {
        const dish = foodServices.find(s => s.id === dishId);
        if (dish) {
          const unitPrice = getConvertedPrice(dish.price || 0);
          selectedAddons.push({
            type: `FOOD_DISH_${dish.id}`,
            name: dish.name,
            quantity: 1,
            unitPrice,
            price: unitPrice,
            details: JSON.stringify({ plan: selectedCookService?.name || 'Chef', type: 'Dish Selection' })
          });
        }
      });
    }
    if (wantsATV) {
      Object.entries(atvSelections).forEach(([id, count]) => {
        if (count > 0) {
          const tour = tours.find(t => t.id.toString() === id);
          if (tour) {
            const unitPrice = getConvertedPrice(tour.pricePerPax);
            selectedAddons.push({ type: `TOUR_${tour.id}`, name: tour.name, quantity: count * atvPeople, unitPrice, price: count * atvPeople * unitPrice, details: JSON.stringify({ people: atvPeople, destination: tour.name, instances: count }) });
          }
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

  const nextStep = () => setStep(s => Math.min(s + 1, 5));
  const prevStep = () => {
    setStep(s => {
      const newStep = Math.max(s - 1, 1);
      // Reset the answer of the step we are going back to so user can choose again
      if (newStep === 2) setWantsCook(null);
      if (newStep === 3) setWantsATV(null);
      return newStep;
    });
  };

  const handleWantsCook = (wants: boolean) => {
    setWantsCook(wants);
    if (!wants) {
      setCookSelections({});
      setSelectedDishes([]);
      nextStep();
    }
  };

  const handleCookChange = (id: string, val: number) => {
    setCookSelections(prev => ({ ...prev, [id]: val }));
  };

  const totalCookServices = Object.values(cookSelections).reduce((a, b) => a + b, 0);

  const handleWantsATV = (wants: boolean) => {
    setWantsATV(wants);
    if (!wants) {
      setAtvSelections({});
      nextStep();
    }
  };

  const Counter = ({ label, value, onChange, max, sublabel = null }: { label: string, value: number, onChange: (v: number) => void, max: number, sublabel?: string | null }) => (
    <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="flex flex-col">
        <span className="font-bold text-sm text-[#23211F]">{label}</span>
        {sublabel && <span className="text-xs text-gray-400 mt-1">{sublabel}</span>}
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
    setAtvSelections(prev => ({ ...prev, [type]: val }));
  };

  const totalAtvTours = Object.values(atvSelections).reduce((a, b) => a + b, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center md:items-center p-0 md:p-4 touch-none perspective-[1000px]">
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
            className="relative w-full max-w-5xl bg-[#F9F7F4] rounded-t-[2rem] md:rounded-[3rem] shadow-[0_-20px_40px_rgba(0,0,0,0.2)] md:shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[100dvh] h-[100dvh] md:h-[650px] mt-auto md:mt-0 z-10"
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
            <div className="hidden md:flex w-5/12 bg-[#23211F] text-[#F9F7F4] flex-col justify-between p-12 relative overflow-hidden shrink-0">
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
              <div className="relative z-10">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-[#9B7E67] mb-2">{dict.modal?.hotelName}</h3>
                  <h2 className="text-4xl font-serif leading-tight">
                    {isEn ? <>Your Private<br/>Refuge in<br/>Chacala</> : <>Tu Refugio<br/>Privado en<br/>Chacala</>}
                  </h2>
                </motion.div>
                
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="mt-12 space-y-6"
                >
                  <div className="flex items-start gap-4 text-sm font-light text-gray-300">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                      <CalendarDays size={16} className="text-[#9B7E67]" />
                    </div>
                    <div>
                      <p className="font-bold text-white mb-1 uppercase tracking-widest text-xs">{dict.modal?.dates}</p>
                      <p>{range?.from ? format(range.from, "d MMM yyyy", { locale: localeObj }) : '-'} — {range?.to ? format(range.to, "d MMM yyyy", { locale: localeObj }) : '-'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4 text-sm font-light text-gray-300">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                      <User size={16} className="text-[#9B7E67]" />
                    </div>
                    <div>
                      <p className="font-bold text-white mb-1 uppercase tracking-widest text-xs">{dict.modal?.guests}</p>
                      <p>{dict.modal?.guestsCount}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 text-sm font-light text-gray-300">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                      <Utensils size={16} className="text-[#9B7E67]" />
                    </div>
                    <div>
                      <p className="font-bold text-white mb-1 uppercase tracking-widest text-xs">{dict.addons?.optional}</p>
                      <p>{dict.addons?.optionalDesc}</p>
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="relative z-10 pt-12 mt-auto border-t border-white/10">
                <div className="flex justify-between items-end mb-2">
                  <div className="flex flex-col gap-1">
                    <p className="text-xs uppercase tracking-widest font-bold text-gray-400">{dict.modal?.total} {nights > 0 && `(${nights} ${dict.modal?.nights})`}</p>
                    <div className="flex gap-2 items-center mt-2">
                      <span className="text-[8px] uppercase text-[#9B7E67] font-bold tracking-widest max-w-[200px]">
                        {isEn ? '* Stripe will handle the currency conversion at checkout' : '* Stripe aplicará el tipo de cambio correspondiente al momento del pago'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-serif text-3xl text-[#9B7E67] flex items-baseline gap-1">
                      <AnimatedCounter value={grandTotal} prefix={currency === 'USD' || currency === 'CAD' ? '$' : '$'} />
                    </span>
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">{dict.modal?.taxesIncluded}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel */}
            <div className="w-full md:w-7/12 flex flex-col h-full bg-[#F9F7F4] text-[#23211F] relative">
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-12 pb-32 md:pb-12 scroll-smooth flex flex-col">
                <div className="shrink-0 z-10">
                  {step > 1 && step <= 5 && (
                    <PremiumButton variant="back" onClick={prevStep} backText={dict.modal?.backToCalendar} />
                  )}
                  <StepIndicator currentStep={step} totalSteps={5} />
                </div>
                <AnimatePresence mode="wait">
                  {step === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                      className="min-h-full flex flex-col flex-1"
                    >
                      <h3 className="text-2xl font-serif text-[#23211F] mb-6">{dict.modal?.selectDates}</h3>
                      <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-sm border border-gray-100 min-h-[350px]">
                        <DayPicker
                          mode="range"
                          selected={range}
                          onSelect={setRange}
                          disabled={[{ before: new Date() }, ...disabledRanges]}
                          modifiers={{
                            booked: bookedRanges,
                            buffer: bufferRanges,
                            blocked: blockedRanges
                          }}
                          numberOfMonths={1}
                          className="premium-calendar !m-0"
                          modifiersClassNames={{
                            selected: '!bg-[#9B7E67] !text-[#F9F7F4] !rounded-none ![clip-path:polygon(15%_0%,100%_0%,85%_100%,0%_100%)] !z-20 !font-bold !w-full !max-w-full !m-0',
                            range_start: '!bg-[#9B7E67] !text-[#F9F7F4] !rounded-none ![clip-path:polygon(15%_0%,100%_0%,100%_100%,0%_100%)] !z-20 !w-full !max-w-full !m-0',
                            range_end: '!bg-[#9B7E67] !text-[#F9F7F4] !rounded-none ![clip-path:polygon(0%_0%,100%_0%,85%_100%,0%_100%)] !z-20 !w-full !max-w-full !m-0',
                            range_middle: '!bg-[#D4A574] !text-[#23211F] !rounded-none !shadow-none !z-10 !w-full !max-w-full !m-0',
                            booked: '!text-red-500 !font-bold line-through !opacity-80',
                            buffer: '!text-[#D4A574] !font-bold line-through !opacity-80',
                            blocked: '!text-gray-400 line-through !opacity-60',
                            disabled: 'text-gray-300 opacity-50', // Fallback for past dates
                          }}
                        />
                        {range?.from && !range?.to && (
                          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[#9B7E67] text-sm mt-6 font-medium animate-pulse">
                            {dict.modal?.minStay}
                          </motion.p>
                        )}
                        <div className="flex flex-wrap items-center justify-center gap-4 mt-8 pt-6 border-t border-gray-50 text-[9px] font-bold uppercase tracking-widest text-gray-500 w-full">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500 opacity-80"></div>
                            <span>{isEn ? 'Booked' : 'Reservado'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#D4A574] opacity-80"></div>
                            <span>{isEn ? 'Cleaning / Buffer' : 'Limpieza / Margen'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-gray-400 opacity-60"></div>
                            <span>{isEn ? 'Blocked' : 'Bloqueado'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-8 shrink-0">
                        {(!range?.from || !range?.to) && (
                          <p className="text-amber-600 text-xs font-bold mb-3 text-center">
                            {isEn ? 'Please select your check-in and check-out dates' : 'Por favor selecciona tus fechas de entrada y salida'}
                          </p>
                        )}
                        {range?.from && range?.to && nights < 2 && (
                          <p className="text-red-500 text-xs font-bold mb-3 text-center">
                            {dict.modal?.minStay || (isEn ? 'Minimum 2 nights required' : 'Mínimo 2 noches requeridas')}
                          </p>
                        )}
                        <PremiumButton onClick={nextStep} disabled={!range?.from || !range?.to || nights < 2}>
                          {dict.modal?.continue} <ArrowRight size={16} />
                        </PremiumButton>
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                      className="min-h-full flex flex-col flex-1"
                    >
                      <div className="mb-8 shrink-0">
                        <div className="w-12 h-12 bg-[#F9F7F4] rounded-full flex items-center justify-center text-[#9B7E67] mb-4 shadow-sm border border-[#E8D5B7]">
                          <Utensils size={24} />
                        </div>
                        <h3 className="text-3xl font-serif text-[#23211F] mb-2">{dict.addons?.chefTitle}</h3>
                        <p className="text-gray-500 font-light">
                          {wantsCook 
                            ? (isEn ? "Would you like dinners prepared for you or extra help in the kitchen? Select from the options below" : "¿Le gustaría que le prepararan la cena o ayuda extra en la cocina? Seleccione de las opciones a continuación.")
                            : dict.addons?.chefDesc}
                        </p>
                      </div>

                      {wantsCook === null ? (
                        <div className="grid grid-cols-2 gap-4 mt-auto md:mt-0 pb-4">
                          <button onClick={() => handleWantsCook(true)} className="p-6 md:p-8 border-2 border-gray-200 rounded-2xl hover:border-[#9B7E67] text-[#23211F] font-bold text-sm md:text-lg transition-colors flex flex-col items-center gap-2 group bg-white">
                            <span className="w-8 h-8 rounded-full border-2 border-gray-300 group-hover:border-[#9B7E67] flex items-center justify-center text-transparent group-hover:bg-[#9B7E67] group-hover:text-white transition-all">✓</span>
                            {dict.addons?.yesPlease}
                          </button>
                          <button onClick={() => handleWantsCook(false)} className="p-6 md:p-8 border-2 border-gray-200 rounded-2xl hover:border-gray-400 text-gray-500 font-bold text-sm md:text-lg transition-colors flex flex-col items-center gap-2 group bg-white">
                            <span className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center text-transparent group-hover:bg-gray-400 group-hover:text-white transition-all">✕</span>
                            {dict.addons?.noThanks}
                          </button>
                        </div>
                      ) : wantsCook === true ? (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 flex-1 pb-4">
                          <button 
                            onClick={() => { 
                              if (selectedCookService) {
                                setSelectedCookService(null); 
                                setCookSelections({}); 
                                setSelectedDishes([]);
                              } else {
                                setWantsCook(null);
                              }
                            }} 
                            className="text-xs text-[#9B7E67] font-bold tracking-widest uppercase mb-2 block w-full text-left hover:text-[#23211F] transition-colors"
                          >
                            {isEn ? '← Change option' : '← Cambiar opción'}
                          </button>
                          
                          {!selectedCookService ? (
                            <div>
                              <div className="grid gap-3">
                                {foodServices.filter(s => s.serviceType === 'FOOD_SERVICE').map(service => (
                                  <button 
                                    key={service.id}
                                    onClick={() => setSelectedCookService(service)}
                                    className="p-5 border border-[#E8D5B7] rounded-xl hover:bg-[#F9F7F4] text-left transition-colors flex flex-col group bg-white"
                                  >
                                    <span className="font-bold text-[#23211F] group-hover:text-[#9B7E67] transition-colors">{translateDB(service.name, isEn)}</span>
                                    {service.description && <span className="text-sm text-gray-500 mt-1">{translateDB(service.description, isEn)}</span>}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div>
                              
                              <h4 className="text-lg font-serif text-[#23211F] mb-4">
                                {isEn ? 'Select a Catering Plan' : 'Selecciona un Plan de Alimentos'}
                              </h4>
                              <div className="space-y-3 mb-8">
                                {foodServices.filter(s => s.serviceType === 'FOOD_PRICE').map(priceOption => {
                                  return (
                                    <Counter 
                                      key={priceOption.id}
                                      label={translateDB(priceOption.name, isEn)} 
                                      value={cookSelections[priceOption.id.toString()] || 0} 
                                      onChange={(val) => setCookSelections(prev => ({ ...prev, [priceOption.id.toString()]: val }))} 
                                      max={(cookSelections[priceOption.id.toString()] || 0) + (Math.max(1, nights - 1) - totalCookServices)} 
                                      sublabel={`+${formatPrice(priceOption.price || 0)} / ${isEn ? 'day' : 'día'}`} 
                                    />
                                  );
                                })}
                              </div>

                              <div className="bg-[#FAF8F5] p-5 rounded-3xl border border-[#E8D5B7] mb-8">
                                <div className="flex justify-between items-center mb-4">
                                  <h4 className="text-sm font-bold uppercase tracking-widest text-[#9B7E67]">
                                    {isEn ? 'Available Dishes (Menu)' : 'Platillos Disponibles (Menú)'}
                                  </h4>
                                  <span className="text-xs font-bold text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">
                                    {selectedDishes.length} / {Math.max(1, nights - 1)} {isEn ? 'selected' : 'seleccionados'}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 mb-4 font-light">
                                  {isEn 
                                    ? `Based on your stay, you can select up to ${Math.max(1, nights - 1)} dishes (1 per day).` 
                                    : `Basado en tu estadía, puedes seleccionar hasta ${Math.max(1, nights - 1)} platillos (1 por día).`}
                                  <br/>
                                  <span className="font-medium mt-2 inline-block text-[#9B7E67]">
                                    {isEn 
                                      ? "Dinner includes an afternoon appetizer, fresh salad, your choice of main course, and dessert."
                                      : "La cena incluye un aperitivo por la tarde, ensalada fresca, su elección de plato principal y postre."}
                                  </span>
                                </p>
                                <div className="space-y-3">
                                  {foodServices.filter(s => s.serviceType === 'FOOD_DISH').map(dish => {
                                    const isExpanded = expandedDishId === dish.id;
                                    const isSelected = selectedDishes.includes(dish.id);
                                    const maxDishes = Math.max(1, nights - 1);
                                    return (
                                      <motion.div 
                                        layout
                                        key={dish.id} 
                                        className={`bg-white border rounded-[2rem] overflow-hidden shadow-sm transition-colors ${isSelected ? 'border-[#9B7E67] ring-1 ring-[#9B7E67]' : 'border-gray-100 hover:border-gray-200'}`}
                                      >
                                        <button 
                                          onClick={() => setExpandedDishId(isExpanded ? null : dish.id)}
                                          className="w-full px-6 py-4 text-left font-medium text-[#23211F] flex justify-between items-center"
                                        >
                                          <span className="flex items-center gap-3">
                                            {translateDB(dish.name, isEn)}
                                            {isSelected && (
                                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-5 h-5 rounded-full bg-[#9B7E67] text-white flex items-center justify-center">
                                                <Check size={12} strokeWidth={3} />
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
                                                <p className="text-sm text-gray-600 font-light leading-relaxed flex-1 whitespace-pre-wrap">
                                                  {translateDB(dish.description, isEn)}
                                                </p>
                                                <div className="shrink-0">
                                                  {!isSelected && selectedDishes.length < maxDishes && (
                                                    <motion.button 
                                                      whileHover={{ scale: 1.05 }}
                                                      whileTap={{ scale: 0.95 }}
                                                      onClick={() => {
                                                        setSelectedDishes(prev => {
                                                          const next = [...prev, dish.id];
                                                          if (next.length === maxDishes && totalCookServices > 0) {
                                                            setTimeout(() => nextStep(), 800);
                                                          }
                                                          return next;
                                                        });
                                                      }}
                                                      className="text-xs uppercase tracking-widest font-bold bg-[#23211F] text-white px-6 py-3 rounded-full shadow-md hover:shadow-lg transition-all"
                                                    >
                                                      {isEn ? 'Select Dish' : 'Seleccionar'}
                                                    </motion.button>
                                                  )}
                                                  {isSelected && (
                                                    <motion.button 
                                                      whileHover={{ scale: 1.05 }}
                                                      whileTap={{ scale: 0.95 }}
                                                      onClick={() => setSelectedDishes(prev => prev.filter(id => id !== dish.id))}
                                                      className="text-xs uppercase tracking-widest font-bold text-red-500 border border-red-200 bg-red-50 px-6 py-3 rounded-full hover:bg-red-100 transition-colors"
                                                    >
                                                      {isEn ? 'Remove' : 'Quitar'}
                                                    </motion.button>
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
                              </div>

                              {selectedDishes.length < Math.max(1, nights - 1) && (
                                <div className="shrink-0 mt-4">
                                  {totalCookServices === 0 && (
                                    <p className="text-amber-600 text-xs font-bold mb-3 text-center">
                                      {isEn ? 'Please select a Catering Plan for your days' : 'Por favor selecciona un Plan de Alimentos para tus días'}
                                    </p>
                                  )}
                                  {totalCookServices > 0 && selectedDishes.length < Math.max(1, nights - 1) && (
                                    <p className="text-amber-600 text-xs font-bold mb-3 text-center animate-pulse">
                                      {isEn ? `Please select ${Math.max(1, nights - 1) - selectedDishes.length} more dish(es)` : `Por favor selecciona ${Math.max(1, nights - 1) - selectedDishes.length} platillo(s) más`}
                                    </p>
                                  )}
                                  <PremiumButton onClick={nextStep} disabled={totalCookServices === 0 || selectedDishes.length < Math.max(1, nights - 1)}>
                                    {dict.addons?.confirmChef} <ArrowRight size={16} />
                                  </PremiumButton>
                                </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      ) : null}
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                      className="min-h-full flex flex-col flex-1"
                    >
                      <div className="mb-6 shrink-0">
                        <div className="w-12 h-12 bg-[#F9F7F4] rounded-full flex items-center justify-center text-[#9B7E67] mb-4 shadow-sm border border-[#E8D5B7]">
                          <Map size={24} />
                        </div>
                        <h3 className="text-3xl font-serif text-[#23211F] mb-2">{dict.addons?.atvTitle}</h3>
                        <p className="text-gray-500 font-light">{dict.addons?.atvDesc}</p>
                      </div>

                      {isTourBookedOnSelectedDates ? (
                        <div className="bg-[#FAF8F5] border border-[#D4A574] text-[#9B7E67] p-4 rounded-xl mb-6 text-sm">
                          <strong>{isEn ? 'Tour already booked' : 'Tour ya reservado'}</strong>
                          <p className="mt-1 opacity-80">
                            {isEn 
                              ? 'There is already a tour booked for these dates. You can still book the accommodation, but the ATV tour option is currently unavailable.' 
                              : 'Ya hay un tour reservado para estas fechas. Puedes reservar el alojamiento, pero la opción de tour en cuatrimoto no está disponible actualmente.'}
                          </p>
                        </div>
                      ) : wantsATV === null ? (
                        <div className="grid grid-cols-2 gap-4 mt-auto md:mt-0 pb-4">
                          <button onClick={() => handleWantsATV(true)} className="p-6 md:p-8 border-2 border-gray-200 rounded-2xl hover:border-[#9B7E67] text-[#23211F] font-bold text-sm md:text-lg transition-colors flex flex-col items-center gap-2 group bg-white">
                            <span className="w-8 h-8 rounded-full border-2 border-gray-300 group-hover:border-[#9B7E67] flex items-center justify-center text-transparent group-hover:bg-[#9B7E67] group-hover:text-white transition-all">✓</span>
                            {dict.addons?.yesExplore}
                          </button>
                          <button onClick={() => handleWantsATV(false)} className="p-6 md:p-8 border-2 border-gray-200 rounded-2xl hover:border-gray-400 text-gray-500 font-bold text-sm md:text-lg transition-colors flex flex-col items-center gap-2 group bg-white">
                            <span className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center text-transparent group-hover:bg-gray-400 group-hover:text-white transition-all">✕</span>
                            {dict.addons?.noThanks}
                          </button>
                        </div>
                      ) : wantsATV === true ? (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 flex-1 flex flex-col">
                          <button onClick={() => setWantsATV(null)} className="text-xs text-[#9B7E67] font-bold tracking-widest uppercase mb-2 block w-full text-left hover:text-[#23211F] transition-colors">{isEn ? '← Change option (Unselect)' : '← Cambiar opción (Deseleccionar)'}</button>
                          <div className="bg-amber-50 text-amber-800 text-xs px-4 py-2 rounded-lg font-medium shrink-0">
                            {isEn ? `Maximum 1 tour per day (${nights - totalAtvTours} available)` : `Máximo 1 recorrido por día (${nights - totalAtvTours} disponibles)`}
                          </div>
                          
                          <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm shrink-0">
                            <div className="font-bold text-sm text-[#23211F] mb-2">{dict.addons?.howManyPeople} (Min {minTourPax}, Max {maxTourPax})</div>
                            <div className="flex items-center gap-3">
                              <button 
                                onClick={() => setAtvPeople(Math.max(minTourPax, atvPeople - 1))}
                                className={`w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 border border-gray-200 text-gray-500 hover:text-black transition-colors ${atvPeople <= minTourPax ? 'invisible' : ''}`}
                              >
                                <Minus size={16} />
                              </button>
                              <span className="w-4 text-center font-bold text-[#9B7E67]">{atvPeople}</span>
                              <button 
                                onClick={() => setAtvPeople(Math.min(maxTourPax, atvPeople + 1))}
                                className={`w-8 h-8 flex items-center justify-center rounded-full bg-[#23211F] text-white hover:bg-[#9B7E67] transition-colors ${atvPeople >= maxTourPax ? 'invisible' : ''}`}
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                          </div>
                          
                          <div className="flex-1 space-y-3 pb-4">
                            <p className="font-bold text-sm text-[#23211F] mb-2">{dict.addons?.selectDestination}</p>
                            {tours.map(tour => (
                              <Counter 
                                key={tour.id}
                                label={translateDB(tour.name, isEn)} 
                                value={atvSelections[tour.id.toString()] || 0} 
                                onChange={(val) => handleAtvChange(tour.id.toString(), val)} 
                                max={(atvSelections[tour.id.toString()] || 0) + (nights - totalAtvTours)} 
                                sublabel={`+${formatPrice(tour.pricePerPax)} / pax`} 
                              />
                            ))}
                          </div>

                          <div className="mt-4 pb-4 shrink-0">
                            {(totalAtvTours === 0 || atvPeople < minTourPax) && (
                              <p className="text-amber-600 text-xs font-bold mb-3 text-center">
                                {isEn ? 'Please select at least one destination and number of people' : 'Por favor selecciona al menos un destino y personas'}
                              </p>
                            )}
                            <PremiumButton onClick={nextStep} disabled={totalAtvTours === 0 || atvPeople < minTourPax}>
                              {dict.modal?.continue} <ArrowRight size={16} />
                            </PremiumButton>
                          </div>
                        </motion.div>
                      ) : null}
                    </motion.div>
                  )}

                  {step === 4 && (
                    <motion.div
                      key="step4"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                      className="min-h-full flex flex-col flex-1"
                    >
                      <h3 className="text-3xl font-serif text-[#23211F] mb-8 shrink-0">{dict.modal?.yourData}</h3>
                      
                      <form 
                        onSubmit={(e) => { 
                          e.preventDefault(); 
                          if (isFormValid) nextStep(); 
                        }} 
                        className="space-y-6 flex-1 pb-4"
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
                        <div className="flex gap-4">
                          <div className="w-1/3">
                            <PremiumInput
                              id="countryCode"
                              type="text"
                              label={isEn ? 'Code' : 'Lada'}
                              placeholder="+52"
                              value={countryCode}
                              onChange={setCountryCode}
                              isValid={countryCode.length >= 2}
                              delay={0.3}
                            />
                          </div>
                          <div className="w-2/3">
                            <PremiumInput
                              id="phone"
                              type="tel"
                              label={dict.modal?.phone}
                              placeholder="55 1234 5678"
                              value={guestPhone}
                              onChange={setGuestPhone}
                              isValid={isPhoneValid}
                              delay={0.3}
                            />
                          </div>
                        </div>

                        <div className="mt-8 pb-4 shrink-0">
                          {!isFormValid && (
                            <p className="text-amber-600 text-xs font-bold mb-3 text-center">
                              {isEn ? 'Please fill in all required fields correctly' : 'Por favor completa todos los campos requeridos correctamente'}
                            </p>
                          )}
                          <button 
                            type="submit"
                            disabled={!isFormValid}
                            className={`flex items-center justify-center gap-4 text-xs uppercase tracking-[0.2em] font-bold px-10 py-5 rounded-full transition-all duration-300 transform w-full ${
                              !isFormValid 
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                                : 'bg-[#9B7E67] text-[#0A0908] hover:bg-[#F9F7F4] hover:-translate-y-1 shadow-md hover:shadow-xl hover:shadow-black/10'
                            }`}
                          >
                            {dict.modal?.summary || (isEn ? 'View Summary' : 'Ver Resumen')} <ArrowRight size={16} />
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  )}

                  {step === 5 && (
                    <motion.div
                      key="step5"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                      className="min-h-full flex flex-col flex-1"
                    >
                      {showConfetti && Array.from({ length: 40 }).map((_, i) => (
                        <ConfettiParticle key={i} index={i} delay={Math.random() * 0.5} />
                      ))}

                      <div className="flex flex-col h-full">
                        <h3 className="text-3xl font-serif text-[#23211F] mb-6 shrink-0">{dict.modal?.summary || (isEn ? 'Summary' : 'Resumen')}</h3>
                        
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex-1 overflow-y-auto space-y-6 mb-8">
                          <div className="flex justify-between items-center pb-6 border-b border-gray-100">
                            <div>
                              <h4 className="font-bold text-[#23211F]">{dict.addons?.accommodation}</h4>
                              <p className="text-sm text-gray-500">{nights} {dict.modal?.nights}</p>
                            </div>
                            <div className="font-serif text-xl text-[#9B7E67]">${accommodationTotal.toLocaleString('en-US')} {currency}</div>
                          </div>
                          
                          {wantsCook && totalCookServices > 0 && (
                            <div className="pb-6 border-b border-gray-100">
                              <h4 className="font-bold text-[#23211F] mb-3 flex items-center gap-2"><Utensils size={16}/> {dict.addons?.chefTitle}</h4>
                              {Object.entries(cookSelections).map(([id, count]) => {
                                if (count > 0) {
                                  const service = foodServices.find(s => s.id.toString() === id);
                                  if (service) {
                                    return (
                                      <div key={id} className="flex justify-between text-sm text-gray-600 mb-1">
                                        <span>{count}x {translateDB(service.name, isEn)}</span>
                                        <span>${(count * (service.price || 0)).toLocaleString('en-US')}</span>
                                      </div>
                                    );
                                  }
                                }
                                return null;
                              })}
                              {selectedDishes.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-50">
                                  <p className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-1">{isEn ? 'Selected Dishes:' : 'Platillos Seleccionados:'}</p>
                                  {selectedDishes.map(dishId => {
                                    const dish = foodServices.find(s => s.id === dishId);
                                    if (dish) {
                                      return (
                                        <div key={dishId} className="flex justify-between text-sm text-gray-500 mb-0.5 ml-2">
                                          <span>• {translateDB(dish.name, isEn)}</span>
                                          {(dish.price || 0) > 0 && <span>${(dish.price || 0).toLocaleString('en-US')}</span>}
                                        </div>
                                      );
                                    }
                                    return null;
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {wantsATV && Object.values(atvSelections).some(v => v > 0) && (
                            <div className="pb-6 border-b border-gray-100">
                              <h4 className="font-bold text-[#23211F] mb-3 flex items-center gap-2"><Map size={16}/> {dict.addons?.atvTour}</h4>
                              {Object.entries(atvSelections).map(([id, count]) => {
                                if (count > 0) {
                                  const tour = tours.find(t => t.id.toString() === id);
                                  if (tour) {
                                    return (
                                      <div key={id} className="flex justify-between text-sm text-gray-600 mb-1">
                                        <span>{count}x {atvPeople} pax - {translateDB(tour.name, isEn)}</span>
                                        <span>${(count * atvPeople * (tour.pricePerPax || 0)).toLocaleString('en-US')}</span>
                                      </div>
                                    );
                                  }
                                }
                                return null;
                              })}
                            </div>
                          )}

                          <div className="flex justify-between items-center pt-2">
                            <div>
                              <h4 className="font-bold text-2xl text-[#23211F]">{dict.modal?.total}</h4>
                              <p className="text-xs text-gray-400 uppercase tracking-widest">{dict.modal?.taxesIncluded}</p>
                            </div>
                            <div className="font-serif text-3xl text-[#23211F]">${grandTotal.toLocaleString('en-US')} {currency}</div>
                          </div>
                        </div>

                        {error && (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium mb-6 text-center shrink-0">
                            {error}
                          </motion.div>
                        )}

                        <div className="shrink-0 pb-4">
                          <PremiumButton onClick={handleCheckout} disabled={!isFormValid || isLoading || grandTotal === 0}>
                            <CreditCard size={18} />
                            {dict.modal?.proceedPayment}
                          </PremiumButton>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Mobile Fixed Bottom Summary */}
            {isMobile && step < 5 && (
              <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-8 flex justify-between items-center shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-20"
              >
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1">{isEn ? 'Subtotal' : 'Total Parcial'}</p>
                  <div className="font-serif text-xl text-[#23211F] leading-none">${grandTotal.toLocaleString('en-US')}</div>
                </div>
                {step === 1 && (
                  <div className="flex flex-col items-end">
                    {range?.from && range?.to && nights < 2 && <span className="text-red-500 text-[10px] font-bold mb-1 mr-2">{isEn ? 'Min 2 nights' : 'Mínimo 2 noches'}</span>}
                    <button onClick={nextStep} disabled={!range?.from || !range?.to || nights < 2} className="bg-[#23211F] text-white px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest disabled:opacity-50 transition-colors">
                      {dictContext?.modal?.next || (isEn ? 'Next' : 'Siguiente')}
                    </button>
                  </div>
                )}
                {step === 2 && (
                  <div className="flex flex-col items-end">
                    {wantsCook === null ? <span className="text-amber-600 text-[10px] font-bold mb-1 mr-2">{isEn ? 'Select an option' : 'Selecciona una opción'}</span> : wantsCook && (totalCookServices === 0 || selectedDishes.length < Math.max(1, nights - 1)) ? <span className="text-amber-600 text-[10px] font-bold mb-1 mr-2">{isEn ? 'Select your dishes' : 'Selecciona tus platillos'}</span> : null}
                    <button onClick={nextStep} disabled={wantsCook === null || (wantsCook && (totalCookServices === 0 || selectedDishes.length < Math.max(1, nights - 1)))} className="bg-[#23211F] text-white px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest disabled:opacity-50 transition-colors">
                      {dictContext?.modal?.next || (isEn ? 'Next' : 'Siguiente')}
                    </button>
                  </div>
                )}
                {step === 3 && (
                  <div className="flex flex-col items-end">
                    {(!isTourBookedOnSelectedDates && wantsATV === null) ? <span className="text-amber-600 text-[10px] font-bold mb-1 mr-2">{isEn ? 'Select an option' : 'Selecciona una opción'}</span> : wantsATV && (totalAtvTours === 0 || atvPeople < minTourPax) ? <span className="text-amber-600 text-[10px] font-bold mb-1 mr-2">{isEn ? 'Select destination' : 'Selecciona un destino'}</span> : null}
                    <button onClick={nextStep} disabled={(!isTourBookedOnSelectedDates && wantsATV === null) || (wantsATV && (totalAtvTours === 0 || atvPeople < minTourPax))} className="bg-[#23211F] text-white px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest disabled:opacity-50 transition-colors">
                      {dictContext?.modal?.next || (isEn ? 'Next' : 'Siguiente')}
                    </button>
                  </div>
                )}
                {step === 4 && (
                  <div className="flex flex-col items-end">
                    {!isFormValid && <span className="text-amber-600 text-[10px] font-bold mb-1 mr-2">{isEn ? 'Fill required fields' : 'Llena los campos'}</span>}
                    <button onClick={nextStep} disabled={!isFormValid} className="bg-[#23211F] text-white px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest disabled:opacity-50 transition-colors">
                      {dictContext?.modal?.summary || (isEn ? 'Summary' : 'Resumen')}
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
