'use client';

import React, { useState, useEffect } from 'react';
import { DayPicker, DateRange } from 'react-day-picker';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-day-picker/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';

interface BookingWidgetProps {
  roomId: number;
  price: number;
  roomName: string;
}

export const BookingWidget = ({ roomId, price, roomName }: BookingWidgetProps) => {
  const [range, setRange] = useState<DateRange | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [disabledDays, setDisabledDays] = useState<Date[]>([]);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Fetch disabled days from the server
    const fetchBookings = async () => {
      try {
        const res = await fetch(`/api/bookings?roomId=${roomId}`);
        const data = await res.json();
        if (data.success) {
          const disabled: Date[] = [];
          data.bookings.forEach((b: any) => {
            const start = new Date(b.checkIn);
            const end = new Date(b.checkOut);
            let current = start;
            while (current < end) {
              disabled.push(new Date(current));
              current.setDate(current.getDate() + 1);
            }
            // Add end date too
            disabled.push(new Date(end));
          });
          setDisabledDays(disabled);
        }
      } catch (e) {
        console.error("Failed to fetch bookings", e);
      }
    };
    fetchBookings();
  }, [roomId]);

  const days = range?.from && range?.to ? differenceInDays(range.to, range.from) : 0;
  const totalPrice = days * price;

  const handleReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!range?.from || !range?.to || !guestName || !guestEmail || !guestPhone) return;
    
    setIsLoading(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          checkIn: range.from,
          checkOut: range.to,
          guestName,
          guestEmail,
          guestPhone,
          totalPrice
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
      } else {
        alert("Error: " + data.error);
      }
    } catch (e) {
      alert("Error al procesar la reserva.");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
        className="text-center py-16 px-8 h-full flex flex-col justify-center items-center"
      >
        <motion.div 
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 100, delay: 0.2 }}
          className="w-24 h-24 bg-[#9B7E67]/10 text-[#9B7E67] rounded-full flex items-center justify-center mb-8"
        >
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 13l4 4L19 7"></path></svg>
        </motion.div>
        <motion.h3 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="font-serif text-3xl md:text-4xl mb-4 text-[#23211F]"
        >
          Solicitud Enviada
        </motion.h3>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-[#524D48] font-light text-lg leading-relaxed"
        >
          Nos comunicaremos con usted a la brevedad para confirmar los detalles de su estadía exclusiva en {roomName}.
        </motion.p>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      <style>{`
        .rdp { 
          --rdp-cell-size: 44px; 
          --rdp-accent-color: #9B7E67; 
          --rdp-background-color: rgba(155, 126, 103, 0.1); 
          margin: 0 auto;
          font-family: inherit;
        }
        .rdp-day { font-weight: 300; font-size: 0.9rem; color: #524D48; transition: all 0.2s ease; border-radius: 50%; }
        .rdp-day:hover:not(.rdp-day_disabled) { background-color: rgba(155, 126, 103, 0.1); transform: scale(1.1); }
        .rdp-day_selected, .rdp-day_selected:focus-visible { 
          background-color: #9B7E67 !important; 
          color: white !important; 
          font-weight: 500;
          transform: scale(1.05);
          box-shadow: 0 4px 14px rgba(155, 126, 103, 0.4);
        }
        .rdp-day_range_middle {
          background-color: rgba(155, 126, 103, 0.1) !important;
          color: #9B7E67 !important;
          border-radius: 0;
          transform: scale(1);
          box-shadow: none;
        }
        .rdp-day_range_start {
          border-top-right-radius: 0;
          border-bottom-right-radius: 0;
        }
        .rdp-day_range_end {
          border-top-left-radius: 0;
          border-bottom-left-radius: 0;
        }
        .rdp-head_cell { text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.1em; color: #9B7E67; font-weight: 600; padding-bottom: 10px; }
        .rdp-nav_button { color: #9B7E67; transition: all 0.3s ease; }
        .rdp-nav_button:hover { background-color: rgba(155, 126, 103, 0.1); transform: scale(1.1); }
        .rdp-button:focus-visible:not([disabled]), .rdp-button:focus:not([disabled]), .rdp-button:active:not([disabled]) {
          outline: 2px solid #9B7E67 !important;
          outline-offset: 2px !important;
          border-color: #9B7E67 !important;
        }
        .rdp-day_today:not(.rdp-day_outside) {
          color: #9B7E67 !important;
          font-weight: 700 !important;
        }
      `}</style>
      
      <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-8 flex justify-center border border-black/5 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#9B7E67]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
        <DayPicker
          mode="range"
          selected={range}
          onSelect={setRange}
          disabled={[{ before: new Date() }, ...disabledDays]}
          locale={es}
          numberOfMonths={1}
          className="rdp-premium"
        />
      </div>

      <form onSubmit={handleReserve} className="flex flex-col space-y-8 flex-1">
        {days > 0 && (
          <div className="flex justify-between items-end border-b border-black/10 pb-4">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-widest text-[#9B7E67] font-bold mb-1">Estadía</span>
              <span className="text-[#524D48] font-light">{days} noche{days > 1 ? 's' : ''} a ${price}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs uppercase tracking-widest text-[#9B7E67] font-bold mb-1">Total Estimado</span>
              <span className="font-mono text-2xl text-[#23211F]">${totalPrice}</span>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div className="relative group">
            <input 
              type="text" 
              id="guestName"
              required
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              className="w-full bg-transparent border-b border-black/20 py-3 text-[#23211F] placeholder-transparent focus:outline-none focus:border-[#9B7E67] transition-colors peer font-light"
              placeholder="Nombre completo"
            />
            <label htmlFor="guestName" className="absolute left-0 -top-3.5 text-xs font-bold uppercase tracking-widest text-[#9B7E67] transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-3.5 peer-placeholder-shown:font-light peer-placeholder-shown:normal-case peer-focus:-top-3.5 peer-focus:text-xs peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-widest peer-focus:text-[#9B7E67]">Nombre Completo</label>
          </div>
          
          <div className="relative group">
            <input 
              type="email" 
              id="guestEmail"
              required
              value={guestEmail}
              onChange={e => setGuestEmail(e.target.value)}
              className="w-full bg-transparent border-b border-black/20 py-3 text-[#23211F] placeholder-transparent focus:outline-none focus:border-[#9B7E67] transition-colors peer font-light"
              placeholder="Correo electrónico"
            />
            <label htmlFor="guestEmail" className="absolute left-0 -top-3.5 text-xs font-bold uppercase tracking-widest text-[#9B7E67] transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-3.5 peer-placeholder-shown:font-light peer-placeholder-shown:normal-case peer-focus:-top-3.5 peer-focus:text-xs peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-widest peer-focus:text-[#9B7E67]">Correo Electrónico</label>
          </div>

          <div className="relative group">
            <input 
              type="tel" 
              id="guestPhone"
              required
              value={guestPhone}
              onChange={e => setGuestPhone(e.target.value)}
              className="w-full bg-transparent border-b border-black/20 py-3 text-[#23211F] placeholder-transparent focus:outline-none focus:border-[#9B7E67] transition-colors peer font-light"
              placeholder="Teléfono"
            />
            <label htmlFor="guestPhone" className="absolute left-0 -top-3.5 text-xs font-bold uppercase tracking-widest text-[#9B7E67] transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-3.5 peer-placeholder-shown:font-light peer-placeholder-shown:normal-case peer-focus:-top-3.5 peer-focus:text-xs peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-widest peer-focus:text-[#9B7E67]">Teléfono de Contacto</label>
          </div>
        </div>
        
        <div className="pt-4 mt-auto">
          <button 
            type="submit"
            disabled={!range?.from || !range?.to || isLoading}
            className="w-full bg-[#2C2927] text-white py-5 rounded-xl uppercase tracking-[0.2em] text-xs font-bold hover:bg-[#9B7E67] hover:shadow-lg transition-all duration-300 disabled:opacity-40 disabled:hover:bg-[#2C2927] disabled:hover:shadow-none disabled:cursor-not-allowed group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out"></div>
            <span className="relative z-10">{isLoading ? 'Procesando...' : (range?.from && range?.to ? `Confirmar Reserva` : 'Seleccione Fechas')}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
