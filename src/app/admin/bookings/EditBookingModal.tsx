'use client';

import React, { useState, useTransition } from 'react';
import { X, Loader2, Save, Printer, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { updateBooking } from './actions';
import { format, differenceInDays } from 'date-fns';
import { AdminToast } from '@/components/admin/AdminToast';

export default function EditBookingModal({ 
  booking, 
  isOpen, 
  onClose,
  basePrice 
}: { 
  booking: any; 
  isOpen: boolean; 
  onClose: () => void;
  basePrice: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [invoiceSent, setInvoiceSent] = useState(false);
  const [toastState, setToastState] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' }>({
    isOpen: false,
    message: '',
    type: 'success',
  });
  
  const [guestName, setGuestName] = useState(booking.guestName);
  const [guestEmail, setGuestEmail] = useState(booking.guestEmail || '');
  const [guestPhone, setGuestPhone] = useState(booking.guestPhone || '');
  const [checkIn, setCheckIn] = useState(format(new Date(booking.checkIn), 'yyyy-MM-dd'));
  const [checkOut, setCheckOut] = useState(format(new Date(booking.checkOut), 'yyyy-MM-dd'));
  const [totalPrice, setTotalPrice] = useState(booking.totalPrice);
  
  const initialDepositType = booking.depositPaid > 0 && booking.depositPaid < booking.totalPrice ? 'fixed' : 'percentage';
  const [depositType, setDepositType] = useState<'percentage' | 'fixed'>(initialDepositType);
  const [depositValue, setDepositValue] = useState(
    initialDepositType === 'percentage' 
      ? (booking.depositPaid / booking.totalPrice) * 100 
      : booking.depositPaid
  );
  const [depositCurrency, setDepositCurrency] = useState(booking.depositCurrency || 'MXN');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('guestName', guestName);
    formData.append('guestEmail', guestEmail);
    formData.append('guestPhone', guestPhone);
    formData.append('checkIn', checkIn);
    formData.append('checkOut', checkOut);
    formData.append('price', totalPrice.toString());
    
    const depositPaid = depositType === 'percentage' 
      ? totalPrice * ((depositValue || 0) / 100)
      : (depositValue || 0);
      
    formData.append('depositPaid', depositPaid.toString());
    formData.append('depositCurrency', depositCurrency);

    startTransition(async () => {
      const result = await updateBooking(booking.id, formData);
      if (result.success) {
        onClose();
      } else {
        setToastState({
          isOpen: true,
          message: result.error || 'Failed to update booking',
          type: 'error',
        });
      }
    });
  };

  const handlePrintInvoice = async (sendToClient: boolean) => {
    setIsSendingInvoice(true);
    try {
      const res = await fetch('/api/admin/send-invoice-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bookingId: booking.id, 
          sendToClient, 
          clientEmail: guestEmail 
        })
      });
      const data = await res.json();
      if (data.success && data.pdfBase64) {
        // Blob download for mobile & desktop
        const binary = atob(data.pdfBase64);
        const array = [];
        for (let i = 0; i < binary.length; i++) {
          array.push(binary.charCodeAt(i));
        }
        const blob = new Blob([new Uint8Array(array)], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        
        const downloadLink = document.createElement("a");
        downloadLink.href = blobUrl;
        downloadLink.download = `Invoice-${booking.id}.pdf`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        setInvoiceSent(true);
        setToastState({
          isOpen: true,
          message: sendToClient ? 'Invoice generated and sent to guest!' : 'Invoice generated successfully!',
          type: 'success',
        });
        setTimeout(() => setInvoiceSent(false), 3000);
      } else {
        setToastState({
          isOpen: true,
          message: 'Error generating invoice: ' + (data.error || 'Internal error'),
          type: 'error',
        });
      }
    } catch (e) {
      setToastState({
        isOpen: true,
        message: 'Error generating invoice',
        type: 'error',
      });
    } finally {
      setIsSendingInvoice(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="flex justify-between items-center p-6 border-b border-gray-100">
            <h3 className="text-xl font-serif text-[#23211F]">Edit Booking #{booking.id}</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1">
            <form id="edit-booking-form" onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Guest Name</label>
                  <input type="text" required value={guestName} onChange={e => setGuestName(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[#23211F] text-sm focus:outline-none focus:border-[#9B7E67]" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Email</label>
                  <input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[#23211F] text-sm focus:outline-none focus:border-[#9B7E67]" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Check In</label>
                  <input type="date" required value={checkIn} onChange={e => setCheckIn(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[#23211F] text-sm focus:outline-none focus:border-[#9B7E67]" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Check Out</label>
                  <input type="date" required value={checkOut} onChange={e => setCheckOut(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[#23211F] text-sm focus:outline-none focus:border-[#9B7E67]" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Deposit Currency</label>
                  <select value={depositCurrency} onChange={e => setDepositCurrency(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[#23211F] text-sm focus:outline-none focus:border-[#9B7E67] bg-white">
                    <option value="MXN">MXN</option>
                    <option value="USD">USD</option>
                    <option value="CAD">CAD</option>
                  </select>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Deposit Type</label>
                  <select value={depositType} onChange={e => setDepositType(e.target.value as 'percentage'|'fixed')} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[#23211F] text-sm focus:outline-none focus:border-[#9B7E67] bg-white">
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed</option>
                  </select>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Amount</label>
                  <input type="number" required value={depositValue} onChange={e => setDepositValue(parseFloat(e.target.value))} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[#23211F] text-sm focus:outline-none focus:border-[#9B7E67]" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Total Price (MXN)</label>
                <input type="number" required value={totalPrice} onChange={e => setTotalPrice(parseFloat(e.target.value))} className="w-full border border-[#D4C3AB] bg-[#F9F7F4] rounded-xl px-4 py-3 text-[#23211F] text-lg font-serif focus:outline-none focus:border-[#9B7E67]" />
              </div>
            </form>
          </div>

          <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
            
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              {invoiceSent && <span className="text-xs text-green-600 font-bold uppercase tracking-widest text-center sm:text-left">Invoice Downloaded & Sent!</span>}
              <div className="flex flex-col sm:flex-row gap-2">
                <button 
                  onClick={() => handlePrintInvoice(false)}
                  disabled={isSendingInvoice}
                  className="px-4 py-2.5 border border-gray-300 text-gray-700 bg-white hover:bg-gray-100 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                >
                  {isSendingInvoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                  Save & Print
                </button>
                <button 
                  onClick={() => handlePrintInvoice(true)}
                  disabled={isSendingInvoice || !guestEmail}
                  className="px-4 py-2.5 bg-[#F9F7F4] border border-[#E5D9C5] text-[#9B7E67] hover:bg-[#E5D9C5] rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  title={!guestEmail ? "Guest email required" : ""}
                >
                  {isSendingInvoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send to Client
                </button>
              </div>
            </div>

            <div className="flex gap-3 w-full sm:w-auto justify-end">
              <button 
                onClick={onClose}
                className="flex-1 sm:flex-none px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-widest text-gray-500 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                form="edit-booking-form"
                type="submit"
                disabled={isPending}
                className="flex-1 sm:flex-none px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest text-white bg-[#9B7E67] hover:bg-[#23211F] transition-colors flex items-center justify-center gap-2"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
