'use client';

import { calendarDateToLocal } from '@/lib/dateRanges';

import React, { useState, useEffect, useTransition } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, differenceInDays } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calculator, CalendarDays, User, Mail, Phone, Image as ImageIcon, Send, CheckCircle, Download, Lock, DollarSign } from 'lucide-react';
import { CalaSpinner as Loader2 } from "@/cala/components/ui/cala-loader";
import { motion, AnimatePresence } from 'framer-motion';
import { AdminToast } from '@/components/admin/AdminToast';

type Booking = {
  checkIn: Date;
  checkOut: Date;
  origin?: string;
};
type PricingRule = { date: Date; priceOverride: number; };
type BlockedDate = { startDate: Date; endDate: Date; };

interface BookingCalendarProps {
  bookings: Booking[];
  tourBookings?: any[];
  blocks: BlockedDate[];
  pricingRules?: PricingRule[];
  addManualBooking: (formData: FormData) => Promise<{ success: boolean; bookingId?: number; error?: string }>;
  manageDateRange?: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
  basePrice: number;
}

export default function BookingCalendarClient({ bookings, tourBookings = [], blocks, pricingRules = [], addManualBooking, manageDateRange, basePrice }: BookingCalendarProps) {
  const [activeTab, setActiveTab] = useState<'booking' | 'block' | 'price'>('booking');
  const [manualPrice, setManualPrice] = useState<number>(basePrice);


  const [currentDate, setCurrentDate] = useState(new Date());
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCheckIn(null);

    setCheckOut(null);
  }, [activeTab]);

  const [calculatedPrice, setCalculatedPrice] = useState<number>(0);
  const [depositType, setDepositType] = useState<'percentage' | 'fixed'>('percentage');
  const [depositValue, setDepositValue] = useState<number>(50);
  const [depositCurrency, setDepositCurrency] = useState<string>('MXN');

  const [isPending, startTransition] = useTransition();
  const [createdBooking, setCreatedBooking] = useState<{ id: number, email: string, name: string } | null>(null);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [invoiceSent, setInvoiceSent] = useState(false);
  const [invoiceEmail, setInvoiceEmail] = useState('');
  const [invoiceLanguage, setInvoiceLanguage] = useState<'en' | 'es' | ''>('');

  const [toastState, setToastState] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' }>({
    isOpen: false,
    message: '',
    type: 'success',
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const nextMonth = () => {
    const maxYear = new Date().getFullYear() + 2;
    const canGoNext = currentDate.getFullYear() < maxYear || (currentDate.getFullYear() === maxYear && currentDate.getMonth() < 11);
    if (canGoNext) {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const maxYear = new Date().getFullYear() + 2;
  const canGoNext = currentDate.getFullYear() < maxYear || (currentDate.getFullYear() === maxYear && currentDate.getMonth() < 11);

  const isDateUnavailable = (day: Date) => {
    if (day < new Date(new Date().setHours(0,0,0,0))) return true;
    if (activeTab === 'block' || activeTab === 'price') return false;

    const isBlocked = blocks.some(b => {
      const start = calendarDateToLocal(b.startDate);
      const end = calendarDateToLocal(b.endDate);
      return day >= start && day <= end;
    });
    if (isBlocked) return true;

    const isBooked = bookings.some(b => {
      const start = calendarDateToLocal(b.checkIn);
      const end = calendarDateToLocal(b.checkOut);
      return day >= start && day <= end;
    });
    return isBooked;
  };

  const handleDayClick = (day: Date) => {
    if (isDateUnavailable(day)) return;

    if (!checkIn) {
      setCheckIn(day);
      setCheckOut(activeTab === 'booking' ? null : day);
    } else if (checkIn && (!checkOut || isSameDay(checkIn, checkOut) || activeTab !== 'booking')) {
      if (day < checkIn) {
        setCheckIn(day);
        if (activeTab !== 'booking') setCheckOut(day);
      } else {
        let d = addDays(checkIn, 1);
        let valid = true;
        if (activeTab === 'booking') {
          while (d < day) {
            if (isDateUnavailable(d)) {
              valid = false;
              break;
            }
            d = addDays(d, 1);
          }
        }
        if (valid) {
          setCheckOut(day);
        } else {
          setCheckIn(day);
          if (activeTab !== 'booking') setCheckOut(day);
        }
      }
    } else {
      setCheckIn(day);
      setCheckOut(activeTab === 'booking' ? null : day);
    }
  };

  useEffect(() => {
    if (checkIn && checkOut && activeTab === 'booking') {
      const nights = differenceInDays(checkOut, checkIn);
      let total = 0;
      let d = new Date(checkIn);
      for(let i=0; i<nights; i++) {
        const rule = pricingRules.find(r => isSameDay(calendarDateToLocal(r.date), d));
        total += rule ? rule.priceOverride : basePrice;
        d = addDays(d, 1);
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCalculatedPrice(total);
    } else {

      setCalculatedPrice(0);
    }
  }, [checkIn, checkOut, basePrice, pricingRules, activeTab]);

  const onManageSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!checkIn || !checkOut || !manageDateRange) return;
    const formData = new FormData(e.currentTarget);
    formData.append('startDate', format(checkIn, 'yyyy-MM-dd'));
    formData.append('endDate', format(checkOut, 'yyyy-MM-dd'));

    startTransition(async () => {
      const result = await manageDateRange(formData);
      if (result.success) {
        setToastState({ isOpen: true, message: 'Updated successfully!', type: 'success' });
        setCheckIn(null);
        setCheckOut(null);
      } else {
        setToastState({ isOpen: true, message: result.error || 'Error updating', type: 'error' });
      }
    });
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const guestEmail = formData.get('guestEmail') as string || '';
    const guestName = formData.get('guestName') as string || '';

    const depositPaid = depositType === 'percentage'
      ? calculatedPrice * ((depositValue || 0) / 100)
      : (depositValue || 0);
    formData.append('depositPaid', depositPaid.toString());
    formData.append('depositCurrency', depositCurrency);
    formData.append('invoiceLanguage', invoiceLanguage);

    startTransition(async () => {
      const result = await addManualBooking(formData);
      if (result.success && result.bookingId) {
        setCreatedBooking({ id: result.bookingId, email: guestEmail, name: guestName });
        setInvoiceEmail(guestEmail);
        handleAutomaticInvoice(result.bookingId);
      } else {
        setToastState({
          isOpen: true,
          message: result.error || 'Error creating booking',
          type: 'error',
        });
      }
    });
  };

  const handleAutomaticInvoice = async (bookingId: number) => {
    // Automatically trigger local download and send to admin
    // email parameter is kept for future use if needed

    try {
      const res = await fetch('/api/admin/send-invoice-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, sendToClient: false })
      });
      const data = await res.json();
      if (data.success && data.pdfBase64) {
        // Convert base64 to Blob for robust cross-platform mobile & desktop downloading
        const binary = atob(data.pdfBase64);
        const array = [];
        for (let i = 0; i < binary.length; i++) {
          array.push(binary.charCodeAt(i));
        }
        const blob = new Blob([new Uint8Array(array)], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);

        const downloadLink = document.createElement("a");
        downloadLink.href = blobUrl;
        downloadLink.download = `Invoice-${bookingId}.pdf`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
    } catch (e) {
      console.error('Error with automatic invoice generation:', e);
    }
  };

  const handleManualDownload = (bookingId: number) => {
    window.open(`/api/invoice/${bookingId}`, '_blank');
  };

  const handleSendInvoice = async () => {
    if (!createdBooking || !invoiceEmail || !invoiceLanguage) {
      setToastState({
        isOpen: true,
        message: 'Please select an Invoice Language before sending.',
        type: 'error'
      });
      return;
    }
    setIsSendingInvoice(true);
    try {
      const res = await fetch('/api/admin/send-invoice-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: createdBooking.id, sendToClient: true, clientEmail: invoiceEmail, invoiceLanguage })
      });
      const data = await res.json();
      if (data.success || data.clientEmailSent) {
        setInvoiceSent(true);
        setToastState({
          isOpen: true,
          message: `Invoice successfully sent to ${invoiceEmail}`,
          type: 'success',
        });
        setTimeout(() => {
          setCreatedBooking(null);
          setInvoiceSent(false);
          setCheckIn(null);
          setCheckOut(null);
        }, 3500);
      } else {
        setToastState({
          isOpen: true,
          message: 'Error sending invoice: ' + (data.error || 'Check email configuration'),
          type: 'error',
        });
      }
    } catch (err) {
      console.error(err);
      setToastState({
        isOpen: true,
        message: 'Error sending invoice email',
        type: 'error',
      });
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
            className="fixed inset-0 md:absolute md:inset-0 z-[100] md:z-50 flex flex-col items-center justify-center bg-white/95 md:bg-white/80 backdrop-blur-md md:backdrop-blur-sm md:rounded-2xl"
          >
            <Loader2 className="w-10 h-10 text-[#9B7E67] animate-spin mb-4" />
            <p className="text-[#23211F] font-serif text-xl">Processing booking...</p>
            <p className="text-gray-500 text-sm uppercase tracking-widest font-bold mt-2">Please wait</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calendar Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-serif text-[#23211F] capitalize flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-[#9B7E67]" />
            Stay Dates
          </h3>
          <div className="flex space-x-2">
            <button type="button" onClick={prevMonth} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              disabled={!canGoNext}
              className={`p-2 rounded-lg transition-colors ${canGoNext ? 'bg-gray-100 hover:bg-gray-200' : 'bg-gray-50 cursor-not-allowed opacity-50'}`}
            >
              <ChevronRight className={`w-4 h-4 ${canGoNext ? 'text-gray-600' : 'text-gray-400'}`} />
            </button>
          </div>
        </div>

        <div className="text-center font-bold text-gray-800 capitalize mb-4">
          {format(currentDate, 'MMMM yyyy', { locale: enUS })}
        </div>

        <div className="w-full">
          <div className="w-full">
            <div className="grid grid-cols-7 mb-2 gap-1 sm:gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center text-xs md:text-[10px] font-bold text-gray-400 uppercase">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {days.map((day) => {
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isPast = day < new Date(new Date().setHours(0,0,0,0));
                const isBookedManual = bookings.some(b => b.origin === 'MANUAL' && day >= calendarDateToLocal(b.checkIn) && day < calendarDateToLocal(b.checkOut));
                const isBookedClient = bookings.some(b => b.origin !== 'MANUAL' && day >= calendarDateToLocal(b.checkIn) && day < calendarDateToLocal(b.checkOut));
                const isBooked = isBookedManual || isBookedClient;
                const isCleaning = bookings.some(b => isSameDay(day, calendarDateToLocal(b.checkOut)));
                const isBlocked = blocks.some(b => day >= calendarDateToLocal(b.startDate) && day <= calendarDateToLocal(b.endDate));
                const isTour = tourBookings.some(t => {
                  const d = calendarDateToLocal(t.startDate);
                  d.setHours(0,0,0,0);
                  const end = calendarDateToLocal(t.endDate);
                  end.setHours(0,0,0,0);
                  const currentDay = new Date(day);
                  currentDay.setHours(0,0,0,0);
                  return currentDay >= d && currentDay <= end;
                });

                let bgClass = "bg-[#F9F7F4] hover:bg-[#E5D9C5] border border-[#D4C3AB]/40 cursor-pointer shadow-sm transition-all";
                let textClass = "text-[#23211F] font-medium";
                const hasPriceRule = pricingRules.find(r => isSameDay(calendarDateToLocal(r.date), day));
                const inRange = checkIn && checkOut && day >= checkIn && day <= checkOut;

                if (!isCurrentMonth) {
                  bgClass = "bg-transparent opacity-0 pointer-events-none";
                } else if (checkIn && checkOut && (isSameDay(day, checkIn) || isSameDay(day, checkOut))) {
                  bgClass = "bg-[#9B7E67] shadow-md";
                  textClass = "text-[#F9F7F4] font-bold";
                } else if (checkIn && !checkOut && isSameDay(day, checkIn)) {
                  bgClass = "bg-[#9B7E67] shadow-md";
                  textClass = "text-[#F9F7F4] font-bold";
                } else if (inRange) {
                  bgClass = "bg-[#D4A574] shadow-sm opacity-90";
                  textClass = "text-[#23211F] font-bold";
                } else if (isPast) {
                  bgClass = "bg-gray-50 border border-gray-200 cursor-not-allowed";
                  textClass = "text-gray-400 font-medium";
                } else if (isBookedClient || (isBlocked && activeTab === 'booking')) {
                  bgClass = "bg-[#c1121f] cursor-not-allowed shadow-inner";
                  textClass = "text-white font-bold";
                } else if (isBookedManual) {
                  bgClass = "bg-[#a8dadc] cursor-not-allowed shadow-inner";
                  textClass = "text-[#1d3557] font-bold";
                } else if (isBlocked && activeTab !== 'booking') {
                  bgClass = "bg-gray-300 shadow-inner";
                  textClass = "text-gray-600 font-bold";
                } else if (isCleaning) {
                  bgClass = "bg-[#D4A574] cursor-pointer shadow-sm border border-[#c9955c]";
                  textClass = "text-[#23211F] font-bold";
                } else if (isTour) {
                  bgClass = "bg-[#6B705C] hover:bg-[#5A5E4E] text-[#F9F7F4] shadow-sm";
                  textClass = "text-[#F9F7F4] font-bold";
                }

                return (
                  <div
                    key={day.toString()}
                    onClick={() => isCurrentMonth && handleDayClick(day)}
                    className={`h-10 sm:h-12 flex items-center justify-center rounded-lg transition-colors ${bgClass}`}
                  >
                    {isCurrentMonth && (
                      <div className="relative flex items-center justify-center w-full h-full">
                        <span className={`text-xs sm:text-sm ${textClass}`}>
                          {format(day, 'd')}
                        </span>
                        {hasPriceRule && (
                          <div className="absolute top-0 right-0 p-[2px] bg-green-500/90 rounded-bl-md rounded-tr-md" title={`$${hasPriceRule.priceOverride}`}>
                            <DollarSign className="w-2 sm:w-3 h-2 sm:h-3 text-white" />
                          </div>
                        )}
                        {isBlocked && (
                          <div className="absolute top-0 left-0 p-[2px] bg-red-600/90 rounded-br-md rounded-tl-md">
                            <Lock className="w-2 sm:w-3 h-2 sm:h-3 text-white" />
                          </div>
                        )}
                        {isTour && (isBooked || (isBlocked && activeTab === 'booking')) && (
                          <div className="absolute bottom-0 right-0 p-[2px] bg-[#6B705C]/90 rounded-tl-md rounded-br-md" title="Tour Booked">
                            <div className="w-2 sm:w-3 h-2 sm:h-3 rounded-full bg-[#F9F7F4]" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 items-center justify-center text-xs md:text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#c1121f]"></div>
            <span>Reserva Web</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#a8dadc]"></div>
            <span>Reserva Manual</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#D4A574] border border-[#c9955c]"></div>
            <span>Limpieza</span>
          </div>
        </div>

        <div className="mt-6 flex justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
          <div className="text-center w-full border-r border-gray-200">
            <span className="text-xs md:text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Check-in</span>
            <span className="font-serif text-[#23211F]">{checkIn ? format(checkIn, 'MMM dd, yyyy', { locale: enUS }) : '--/--/----'}</span>
          </div>
          <div className="text-center w-full">
            <span className="text-xs md:text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Check-out</span>
            <span className="font-serif text-[#23211F]">{checkOut ? format(checkOut, 'MMM dd, yyyy', { locale: enUS }) : '--/--/----'}</span>
          </div>
        </div>
      </div>

      {/* Tabs UI */}
      <div className="flex bg-gray-100 p-1 rounded-xl mx-auto w-full max-w-lg mb-2">
        <button
          onClick={() => setActiveTab('booking')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors uppercase tracking-widest ${activeTab === 'booking' ? 'bg-white shadow-sm text-[#23211F]' : 'text-gray-500 hover:text-gray-700'}`}
        >
          New Booking
        </button>
        <button
          onClick={() => setActiveTab('block')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors uppercase tracking-widest ${activeTab === 'block' ? 'bg-white shadow-sm text-[#23211F]' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Block Dates
        </button>
        <button
          onClick={() => setActiveTab('price')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors uppercase tracking-widest ${activeTab === 'price' ? 'bg-white shadow-sm text-[#23211F]' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Manual Price
        </button>
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
              <h3 className="text-2xl font-serif text-[#23211F] mb-2">Booking Registered!</h3>
              <p className="text-gray-500 mb-6 max-w-sm">
                The booking for <strong className="text-[#23211F]">{createdBooking.name}</strong> has been saved successfully.
              </p>

              {/* Instant Download Button (Mobile & Desktop) */}
              <div className="mb-6 w-full max-w-md">
                <button
                  type="button"
                  onClick={() => handleManualDownload(createdBooking.id)}
                  className="w-full py-3.5 px-4 rounded-xl border border-[#9B7E67] text-[#9B7E67] hover:bg-[#9B7E67] hover:text-white transition-all font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Download PDF Invoice
                </button>
              </div>

              {invoiceSent ? (
                <div className="bg-[#F9F7F4] border border-[#E5E0D8] text-[#9B7E67] px-6 py-4 rounded-xl font-medium flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Invoice sent successfully
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
                      placeholder="Client email address"
                      className="w-full border border-gray-200 rounded-xl pl-10 px-4 py-4 text-[#23211F] focus:outline-none focus:border-[#9B7E67] focus:ring-1 focus:ring-[#9B7E67] transition-all"
                    />
                  </div>
                  <div className="relative">
                    <select
                      value={invoiceLanguage}
                      onChange={(e) => setInvoiceLanguage(e.target.value as 'en' | 'es')}
                      className="w-full border border-gray-200 rounded-xl px-4 py-4 text-[#23211F] focus:outline-none focus:border-[#9B7E67] focus:ring-1 focus:ring-[#9B7E67] transition-all appearance-none bg-white"
                      required
                    >
                      <option value="" disabled>Select Invoice Language</option>
                      <option value="en">English (EN)</option>
                      <option value="es">Español (ES)</option>
                    </select>
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
                      Skip
                    </button>
                    <button
                      onClick={handleSendInvoice}
                      disabled={isSendingInvoice || !invoiceEmail}
                      className="flex-1 py-4 rounded-xl font-bold text-xs tracking-widest uppercase text-white bg-[#9B7E67] hover:bg-[#23211F] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSendingInvoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {isSendingInvoice ? 'Sending...' : 'Send PDF'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="forms"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              {activeTab === 'booking' && (
                <>
                  <h3 className="text-xl font-serif text-[#23211F] mb-6 flex items-center gap-2">
                    <User className="w-5 h-5 text-[#9B7E67]" />
                    Guest Details
                  </h3>

              <form onSubmit={onSubmit} className="space-y-5">
                <input type="hidden" name="checkIn" value={checkIn ? format(checkIn, 'yyyy-MM-dd') : ''} />
                <input type="hidden" name="checkOut" value={checkOut ? format(checkOut, 'yyyy-MM-dd') : ''} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Full Name</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-gray-400" />
                      </div>
                      <input type="text" name="guestName" required placeholder="e.g., John Doe" className="w-full border border-gray-200 rounded-xl pl-10 px-3 py-3 text-[#23211F] text-sm focus:outline-none focus:border-[#9B7E67] focus:ring-1 focus:ring-[#9B7E67] transition-all" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Email (Optional)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-4 w-4 text-gray-400" />
                      </div>
                      <input type="email" name="guestEmail" placeholder="john@example.com" className="w-full border border-gray-200 rounded-xl pl-10 px-3 py-3 text-[#23211F] text-sm focus:outline-none focus:border-[#9B7E67] focus:ring-1 focus:ring-[#9B7E67] transition-all" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Phone (Optional)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-4 w-4 text-gray-400" />
                      </div>
                      <input type="tel" name="guestPhone" placeholder="+1 234 567 8900" className="w-full border border-gray-200 rounded-xl pl-10 px-3 py-3 text-[#23211F] text-sm focus:outline-none focus:border-[#9B7E67] focus:ring-1 focus:ring-[#9B7E67] transition-all" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">ID Document (Optional)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <ImageIcon className="h-4 w-4 text-gray-400" />
                      </div>
                      <input type="file" name="idCard" accept="image/*" className="w-full border border-gray-200 rounded-xl pl-10 px-3 py-2 text-gray-500 text-sm focus:outline-none focus:border-[#9B7E67] focus:ring-1 focus:ring-[#9B7E67] bg-white transition-all file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Invoice Language</label>
                    <div className="relative">
                      <select
                        name="invoiceLanguage"
                        value={invoiceLanguage}
                        onChange={(e) => setInvoiceLanguage(e.target.value as 'en' | 'es')}
                        required
                        className="w-full border border-gray-200 rounded-xl px-3 py-3 text-[#23211F] text-sm focus:outline-none focus:border-[#9B7E67] focus:ring-1 focus:ring-[#9B7E67] transition-all appearance-none bg-white"
                      >
                        <option value="" disabled>Select Language</option>
                        <option value="en">English</option>
                        <option value="es">Español</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Deposit Currency</label>
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                      {(['MXN', 'USD', 'CAD']).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setDepositCurrency(c)}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${depositCurrency === c ? 'bg-white shadow-sm text-[#23211F]' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Deposit Type</label>
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setDepositType('percentage')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${depositType === 'percentage' ? 'bg-white shadow-sm text-[#23211F]' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        Percentage (%)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDepositType('fixed')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${depositType === 'fixed' ? 'bg-white shadow-sm text-[#23211F]' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        Fixed ({depositCurrency})
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                      {depositType === 'percentage' ? 'Deposit Percentage (%)' : `Deposit Amount (${depositCurrency})`}
                    </label>
                    <input
                      type="number"
                      value={depositValue === 0 && depositType === 'percentage' ? '' : depositValue}
                      onChange={(e) => setDepositValue(parseFloat(e.target.value) || 0)}
                      placeholder={depositType === 'percentage' ? '50' : '0'}
                      className="w-full border border-gray-200 rounded-xl px-3 py-3 text-[#23211F] text-sm focus:outline-none focus:border-[#9B7E67] focus:ring-1 focus:ring-[#9B7E67] transition-all"
                    />
                  </div>
                </div>

                <div className="bg-[#F9F7F4] p-5 rounded-xl border border-[#E5D9C5] mt-6">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-white p-2 rounded-lg shadow-sm shrink-0">
                        <Calculator className="w-5 h-5 text-[#9B7E67]" />
                      </div>
                      <div>
                        <p className="text-xs md:text-[10px] font-bold text-gray-400 uppercase tracking-widest">Estimated Cost ({checkIn && checkOut ? differenceInDays(checkOut, checkIn) : 0} nights)</p>
                        <p className="text-xs text-gray-500">At ${basePrice.toLocaleString('es-MX')} MXN per night</p>
                      </div>
                    </div>
                    <div className="relative w-full sm:w-1/3">
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
                  {isPending ? 'REGISTERING...' : 'CONFIRM BOOKING'}
                </button>
              </form>
                </>
              )}

              {activeTab === 'block' && (
                <form onSubmit={onManageSubmit} className="space-y-6">
                  <h3 className="text-xl font-serif text-[#23211F] mb-2 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-red-500" />
                    Block Dates
                  </h3>
                  <p className="text-sm text-gray-500">Select a date or range in the calendar to block or unblock it.</p>

                  <div className="flex gap-4">
                    <button
                      type="submit"
                      name="action"
                      value="BLOCK"
                      disabled={!checkIn || !checkOut || isPending}
                      className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs tracking-widest uppercase transition-colors disabled:opacity-50"
                    >
                      {isPending ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
                      Block Selected
                    </button>
                    <button
                      type="submit"
                      name="action"
                      value="UNBLOCK"
                      disabled={!checkIn || !checkOut || isPending}
                      className="flex-1 py-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold text-xs tracking-widest uppercase transition-colors disabled:opacity-50"
                    >
                      {isPending ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
                      Unblock
                    </button>
                  </div>
                </form>
              )}

              {activeTab === 'price' && (
                <form onSubmit={onManageSubmit} className="space-y-6">
                  <h3 className="text-xl font-serif text-[#23211F] mb-2 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    Manual Price Override
                  </h3>
                  <p className="text-sm text-gray-500">Set a custom price per night for the selected dates. Base price is ${basePrice}.</p>

                  <div>
                    <label className="block text-xs md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">New Price per Night</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-400 font-bold">$</span>
                      </div>
                      <input
                        type="number"
                        name="price"
                        value={manualPrice}
                        onChange={e => setManualPrice(parseFloat(e.target.value) || 0)}
                        required
                        className="w-full border border-gray-200 rounded-xl pl-8 px-3 py-3 text-[#23211F] font-bold text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      type="submit"
                      name="action"
                      value="SET_PRICE"
                      disabled={!checkIn || !checkOut || isPending}
                      className="flex-1 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs tracking-widest uppercase transition-colors disabled:opacity-50"
                    >
                      {isPending ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
                      Save Price
                    </button>
                    <button
                      type="submit"
                      name="action"
                      value="CLEAR_PRICE"
                      disabled={!checkIn || !checkOut || isPending}
                      className="flex-1 py-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold text-xs tracking-widest uppercase transition-colors disabled:opacity-50"
                    >
                      {isPending ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
                      Clear Override
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AdminToast
        isOpen={toastState.isOpen}
        message={toastState.message}
        type={toastState.type}
        onClose={() => setToastState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
