'use client';

import React, { useState } from 'react';
import { saveIcalFeeds, syncIcalSources } from '@/lib/actions';
import { Loader2, Link2, Plus, Trash2, Copy, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { ActionLoadingScreen } from '@/components/ui/ActionLoadingScreen';
import { motion, AnimatePresence } from 'framer-motion';

type Feed = { id?: number; name: string; url: string; syncStatus?: string; lastSync?: Date | string; syncError?: string; };

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
    await saveIcalFeeds(roomId, feeds.filter(f => f.name && f.url).map(f => ({ name: f.name, url: f.url })));
    setIsLoading(false);
  };

  const handleSync = async () => {
    setIsLoading(true);
    await syncIcalSources(roomId);
    setIsLoading(false);
  };

  const domain = typeof window !== 'undefined' ? window.location.origin : 'https://casacaballosonador.com';
  const exportUrl = `${domain}/api/ical/export/${roomId}/calendar.ics`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(exportUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Export Section */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-5 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#9B7E67]/10 flex items-center justify-center shrink-0">
            <Link2 className="w-6 h-6 text-[#9B7E67]" />
          </div>
          <div className="flex-1 space-y-4 w-full">
            <div>
              <h3 className="font-serif text-2xl text-[#23211F]">Export Calendar</h3>
              <p className="text-gray-500 text-sm mt-1">Copy this URL and paste it into Airbnb, Booking.com, or other channels so they can block their dates when you receive a booking here.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <input 
                type="url" 
                value={exportUrl} 
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs sm:text-sm text-gray-500 font-mono overflow-x-auto" 
                readOnly
              />
              <button 
                onClick={copyToClipboard}
                className="bg-[#2C2927] text-white px-6 py-3 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-widest hover:bg-[#1A1817] transition-colors flex items-center justify-center gap-2 shrink-0"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Import Section */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-5 sm:p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-serif text-2xl text-[#23211F]">Import Calendars</h3>
            <p className="text-gray-500 text-sm mt-1">Add iCal links provided by external channels (e.g. Airbnb) to block dates in your system.</p>
          </div>
          <button 
            onClick={handleAdd}
            className="w-10 h-10 bg-[#F9F7F4] hover:bg-[#9B7E67]/10 text-[#9B7E67] rounded-full flex items-center justify-center transition-colors shrink-0"
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
                className="flex flex-col gap-3 bg-gray-50 p-4 rounded-2xl"
              >
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center w-full">
                <div className="w-full sm:w-1/3">
                  <input
                    type="text"
                    placeholder="Name (e.g. Airbnb)"
                    value={feed.name}
                    onChange={(e) => handleChange(index, 'name', e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#9B7E67]"
                  />
                </div>
                <div className="w-full sm:flex-1">
                  <input
                    type="url"
                    placeholder="iCal Format URL (https://...)"
                    value={feed.url}
                    onChange={(e) => handleChange(index, 'url', e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#9B7E67]"
                  />
                </div>
                <div className="flex justify-end sm:block">
                  <button 
                    onClick={() => handleRemove(index)} 
                    className="p-3 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-2 text-xs font-bold uppercase sm:normal-case"
                  >
                    <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="sm:hidden">Remove Feed</span>
                  </button>
                </div>
                </div>
                {feed.id && (
                  <div className="flex items-center gap-2 text-xs">
                    {feed.syncStatus === 'success' ? (
                      <span className="flex items-center gap-1 text-green-600 bg-green-100 px-2 py-1 rounded-md">
                        <Check className="w-3 h-3" /> Online
                      </span>
                    ) : feed.syncStatus === 'error' ? (
                      <span className="flex items-center gap-1 text-red-600 bg-red-100 px-2 py-1 rounded-md">
                        <AlertCircle className="w-3 h-3" /> Failed
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-500 bg-gray-200 px-2 py-1 rounded-md">
                        Pending
                      </span>
                    )}
                    {feed.lastSync && (
                      <span className="text-gray-400">
                        Last sync: {new Date(feed.lastSync).toLocaleString()}
                      </span>
                    )}
                    {feed.syncError && (
                      <span className="text-red-500 truncate max-w-xs" title={feed.syncError}>
                        - {feed.syncError}
                      </span>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="mt-8 flex justify-end gap-3 flex-wrap">
          <button 
            onClick={handleSync}
            disabled={isLoading || feeds.length === 0}
            className="w-full sm:w-auto bg-[#F9F7F4] hover:bg-[#EBE7E0] text-[#9B7E67] border border-[#9B7E67]/20 px-8 py-3.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            Sync Now
          </button>
          <button 
            onClick={handleSave}
            disabled={isLoading}
            className="w-full sm:w-auto bg-[#9B7E67] hover:bg-[#8A6D56] text-white px-8 py-3.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
      
      <ActionLoadingScreen 
        isOpen={isLoading}
        message="Syncing iCal..."
        subMessage="Updating availability with Airbnb / Booking"
      />
    </div>
  );
}
