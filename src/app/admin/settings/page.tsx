import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import React from 'react';
import { createCoupon } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  let property = await prisma.property.findFirst();

  if (!property) {
    property = await prisma.property.create({
      data: {
        name: 'Casa del Caballo Soñador',
        baseCapacity: 12,
        basePrice: 1500
      }
    });
  }

  // Server Actions for this page
  async function updateSettings(formData: FormData) {
    'use server';
    const basePrice = parseFloat(formData.get('basePrice') as string);
    const baseCapacity = parseInt(formData.get('baseCapacity') as string, 10);
    const checkInTime = formData.get('checkInTime') as string;
    const checkOutTime = formData.get('checkOutTime') as string;
    
    if (!isNaN(basePrice) && !isNaN(baseCapacity)) {
      await prisma.property.update({
        where: { id: property!.id },
        data: { 
          basePrice, 
          baseCapacity,
          checkInTime: checkInTime || "15:00",
          checkOutTime: checkOutTime || "12:00"
        }
      });
      revalidatePath('/admin/settings');
    }
  }

  async function handleCreateCoupon(formData: FormData) {
    'use server';
    const name = formData.get('name') as string;
    const type = formData.get('type') as string;
    const amount = parseFloat(formData.get('amount') as string);
    
    if (name && !isNaN(amount)) {
      if (type === 'percent') {
        await createCoupon(name, null, amount);
      } else {
        await createCoupon(name, amount, null);
      }
      revalidatePath('/admin/settings');
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div className="mb-8">
        <h2 className="text-4xl font-serif text-[#23211F]">Settings & Rules</h2>
        <p className="text-gray-500 font-light mt-2">
          Configure the global rules and pricing of the property.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Settings Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-serif text-[#23211F] mb-4">Base House Rules</h2>
          <form action={updateSettings} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Base Price per Night (MXN)</label>
              <input type="number" name="basePrice" defaultValue={property.basePrice} required className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[#23211F] text-sm focus:outline-none focus:border-[#9B7E67]" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Base Capacity</label>
              <input type="number" name="baseCapacity" defaultValue={property.baseCapacity} required className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[#23211F] text-sm focus:outline-none focus:border-[#9B7E67]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Check-in Time</label>
                <input type="time" name="checkInTime" defaultValue={property.checkInTime || "15:00"} required className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[#23211F] text-sm focus:outline-none focus:border-[#9B7E67]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Check-out Time</label>
                <input type="time" name="checkOutTime" defaultValue={property.checkOutTime || "12:00"} required className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[#23211F] text-sm focus:outline-none focus:border-[#9B7E67]" />
              </div>
            </div>
            <button type="submit" className="w-full bg-[#23211F] hover:bg-[#9B7E67] text-white font-bold text-xs tracking-widest uppercase py-3 rounded-xl transition-all duration-300">
              SAVE SETTINGS
            </button>
          </form>
        </div>

        {/* Coupon Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-serif text-[#23211F] mb-4">Create Discount Coupon (Stripe)</h2>
          <form action={handleCreateCoupon} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Name / Code</label>
              <input type="text" name="name" required placeholder="e.g. SUMMER20" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[#23211F] text-sm focus:outline-none focus:border-[#9B7E67]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Type</label>
                <select name="type" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[#23211F] text-sm focus:outline-none focus:border-[#9B7E67]">
                  <option value="percent">Percentage (%)</option>
                  <option value="amount">Fixed Amount ($)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Value</label>
                <input type="number" name="amount" required className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[#23211F] text-sm focus:outline-none focus:border-[#9B7E67]" />
              </div>
            </div>
            <button type="submit" className="w-full bg-[#23211F] hover:bg-[#9B7E67] text-white font-bold text-xs tracking-widest uppercase py-3 rounded-xl transition-all duration-300">
              CREATE COUPON
            </button>
          </form>
          <p className="text-[10px] text-gray-400 mt-4 text-center">Coupons will appear in the Stripe dashboard.</p>
        </div>
      </div>
    </div>
  );
}
