'use client';

import React, { useState } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, parseISO } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';
import { ActionLoadingScreen } from '@/components/ui/ActionLoadingScreen';
import { motion, AnimatePresence } from 'framer-motion';
import { toggleBlockDate, setCustomPrice } from './actions';

type Booking = { id: number; checkIn: Date; checkOut: Date; guestName: string; origin: string };
type BlockedDate = { id: number; startDate: Date; endDate: Date; reason: string | null };
type PricingRule = { id: number; date: Date; priceOverride: number };
type HolidayRule = { id: number; startDate: Date; endDate: Date; price: number; name: string };

interface CalendarProps {
  roomId: number;
  basePrice: number;
  bookings: Booking[];
  blocks: BlockedDate[];
  dailyRates: PricingRule[];
  holidays: HolidayRule[];
}

export default function AdminCalendarClient({ roomId, basePrice, bookings, blocks, dailyRates, holidays }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [customPriceInput, setCustomPriceInput] = useState('');

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const getDayInfo = (day: Date) => {
    // Check bookings and buffer
    let isBooked = false;
    let isCheckoutBuffer = false;
    let bookingOrigin = undefined;

    const booking = bookings.find(b => {
      const checkIn = new Date(b.checkIn);
      const checkOut = new Date(b.checkOut);
      const isNight = day >= checkIn && day < checkOut;
      const isBuffer = isSameDay(day, checkOut);
      
      if (isNight) {
        isBooked = true;
        bookingOrigin = b.origin;
        return true;
      }
      if (isBuffer) {
        isCheckoutBuffer = true;
        bookingOrigin = b.origin;
        return true;
      }
      return false;
    });

    // Check blocks
    const block = blocks.find(b => {
      const start = new Date(b.startDate);
      const end = new Date(b.endDate);
      return day >= start && day <= end;
    });

    // Check holidays
    const holiday = holidays.find(h => {
      const start = new Date(h.startDate);
      const end = new Date(h.endDate);
      return day >= start && day < end;
    });

    // Check custom daily rate using UTC date to avoid timezone shift
    const customRate = dailyRates.find(r => {
      const d = new Date(r.date);
      return d.getUTCFullYear() === day.getFullYear() && 
             d.getUTCMonth() === day.getMonth() && 
             d.getUTCDate() === day.getDate();
    });

    let price = basePrice;
    if (customRate) price = customRate.priceOverride;
    else if (holiday) price = holiday.price;

    return {
      isBooked,
      isCheckoutBuffer,
      bookingOrigin,
      isBlocked: !!block,
      blockReason: block?.reason,
      isHoliday: !!holiday,
      holidayName: holiday?.name,
      price
    };
  };

  const handleDayClick = (day: Date) => {
    const info = getDayInfo(day);
    setSelectedDate(day);
    setCustomPriceInput(info.price.toString());
    setIsPanelOpen(true);
  };

  const handleToggleBlock = async () => {
    if (!selectedDate) return;
    setIsLoading(true);
    await toggleBlockDate(roomId, selectedDate);
    setIsLoading(false);
    setIsPanelOpen(false);
  };

  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) return;
    setIsLoading(true);
    await setCustomPrice(roomId, selectedDate, parseFloat(customPriceInput));
    setIsLoading(false);
    setIsPanelOpen(false);
  };

  const days = [];
  let day = startDate;
  while (day <= endDate) {
    days.push(day);
    day = addDays(day, 1);
  }

  return (
    <div className="relative">
      
      {/* Calendar Header */}
      <div className="flex justify-between items-center mb-4 sm:mb-8">
        <h2 className="text-xl sm:text-3xl font-serif text-[#23211F] capitalize">
          {format(currentDate, 'MMMM yyyy', { locale: enUS })}
        </h2>
        <div className="flex bg-white rounded-2xl shadow-[inset_2px_2px_5px_rgba(0,0,0,0.05),inset_-2px_-2px_5px_rgba(255,255,255,1)] p-1">
          <button onClick={prevMonth} className="p-2.5 sm:p-3 hover:bg-[#F9F7F4] rounded-xl transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <button onClick={nextMonth} className="p-2.5 sm:p-3 hover:bg-[#F9F7F4] rounded-xl transition-colors">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Mobile View Calendar (Fits 100% screen width, no side scrolling) */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 sm:hidden">
        <div className="grid grid-cols-7 mb-2 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-[10px] font-bold text-gray-400 uppercase">
              {d}
            </div>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div 
            key={`mob-${currentDate.toISOString()}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-7 gap-1"
          >
            {days.map((day) => {
              const isCurrentMonth = isSameMonth(day, currentDate);
              const info = getDayInfo(day);
              const isToday = isSameDay(day, new Date());

              let bgClass = "bg-[#F9F7F4] hover:bg-[#E5D9C5] border border-gray-200 cursor-pointer shadow-sm";
              let textClass = "text-[#23211F] font-bold";

              if (!isCurrentMonth) {
                bgClass = "bg-transparent opacity-0 pointer-events-none";
              } else if (info.isBlocked) {
                bgClass = "bg-gray-400 text-white shadow-inner";
                textClass = "text-white font-bold";
              } else if (info.isBooked) {
                const color = info.bookingOrigin === 'MANUAL' ? 'bg-[#c1121f]' : 'bg-red-500';
                bgClass = `${color} text-white shadow-inner`;
                textClass = "text-white font-bold";
              } else if (info.isCheckoutBuffer) {
                bgClass = "bg-[#D4A574] text-white shadow-inner";
                textClass = "text-white font-bold";
              } else if (info.isHoliday) {
                bgClass = "bg-[#e5d9c5] border border-[#d4c3ab] text-[#9B7E67]";
                textClass = "text-[#9B7E67] font-bold";
              }

              return (
                <div 
                  key={`mob-${day.toString()}`}
                  onClick={() => isCurrentMonth && handleDayClick(day)}
                  className={`h-12 flex flex-col items-center justify-between p-1 rounded-xl transition-all ${bgClass} ${isCurrentMonth ? '' : 'pointer-events-none'}`}
                >
                  <span className={`text-xs ${textClass} ${isToday && !info.isBlocked && !info.isBooked ? 'underline font-extrabold text-[#9B7E67]' : ''}`}>
                    {format(day, 'd')}
                  </span>
                  {isCurrentMonth && (
                    <span className="text-[8px] opacity-90 truncate max-w-full font-sans font-medium">
                      {info.isBlocked ? 'Blocked' : info.isBooked ? 'Booked' : info.isCheckoutBuffer ? 'Buffer' : `$${info.price}`}
                    </span>
                  )}
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>

        {/* Legend for Mobile */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-4 pt-3 border-t border-gray-100 text-[9px] font-bold uppercase tracking-widest text-gray-500">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500" /><span>Stripe</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#c1121f]" /><span>Manual</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#D4A574]" /><span>Buffer</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-gray-400" /><span>Blocked</span></div>
        </div>
      </div>

      {/* Desktop View Calendar Grid */}
      <div className="hidden sm:block overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0">
        <div className="bg-[#F9F7F4] p-6 rounded-[2rem] shadow-[10px_10px_20px_#e3e1de,-10px_-10px_20px_#ffffff] min-w-[700px]">
          {/* Days of week */}
          <div className="grid grid-cols-7 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {d}
              </div>
            ))}
          </div>

          {/* Days */}
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentDate.toISOString()}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-7 gap-4"
            >
            {days.map((day, i) => {
              const isCurrentMonth = isSameMonth(day, currentDate);
              const info = getDayInfo(day);
              const isToday = isSameDay(day, new Date());

              let bgClass = "bg-[#F9F7F4] shadow-[5px_5px_10px_#e3e1de,-5px_-5px_10px_#ffffff]"; // Default Neumorphic
              let textClass = "text-[#23211F]";
              let label = null;

              if (!isCurrentMonth) {
                bgClass = "bg-transparent opacity-30 shadow-none";
              } else if (info.isBlocked) {
                bgClass = "bg-gray-400 shadow-[inset_3px_3px_6px_rgba(0,0,0,0.2)]"; // Gray block
                textClass = "text-white";
                label = info.blockReason || "Blocked";
              } else if (info.isBooked) {
                const color = info.bookingOrigin === 'MANUAL' ? 'bg-[#c1121f]' : 'bg-red-500';
                bgClass = `${color} shadow-[inset_3px_3px_6px_rgba(0,0,0,0.3)]`; 
                textClass = "text-white";
                label = info.bookingOrigin;
              } else if (info.isCheckoutBuffer) {
                bgClass = "bg-[#D4A574] shadow-[inset_3px_3px_6px_rgba(0,0,0,0.2)]"; 
                textClass = "text-white";
                label = "Cleaning / Buffer";
              } else if (info.isHoliday) {
                bgClass = "bg-[#e5d9c5] shadow-[5px_5px_10px_#e3e1de,-5px_-5px_10px_#ffffff] border border-[#d4c3ab]";
                textClass = "text-[#9B7E67]";
                label = info.holidayName;
              }

              return (
                <motion.div 
                  key={day.toString()}
                  whileHover={isCurrentMonth ? { scale: 1.05 } : {}}
                  whileTap={isCurrentMonth ? { scale: 0.95 } : {}}
                  onClick={() => isCurrentMonth && handleDayClick(day)}
                  className={`relative h-28 rounded-2xl p-3 flex flex-col justify-between cursor-pointer transition-colors ${bgClass} ${isCurrentMonth ? '' : 'pointer-events-none'}`}
                >
                  <div className={`text-lg font-bold ${textClass} ${isToday && !info.isBlocked && !info.isBooked ? 'text-[#9B7E67]' : ''}`}>
                    {format(day, 'd')}
                  </div>
                  
                  {isCurrentMonth && (
                    <div className="flex flex-col items-end w-full">
                      {label && (
                        <span className={`text-[9px] font-bold uppercase tracking-widest truncate w-full text-right ${textClass} opacity-80`}>
                          {label}
                        </span>
                      )}
                      <span className={`text-xs font-serif ${textClass} mt-1 ${info.isBlocked || info.isBooked || info.isCheckoutBuffer ? 'opacity-50' : 'opacity-100'}`}>
                        ${info.price}
                      </span>
                    </div>
                  )}
                </motion.div>
              );
            })}
            </motion.div>
          </AnimatePresence>
          
          {/* Admin Legend */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8 pt-6 border-t border-gray-200 text-[10px] font-bold uppercase tracking-widest text-gray-500 w-full">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 shadow-inner"></div>
              <span>Booked (Stripe)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#c1121f] shadow-inner"></div>
              <span>Booked (Manual)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#D4A574] shadow-inner"></div>
              <span>Cleaning / Buffer</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400 shadow-inner"></div>
              <span>Blocked (Manual)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Side Panel for Interactions */}
      <AnimatePresence>
        {isPanelOpen && selectedDate && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPanelOpen(false)}
              className="fixed inset-0 bg-black z-40"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              className="fixed top-0 right-0 w-full sm:max-w-md h-full max-h-screen bg-[#F9F7F4] shadow-2xl z-50 p-5 sm:p-8 flex flex-col overflow-y-auto sm:top-0 sm:right-0 sm:rounded-none rounded-t-3xl sm:rounded-none"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-serif text-[#23211F] capitalize">
                  {format(selectedDate, 'EEEE, MMMM d', { locale: enUS })}
                </h3>
                <button onClick={() => setIsPanelOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              {getDayInfo(selectedDate).isBooked ? (
                <div className="bg-[#FAF8F5] border border-[#D4A574] text-[#9B7E67] p-6 rounded-2xl mb-6">
                  <p className="font-bold mb-2">Day Booked</p>
                  <p className="text-sm opacity-80">You cannot modify the price or block a day that already has an active booking.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Block / Unblock */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm">
                    <h4 className="text-sm font-bold text-gray-800 uppercase tracking-widest mb-4">Availability</h4>
                    <p className="text-sm text-gray-500 mb-6">Manually block this day so it cannot be booked by anyone.</p>
                    <button 
                      onClick={handleToggleBlock}
                      disabled={isLoading}
                      className={`w-full py-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex justify-center items-center ${getDayInfo(selectedDate).isBlocked ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-red-500 text-white hover:bg-red-600'}`}
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : getDayInfo(selectedDate).isBlocked ? 'Unblock Day' : 'Block Day'}
                    </button>
                  </div>

                  {/* Modify Price */}
                  {!getDayInfo(selectedDate).isBlocked && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm">
                      <h4 className="text-sm font-bold text-gray-800 uppercase tracking-widest mb-4">Modify Rate</h4>
                      <p className="text-sm text-gray-500 mb-6">Apply a specific rate just for this day (overrides base rules and holidays).</p>
                      
                      <form onSubmit={handleSavePrice} className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Price per Night (MXN)</label>
                          <input 
                            type="number" 
                            value={customPriceInput}
                            onChange={(e) => setCustomPriceInput(e.target.value)}
                            required 
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[#23211F] text-sm focus:outline-none focus:border-[#9B7E67] font-serif text-lg" 
                          />
                        </div>
                        <button 
                          type="submit"
                          disabled={isLoading}
                          className="w-full bg-[#23211F] text-white hover:bg-[#9B7E67] py-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex justify-center items-center"
                        >
                          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Price'}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ActionLoadingScreen 
        isOpen={isLoading}
        message="Saving Changes..."
        subMessage="Syncing calendar and rates"
      />
    </div>
  );
}
