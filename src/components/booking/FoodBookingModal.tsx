'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CalendarDays, ArrowRight, Check, CreditCard, ChevronLeft, ChevronRight, Utensils } from 'lucide-react';
import { ActionLoadingScreen } from '../ui/ActionLoadingScreen';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

export const FoodBookingModal = ({ 
  isOpen, 
  onClose, 
  initialService = null,
  lang = 'es' 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  initialService?: string | null;
  lang?: string;
}) => {
  const isEn = lang === 'en';
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [pax, setPax] = useState(2);
  const [date, setDate] = useState<Date | undefined>(undefined);
  
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Fetch active food services
    fetch('/api/services/food')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setServices(data);
          if (initialService) {
            const match = data.find(s => s.name.toLowerCase().includes(initialService.toLowerCase()));
            if (match) setSelectedService(match);
          }
        }
      })
      .catch(console.error);
  }, [initialService]);

  if (!isOpen) return null;

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !date) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/checkout_services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType: 'FOOD',
          serviceDetails: { serviceName: selectedService.name, pax },
          startDate: date,
          endDate: date,
          pax,
          guestName,
          guestEmail,
          guestPhone,
          totalPrice: selectedService.price * pax,
          items: [{
            name: `Servicio de Comida: ${selectedService.name}`,
            description: `Para ${pax} personas el ${format(date, 'PPP', { locale: isEn ? enUS : es })}`,
            unitPrice: selectedService.price,
            quantity: pax
          }],
          currency: 'usd'
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

  const isStep1Valid = selectedService !== null;
  const isStep2Valid = date !== undefined && pax > 0;
  const isStep3Valid = guestName.length > 2 && guestEmail.includes('@');

  return (
    <AnimatePresence>
      <ActionLoadingScreen isOpen={isSubmitting} theme="dark" subMessage={isEn ? "PREPARING SECURE PAYMENT..." : "PREPARANDO PAGO SEGURO..."} />
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          className="absolute inset-0 bg-[#0A0908]/80 backdrop-blur-md"
          onClick={onClose}
        />

        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative w-full max-w-4xl bg-white rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col md:flex-row h-[85vh] md:h-[650px]"
        >
          {/* Sidebar */}
          <div className="hidden md:flex w-1/3 bg-[#9B7E67] text-[#F9F7F4] p-10 flex-col justify-between relative overflow-hidden">
            <div className="absolute inset-0 bg-black/10 mix-blend-overlay pointer-events-none"></div>
            <div className="relative z-10">
              <span className="text-white/80 uppercase tracking-[0.3em] text-[10px] font-bold mb-4 block">
                {isEn ? "Culinary Service" : "Servicio Culinario"}
              </span>
              <h2 className="font-serif text-4xl mb-8 leading-tight">
                {isEn ? "Your Reservation" : "Tu Reserva"}
              </h2>
              
              {selectedService && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 bg-white/10 p-4 rounded-2xl">
                    <Utensils className="text-white" size={20} />
                    <div>
                      <span className="block text-[10px] uppercase text-white/70">{isEn ? "Service" : "Servicio"}</span>
                      <span className="font-bold">{selectedService.name}</span>
                    </div>
                  </div>
                </div>
              )}
              {date && (
                <div className="space-y-4 mt-4">
                  <div className="flex items-center gap-3 bg-white/10 p-4 rounded-2xl">
                    <CalendarDays className="text-white" size={20} />
                    <div>
                      <span className="block text-[10px] uppercase text-white/70">{isEn ? "Date" : "Fecha"}</span>
                      <span className="font-bold">{format(date, 'PPP', { locale: isEn ? enUS : es })}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {selectedService && pax > 0 && (
              <div className="relative z-10 mt-auto pt-8 border-t border-white/20">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="block text-[10px] uppercase text-white/80 mb-1">Total ({pax} pax)</span>
                    <span className="font-serif text-3xl">${selectedService.price * pax}</span>
                  </div>
                  <span className="text-white/80 text-xs font-bold tracking-widest">USD</span>
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="w-full md:w-2/3 p-6 md:p-12 flex flex-col h-full overflow-y-auto">
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
                    <h3 className="font-serif text-3xl text-[#23211F] mb-6">{isEn ? "Select Service" : "Selecciona un servicio"}</h3>
                    <div className="flex flex-col gap-4">
                      {services.map(service => (
                        <button
                          key={service.id}
                          onClick={() => setSelectedService(service)}
                          className={`p-6 rounded-2xl border-2 text-left transition-all flex justify-between items-center ${selectedService?.id === service.id ? 'border-[#9B7E67] bg-[#9B7E67]/5' : 'border-gray-100 hover:border-gray-200'}`}
                        >
                          <div>
                            <h4 className="font-bold text-[#23211F] mb-1">{service.name}</h4>
                            <span className="text-sm text-gray-500">${service.price} USD {isEn ? "per person" : "por persona"}</span>
                          </div>
                          {selectedService?.id === service.id && (
                            <div className="w-6 h-6 rounded-full bg-[#9B7E67] flex items-center justify-center text-white">
                              <Check size={14} strokeWidth={3} />
                            </div>
                          )}
                        </button>
                      ))}
                      {services.length === 0 && (
                        <p className="text-gray-500 italic">Cargando servicios...</p>
                      )}
                    </div>
                    <div className="mt-8 flex justify-end">
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
                    
                    <div className="mb-8">
                      <label className="block text-xs uppercase tracking-widest font-bold text-gray-500 mb-3">{isEn ? "Number of people" : "Número de personas"}</label>
                      <div className="flex items-center gap-4">
                        <button onClick={() => setPax(p => Math.max(1, p - 1))} className="w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center hover:border-[#9B7E67]"><ChevronLeft size={20}/></button>
                        <span className="font-serif text-2xl w-8 text-center">{pax}</span>
                        <button onClick={() => setPax(p => p + 1)} className="w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center hover:border-[#9B7E67]"><ChevronRight size={20}/></button>
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
                        modifiersStyles={{ selected: { backgroundColor: '#9B7E67' } }}
                      />
                    </div>

                    <div className="flex justify-between">
                      <button onClick={handleBack} className="text-gray-500 font-bold uppercase text-xs tracking-widest">{isEn ? "Back" : "Volver"}</button>
                      <button 
                        onClick={handleNext} 
                        disabled={!isStep2Valid}
                        className="bg-[#23211F] text-white px-8 py-4 rounded-full text-xs font-bold uppercase tracking-widest disabled:opacity-50 flex items-center gap-2"
                      >
                        {isEn ? "Next" : "Siguiente"} <ArrowRight size={16} />
                      </button>
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
                          placeholder={isEn ? "Email" : "Correo Electrónico"}
                          className="w-full bg-transparent border-b-2 border-gray-200 py-4 text-[#23211F] text-lg focus:outline-none focus:border-[#9B7E67] transition-colors"
                        />
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

                      <div className="mt-12 flex justify-between items-center pt-8 border-t border-gray-100">
                        <button type="button" onClick={handleBack} className="text-gray-500 font-bold uppercase text-xs tracking-widest">{isEn ? "Back" : "Volver"}</button>
                        <button 
                          type="submit" 
                          disabled={!isStep3Valid || isSubmitting}
                          className="bg-[#23211F] text-white px-8 py-4 rounded-full text-xs font-bold uppercase tracking-widest disabled:opacity-50 flex items-center gap-2"
                        >
                          <CreditCard size={16} /> {isEn ? "Proceed to Payment" : "Proceder al Pago"}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
