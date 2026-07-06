'use client';

import React, { useState } from 'react';
import { saveIcalFeeds } from '@/lib/actions';
import { Loader2, Link2, Plus, Trash2, Copy, Check } from 'lucide-react';
import { ActionLoadingScreen } from '@/components/ui/ActionLoadingScreen';
import { motion, AnimatePresence } from 'framer-motion';

type Feed = { name: string; url: string };

export default function IcalWorkspace({ roomId, initialFeeds }: { roomId: number, initialFeeds: Feed[] }) {
  const [feeds, setFeeds] = useState<Feed[]>(initialFeeds);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleAdd = () => setFeeds([...feeds, { name: '', url: '' }]);
  const handleRemove = (index: number) => setFeeds(feeds.filter((_, i) => i !== index));
  const handleChange = (index: number, field: keyof Feed, value: string) => {
    const newFeeds = [...feeds];
    newFeeds[index][field] = value;
    setFeeds(newFeeds);
  };

  const handleSave = async () => {
    setIsLoading(true);
    await saveIcalFeeds(roomId, feeds.filter(f => f.name && f.url));
    setIsLoading(false);
  };

  const exportUrl = `https://hotelsonador.com/api/ical/export/${roomId}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(exportUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Export Section */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#9B7E67]/10 flex items-center justify-center shrink-0">
            <Link2 className="w-6 h-6 text-[#9B7E67]" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="font-serif text-2xl text-[#23211F]">Export Calendar</h3>
              <p className="text-gray-500 text-sm mt-1">Copy this URL and paste it into Airbnb, Booking.com, or other channels so they can block their dates when you receive a booking here.</p>
            </div>
            
            <div className="flex gap-2">
              <input 
                type="url" 
                value={exportUrl} 
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500 font-mono" 
                readOnly
              />
              <button 
                onClick={copyToClipboard}
                className="bg-[#2C2927] text-white px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest hover:bg-[#1A1817] transition-colors flex items-center gap-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Import Section */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-serif text-2xl text-[#23211F]">Import Calendars</h3>
            <p className="text-gray-500 text-sm mt-1">Add iCal links provided by external channels (e.g. Airbnb) to block dates in your system.</p>
          </div>
          <button 
            onClick={handleAdd}
            className="w-10 h-10 bg-[#F9F7F4] hover:bg-[#9B7E67]/10 text-[#9B7E67] rounded-full flex items-center justify-center transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <AnimatePresence>
            {feeds.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-2xl">
                You haven't added any links to import yet.
              </motion.div>
            )}
            {feeds.map((feed, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex gap-4 items-center bg-gray-50 p-4 rounded-2xl"
              >
                <div className="w-1/3">
                  <input
                    type="text"
                    placeholder="Name (e.g. Airbnb)"
                    value={feed.name}
                    onChange={(e) => handleChange(index, 'name', e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#9B7E67]"
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="url"
                    placeholder="iCal Format URL (https://...)"
                    value={feed.url}
                    onChange={(e) => handleChange(index, 'url', e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#9B7E67]"
                  />
                </div>
                <button onClick={() => handleRemove(index)} className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-5 h-5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="mt-8 flex justify-end">
          <button 
            onClick={handleSave}
            disabled={isLoading}
            className="bg-[#9B7E67] hover:bg-[#8A6D56] text-white px-8 py-3 rounded-xl font-medium transition-colors flex items-center gap-2"
          >
            {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
      
      <ActionLoadingScreen 
        isOpen={isLoading}
        message="Sincronizando iCal..."
        subMessage="Actualizando disponibilidad con Airbnb / Booking"
      />
    </div>
  );
}
