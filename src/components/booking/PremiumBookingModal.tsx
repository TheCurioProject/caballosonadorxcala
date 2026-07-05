'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useDragControls } from 'framer-motion';
import { X, CalendarDays, ArrowRight, Check, Shield, CreditCard, Calendar, User, ChefHat, Map, Utensils, Minus, Plus } from 'lucide-react';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import FluidHorseAnimation from '../FluidHorseAnimation';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
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
  const x = (Math.random() - 0.5) * 300;
  const y = -(Math.random() * 200 + 100);
  const rotate = Math.random() * 720 - 360;
  const size = Math.random() * 6 + 4;

  return (
    <motion.div
      initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
      animate={{ opacity: [1, 1, 0], x, y: [0, y, y + 60], rotate, scale: [1, 1.2, 0.5] }}
      transition={{ duration: 2.2, delay, ease: 'easeOut' }}
      className="absolute pointer-events-none"
      style={{
        width: size,
        height: size * 1.5,
        backgroundColor: color,
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
        left: '50%',
        top: '50%',
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

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      controls.set(start + (value - start) * eased);
      setDisplay(`${prefix}${Math.round(controls.get()).toLocaleString('en-US')}`);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
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
}: {
  id: string;
  type: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  isValid: boolean;
  delay?: number;
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
          {isFocused || value ? label.toUpperCase() : placeholder}
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
          className="flex items-center justify-center relative"
          animate={{
            scale: currentStep === step ? 1 : 0.85,
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <motion.div
            className="w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[10px] md:text-xs font-bold relative overflow-hidden"
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
              className="absolute inset-0 rounded-full border-2 border-[#9B7E67]"
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
        </motion.div>
        {step < totalSteps && (
          <motion.div
            className="h-[2px] flex-1 rounded-full overflow-hidden bg-gray-200"
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
}: {
  children?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'back';
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
        Volver
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

/* ─── Main Modal ─── */
export const PremiumBookingModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const dragControls = useDragControls();
  const dict = useDictionary();

  const [step, setStep] = useState(1);
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [disabledRanges, setDisabledRanges] = useState<{from: Date, to: Date}[]>([]);
  
  // Form Data
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+52');
  const [guestPhone, setGuestPhone] = useState('');
  
  // Extras state
  const [addonsData, setAddonsData] = useState<any[]>([]);
  
  const [wantsChef, setWantsChef] = useState<boolean | null>(null);
  const [chefBreakfasts, setChefBreakfasts] = useState(0);
  const [chefLunches, setChefLunches] = useState(0);
  const [chefDinners, setChefDinners] = useState(0);

  const [wantsATV, setWantsATV] = useState<boolean | null>(null);
  const [atvPeople, setAtvPeople] = useState(1);
  const [atvDestination, setAtvDestination] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [currency, setCurrency] = useState('MXN');
  const [showConfetti, setShowConfetti] = useState(false);

  useScrollLock(isOpen);

  // Fetch addons on mount
  useEffect(() => {
    fetch('/api/admin/addons')
      .then(res => res.json())
      .then(data => setAddonsData(data))
      .catch(console.error);
  }, []);

  // Fetch blocked dates on open
  useEffect(() => {
    if (isOpen) {
      fetch('/api/availability')
        .then(res => res.json())
        .then(data => {
          if (data.disabledRanges) {
            const ranges = data.disabledRanges.map((r: any) => ({
              from: new Date(r.from),
              to: new Date(r.to)
            }));
            setDisabledRanges(ranges);
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
        setWantsChef(null);
        setChefBreakfasts(0);
        setChefLunches(0);
        setChefDinners(0);
        setWantsATV(null);
        setAtvPeople(1);
        setAtvDestination('');
        setError(null);
        setIsSuccess(false);
        setShowConfetti(false);
      }, 500);
    }
  }, [isOpen]);

  const basePrice = useMemo(() => {
    switch(currency) {
      case 'USD': return 800;
      case 'EUR': return 750;
      case 'MXN': 
      default: return 15000;
    }
  }, [currency]);

  const nights = (range?.from && range?.to) ? differenceInDays(range.to, range.from) : 0;
  const accommodationTotal = nights > 0 ? nights * basePrice : 0;

  // Calculate Extra Costs
  const getAddonPrice = (type: string) => {
    const addon = addonsData.find(a => a.type === type);
    return addon ? addon.price : 0;
  };
  
  const getAddonName = (type: string) => {
    const addon = addonsData.find(a => a.type === type);
    return addon ? addon.name : '';
  };

  const chefTotal = wantsChef ? (chefBreakfasts * getAddonPrice('CHEF_BREAKFAST') + chefLunches * getAddonPrice('CHEF_LUNCH') + chefDinners * getAddonPrice('CHEF_DINNER')) : 0;
  const atvTotal = (wantsATV && atvDestination) ? (atvPeople * getAddonPrice(atvDestination)) : 0;
  
  const grandTotal = accommodationTotal + chefTotal + atvTotal;

  const isNameValid = guestName.trim().length >= 2;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail);
  const isPhoneValid = guestPhone.trim().length >= 7;
  const isFormValid = isNameValid && isEmailValid && isPhoneValid;

  const handleCheckout = async () => {
    if (!range?.from || !range?.to || !isFormValid) return;

    setIsLoading(true);
    setError(null);

    const selectedAddons = [];
    if (wantsChef) {
      if (chefBreakfasts > 0) selectedAddons.push({ type: 'CHEF_BREAKFAST', name: getAddonName('CHEF_BREAKFAST'), quantity: chefBreakfasts, unitPrice: getAddonPrice('CHEF_BREAKFAST'), price: chefBreakfasts * getAddonPrice('CHEF_BREAKFAST') });
      if (chefLunches > 0) selectedAddons.push({ type: 'CHEF_LUNCH', name: getAddonName('CHEF_LUNCH'), quantity: chefLunches, unitPrice: getAddonPrice('CHEF_LUNCH'), price: chefLunches * getAddonPrice('CHEF_LUNCH') });
      if (chefDinners > 0) selectedAddons.push({ type: 'CHEF_DINNER', name: getAddonName('CHEF_DINNER'), quantity: chefDinners, unitPrice: getAddonPrice('CHEF_DINNER'), price: chefDinners * getAddonPrice('CHEF_DINNER') });
    }
    if (wantsATV && atvDestination) {
      selectedAddons.push({ type: atvDestination, name: getAddonName(atvDestination), quantity: atvPeople, unitPrice: getAddonPrice(atvDestination), price: atvPeople * getAddonPrice(atvDestination), details: JSON.stringify({ people: atvPeople, destination: atvDestination }) });
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
      setError(err.message || 'Error occurred while booking. Please try again.');
      setIsLoading(false);
    }
  };

  const nextStep = () => setStep(s => Math.min(s + 1, 5));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  // --- Step 2: Chef ---
  const handleWantsChef = (wants: boolean) => {
    setWantsChef(wants);
    if (!wants) {
      setChefBreakfasts(0);
      setChefLunches(0);
      setChefDinners(0);
      nextStep();
    }
  };

  const Counter = ({ label, value, onChange, max }: { label: string, value: number, onChange: (v: number) => void, max: number }) => (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
      <span className="font-medium text-[#23211F]">{label}</span>
      <div className="flex items-center gap-4">
        <button 
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-500 hover:text-black hover:border-gray-400 transition-colors"
        >
          <Minus size={16} />
        </button>
        <span className="w-4 text-center font-bold text-[#9B7E67]">{value}</span>
        <button 
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-[#23211F] text-white hover:bg-[#9B7E67] transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4 perspective-[1000px]">
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
            initial={isMobile ? { y: '100%' } : { opacity: 0, y: 40, scale: 0.95, rotateX: 10 }}
            animate={isMobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={isMobile ? { y: '100%' } : { opacity: 0, y: 40, scale: 0.95, rotateX: -10 }}
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
            className="relative w-full sm:w-[95vw] md:w-[85vw] lg:w-[1000px] max-w-full bg-[#F9F7F4] sm:rounded-[32px] rounded-t-[32px] overflow-hidden shadow-2xl flex flex-col sm:flex-row min-h-[85vh] sm:min-h-0 h-full sm:h-auto z-10"
          >
            {isMobile && (
              <div 
                className="w-full flex justify-center py-3 sm:hidden absolute top-0 z-50 cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
              </div>
            )}

            {/* Left Panel - Premium Brand Presentation */}
            <div className="hidden sm:flex w-5/12 bg-[#23211F] text-[#F9F7F4] flex-col justify-between p-12 relative overflow-hidden">
              <div className="absolute inset-0 opacity-20 pointer-events-none">
                <FluidHorseAnimation />
              </div>
              <div className="relative z-10">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-[#9B7E67] mb-2">{(dict as any).modal?.hotelName}</h3>
                  <h2 className="text-4xl font-serif leading-tight">Tu Refugio<br/>Privado en<br/>Chacala</h2>
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
                      <p className="font-bold text-white mb-1 uppercase tracking-widest text-xs">{(dict as any).modal?.dates}</p>
                      <p>{range?.from ? format(range.from, "d 'de' MMMM", { locale: es }) : 'Selecciona'} - {range?.to ? format(range.to, "d 'de' MMMM", { locale: es }) : 'Selecciona'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4 text-sm font-light text-gray-300">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                      <User size={16} className="text-[#9B7E67]" />
                    </div>
                    <div>
                      <p className="font-bold text-white mb-1 uppercase tracking-widest text-xs">{(dict as any).modal?.guests}</p>
                      <p>{(dict as any).modal?.guestsCount}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 text-sm font-light text-gray-300">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                      <Utensils size={16} className="text-[#9B7E67]" />
                    </div>
                    <div>
                      <p className="font-bold text-white mb-1 uppercase tracking-widest text-xs">Extras (Opcional)</p>
                      <p>Chef privado y tours en ATV.</p>
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="relative z-10 pt-12 mt-auto border-t border-white/10">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-xs uppercase tracking-widest font-bold text-gray-400 mb-2">{(dict as any).modal?.total}</p>
                    <div className="text-3xl font-serif text-[#9B7E67] flex items-baseline gap-2">
                      <AnimatedCounter value={grandTotal} prefix={currency === 'EUR' ? '€' : '$'} />
                      <span className="text-sm font-sans font-light text-gray-400">{currency}</span>
                    </div>
                  </div>
                  {nights > 0 && <span className="text-xs text-gray-400 bg-white/5 px-3 py-1 rounded-full">{nights} {(dict as any).modal?.nights}</span>}
                </div>
              </div>
            </div>

            {/* Right Panel - Interactive Flow */}
            <div className="w-full sm:w-7/12 flex flex-col h-full overflow-hidden relative pt-12 sm:pt-0">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 flex items-center justify-center rounded-full bg-white sm:bg-transparent shadow-md sm:shadow-none sm:hover:bg-gray-200 transition-colors z-50 text-gray-500"
              >
                <X size={20} />
              </button>

              <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 sm:p-12 pb-24 sm:pb-12 scroll-smooth">
                <AnimatePresence mode="wait">
                  {step === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                      className="h-full flex flex-col"
                    >
                      <StepIndicator currentStep={1} totalSteps={5} />
                      <h3 className="text-2xl font-serif text-[#23211F] mb-6">{(dict as any).modal?.selectDates}</h3>
                      <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-sm border border-gray-100">
                        <DayPicker
                          mode="range"
                          selected={range}
                          onSelect={setRange}
                          disabled={[{ before: new Date() }, ...disabledRanges]}
                          numberOfMonths={isMobile ? 1 : 2}
                          className="premium-calendar !m-0"
                          modifiersClassNames={{
                            selected: 'bg-[#9B7E67] text-white font-bold rounded-full',
                            range_start: 'bg-[#23211F] text-white',
                            range_end: 'bg-[#23211F] text-white',
                            range_middle: 'bg-[#F9F7F4] text-[#9B7E67]',
                            disabled: 'text-gray-300 line-through opacity-50',
                          }}
                        />
                        {range?.from && !range?.to && (
                          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[#9B7E67] text-sm mt-6 font-medium animate-pulse">
                            {(dict as any).modal?.minStay}
                          </motion.p>
                        )}
                      </div>
                      <div className="mt-8">
                        <PremiumButton onClick={nextStep} disabled={!range?.from || !range?.to || nights < 2}>
                          Continuar <ArrowRight size={16} />
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
                      className="h-full flex flex-col"
                    >
                      <PremiumButton variant="back" onClick={prevStep} />
                      <StepIndicator currentStep={2} totalSteps={5} />
                      <div className="mb-8">
                        <div className="w-12 h-12 bg-[#F9F7F4] rounded-full flex items-center justify-center text-[#9B7E67] mb-4 shadow-sm border border-[#E8D5B7]">
                          <ChefHat size={24} />
                        </div>
                        <h3 className="text-3xl font-serif text-[#23211F] mb-2">Servicio de Chef</h3>
                        <p className="text-gray-500 font-light">¿Te gustaría añadir el servicio de Chef Privado a tu estancia? Disfruta de deliciosos platillos preparados en la casa (Cargo extra por comida).</p>
                      </div>

                      {wantsChef === null ? (
                        <div className="grid grid-cols-2 gap-4">
                          <button onClick={() => handleWantsChef(true)} className="p-8 border-2 border-gray-200 rounded-2xl hover:border-[#9B7E67] text-[#23211F] font-bold text-lg transition-colors flex flex-col items-center gap-2 group">
                            <span className="w-8 h-8 rounded-full border-2 border-gray-300 group-hover:border-[#9B7E67] flex items-center justify-center text-transparent group-hover:bg-[#9B7E67] group-hover:text-white transition-all">✓</span>
                            Sí, por favor
                          </button>
                          <button onClick={() => handleWantsChef(false)} className="p-8 border-2 border-gray-200 rounded-2xl hover:border-gray-400 text-gray-500 font-bold text-lg transition-colors flex flex-col items-center gap-2 group">
                            <span className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center text-transparent group-hover:bg-gray-400 group-hover:text-white transition-all">✕</span>
                            No, gracias
                          </button>
                        </div>
                      ) : wantsChef === true ? (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 flex-1">
                          <Counter label="Desayunos" value={chefBreakfasts} onChange={setChefBreakfasts} max={nights} />
                          <Counter label="Comidas" value={chefLunches} onChange={setChefLunches} max={nights} />
                          <Counter label="Cenas" value={chefDinners} onChange={setChefDinners} max={nights} />
                          <div className="mt-8">
                            <PremiumButton onClick={nextStep} disabled={chefBreakfasts === 0 && chefLunches === 0 && chefDinners === 0}>
                              Confirmar Chef <ArrowRight size={16} />
                            </PremiumButton>
                          </div>
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
                      className="h-full flex flex-col"
                    >
                      <PremiumButton variant="back" onClick={prevStep} />
                      <StepIndicator currentStep={3} totalSteps={5} />
                      <div className="mb-8">
                        <div className="w-12 h-12 bg-[#F9F7F4] rounded-full flex items-center justify-center text-[#9B7E67] mb-4 shadow-sm border border-[#E8D5B7]">
                          <Map size={24} />
                        </div>
                        <h3 className="text-3xl font-serif text-[#23211F] mb-2">Aventura ATV</h3>
                        <p className="text-gray-500 font-light">Tenemos rutas exclusivas de ATV para explorar Chacala. ¿Deseas reservar una aventura? (Cargo extra).</p>
                      </div>

                      {wantsATV === null ? (
                        <div className="grid grid-cols-2 gap-4">
                          <button onClick={() => setWantsATV(true)} className="p-8 border-2 border-gray-200 rounded-2xl hover:border-[#9B7E67] text-[#23211F] font-bold text-lg transition-colors flex flex-col items-center gap-2 group">
                            <span className="w-8 h-8 rounded-full border-2 border-gray-300 group-hover:border-[#9B7E67] flex items-center justify-center text-transparent group-hover:bg-[#9B7E67] group-hover:text-white transition-all">✓</span>
                            Sí, explorar
                          </button>
                          <button onClick={() => { setWantsATV(false); nextStep(); }} className="p-8 border-2 border-gray-200 rounded-2xl hover:border-gray-400 text-gray-500 font-bold text-lg transition-colors flex flex-col items-center gap-2 group">
                            <span className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center text-transparent group-hover:bg-gray-400 group-hover:text-white transition-all">✕</span>
                            No, gracias
                          </button>
                        </div>
                      ) : wantsATV === true ? (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 flex-1 overflow-y-auto pr-2 pb-8">
                          <Counter label="¿Cuántas personas? (Máx 10)" value={atvPeople} onChange={setAtvPeople} max={10} />
                          <div>
                            <p className="font-bold text-sm text-[#23211F] mb-4">Selecciona tu destino (1 ruta por grupo)</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {addonsData.filter(a => a.type.startsWith('ATV_')).map(tour => (
                                <button 
                                  key={tour.type}
                                  onClick={() => setAtvDestination(tour.type)}
                                  className={`p-4 rounded-xl border text-left transition-all ${atvDestination === tour.type ? 'border-[#9B7E67] bg-[#9B7E67]/5' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                                >
                                  <div className="font-bold text-[#23211F] text-sm">{tour.name.replace(' (por persona)', '').replace('ATV - ', '')}</div>
                                  <div className="text-[#9B7E67] font-medium text-xs mt-1">+${tour.price} USD / persona</div>
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="mt-8">
                            <PremiumButton onClick={nextStep} disabled={!atvDestination || atvPeople < 1}>
                              Continuar <ArrowRight size={16} />
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
                      className="h-full flex flex-col"
                    >
                      <PremiumButton variant="back" onClick={prevStep} />
                      <StepIndicator currentStep={4} totalSteps={5} />
                      <h3 className="text-3xl font-serif text-[#23211F] mb-8">{(dict as any).modal?.yourData}</h3>
                      
                      <div className="space-y-6 flex-1">
                        <PremiumInput
                          id="name"
                          type="text"
                          label={(dict as any).modal?.fullName}
                          placeholder="Ej. Juan Pérez"
                          value={guestName}
                          onChange={setGuestName}
                          isValid={isNameValid}
                          delay={0.1}
                        />
                        <PremiumInput
                          id="email"
                          type="email"
                          label={(dict as any).modal?.email}
                          placeholder="correo@ejemplo.com"
                          value={guestEmail}
                          onChange={setGuestEmail}
                          isValid={isEmailValid}
                          delay={0.2}
                        />
                        <div className="flex gap-4">
                          <div className="w-1/3">
                            <PremiumInput
                              id="countryCode"
                              type="text"
                              label="Lada"
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
                              label={(dict as any).modal?.phone}
                              placeholder="55 1234 5678"
                              value={guestPhone}
                              onChange={setGuestPhone}
                              isValid={isPhoneValid}
                              delay={0.3}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-12">
                        <PremiumButton onClick={nextStep} disabled={!isFormValid}>
                          Ver Resumen <ArrowRight size={16} />
                        </PremiumButton>
                      </div>
                    </motion.div>
                  )}

                  {step === 5 && (
                    <motion.div
                      key="step5"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                      className="h-full flex flex-col"
                    >
                      {showConfetti && Array.from({ length: 40 }).map((_, i) => (
                        <ConfettiParticle key={i} index={i} delay={Math.random() * 0.5} />
                      ))}

                      {isLoading || isSuccess ? (
                        <div className="flex-1 flex flex-col items-center justify-center h-full text-center space-y-6">
                          <motion.div
                            animate={{ rotate: isSuccess ? 0 : 360, scale: isSuccess ? 1.2 : 1 }}
                            transition={isSuccess ? { type: 'spring', stiffness: 300 } : { duration: 2, repeat: Infinity, ease: 'linear' }}
                            className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl ${
                              isSuccess ? 'bg-[#9B7E67] text-white' : 'bg-white text-[#9B7E67]'
                            }`}
                          >
                            {isSuccess ? <Check size={40} /> : <div className="w-10 h-10 border-4 border-[#9B7E67] border-t-transparent rounded-full animate-spin" />}
                          </motion.div>
                          <div>
                            <h3 className="text-3xl font-serif text-[#23211F] mb-2">
                              {isSuccess ? (dict as any).modal?.allReady : (dict as any).modal?.preparing}
                            </h3>
                            <p className="text-gray-500 font-light">
                              {isSuccess ? (dict as any).modal?.redirecting : (dict as any).modal?.securePayments}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col h-full">
                          <PremiumButton variant="back" onClick={prevStep} />
                          <StepIndicator currentStep={5} totalSteps={5} />
                          <h3 className="text-3xl font-serif text-[#23211F] mb-6">Resumen</h3>
                          
                          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex-1 overflow-y-auto space-y-6 mb-8">
                            <div className="flex justify-between items-center pb-6 border-b border-gray-100">
                              <div>
                                <h4 className="font-bold text-[#23211F]">Hospedaje</h4>
                                <p className="text-sm text-gray-500">{nights} {(dict as any).modal?.nights}</p>
                              </div>
                              <div className="font-serif text-xl text-[#9B7E67]">${accommodationTotal.toLocaleString('en-US')} {currency}</div>
                            </div>
                            
                            {wantsChef && (chefBreakfasts > 0 || chefLunches > 0 || chefDinners > 0) && (
                              <div className="pb-6 border-b border-gray-100">
                                <h4 className="font-bold text-[#23211F] mb-3 flex items-center gap-2"><ChefHat size={16}/> Servicio de Chef</h4>
                                {chefBreakfasts > 0 && <div className="flex justify-between text-sm text-gray-600 mb-1"><span>{chefBreakfasts}x Desayuno</span><span>${(chefBreakfasts * getAddonPrice('CHEF_BREAKFAST')).toLocaleString('en-US')}</span></div>}
                                {chefLunches > 0 && <div className="flex justify-between text-sm text-gray-600 mb-1"><span>{chefLunches}x Comida</span><span>${(chefLunches * getAddonPrice('CHEF_LUNCH')).toLocaleString('en-US')}</span></div>}
                                {chefDinners > 0 && <div className="flex justify-between text-sm text-gray-600"><span>{chefDinners}x Cena</span><span>${(chefDinners * getAddonPrice('CHEF_DINNER')).toLocaleString('en-US')}</span></div>}
                              </div>
                            )}

                            {wantsATV && atvDestination && (
                              <div className="pb-6 border-b border-gray-100">
                                <h4 className="font-bold text-[#23211F] mb-3 flex items-center gap-2"><Map size={16}/> Tour ATV</h4>
                                <div className="flex justify-between text-sm text-gray-600">
                                  <span>{atvPeople}x {getAddonName(atvDestination).replace(' (por persona)', '').replace('ATV - ', '')}</span>
                                  <span>${(atvPeople * getAddonPrice(atvDestination)).toLocaleString('en-US')}</span>
                                </div>
                              </div>
                            )}

                            <div className="flex justify-between items-center pt-2">
                              <div>
                                <h4 className="font-bold text-2xl text-[#23211F]">Total</h4>
                                <p className="text-xs text-gray-400 uppercase tracking-widest">{(dict as any).modal?.taxesIncluded}</p>
                              </div>
                              <div className="font-serif text-3xl text-[#23211F]">${grandTotal.toLocaleString('en-US')} {currency}</div>
                            </div>
                          </div>

                          {error && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium mb-6 text-center">
                              {error}
                            </motion.div>
                          )}

                          <PremiumButton onClick={handleCheckout} disabled={!isFormValid || isLoading || grandTotal === 0}>
                            <CreditCard size={18} />
                            {(dict as any).modal?.proceedPayment}
                          </PremiumButton>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Mobile Fixed Bottom Summary (Only shows on step 1 to 4) */}
            {isMobile && step < 5 && (
              <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-6 flex justify-between items-center shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-20"
              >
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1">Total Parcial</p>
                  <div className="font-serif text-xl text-[#23211F] leading-none">${grandTotal.toLocaleString('en-US')}</div>
                </div>
                {step === 1 && (
                  <button onClick={nextStep} disabled={!range?.from || !range?.to || nights < 2} className="bg-[#23211F] text-white px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest disabled:opacity-50">
                    Siguiente
                  </button>
                )}
                {step === 2 && (
                  <button onClick={nextStep} disabled={wantsChef === null || (wantsChef && chefBreakfasts === 0 && chefLunches === 0 && chefDinners === 0)} className="bg-[#23211F] text-white px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest disabled:opacity-50">
                    Siguiente
                  </button>
                )}
                {step === 3 && (
                  <button onClick={nextStep} disabled={wantsATV === null || (wantsATV && (!atvDestination || atvPeople < 1))} className="bg-[#23211F] text-white px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest disabled:opacity-50">
                    Siguiente
                  </button>
                )}
                {step === 4 && (
                  <button onClick={nextStep} disabled={!isFormValid} className="bg-[#23211F] text-white px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest disabled:opacity-50">
                    Resumen
                  </button>
                )}
              </motion.div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
