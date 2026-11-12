'use client';

import React, { useState, useEffect } from 'react';
import { saveIcalFeeds, verifyAndSyncIcalSources } from '@/lib/actions';
import { Link2, Plus, Trash2, Copy, Check, RefreshCw, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { CalaSpinner as Loader2 } from "@/cala/components/ui/cala-loader";
import { ActionLoadingScreen } from '@/components/ui/ActionLoadingScreen';
import { ActionResultModal } from '@/components/ui/ActionResultModal';
import { motion, AnimatePresence } from 'framer-motion';

type Feed = {
  id?: number;
  name: string;
  url: string;
  syncStatus?: string | null;
  lastSync?: Date | string | null;
  syncError?: string | null;
};

type ModalState = {
  isOpen: boolean;
  type: 'success' | 'error';
  title: string;
  message: string;
  detail?: string;
};

export default function IcalWorkspace({
  roomId,
  initialFeeds,
}: {
  roomId: number;
  initialFeeds: Feed[];
}) {
  const [feeds, setFeeds] = useState<Feed[]>(initialFeeds);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Syncing iCal...');
  const [loadingSubMessage, setLoadingSubMessage] = useState('Verifying connection with Airbnb / Booking...');
  const [copied, setCopied] = useState(false);
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    type: 'success',
    title: '',
    message: '',
  });

  const handleAdd = () => setFeeds([...feeds, { name: '', url: '' }]);

  const handleRemove = (index: number) => setFeeds(feeds.filter((_, i) => i !== index));

  const handleChange = (index: number, field: keyof Feed, value: string) => {
    const newFeeds = [...feeds];
    newFeeds[index] = {
      ...newFeeds[index],
      [field]: value,
    };
    setFeeds(newFeeds);
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      setLoadingMessage('Saving & Verifying...');
      setLoadingSubMessage('Validating structure and external connections');

      const validFeeds = feeds
        .filter((f) => f.name.trim() && f.url.trim())
        .map((f) => ({ name: f.name.trim(), url: f.url.trim() }));

      const res = await saveIcalFeeds(roomId, validFeeds);
      setFeeds(res.sources);
      setIsLoading(false);

      if (res.syncResult.success) {
        setModalState({
          isOpen: true,
          type: 'success',
          title: 'Changes Saved & Verified',
          message: 'Calendar links were successfully saved and verified online.',
          detail: `Active channels: ${res.syncResult.totalSources} | External dates blocked: ${res.syncResult.totalBlocks}`,
        });
      } else {
        const errors = res.syncResult.results
          .filter((r) => !r.success)
          .map((r) => `• ${r.sourceName}: ${r.error}`)
          .join('\n');

        setModalState({
          isOpen: true,
          type: 'error',
          title: 'Saved with Connection Issues',
          message: 'Feeds were saved to the database, but one or more failed to synchronize.',
          detail: errors || 'Error connecting to external calendar servers.',
        });
      }
    } catch (error: any) {
      setIsLoading(false);
      setModalState({
        isOpen: true,
        type: 'error',
        title: 'Error Saving Feeds',
        message: 'An unexpected error occurred while saving iCal sources.',
        detail: error?.message || 'Internal server connection error',
      });
    }
  };

  const handleSync = async () => {
    try {
      setIsLoading(true);
      setLoadingMessage('Syncing iCal...');
      setLoadingSubMessage('Updating availability and dates in real time');

      const res = await verifyAndSyncIcalSources(roomId);
      setFeeds(res.sources);
      setIsLoading(false);

      if (res.syncResult.success) {
        setModalState({
          isOpen: true,
          type: 'success',
          title: 'Sync Completed Successfully',
          message: 'All external channels are online and blocked dates have been updated.',
          detail: `Sources synced: ${res.syncResult.totalSources} | Active date blocks: ${res.syncResult.totalBlocks}`,
        });
      } else {
        const failedItems = res.syncResult.results.filter((r) => !r.success);
        const errorSummary = failedItems
          .map((r) => `• ${r.sourceName}: ${r.error}`)
          .join('\n');

        setModalState({
          isOpen: true,
          type: 'error',
          title: 'Synchronization Error',
          message: `Issues detected in ${failedItems.length} of the configured external feeds.`,
          detail: errorSummary,
        });
      }
    } catch (error: any) {
      setIsLoading(false);
      setModalState({
        isOpen: true,
        type: 'error',
        title: 'Sync Failed',
        message: 'Could not complete synchronization with external calendar servers.',
        detail: error?.message || 'Database or network communication error.',
      });
    }
  };

  const domain = typeof window !== 'undefined' ? window.location.origin : 'https://casacaballosonador.com';
  const exportUrl = `${domain}/api/ical/export/${roomId}/calendar.ics`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(exportUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 pb-16 md:pb-24">
      {/* Top Action Bar: Immediately visible at top without scrolling */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/80 backdrop-blur-sm p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#9B7E67]/10 flex items-center justify-center text-[#9B7E67] shrink-0">
            <RefreshCw className={`w-5 h-5 ${isVerifying ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <p className="font-serif text-base text-[#23211F] font-medium">Availability Synchronization</p>
            <p className="text-xs text-gray-500">
              {isVerifying ? 'Checking feed statuses...' : `${feeds.filter(f => f.url).length} channel(s) configured`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:self-auto self-end w-full sm:w-auto">
          <button
            onClick={handleSync}
            disabled={isLoading || isVerifying || feeds.length === 0}
            className="flex-1 sm:flex-none bg-[#F9F7F4] hover:bg-[#EBE7E0] text-[#9B7E67] border border-[#9B7E67]/30 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync Now
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading || isVerifying}
            className="flex-1 sm:flex-none bg-[#9B7E67] hover:bg-[#8A6D56] text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Live verification banner */}
      {isVerifying && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="bg-[#9B7E67]/10 border border-[#9B7E67]/25 rounded-xl p-3.5 flex items-center justify-between gap-4 text-xs text-[#5B4636]"
        >
          <div className="flex items-center gap-2.5">
            <Loader2 className="w-4 h-4 animate-spin text-[#9B7E67]" />
            <span>Checking live connectivity with external channels...</span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#9B7E67] hidden sm:inline">
            Active Verification
          </span>
        </motion.div>
      )}

      {/* Export Section (Compact and streamlined to save vertical space) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-3">
          <div className="w-9 h-9 rounded-lg bg-[#9B7E67]/10 flex items-center justify-center shrink-0">
            <Link2 className="w-4 h-4 text-[#9B7E67]" />
          </div>
          <div className="flex-1">
            <h3 className="font-serif text-lg text-[#23211F]">Export Calendar to External Platforms</h3>
            <p className="text-gray-500 text-xs">
              Paste this link into Airbnb, Booking.com, or VRBO so they automatically block dates when you receive bookings here or block dates manually.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <input
            type="url"
            value={exportUrl}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-600 font-mono overflow-x-auto select-all"
            readOnly
          />
          <button
            onClick={copyToClipboard}
            className="bg-[#2C2927] text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#1A1817] transition-colors flex items-center justify-center gap-2 shrink-0 shadow-sm"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Import Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-5 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-serif text-lg sm:text-xl text-[#23211F]">Import Calendars (iCal)</h3>
            <p className="text-gray-500 text-xs mt-0.5">
              Add iCal links from Airbnb, Booking.com, or VRBO to automatically reflect their bookings here.
            </p>
          </div>
          <button
            onClick={handleAdd}
            className="w-9 h-9 bg-[#F9F7F4] hover:bg-[#9B7E67]/15 text-[#9B7E67] border border-[#9B7E67]/20 rounded-full flex items-center justify-center transition-colors shrink-0 shadow-sm"
            title="Add another calendar"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <AnimatePresence>
            {feeds.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8 text-gray-400 text-xs sm:text-sm border-2 border-dashed border-gray-200 rounded-xl"
              >
                You haven&apos;t added any iCal links yet. Click &apos;+&apos; to add the first one.
              </motion.div>
            )}

            {feeds.map((feed, index) => {
              const isSuccess = feed.syncStatus === 'success';
              const isError = feed.syncStatus === 'error';

              return (
                <motion.div
                  key={feed.id ? `feed-${feed.id}` : `temp-${index}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`flex flex-col gap-2.5 p-4 rounded-xl border transition-all ${
                    isError
                      ? 'bg-rose-50/40 border-rose-200'
                      : isSuccess
                      ? 'bg-[#FDFCFB] border-emerald-200/70'
                      : 'bg-gray-50/80 border-gray-200'
                  }`}
                >
                  {/* Inputs row */}
                  <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center w-full">
                    <div className="w-full sm:w-1/3">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 sm:hidden">
                        Channel Name
                      </label>
                      <input
                        type="text"
                        placeholder="Name (e.g. Airbnb)"
                        value={feed.name}
                        onChange={(e) => handleChange(index, 'name', e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-[#9B7E67]"
                      />
                    </div>
                    <div className="w-full sm:flex-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 sm:hidden">
                        Export URL (.ics)
                      </label>
                      <input
                        type="url"
                        placeholder="iCal format URL (https://...calendar.ics)"
                        value={feed.url}
                        onChange={(e) => handleChange(index, 'url', e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:border-[#9B7E67]"
                      />
                    </div>
                    <div className="flex justify-end sm:block">
                      <button
                        onClick={() => handleRemove(index)}
                        className="p-2.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-bold uppercase sm:normal-case"
                        title="Remove feed"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="sm:hidden">Remove</span>
                      </button>
                    </div>
                  </div>

                  {/* Status row */}
                  {feed.id && (
                    <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                      {isVerifying ? (
                        <span className="inline-flex items-center gap-1.5 text-amber-700 bg-amber-100/80 border border-amber-200 px-2 py-0.5 rounded-md font-medium text-[11px]">
                          <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                          Checking feed...
                        </span>
                      ) : isSuccess ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-100/90 border border-emerald-300/80 px-2 py-0.5 rounded-md font-bold text-[11px]">
                          <Wifi className="w-3 h-3 text-emerald-600" />
                          Online
                        </span>
                      ) : isError ? (
                        <span className="inline-flex items-center gap-1.5 text-rose-700 bg-rose-100/90 border border-rose-300/80 px-2 py-0.5 rounded-md font-bold text-[11px]">
                          <WifiOff className="w-3 h-3 text-rose-600" />
                          Connection Failed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-gray-600 bg-gray-200 px-2 py-0.5 rounded-md text-[11px]">
                          Pending Verification
                        </span>
                      )}

                      {feed.lastSync && (
                        <span className="text-gray-500 text-[11px]">
                          Last checked: {new Date(feed.lastSync).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Exact issue alert legend (untruncated) */}
                  {feed.id && isError && feed.syncError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-1 bg-rose-100/70 border border-rose-300/80 rounded-xl p-3 text-xs text-rose-900 flex items-start gap-2.5 shadow-sm"
                    >
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5 overflow-hidden">
                        <p className="font-bold text-rose-950 flex items-center gap-1 text-[11px]">
                          Exact issue detected in {feed.name || 'this feed'}:
                        </p>
                        <p className="text-rose-800 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">
                          {feed.syncError}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Action Buttons at bottom of card */}
        <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end gap-2.5 flex-wrap">
          <button
            onClick={handleSync}
            disabled={isLoading || isVerifying || feeds.length === 0}
            className="w-full sm:w-auto bg-[#F9F7F4] hover:bg-[#EBE7E0] text-[#9B7E67] border border-[#9B7E67]/25 px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync Now
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading || isVerifying}
            className="w-full sm:w-auto bg-[#9B7E67] hover:bg-[#8A6D56] text-white px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Portaled Loading Screen */}
      <ActionLoadingScreen
        isOpen={isLoading}
        message={loadingMessage}
        subMessage={loadingSubMessage}
      />

      {/* Portaled Result Modal */}
      <ActionResultModal
        isOpen={modalState.isOpen}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
        detail={modalState.detail}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
