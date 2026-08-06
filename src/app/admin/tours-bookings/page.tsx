import prisma from '@/lib/prisma';
import React from 'react';
import TourBookingActions from './TourBookingActions';
import { DeleteTourBookingButton } from './DeleteTourBookingButton';

export const dynamic = 'force-dynamic';

export default async function AdminToursBookingsPage() {
  let tourBookings: any[] = [];
  try {
    tourBookings = await prisma.serviceBooking.findMany({
      where: {
        serviceType: 'TOUR',
        endDate: { gte: new Date() }
      },
      orderBy: { startDate: 'asc' }
    });
  } catch (error) {
    console.warn("Failed to fetch tour bookings:", error);
  }

  const formatDate = (date: Date) => new Date(date).toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan', day: '2-digit', month: 'short', year: 'numeric' });

  const activeBookings = tourBookings.filter(b => b.paymentStatus !== 'PENDING');
  const pendingBookings = tourBookings.filter(b => b.paymentStatus === 'PENDING');

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 px-4 sm:px-0">
      <div className="mb-4 sm:mb-8">
        <h2 className="text-2xl sm:text-4xl font-serif text-[#23211F]">Tour Bookings</h2>
        <p className="text-gray-500 font-light mt-1 sm:mt-2 text-sm sm:text-base">
          Manage your upcoming tour reservations, download invoices, and send emails.
        </p>
      </div>

      {/* Pending Locks */}
      {pendingBookings.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-orange-200 overflow-hidden mb-8">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-orange-100 bg-orange-50/30">
            <h2 className="font-serif text-orange-900 text-lg sm:text-xl">Pending Tour Payments</h2>
          </div>
          
          {/* Mobile: Cards */}
          <div className="space-y-0 divide-y divide-orange-50 sm:hidden">
            {pendingBookings.map((b: any) => (
              <div key={b.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-orange-900 truncate">{b.guestName}</p>
                  <p className="text-[11px] text-orange-600 mt-0.5">{formatDate(b.startDate)}</p>
                </div>
                <DeleteTourBookingButton bookingId={b.id} />
              </div>
            ))}
          </div>
          
          {/* Desktop: Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full min-w-max">
              <thead>
                <tr className="bg-orange-50/50 text-xs md:text-[10px] font-bold text-orange-400 uppercase tracking-widest text-left">
                  <th className="py-4 px-6">Guest</th>
                  <th className="py-4 px-6">Tour Date</th>
                  <th className="py-4 px-6">Destination</th>
                  <th className="py-4 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-50 text-sm">
                {pendingBookings.map((b: any) => {
                  let dest = 'Tour';
                  try {
                    const parsed = JSON.parse(b.serviceDetails);
                    dest = parsed.destinations?.map((d:any)=>d.name).join(', ') || 'Tour';
                  } catch(e){}
                  return (
                    <tr key={b.id} className="hover:bg-orange-50/30 transition-colors">
                      <td className="py-4 px-6 font-medium text-orange-900">{b.guestName}</td>
                      <td className="py-4 px-6 text-orange-600">{formatDate(b.startDate)}</td>
                      <td className="py-4 px-6 text-orange-600">{dest}</td>
                      <td className="py-4 px-6 text-right">
                        <DeleteTourBookingButton bookingId={b.id} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active Bookings */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-50 flex justify-between items-center">
          <h2 className="font-serif text-[#23211F] text-lg sm:text-xl">Upcoming Tours</h2>
          <span className="text-[9px] sm:text-xs text-gray-400 uppercase tracking-widest font-bold">Total: {activeBookings.length}</span>
        </div>
        
        {/* Mobile: Cards */}
        <div className="divide-y divide-gray-50 sm:hidden">
          {activeBookings.map((b: any) => {
            let dest = 'Tour';
            try {
              const parsed = JSON.parse(b.serviceDetails);
              dest = parsed.destinations?.map((d:any)=>d.name).join(', ') || 'Tour';
            } catch(e){}
            return (
              <div key={b.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-[#23211F] truncate">{b.guestName}</p>
                    <p className="text-xs md:text-[10px] text-gray-500 truncate">{b.guestEmail}</p>
                  </div>
                  <TourBookingActions booking={b} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase bg-[#6B705C]/10 text-[#6B705C]">
                    TOUR
                  </span>
                  <span className="text-xs text-[#23211F] font-bold">{dest}</span>
                </div>
                <p className="text-xs text-gray-500 pt-1 border-t border-gray-100 flex justify-between">
                  <span>{formatDate(b.startDate)}</span>
                  <span className="font-medium">Personas / Guests: {b.pax}</span>
                </p>
              </div>
            )
          })}
          {activeBookings.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-400 italic">No upcoming tours.</div>
          )}
        </div>
        
        {/* Desktop: Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full min-w-max">
            <thead>
              <tr className="bg-[#F9F7F4] text-xs md:text-[10px] font-bold text-gray-400 uppercase tracking-widest text-left">
                <th className="py-4 px-6">Guest</th>
                <th className="py-4 px-6">Tour Date</th>
                <th className="py-4 px-6">Destination</th>
                <th className="py-4 px-6 text-center">Personas / Guests</th>
                <th className="py-4 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {activeBookings.map((b: any) => {
                let dest = 'Tour';
                try {
                  const parsed = JSON.parse(b.serviceDetails);
                  dest = parsed.destinations?.map((d:any)=>d.name).join(', ') || 'Tour';
                } catch(e){}
                return (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 font-medium text-[#23211F]">
                      {b.guestName}
                      <p className="text-xs md:text-[10px] text-gray-400 font-normal">{b.guestEmail}</p>
                    </td>
                    <td className="py-4 px-6 text-gray-600">
                      {formatDate(b.startDate)}
                    </td>
                    <td className="py-4 px-6 font-medium text-gray-700">
                      {dest}
                    </td>
                    <td className="py-4 px-6 text-center text-gray-600">
                      {b.pax}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <TourBookingActions booking={b} />
                    </td>
                  </tr>
                )
              })}
              {activeBookings.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-sm text-gray-400 italic">No upcoming tours.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
