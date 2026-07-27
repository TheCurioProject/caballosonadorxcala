'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CalendarDays, ArrowRight, User, Map, Check, CreditCard, ChevronLeft, ChevronRight } from 'lucide-react';
import { ActionLoadingScreen } from '../ui/ActionLoadingScreen';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

export const TourBookingModal = ({ 
  isOpen, 
  onClose, 
  initialTour = null,
  lang = 'es' 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  initialTour?: any;
  lang?: string;
}) => {
  const isEn = lang === 'en';
  const formatPrice = (amountInMxn: number) => `$${Math.round(amountInMxn).toLocaleString()} MXN`;
  
  const translateDB = (text: string | undefined | null, isEn: boolean): string => {
    if (!text) return text || '';
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.en !== undefined && parsed.es !== undefined) {
          return isEn ? parsed.en : parsed.es;
        }
      } catch (e) {}
    }
    return text;
  };

  const [step, setStep] = useState(1);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<any | null>(initialTour);
  const [minTourPax, setMinTourPax] = useState(3);
  const [maxTourPax, setMaxTourPax] = useState(10);
  const [pax, setPax] = useState(3);
  const [date, setDate] = useState<Date | undefined>(undefined);
  
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Fetch active destinations
    fetch('/api/services/tours')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setDestinations(data);
      })
      .catch(console.error);

    // Fetch tour settings
    fetch('/api/settings/tours')
      .then(res => res.json())
      .then(data => {
        const min = data.minTourPax || 3;
        setMinTourPax(min);
        setMaxTourPax(data.maxTourPax || 10);
        setPax(min);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (initialTour) {
      setSelectedDestination(initialTour);
    }
  }, [initialTour]);

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDestination || !date) return;
    setIsSubmitting(true);

    const convertedPricePerPax = selectedDestination.pricePerPax;
    const convertedTotalPrice = convertedPricePerPax * pax;

    try {
      const res = await fetch('/api/checkout_services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType: 'TOUR',
          serviceDetails: { destination: translateDB(selectedDestination.name, isEn), pax },
          startDate: date,
          endDate: date, // Single day for now, can be updated later if multi-day is needed
          pax,
          guestName,
          guestEmail,
          guestPhone,
          totalPrice: convertedTotalPrice,
          items: [{
            name: `Tour: ${translateDB(selectedDestination.name, isEn)}`,
            description: `Para ${pax} personas el ${format(date, 'PPP', { locale: isEn ? enUS : es })}`,
            unitPrice: convertedPricePerPax,
            quantity: pax
          }],
          currency: 'mxn'
        })
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Error procesando reserva');
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión');
      setIsSubmitting(false);
    }
  };

  const isStep1Valid = selectedDestination !== null;
  const isStep2Valid = date !== undefined && pax >= minTourPax && pax <= maxTourPax;
  const isStep3Valid = guestName.length > 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail);

  return (
    <>
      <ActionLoadingScreen isOpen={isSubmitting} theme="dark" subMessage={isEn ? "PREPARING SECURE PAYMENT..." : "PREPARANDO PAGO SEGURO..."} />
      <AnimatePresence>
        {isOpen && (
          <div key="modal-overlay" className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              key="backdrop"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-[#0A0908]/80 backdrop-blur-md"
              onClick={onClose}
            />

            <motion.div 
              key="modal-content"
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col md:flex-row h-[85vh] md:h-[650px]"
            >
          {/* Sidebar */}
          <div className="hidden md:flex w-1/3 bg-[#23211F] text-[#F9F7F4] p-10 flex-col justify-between relative overflow-hidden">
            <div className="relative z-10">
              <span className="text-[#9B7E67] uppercase tracking-[0.3em] text-[10px] font-bold mb-4 block">
                {isEn ? "Book Adventure" : "Reservar Aventura"}
              </span>
              <h2 className="font-serif text-4xl mb-8 leading-tight">
                {isEn ? "Your Tour" : "Tu Recorrido"}
              </h2>
              
              {selectedDestination && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl">
                    <Map className="text-[#9B7E67]" size={20} />
                    <div>
                      <span className="block text-[10px] uppercase text-white/50">{isEn ? "Destination" : "Destino"}</span>
                      <span className="font-bold">{translateDB(selectedDestination.name, isEn)}</span>
                    </div>
                  </div>
                </div>
              )}
              {date && (
                <div className="space-y-4 mt-4">
                  <div className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl">
                    <CalendarDays className="text-[#9B7E67]" size={20} />
                    <div>
                      <span className="block text-[10px] uppercase text-white/50">{isEn ? "Date" : "Fecha"}</span>
                      <span className="font-bold">{format(date, 'PPP', { locale: isEn ? enUS : es })}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {selectedDestination && pax > 0 && (
              <div className="relative z-10 mt-auto pt-8 border-t border-white/10">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="block text-[10px] uppercase text-white/50 mb-1">Total ({pax} pax)</span>
                    <span className="font-serif text-3xl">{formatPrice(selectedDestination.pricePerPax * pax)}</span>
                    <span className="block text-[8px] uppercase text-[#9B7E67] mt-2 font-bold tracking-widest max-w-[200px]">
                      {isEn ? '* Stripe will handle the currency conversion at checkout' : '* Stripe aplicará el tipo de cambio correspondiente al momento del pago'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="w-full md:w-2/3 p-6 md:p-12 flex flex-col h-full overflow-y-auto text-[#23211F]">
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 transition-colors z-10"
            >
              <X className="text-gray-500" />
            </button>

            {/* Steps Indicator */}
            <div className="flex items-center gap-3 mb-8">
              {[1, 2, 3].map(i => (
                <div key={i} className={`h-1.5 flex-1 rounded-full ${step >= i ? 'bg-[#9B7E67]' : 'bg-gray-200'}`} />
              ))}
            </div>

            <div className="flex-1 relative">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full">
                    <h3 className="font-serif text-3xl text-[#23211F] mb-4">{isEn ? "Select Destination" : "Selecciona un destino"}</h3>
                    <div className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-in-out ${selectedDestination ? 'grid-rows-[1fr] opacity-100 mb-4' : 'grid-rows-[0fr] opacity-0 mb-0'}`}>
                      <div className="overflow-hidden">
                        <p className="text-xs text-[#9B7E67] font-bold uppercase tracking-widest">
                          {isEn ? 'Click again to unselect' : 'Haz clic de nuevo para deseleccionar'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {destinations.map(dest => (
                        <button
                          key={dest.id}
                          onClick={() => {
                            if (selectedDestination?.id === dest.id) {
                              setSelectedDestination(null);
                            } else {
                              setSelectedDestination(dest);
                            }
                          }}
                          className={`p-4 rounded-2xl border-2 text-left transition-all ${selectedDestination?.id === dest.id ? 'border-[#9B7E67] bg-[#9B7E67]/5' : 'border-gray-100 hover:border-gray-200'}`}
                        >
                            <h4 className="font-bold text-[#23211F] mb-1">{translateDB(dest.name, isEn)}</h4>
                          <span className="text-sm text-gray-500">{formatPrice(dest.pricePerPax)} {isEn ? "per person" : "por persona"}</span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-8 flex flex-col items-end gap-2">
                      {!isStep1Valid && (
                        <p className="text-amber-600 text-[10px] font-bold tracking-widest uppercase">
                          {isEn ? 'Please select a tour' : 'Por favor selecciona un tour'}
                        </p>
                      )}
                      <button 
                        onClick={handleNext} 
                        disabled={!isStep1Valid}
                        className="bg-[#23211F] text-white px-8 py-4 rounded-full text-xs font-bold uppercase tracking-widest disabled:opacity-50 flex items-center gap-2"
                      >
                        {isEn ? "Next" : "Siguiente"} <ArrowRight size={16} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full">
                    <h3 className="font-serif text-3xl text-[#23211F] mb-6">{isEn ? "Date & Guests" : "Fecha y Personas"}</h3>
                    
                    <div className="mb-6 p-3 bg-[#9B7E67]/10 border border-[#9B7E67]/20 rounded-xl">
                      <p className="text-[10px] text-[#9B7E67] font-bold uppercase tracking-widest text-center leading-relaxed">
                        {isEn ? "Only 1 tour can be booked per day. For multiple destinations, book them separately." : "Solo se puede reservar 1 tour por día. Para visitar diferentes destinos, resérvelos por separado."}
                      </p>
                    </div>

                    <div className="mb-8">
                      <label className="block text-xs uppercase tracking-widest font-bold text-gray-500 mb-3">{isEn ? `Number of people (Min ${minTourPax}, Max ${maxTourPax})` : `Número de personas (Min ${minTourPax}, Max ${maxTourPax})`}</label>
                      <div className="flex items-center gap-4">
                        <button onClick={() => setPax(p => Math.max(minTourPax, p - 1))} className={`w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-[#23211F] hover:border-[#9B7E67] transition-colors ${pax <= minTourPax ? 'invisible' : ''}`}><ChevronLeft size={20}/></button>
                        <span className="font-serif text-2xl w-8 text-center text-[#23211F]">{pax}</span>
                        <button onClick={() => setPax(p => Math.min(maxTourPax, p + 1))} className={`w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-[#23211F] hover:border-[#9B7E67] transition-colors ${pax >= maxTourPax ? 'invisible' : ''}`}><ChevronRight size={20}/></button>
                      </div>
                    </div>

                    <div className="mb-8">
                      <label className="block text-xs uppercase tracking-widest font-bold text-gray-500 mb-3">{isEn ? "Select Date" : "Selecciona la fecha"}</label>
                      <DayPicker
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        locale={isEn ? enUS : es}
                        disabled={[{ before: new Date() }]}
                        className="border border-gray-200 rounded-2xl p-4 inline-block bg-white shadow-sm"
                        modifiersClassNames={{
                          selected: '!bg-[#9B7E67] !text-[#F9F7F4] !rounded-none ![clip-path:polygon(15%_0%,100%_0%,85%_100%,0%_100%)] !z-20 !font-bold !w-full !max-w-full !m-0',
                        }}
                      />
                    </div>

                    <div className="flex justify-between items-end">
                      <button onClick={handleBack} className="text-gray-500 font-bold uppercase text-xs tracking-widest mb-4">{isEn ? "Back" : "Volver"}</button>
                      <div className="flex flex-col items-end gap-2">
                        {!isStep2Valid && (
                          <p className="text-amber-600 text-[10px] font-bold tracking-widest uppercase">
                            {isEn ? 'Please select a date' : 'Por favor selecciona una fecha'}
                          </p>
                        )}
                        <button 
                          onClick={handleNext} 
                          disabled={!isStep2Valid}
                          className="bg-[#23211F] text-white px-8 py-4 rounded-full text-xs font-bold uppercase tracking-widest disabled:opacity-50 flex items-center gap-2"
                        >
                          {isEn ? "Next" : "Siguiente"} <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full">
                    <h3 className="font-serif text-3xl text-[#23211F] mb-6">{isEn ? "Your Details" : "Tus Datos"}</h3>
                    
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div>
                        <input
                          type="text"
                          required
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          placeholder={isEn ? "Full Name" : "Nombre Completo"}
                          className="w-full bg-transparent border-b-2 border-gray-200 py-4 text-[#23211F] text-lg focus:outline-none focus:border-[#9B7E67] transition-colors"
                        />
                      </div>
                      <div>
                        <input
                          type="email"
                          required
                          value={guestEmail}
                          onChange={(e) => setGuestEmail(e.target.value)}
                          placeholder={isEn ? "Email (e.g. name@domain.com)" : "Correo (ej. nombre@dominio.com)"}
                          className="w-full bg-transparent border-b-2 border-gray-200 py-4 text-[#23211F] text-lg focus:outline-none focus:border-[#9B7E67] transition-colors"
                        />
                        <div className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-in-out ${guestEmail.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail) ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
                          <div className="overflow-hidden">
                            <p className="text-red-500 text-[10px] font-bold tracking-widest uppercase">
                              {isEn ? "Invalid email format" : "Formato de correo inválido"}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div>
                        <input
                          type="tel"
                          required
                          value={guestPhone}
                          onChange={(e) => setGuestPhone(e.target.value)}
                          placeholder={isEn ? "Phone" : "Teléfono"}
                          className="w-full bg-transparent border-b-2 border-gray-200 py-4 text-[#23211F] text-lg focus:outline-none focus:border-[#9B7E67] transition-colors"
                        />
                      </div>

                      <div className="mt-12 flex justify-between items-end pt-8 border-t border-gray-100">
                        <button type="button" onClick={handleBack} className="text-gray-500 font-bold uppercase text-xs tracking-widest mb-4">{isEn ? "Back" : "Volver"}</button>
                        <div className="flex flex-col items-end gap-2">
                          {!isStep3Valid && !isSubmitting && (
                            <p className="text-amber-600 text-[10px] font-bold tracking-widest uppercase">
                              {isEn ? 'Fill required fields' : 'Llena los campos requeridos'}
                            </p>
                          )}
                          <button 
                            type="submit" 
                            disabled={!isStep3Valid || isSubmitting}
                            className="bg-[#23211F] text-white px-8 py-4 rounded-full text-xs font-bold uppercase tracking-widest disabled:opacity-50 flex items-center gap-2"
                          >
                            <CreditCard size={16} /> {isEn ? "Proceed to Payment" : "Proceder al Pago"}
                          </button>
                        </div>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
    </>
  );
};
