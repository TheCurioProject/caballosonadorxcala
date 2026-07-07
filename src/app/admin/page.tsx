import prisma from '@/lib/prisma';

import Link from 'next/link';
import { Calendar, User, DollarSign, CalendarCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  let properties = await prisma.property.findMany({
    include: {
      bookings: {
        where: { checkOut: { gte: new Date() } },
        orderBy: { checkIn: 'asc' }
      }
    }
  });

  if (properties.length === 0) {
    const newProperty = await prisma.property.create({
      data: {
        name: 'Casa Caballo Soñador',
        baseCapacity: 12,
        basePrice: 1500
      },
      include: {
        bookings: true
      }
    });
    properties = [newProperty];
  }

  const totalFutureBookings = properties.reduce((acc, p) => acc + p.bookings.length, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-4xl font-serif text-[#23211F]">Dashboard</h2>
          <p className="text-gray-500 font-light mt-2">Overview of operations and bookings.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-6">
          <div className="w-14 h-14 bg-[#F9F7F4] rounded-full flex items-center justify-center text-[#9B7E67]"><CalendarCheck size={28} /></div>
          <div>
            <div className="text-3xl font-serif text-[#23211F]">{totalFutureBookings}</div>
            <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Active Bookings</div>
          </div>
        </div>
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-6">
          <div className="w-14 h-14 bg-[#F9F7F4] rounded-full flex items-center justify-center text-[#9B7E67]"><User size={28} /></div>
          <div>
            <div className="text-3xl font-serif text-[#23211F]">{properties.length}</div>
            <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Properties</div>
          </div>
        </div>
      </div>

      <div className="bg-white p-10 rounded-2xl shadow-xl border border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-6">
        <div>
          <h3 className="text-2xl font-bold font-serif text-[#23211F]">Availability Management</h3>
          <p className="text-gray-500 font-light mt-2">Manually block dates and set dynamic rates from the interactive calendar.</p>
        </div>
        <Link href="/admin/calendar" className="bg-[#23211F] text-white px-10 py-4 rounded-full hover:bg-[#9B7E67] transition-colors text-xs font-bold uppercase tracking-widest whitespace-nowrap">
          Go to Calendar
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-10 overflow-x-auto">
        <h3 className="text-2xl font-bold mb-6 font-serif text-[#23211F]">Upcoming Bookings</h3>
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
  );
}
