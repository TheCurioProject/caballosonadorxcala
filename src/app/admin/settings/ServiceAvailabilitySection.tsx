'use client';

import { calendarDateToLocal } from '@/lib/dateRanges';

import React, { useState } from 'react';
import { DayPicker, DateRange } from 'react-day-picker';
import { toggleServiceBlockDates } from './service-actions';
import { Loader2 } from 'lucide-react';
import { format, isSameDay, addDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

type BlockedDate = { id: number; startDate: Date; endDate: Date; serviceType: string };

export default function ServiceAvailabilitySection({ foodBlocks, tourBlocks }: { foodBlocks: BlockedDate[], tourBlocks: BlockedDate[] }) {
  const [activeTab, setActiveTab] = useState<'FOOD' | 'TOUR'>('FOOD');
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  const currentBlocks = activeTab === 'FOOD' ? foodBlocks : tourBlocks;

  const handleToggleBlock = async (isBlocking: boolean) => {
    if (!range?.from) return;
    
    // get all dates in range
    const dates = [];
    const end = range.to || range.from;
    let current = new Date(range.from);
    while (current <= end) {
      dates.push(new Date(current));
      current = addDays(current, 1);
    }

    setIsLoading(true);
    try {
      await toggleServiceBlockDates(activeTab, dates.map(date => new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))), isBlocking);
      setRange(undefined);
    } finally {
      setIsLoading(false);
    }
  };

  const getDayInfo = (day: Date) => {
    const isBlocked = currentBlocks.some(b => {
      const start = calendarDateToLocal(b.startDate);
      const end = calendarDateToLocal(b.endDate);
      start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
      const d = new Date(day);
      return d >= start && d <= end;
    });
    return { isBlocked };
  };

  const isSelectedBlocked = () => {
    if (!range?.from) return false;
    const dates = [];
    const end = range.to || range.from;
    let current = new Date(range.from);
    while (current <= end) {
      dates.push(new Date(current));
      current = addDays(current, 1);
    }
    // Check if at least one selected date is blocked
    return dates.some(d => getDayInfo(d).isBlocked);
  };

  const CustomDay = (props: any) => {
    const { date, displayMonth } = props;
    const isBlocked = getDayInfo(date).isBlocked;
    
    let className = "relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors cursor-pointer text-sm ";
    
    // Apply selected styles manually to override react-day-picker generic styles if needed, 
    // but react-day-picker handles selection. Let's just append the blocked style.
    if (isBlocked) {
      className += " bg-gray-400 text-white font-bold";
    } else {
      className += " hover:bg-gray-100 text-gray-800";
    }

    // Since react-day-picker renders standard classes for selected/range, we can just use modifiers
    return <button {...props} />;
  };

  const blockedRanges = currentBlocks.map(b => ({
    from: calendarDateToLocal(b.startDate),
    to: calendarDateToLocal(b.endDate)
  }));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:col-span-2">
      <div className="mb-6">
        <h2 className="text-xl font-serif text-[#23211F]">Service Availability</h2>
        <p className="text-gray-500 font-light text-sm mt-1">Block specific dates for Food Services or ATV Tours.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-1/3 space-y-4">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => { setActiveTab('FOOD'); setRange(undefined); }}
              className={`flex-1 py-2 text-xs md:text-[10px] sm:text-xs font-bold uppercase tracking-wide sm:tracking-widest rounded-lg transition-colors ${activeTab === 'FOOD' ? 'bg-white shadow text-[#9B7E67]' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Food Services
            </button>
            <button
              onClick={() => { setActiveTab('TOUR'); setRange(undefined); }}
              className={`flex-1 py-2 text-xs md:text-[10px] sm:text-xs font-bold uppercase tracking-wide sm:tracking-widest rounded-lg transition-colors ${activeTab === 'TOUR' ? 'bg-white shadow text-[#9B7E67]' : 'text-gray-500 hover:text-gray-700'}`}
            >
              ATV Tours
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-6"
            >
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-widest mb-2">Manage {activeTab === 'FOOD' ? 'Food' : 'Tours'}</h3>
              <p className="text-xs text-gray-500 mb-6">Select a date range on the calendar to block or unblock the service.</p>
              
              {range?.from ? (
                <div className="space-y-4">
                  <div className="bg-[#FAF8F5] border border-[#E8D5B7] p-4 rounded-xl">
                    <p className="text-sm text-[#23211F] font-medium">Selected Range:</p>
                    <p className="text-[#9B7E67] font-bold">
                      {format(range.from, 'MMM d, yyyy')} {range.to && range.to > range.from ? `- ${format(range.to, 'MMM d, yyyy')}` : ''}
                    </p>
                  </div>
                  
                  {isSelectedBlocked() ? (
                    <button
                      onClick={() => handleToggleBlock(false)}
                      disabled={isLoading}
                      className="w-full bg-gray-200 text-gray-700 hover:bg-gray-300 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex justify-center items-center"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Unblock Selected Dates'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleBlock(true)}
                      disabled={isLoading}
                      className="w-full bg-red-500 text-white hover:bg-red-600 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex justify-center items-center"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Block Selected Dates'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-center">
                  <p className="text-sm text-gray-500">Select dates on the calendar to manage availability.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="w-full md:w-2/3 flex justify-center bg-gray-50 rounded-2xl p-6 border border-gray-100 shadow-inner overflow-x-auto">
          <DayPicker
            mode="range"
            selected={range}
            onSelect={setRange}
            modifiers={{ blocked: blockedRanges }}
            modifiersClassNames={{
              blocked: 'bg-gray-400 text-white !rounded-lg font-bold'
            }}
            numberOfMonths={1}
            className="premium-calendar"
          />
        </div>
      </div>
    </div>
  );
}
