import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import React from 'react';
import fs from 'fs/promises';
import path from 'path';
import BookingCalendarClient from './BookingCalendarClient';
import ClearPendingButton from './ClearPendingButton';
import BookingActions from './BookingActions';

export const dynamic = 'force-dynamic';

export default async function AdminBookingsPage() {
  let property: any = null;
  try {
    const fetchProp = prisma.property.findFirst({
      include: {
        bookings: {
          where: { checkOut: { gte: new Date() } },
          orderBy: { checkIn: 'asc' }
        },
        blockedDates: {
          where: { endDate: { gte: new Date() } }
        }
      }
    });
    const timeout = new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Prisma timeout')), 3000));
    property = await Promise.race([fetchProp, timeout]);
  } catch (error) {
    console.warn("Failed to fetch property from Prisma in bookings:", error);
  }

  if (!property) {
    property = {
      id: 1,
      name: 'Casa Caballo Soñador',
      baseCapacity: 12,
      basePrice: 1500,
      bookings: [],
      blockedDates: []
    };
  }

  async function addManualBooking(formData: FormData): Promise<{ success: boolean; bookingId?: number; error?: string }> {
    'use server';
    const checkIn = new Date(formData.get('checkIn') as string);
    const checkOut = new Date(formData.get('checkOut') as string);
    const guestName = formData.get('guestName') as string;
    const guestEmail = formData.get('guestEmail') as string || 'manual@reserva.com';
    const guestPhone = formData.get('guestPhone') as string || null;
    const origin = 'MANUAL';
    const price = parseFloat(formData.get('price') as string);
    const depositPaid = parseFloat(formData.get('depositPaid') as string) || 0;
    const depositCurrency = formData.get('depositCurrency') as string || 'MXN';
    const idCardFile = formData.get('idCard') as File | null;

    let idCardUrl = null;

    if (idCardFile && idCardFile.size > 0) {
      const buffer = Buffer.from(await idCardFile.arrayBuffer());
      const ext = idCardFile.name.split('.').pop();
      const filename = `${Date.now()}-id.${ext}`;
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      
      try {
        await fs.access(uploadDir);
      } catch {
        await fs.mkdir(uploadDir, { recursive: true });
      }
      
      await fs.writeFile(path.join(uploadDir, filename), buffer);
      idCardUrl = `/uploads/${filename}`;
    }

    if (!isNaN(checkIn.getTime()) && !isNaN(checkOut.getTime())) {
      try {
        const newBooking = await prisma.booking.create({
          data: {
            propertyId: property!.id,
            checkIn,
            checkOut,
            guestName,
            guestEmail,
            guestPhone,
            origin,
            payment_status: 'CONFIRMED',
            totalPrice: isNaN(price) ? 0 : price,
            depositPaid: depositPaid,
            depositCurrency: depositCurrency,
            idCardUrl
          }
        });
        revalidatePath('/admin/bookings');
        revalidatePath('/admin/calendar');
        return { success: true, bookingId: newBooking.id };
      } catch (e) {
        console.error(e);
        return { success: false, error: 'Database error' };
      }
    }
    return { success: false, error: 'Invalid dates' };
  }

  const formatDate = (date: Date) => new Date(date).toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div className="mb-8">
        <h2 className="text-4xl font-serif text-[#23211F]">Manual Bookings</h2>
        <p className="text-gray-500 font-light mt-2">
          Manage and create new bookings manually.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Column: Calendar & Form combined in Client */}
        <div className="lg:col-span-2">
          <BookingCalendarClient 
            bookings={property.bookings} 
            blocks={property.blockedDates}
            basePrice={property.basePrice}
            addManualBooking={addManualBooking}
          />
        </div>

        {/* Right Column: Active Bookings & Pending Locks */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Pending Locks Table */}
          {property.bookings.filter(b => b.payment_status === 'PENDING').length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-orange-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-orange-100 flex justify-between items-center bg-orange-50/30">
                <h2 className="font-serif text-orange-900 text-xl">Temporary Locks</h2>
                <div className="flex gap-2">
                  <ClearPendingButton />
                  <ClearPendingButton all={true} label="Clear All" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-max">
                  <thead>
                    <tr className="bg-orange-50/50 text-[10px] font-bold text-orange-400 uppercase tracking-widest text-left">
                      <th className="py-4 px-6">Guest</th>
                      <th className="py-4 px-6">Creation Date</th>
                      <th className="py-4 px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orange-50 text-sm">
                    {property.bookings.filter(b => b.payment_status === 'PENDING').map((b: any) => (
                      <tr key={b.id} className="hover:bg-orange-50/30 transition-colors">
                        <td className="py-4 px-6 font-medium text-orange-900">
                          {b.guestName}
                        </td>
                        <td className="py-4 px-6 text-orange-600">
                          {formatDate(b.createdAt)}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <DeleteBookingButton bookingId={b.id} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Active Bookings Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center">
              <h2 className="font-serif text-[#23211F] text-xl">Upcoming Bookings</h2>
              <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">Total: {property.bookings.filter(b => b.payment_status !== 'PENDING').length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max">
                <thead>
                  <tr className="bg-[#F9F7F4] text-[10px] font-bold text-gray-400 uppercase tracking-widest text-left">
                    <th className="py-4 px-6">Guest</th>
                    <th className="py-4 px-6">Dates</th>
                    <th className="py-4 px-6">Origin</th>
                    <th className="py-4 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-sm">
                  {property.bookings.filter(b => b.payment_status !== 'PENDING').map((b: any) => (
                    <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6 font-medium text-[#23211F]">
                        {b.guestName}
                        {b.idCardUrl && (
                          <a href={b.idCardUrl} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-blue-500 hover:underline mt-1 uppercase font-bold tracking-widest">
                            View ID
                          </a>
                        )}
                      </td>
                      <td className="py-4 px-6 text-gray-600">
                        {formatDate(b.checkIn)} — {formatDate(b.checkOut)}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase ${b.origin === 'MANUAL' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>
                          {b.origin}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <BookingActions booking={b} basePrice={property.basePrice} />
                      </td>
                    </tr>
                  ))}
                  {property.bookings.filter(b => b.payment_status !== 'PENDING').length === 0 && <tr><td colSpan={4} className="py-8 text-center text-sm text-gray-400 italic">No upcoming bookings.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
