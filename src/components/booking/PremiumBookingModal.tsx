'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useDragControls } from 'framer-motion';
import { X, CalendarDays, ArrowRight, Check, Shield, CreditCard, Calendar, User } from 'lucide-react';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import FluidHorseAnimation from '../FluidHorseAnimation';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useDictionary } from '@/i18n/DictionaryContext';

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
  const rounded = useTransform(motionValue, (v) => `${prefix}${Math.round(v).toLocaleString('en-US')}`);
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
  <div className="flex items-center gap-3 mb-8">
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
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold relative overflow-hidden"
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
        className="text-xs font-bold text-gray-400 hover:text-[#23211F] uppercase tracking-widest mb-8 text-left transition-colors flex items-center gap-2"
      >
        <motion.span
          animate={{ x: [0, -3, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          ←
        </motion.span>
        Volver a Calendario
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
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+52');
  const [guestPhone, setGuestPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [basePrice, setBasePrice] = useState(15000);
  const [showConfetti, setShowConfetti] = useState(false);

  const nights = (range?.from && range?.to) ? differenceInDays(range.to, range.from) : 0;
  const total = nights > 0 ? nights * basePrice : 0;

  const isNameValid = guestName.trim().length >= 2;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail);
  const isPhoneValid = guestPhone.trim().length >= 7;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
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
      document.body.style.overflow = 'unset';
      setTimeout(() => {
        setStep(1);
        setRange(undefined);
        setGuestName('');
        setGuestEmail('');
        setGuestPhone('');
        setCountryCode('+52');
        setIsLoading(false);
        setError(null);
        setIsSuccess(false);
        setShowConfetti(false);
      }, 400);
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const handleNext = useCallback(() => {
    if (step === 1 && range?.from && range?.to && nights >= 2) {
      setStep(2);
    }
  }, [step, range, nights]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/checkout_sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkIn: range?.from,
          checkOut: range?.to,
          guestName,
          guestEmail,
          guestPhone: `${countryCode} ${guestPhone}`,
          totalPrice: total
        }),
      });
      const data = await res.json();
      
      if (res.ok && data.url) {
        setIsSuccess(true);
        setShowConfetti(true);
        setTimeout(() => {
          window.location.href = data.url;
        }, 2500);
      } else {
        setError(data.error || 'Ocurrió un error al procesar tu reserva.');
        setIsLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión. Inténtalo de nuevo.');
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-0 md:p-12 overflow-hidden touch-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-lg cursor-pointer"
          />

          <motion.div
            initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.92, y: 30 }}
            animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.92, y: 30 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag={isMobile ? "y" : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(e, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) onClose();
            }}
            className="relative w-full max-w-4xl bg-[#F9F7F4] rounded-t-[2rem] md:rounded-[3rem] shadow-[0_-20px_40px_rgba(0,0,0,0.2)] md:shadow-2xl overflow-y-auto md:overflow-hidden flex flex-col md:flex-row max-h-[92dvh] md:h-[600px] mt-auto md:mt-0"
          >
            {isMobile && (
              <div 
                className="w-full h-8 sticky top-0 left-0 z-50 flex justify-center items-center touch-none"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="w-12 h-1.5 bg-white/30 rounded-full mt-2" />
              </div>
            )}

            {!isMobile && (
              <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                className="absolute top-6 right-6 z-50 p-3 bg-black/5 hover:bg-black/10 backdrop-blur-md rounded-full text-[#23211F] transition-colors"
              >
                <X size={20} />
              </motion.button>
            )}

            <div className="w-full md:w-1/3 bg-[#23211F] text-[#F9F7F4] p-6 md:p-12 flex flex-col relative overflow-hidden pt-10 md:pt-12 shrink-0">
              <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-[#9B7E67]/10 blur-3xl" />
              <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-[#9B7E67]/5 blur-2xl" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#9B7E67]/30 to-transparent" />
              
              <div className="relative z-10 flex-1">
                <h2 className="font-serif text-3xl md:text-5xl font-medium tracking-tight leading-[1.1] max-w-[80%]">
                  {dict.modal.yourReservation}
                </h2>
              </div>

              <div className="hidden md:flex flex-col gap-6 w-full flex-grow pt-4">
                  <div className="bg-white/5 p-4 rounded-xl backdrop-blur-sm">
                    <p className="text-xs uppercase tracking-[0.2em] opacity-60 mb-1">{dict.modal.hotelName}</p>
                    <p className="font-serif text-xl">Suite Exclusiva</p>
                  </div>
                  
                  <div className="bg-white/5 p-4 rounded-xl backdrop-blur-sm">
                    <p className="text-xs uppercase tracking-[0.2em] opacity-60 mb-1">{dict.modal.dates}</p>
                    <p className="font-light text-sm flex items-center gap-2">
                      <Calendar size={14} className="text-[#9B7E67]"/>
                      {range?.from ? format(range.from, 'dd MMM yyyy') : 'Check-in'} — {range?.to ? format(range.to, 'dd MMM yyyy') : 'Check-out'}
                    </p>
                  </div>

                  <div className="bg-white/5 p-4 rounded-xl backdrop-blur-sm">
                    <p className="text-xs uppercase tracking-[0.2em] opacity-60 mb-1">{dict.modal.guests}</p>
                    <p className="font-light text-sm flex items-center gap-2">
                      <User size={14} className="text-[#9B7E67]"/>
                      {dict.modal.guestsCount}
                    </p>
                  </div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="relative z-10 border-t border-white/10 pt-4 md:pt-6 mt-4 md:mt-auto"
                >
                <div className="flex justify-between items-end mb-2">
                  <span className="font-light text-sm opacity-80">{dict.modal.total} ({nights} {dict.modal.nights})</span>
                  <span className="font-serif text-3xl text-[#9B7E67]">
                    <AnimatedCounter value={total} />
                  </span>
                </div>
                <span className="text-[10px] text-gray-500 uppercase tracking-widest">{dict.modal.taxesIncluded}</span>
              </motion.div>
            </div>

            <div className="w-full md:w-2/3 p-8 md:p-12 overflow-y-auto relative">
              {/* Step Progress Indicator */}
              <StepIndicator currentStep={step} totalSteps={2} />

              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="h-full flex flex-col"
                  >
                    <motion.h3
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="text-2xl font-serif text-[#23211F] mb-6"
                    >
                      {dict.modal.selectDates}
                    </motion.h3>

                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2, duration: 0.5 }}
                      className="flex-1 flex justify-center items-center"
                    >
                      <DayPicker
                        mode="range"
                        selected={range}
                        onSelect={setRange}
                        disabled={[{ before: new Date() }, ...disabledRanges]}
                        className="font-sans"
                        modifiersClassNames={{
                          selected: 'bg-[#9B7E67] text-white',
                          today: 'font-bold text-[#9B7E67]'
                        }}
                      />
                    </motion.div>

                    {/* Minimum nights notice */}
                    <AnimatePresence>
                      {range?.from && range?.to && nights < 2 && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-center text-sm text-amber-600 font-medium mb-4"
                        >
                          {dict.modal.minStay}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    <PremiumButton
                      onClick={handleNext}
                      disabled={!range?.from || !range?.to || nights < 2}
                    >
                      {dict.modal.continue} <ArrowRight size={16} />
                    </PremiumButton>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step-2"
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="h-full flex flex-col"
                  >
                    <PremiumButton variant="back" onClick={() => setStep(1)} />

                    <motion.h3
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="text-2xl font-serif text-[#23211F] mb-8"
                    >
                      {dict.modal.yourData}
                    </motion.h3>
                    
                    <form onSubmit={handleCheckout} className="space-y-8 flex-1 flex flex-col">
                      <PremiumInput
                        id="guestName"
                        type="text"
                        label={dict.modal.fullName}
                        placeholder={dict.modal.fullName}
                        value={guestName}
                        onChange={setGuestName}
                        isValid={isNameValid}
                        delay={0.15}
                      />
                      <PremiumInput
                        id="guestEmail"
                        type="email"
                        label={dict.modal.email}
                        placeholder={dict.modal.email}
                        value={guestEmail}
                        onChange={setGuestEmail}
                        isValid={isEmailValid}
                        delay={0.25}
                      />

                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="relative group flex gap-2"
                      >
                        <select
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          className="bg-transparent border-b-2 border-gray-200 py-4 text-[#23211F] text-lg focus:outline-none transition-colors w-24 font-light cursor-pointer appearance-none text-center"
                        >
                          <option value="+52">🇲🇽 +52</option>
                          <option value="+1">🇺🇸 +1</option>
                          <option value="+34">🇪🇸 +34</option>
                          <option value="+44">🇬🇧 +44</option>
                          <option value="+54">🇦🇷 +54</option>
                          <option value="+57">🇨🇴 +57</option>
                          <option value="+56">🇨🇱 +56</option>
                        </select>
                        <div className="flex-1">
                          <PremiumInput
                            id="guestPhone"
                            type="tel"
                            label={dict.modal.phone}
                            placeholder={dict.modal.phone}
                            value={guestPhone}
                            onChange={setGuestPhone}
                            isValid={isPhoneValid}
                            delay={0}
                          />
                        </div>
                      </motion.div>
                      
                      <div className="mt-auto pt-4">
                        <PremiumButton
                          type="submit"
                          disabled={isLoading || !isNameValid || !isEmailValid || !isPhoneValid}
                        >
                          <CreditCard size={16} />
                          {dict.modal.proceedPayment}
                        </PremiumButton>
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.4 }}
                          className="flex items-center justify-center gap-2 mt-4"
                        >
                          <Shield size={12} className="text-[#9B7E67]/50" />
                          <span className="text-[9px] font-bold uppercase tracking-widest text-[#23211F]/40">Pagos seguros mediante Stripe</span>
                        </motion.div>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ─── Overlay States ─── */}
              <AnimatePresence>
                {(isLoading || isSuccess || error) && (
                  <motion.div
                    key="state-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 bg-[#F9F7F4]/95 backdrop-blur-sm flex flex-col items-center justify-center p-8"
                  >
                    {/* Loading */}
                    {isLoading && !isSuccess && !error && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center text-center"
                      >
                        <div className="w-20 md:w-28 mb-8 text-[#9B7E67]">
                          <FluidHorseAnimation />
                        </div>
                        <motion.h3 
                          className="text-xl font-serif text-[#23211F] mb-4"
                        >
                          Preparando tu reserva
                        </motion.h3>
                        {/* Animated dots */}
                        <div className="flex gap-1.5 mb-6">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              className="w-2 h-2 rounded-full bg-[#9B7E67]"
                              animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
                            />
                          ))}
                        </div>
                        {/* Indeterminate progress bar */}
                        <div className="w-48 h-1 bg-gray-200 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-[#9B7E67] rounded-full"
                            animate={{ x: ['-100%', '200%'] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                            style={{ width: '40%' }}
                          />
                        </div>
                      </motion.div>
                    )}

                    {/* Success */}
                    {isSuccess && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center text-center relative"
                      >
                        {/* Confetti */}
                        {showConfetti && Array.from({ length: 50 }).map((_, i) => ({ id: i, delay: Math.random() * 0.5 })).map(({ id, delay }) => (
                          <ConfettiParticle key={id} index={id} delay={delay} />
                        ))}

                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                          className="w-24 h-24 bg-[#9B7E67]/10 text-[#9B7E67] rounded-full flex items-center justify-center mb-6"
                        >
                          <Check size={48} />
                        </motion.div>

                        {/* Staggered text reveal */}
                        <motion.h3
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.6, duration: 0.5 }}
                          className="text-2xl font-serif text-[#23211F] mb-2"
                        >
                          ¡Todo listo!
                        </motion.h3>
                        <motion.p
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.8, duration: 0.5 }}
                          className="text-gray-500 text-sm font-light mb-6"
                        >
                          Redirigiendo a pago seguro...
                        </motion.p>

                        {/* Redirect progress bar */}
                        <div className="w-48 h-1 bg-gray-200 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-[#9B7E67] rounded-full"
                            initial={{ width: '0%' }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 2.5, ease: 'linear' }}
                          />
                        </div>
                      </motion.div>
                    )}

                    {/* Error */}
                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1, x: [0, -8, 8, -6, 6, -3, 3, 0] }}
                        transition={{ 
                          default: { duration: 0.3 },
                          x: { duration: 0.5, ease: 'easeOut' }
                        }}
                        className="flex flex-col items-center text-center max-w-sm"
                      >
                        <motion.div 
                          initial={{ scale: 0, rotate: -90 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                          className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6 border-2 border-red-100"
                        >
                          <X size={32} />
                        </motion.div>
                        <motion.h3
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                          className="text-2xl font-serif text-[#23211F] mb-4"
                        >
                          Uy, algo salió mal
                        </motion.h3>
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.3 }}
                          className="text-gray-500 text-sm font-light mb-8"
                        >
                          {error}
                        </motion.p>
                        <motion.button
                          onClick={() => setError(null)}
                          whileHover={{ scale: 1.03, y: -2 }}
                          whileTap={{ scale: 0.97 }}
                          className="w-full py-4 rounded-full bg-[#23211F] text-[#F9F7F4] hover:bg-[#9B7E67] font-bold text-xs uppercase tracking-widest transition-colors relative overflow-hidden"
                        >
                          {/* Pulse glow */}
                          <motion.div
                            className="absolute inset-0 rounded-full"
                            animate={{
                              boxShadow: [
                                '0 0 0 0px rgba(155,126,103,0.3)',
                                '0 0 0 8px rgba(155,126,103,0)',
                              ],
                            }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          />
                          <span className="relative z-10">Intentar de nuevo</span>
                        </motion.button>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
