'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, differenceInDays } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calculator, CalendarDays, User, Mail, Phone, Image as ImageIcon, Loader2, Send, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Booking = { checkIn: Date; checkOut: Date; };
type BlockedDate = { startDate: Date; endDate: Date; };

interface BookingCalendarProps {
  bookings: Booking[];
  blocks: BlockedDate[];
  addManualBooking: (formData: FormData) => Promise<{ success: boolean; bookingId?: number; error?: string }>;
  basePrice: number;
}

export default function BookingCalendarClient({ bookings, blocks, addManualBooking, basePrice }: BookingCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [calculatedPrice, setCalculatedPrice] = useState<number>(0);
  
  const [isPending, startTransition] = useTransition();
  const [createdBooking, setCreatedBooking] = useState<{ id: number, email: string, name: string } | null>(null);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [invoiceSent, setInvoiceSent] = useState(false);
  const [invoiceEmail, setInvoiceEmail] = useState('');

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const isDateUnavailable = (day: Date) => {
    if (day < new Date(new Date().setHours(0,0,0,0))) return true;

    const isBlocked = blocks.some(b => {
      const start = new Date(b.startDate);
      const end = new Date(b.endDate);
      return day >= start && day <= end;
    });
    if (isBlocked) return true;

    const isBooked = bookings.some(b => {
      const start = new Date(b.checkIn);
      const end = new Date(b.checkOut);
      return day >= start && day < end;
    });
    return isBooked;
  };

  const handleDayClick = (day: Date) => {
    if (isDateUnavailable(day) && !checkIn) return;

    if (!checkIn) {
      setCheckIn(day);
      setCheckOut(null);
    } else if (checkIn && !checkOut) {
      if (day <= checkIn) {
        setCheckIn(day);
      } else {
        let d = addDays(checkIn, 1);
        let valid = true;
        while (d < day) {
          if (isDateUnavailable(d)) {
            valid = false;
            break;
          }
          d = addDays(d, 1);
        }
        if (valid) {
          setCheckOut(day);
        } else {
          setCheckIn(day);
        }
      }
    } else {
      setCheckIn(day);
      setCheckOut(null);
    }
  };

  useEffect(() => {
    if (checkIn && checkOut) {
      const nights = differenceInDays(checkOut, checkIn);
      setCalculatedPrice(nights * basePrice);
    } else {
      setCalculatedPrice(0);
    }
  }, [checkIn, checkOut, basePrice]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const guestEmail = formData.get('guestEmail') as string || '';
    const guestName = formData.get('guestName') as string || '';
    
    startTransition(async () => {
      const result = await addManualBooking(formData);
      if (result.success && result.bookingId) {
        setCreatedBooking({ id: result.bookingId, email: guestEmail, name: guestName });
        setInvoiceEmail(guestEmail);
      } else {
        alert(result.error || 'Error creating booking');
      }
    });
  };

  const handleSendInvoice = async () => {
    if (!createdBooking || !invoiceEmail) return;
    setIsSendingInvoice(true);
    try {
      const res = await fetch('/api/admin/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: createdBooking.id, email: invoiceEmail })
      });
      if (res.ok) {
        setInvoiceSent(true);
        setTimeout(() => {
          setCreatedBooking(null);
          setInvoiceSent(false);
          setCheckIn(null);
          setCheckOut(null);
        }, 3000);
      } else {
        alert('Error sending invoice');
      }
    } catch (err) {
      console.error(err);
      alert('Error sending invoice');
    } finally {
      setIsSendingInvoice(false);
    }
  };

  const days = [];
  let day = startDate;
  while (day <= endDate) {
    days.push(day);
    day = addDays(day, 1);
  }

  return (
    <div className="space-y-6 relative">
      {/* Pending Overlay for creating booking */}
      <AnimatePresence>
        {isPending && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-2xl"
          >
            <Loader2 className="w-10 h-10 text-[#9B7E67] animate-spin mb-4" />
            <p className="text-[#23211F] font-serif text-xl">Procesando reserva...</p>
            <p className="text-gray-500 text-sm uppercase tracking-widest font-bold mt-2">Por favor, espera</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calendar Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-serif text-[#23211F] capitalize flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-[#9B7E67]" />
            Fechas de Estancia
          </h3>
          <div className="flex space-x-2">
            <button type="button" onClick={prevMonth} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button type="button" onClick={nextMonth} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="text-center font-bold text-gray-800 capitalize mb-4">
          {format(currentDate, 'MMMM yyyy', { locale: enUS })}
        </div>

        <div className="grid grid-cols-7 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-[10px] font-bold text-gray-400 uppercase">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const isCurrentMonth = isSameMonth(day, currentDate);
            const unavailable = isDateUnavailable(day);
            
            let bgClass = "bg-white hover:bg-gray-50 border border-gray-100 cursor-pointer";
            let textClass = "text-[#23211F]";

            if (!isCurrentMonth) {
              bgClass = "bg-transparent opacity-0 pointer-events-none";
            } else if (unavailable && (!checkIn || checkOut)) {
              bgClass = "bg-[#c1121f] cursor-not-allowed shadow-inner";
              textClass = "text-white opacity-80";
            } else if (checkIn && isSameDay(day, checkIn)) {
              bgClass = "bg-[#23211F] text-white";
              textClass = "text-white font-bold";
            } else if (checkOut && isSameDay(day, checkOut)) {
              bgClass = "bg-[#23211F] text-white";
              textClass = "text-white font-bold";
            } else if (checkIn && checkOut && day > checkIn && day < checkOut) {
              bgClass = "bg-[#F9F7F4]";
              textClass = "text-[#9B7E67] font-medium";
            }

            return (
              <div 
                key={day.toString()}
                onClick={() => isCurrentMonth && handleDayClick(day)}
                className={`h-12 flex items-center justify-center rounded-lg transition-colors ${bgClass}`}
              >
                {isCurrentMonth && (
                  <span className={`text-sm ${textClass}`}>
                    {format(day, 'd')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        
        <div className="mt-6 flex justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
          <div className="text-center w-full border-r border-gray-200">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Check-in</span>
            <span className="font-serif text-[#23211F]">{checkIn ? format(checkIn, 'MMM dd, yyyy', { locale: enUS }) : '--/--/----'}</span>
          </div>
          <div className="text-center w-full">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Check-out</span>
            <span className="font-serif text-[#23211F]">{checkOut ? format(checkOut, 'MMM dd, yyyy', { locale: enUS }) : '--/--/----'}</span>
          </div>
        </div>
      </div>

      {/* Form or Invoice Prompt Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {createdBooking ? (
            <motion.div 
              key="success-prompt"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center justify-center py-8 text-center"
            >
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-serif text-[#23211F] mb-2">¡Reserva Registrada!</h3>
              <p className="text-gray-500 mb-8 max-w-sm">
                La reserva para {createdBooking.name} se ha guardado exitosamente. ¿Deseas enviar el comprobante en PDF por correo electrónico?
              </p>

              {invoiceSent ? (
                <div className="bg-[#F9F7F4] border border-[#E5E0D8] text-[#9B7E67] px-6 py-4 rounded-xl font-medium flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Comprobante enviado exitosamente
                </div>
              ) : (
                <div className="w-full max-w-md space-y-4">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input 
                      type="email" 
                      value={invoiceEmail}
                      onChange={(e) => setInvoiceEmail(e.target.value)}
                      placeholder="Correo electrónico del cliente"
                      className="w-full border border-gray-200 rounded-xl pl-10 px-4 py-4 text-[#23211F] focus:outline-none focus:border-[#9B7E67] focus:ring-1 focus:ring-[#9B7E67] transition-all"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => {
                        setCreatedBooking(null);
                        setCheckIn(null);
                        setCheckOut(null);
                      }}
                      className="flex-1 py-4 rounded-xl font-bold text-xs tracking-widest uppercase text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      Omitir
                    </button>
                    <button 
                      onClick={handleSendInvoice}
                      disabled={isSendingInvoice || !invoiceEmail}
                      className="flex-1 py-4 rounded-xl font-bold text-xs tracking-widest uppercase text-white bg-[#9B7E67] hover:bg-[#23211F] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSendingInvoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {isSendingInvoice ? 'Enviando...' : 'Enviar PDF'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="booking-form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <h3 className="text-xl font-serif text-[#23211F] mb-6 flex items-center gap-2">
                <User className="w-5 h-5 text-[#9B7E67]" />
                Detalles del Huésped
              </h3>

              <form onSubmit={onSubmit} className="space-y-5">
                <input type="hidden" name="checkIn" value={checkIn ? checkIn.toISOString() : ''} />
                <input type="hidden" name="checkOut" value={checkOut ? checkOut.toISOString() : ''} />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Nombre Completo</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-gray-400" />
                      </div>
                      <input type="text" name="guestName" required placeholder="Ej. Juan Pérez" className="w-full border border-gray-200 rounded-xl pl-10 px-3 py-3 text-[#23211F] text-sm focus:outline-none focus:border-[#9B7E67] focus:ring-1 focus:ring-[#9B7E67] transition-all" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Correo (Opcional)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-4 w-4 text-gray-400" />
                      </div>
                      <input type="email" name="guestEmail" placeholder="juan@ejemplo.com" className="w-full border border-gray-200 rounded-xl pl-10 px-3 py-3 text-[#23211F] text-sm focus:outline-none focus:border-[#9B7E67] focus:ring-1 focus:ring-[#9B7E67] transition-all" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Teléfono (Opcional)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-4 w-4 text-gray-400" />
                      </div>
                      <input type="tel" name="guestPhone" placeholder="+52 123 456 7890" className="w-full border border-gray-200 rounded-xl pl-10 px-3 py-3 text-[#23211F] text-sm focus:outline-none focus:border-[#9B7E67] focus:ring-1 focus:ring-[#9B7E67] transition-all" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Identificación (Opcional)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <ImageIcon className="h-4 w-4 text-gray-400" />
                      </div>
                      <input type="file" name="idCard" accept="image/*" className="w-full border border-gray-200 rounded-xl pl-10 px-3 py-2 text-gray-500 text-sm focus:outline-none focus:border-[#9B7E67] focus:ring-1 focus:ring-[#9B7E67] bg-white transition-all file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100" />
                    </div>
                  </div>
                </div>

                <div className="bg-[#F9F7F4] p-5 rounded-xl border border-[#E5D9C5] mt-6">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="bg-white p-2 rounded-lg shadow-sm">
                        <Calculator className="w-5 h-5 text-[#9B7E67]" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Costo Estimado ({checkIn && checkOut ? differenceInDays(checkOut, checkIn) : 0} noches)</p>
                        <p className="text-xs text-gray-500">A ${basePrice.toLocaleString('es-MX')} MXN por noche</p>
                      </div>
                    </div>
                    <div className="relative w-1/3">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 font-serif">$</span>
                      <input 
                        type="number" 
                        name="price" 
                        value={calculatedPrice || ''} 
                        onChange={(e) => setCalculatedPrice(parseFloat(e.target.value))}
                        placeholder="0" 
                        className="w-full border border-[#D4C3AB] bg-white rounded-xl pl-7 pr-3 py-2 text-right text-[#23211F] text-lg font-serif focus:outline-none focus:border-[#9B7E67] focus:ring-1 focus:ring-[#9B7E67] transition-all" 
                      />
                    </div>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={!checkIn || !checkOut || isPending}
                  className={`w-full py-4 rounded-xl font-bold text-xs tracking-widest uppercase transition-all duration-300 mt-4 flex justify-center items-center gap-2 ${
                    !checkIn || !checkOut || isPending
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                      : 'bg-[#9B7E67] hover:bg-[#23211F] text-white shadow-md hover:shadow-lg'
                  }`}
                >
                  {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  {isPending ? 'REGISTRANDO...' : 'CONFIRMAR RESERVA'}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
