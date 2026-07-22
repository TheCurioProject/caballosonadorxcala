import prisma from '@/lib/prisma';

import Link from 'next/link';
import { User, CalendarCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  let properties: any[] = [];
  try {
    const fetchProps = prisma.property.findMany({
      include: {
        bookings: {
          where: { checkOut: { gte: new Date() } },
          orderBy: { checkIn: 'asc' }
        }
      }
    });
    const timeout = new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('Prisma timeout')), 3000));
    properties = await Promise.race([fetchProps, timeout]);
  } catch (error) {
    console.warn("Failed to fetch properties from Prisma:", error);
    properties = [{
      id: 1,
      name: 'Casa Caballo Soñador',
      baseCapacity: 12,
      basePrice: 1500,
      bookings: []
    }];
  }

  if (!properties || properties.length === 0) {
    properties = [{
      id: 1,
      name: 'Casa Caballo Soñador',
      baseCapacity: 12,
      basePrice: 1500,
      bookings: []
    }];
  }

  const totalFutureBookings = properties.reduce((acc, p) => acc + p.bookings.length, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      <div className="flex justify-between items-center mb-4 sm:mb-8">
        <div>
          <h2 className="text-2xl sm:text-4xl font-serif text-[#23211F]">Dashboard</h2>
          <p className="text-gray-500 font-light mt-1 sm:mt-2 text-sm sm:text-base">Overview of operations and bookings.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-8">
        <div className="bg-white p-4 sm:p-8 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 sm:gap-6">
          <div className="w-10 h-10 sm:w-14 sm:h-14 bg-[#F9F7F4] rounded-full flex items-center justify-center text-[#9B7E67] shrink-0"><CalendarCheck className="w-5 h-5 sm:w-7 sm:h-7" /></div>
          <div>
            <div className="text-xl sm:text-3xl font-serif text-[#23211F]">{totalFutureBookings}</div>
            <div className="text-[9px] sm:text-xs uppercase tracking-widest text-gray-500 font-bold">Active Bookings</div>
          </div>
        </div>
        <div className="bg-white p-4 sm:p-8 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 sm:gap-6">
          <div className="w-10 h-10 sm:w-14 sm:h-14 bg-[#F9F7F4] rounded-full flex items-center justify-center text-[#9B7E67] shrink-0"><User className="w-5 h-5 sm:w-7 sm:h-7" /></div>
          <div>
            <div className="text-xl sm:text-3xl font-serif text-[#23211F]">{properties.length}</div>
            <div className="text-[9px] sm:text-xs uppercase tracking-widest text-gray-500 font-bold">Properties</div>
          </div>
        </div>
      </div>

      <div className="bg-white p-5 sm:p-10 rounded-2xl shadow-xl border border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-6">
        <div>
          <h3 className="text-lg sm:text-2xl font-bold font-serif text-[#23211F]">Availability Management</h3>
          <p className="text-gray-500 font-light mt-1 sm:mt-2 text-sm sm:text-base">Manually block dates and set dynamic rates from the interactive calendar.</p>
        </div>
        <Link href="/admin/calendar" className="bg-[#23211F] text-white px-6 sm:px-10 py-3 sm:py-4 rounded-full hover:bg-[#9B7E67] transition-colors text-xs font-bold uppercase tracking-widest whitespace-nowrap w-full sm:w-auto text-center">
          Go to Calendar
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-5 sm:p-10">
        <h3 className="text-lg sm:text-2xl font-bold mb-4 sm:mb-6 font-serif text-[#23211F]">Upcoming Bookings</h3>
        
        {/* Mobile: Card list */}
        <div className="space-y-3 sm:hidden">
          {properties.flatMap(p => p.bookings.map(b => ({ ...b, propertyName: p.name }))).sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime()).map((booking: any) => (
            <div key={booking.id} className="bg-[#F9F7F4] rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-[#23211F]">{booking.guestName}</span>
                {booking.origin === 'MANUAL_BLOCK' ? (
                  <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest">Block</span>
                ) : (
                  <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest">{booking.payment_status}</span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 font-light">{booking.guestEmail}</p>
              <div className="text-xs text-gray-500 pt-1 border-t border-gray-200/60">
                {booking.checkIn.toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan', day: '2-digit', month: 'short' })} — {booking.checkOut.toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan', day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
          ))}
          {properties.every(p => p.bookings.length === 0) && (
            <div className="py-8 text-center text-gray-400 italic text-sm">No upcoming bookings.</div>
          )}
        </div>

        {/* Desktop: Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr>
                <th className="border-b border-gray-200 pb-4 text-xs uppercase tracking-widest font-bold text-gray-400">Guest</th>
                <th className="border-b border-gray-200 pb-4 text-xs uppercase tracking-widest font-bold text-gray-400">Property</th>
                <th className="border-b border-gray-200 pb-4 text-xs uppercase tracking-widest font-bold text-gray-400">Dates</th>
                <th className="border-b border-gray-200 pb-4 text-xs uppercase tracking-widest font-bold text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {properties.flatMap(p => p.bookings.map(b => ({ ...b, propertyName: p.name }))).sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime()).map((booking: any) => (
                <tr key={booking.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="py-6 font-medium text-[#23211F]">
                    {booking.guestName}
                    <div className="text-xs text-gray-400 font-light mt-1">{booking.guestEmail}</div>
                  </td>
                  <td className="py-6 text-gray-600">{booking.propertyName}</td>
                  <td className="py-6 text-gray-600">
                    {booking.checkIn.toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} - {booking.checkOut.toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-6">
                    {booking.origin === 'MANUAL_BLOCK' ? (
                      <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Manual Block</span>
                    ) : (
                      <span className="bg-green-50 text-green-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">{booking.payment_status}</span>
                    )}
                  </td>
                </tr>
              ))}
              {properties.every(p => p.bookings.length === 0) && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400 italic">No upcoming bookings.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
