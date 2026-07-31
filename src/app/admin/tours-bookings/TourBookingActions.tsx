'use client';

import React, { useState } from 'react';
import { MoreVertical, Download, Mail, Check, X, Loader2 } from 'lucide-react';

export default function TourBookingActions({ booking }: { booking: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState(false);

  const handleSendInvoice = async () => {
    setIsSending(true);
    setSendSuccess(false);
    setSendError(false);
    
    try {
      const res = await fetch('/api/admin/send-tour-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id })
      });
      
      if (res.ok) {
        setSendSuccess(true);
        setTimeout(() => {
          setSendSuccess(false);
          setIsOpen(false);
        }, 2000);
      } else {
        setSendError(true);
      }
    } catch (e) {
      setSendError(true);
    } finally {
      setIsSending(false);
    }
  };

  const handleDownloadInvoice = () => {
    window.open(`/api/invoice/tour/${booking.id}`, '_blank');
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
      >
        <MoreVertical size={16} className="text-gray-500" />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 overflow-hidden">
            
            <button 
              onClick={handleDownloadInvoice}
              className="w-full px-4 py-3 text-left text-sm md:text-base font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
            >
              <Download size={14} className="text-gray-400" />
              Download Invoice
            </button>

            <button 
              onClick={handleSendInvoice}
              disabled={isSending || sendSuccess}
              className="w-full px-4 py-3 text-left text-sm md:text-base font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors border-t border-gray-50 disabled:opacity-50"
            >
              {isSending ? (
                <Loader2 size={14} className="text-gray-400 animate-spin" />
              ) : sendSuccess ? (
                <Check size={14} className="text-green-500" />
              ) : sendError ? (
                <X size={14} className="text-red-500" />
              ) : (
                <Mail size={14} className="text-gray-400" />
              )}
              {isSending ? 'Sending...' : sendSuccess ? 'Sent!' : sendError ? 'Failed' : 'Send Invoice via Email'}
            </button>
            
          </div>
        </>
      )}
    </div>
  );
}
