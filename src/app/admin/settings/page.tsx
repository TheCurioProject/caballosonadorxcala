import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import React from 'react';
import { createCoupon } from '@/lib/stripe';
import AdminEmailsEditor from './AdminEmailsEditor';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  let property: any = null;
  try {
    const fetchProp = prisma.property.findFirst();
    const timeout = new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Prisma timeout')), 12000));
    property = await Promise.race([fetchProp, timeout]);
  } catch (error) {
    console.warn("Failed to fetch settings property from Prisma:", error);
  }

  if (!property) {
    property = {
      id: 1,
      name: 'Casa Caballo Soñador',
      baseCapacity: 12,
      basePrice: 1500,
      adminEmails: 'kelli9@telus.net'
    };
  }

  // Server Actions for this page
  async function updateSettings(formData: FormData) {
    'use server';
    const basePrice = parseFloat(formData.get('basePrice') as string);
    const baseCapacity = parseInt(formData.get('baseCapacity') as string, 10);
    const adminEmails = formData.get('adminEmails') as string || 'kelli9@telus.net';
    
    if (!isNaN(basePrice) && !isNaN(baseCapacity)) {
      await prisma.property.update({
        where: { id: property!.id },
        data: { 
          basePrice, 
          baseCapacity,
          adminEmails
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

  async function updateAdminCredentials(formData: FormData) {
    'use server';
    const newUsername = formData.get('newUsername') as string;
    const newPassword = formData.get('newPassword') as string;
    
    if (newUsername && newPassword) {
      const session = await getSession();
      if (!session || !session?.user?.id) {
        return;
      }
      
      const hash = await bcrypt.hash(newPassword, 10);
      
      await prisma.adminUser.update({
        where: { id: session.user.id },
        data: {
          email: newUsername,
          passwordHash: hash
        }
      });
      
      const cookieStore = await cookies();
      cookieStore.delete('admin_session');
      redirect('/admin/login');
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div className="mb-4 sm:mb-8">
        <h2 className="text-2xl sm:text-4xl font-serif text-[#23211F]">Settings & Rules</h2>
        <p className="text-gray-500 font-light mt-1 sm:mt-2 text-sm sm:text-base">
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
              <input type="number" name="basePrice" defaultValue={property.basePrice} required className="w-full border border-gray-200 rounded-xl px-3 py-3 sm:py-2 text-[#23211F] text-base sm:text-sm focus:outline-none focus:border-[#9B7E67]" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Base Capacity</label>
              <input type="number" name="baseCapacity" defaultValue={property.baseCapacity} required className="w-full border border-gray-200 rounded-xl px-3 py-3 sm:py-2 text-[#23211F] text-base sm:text-sm focus:outline-none focus:border-[#9B7E67]" />
            </div>
            <div>
              <AdminEmailsEditor initialEmails={property.adminEmails} />
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
              <input type="text" name="name" required placeholder="e.g. SUMMER20" className="w-full border border-gray-200 rounded-xl px-3 py-3 sm:py-2 text-[#23211F] text-base sm:text-sm focus:outline-none focus:border-[#9B7E67]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Type</label>
                <select name="type" className="w-full border border-gray-200 rounded-xl px-3 py-3 sm:py-2 text-[#23211F] text-base sm:text-sm focus:outline-none focus:border-[#9B7E67]">
                  <option value="percent">Percentage (%)</option>
                  <option value="amount">Fixed Amount ($)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Value</label>
                <input type="number" name="amount" required className="w-full border border-gray-200 rounded-xl px-3 py-3 sm:py-2 text-[#23211F] text-base sm:text-sm focus:outline-none focus:border-[#9B7E67]" />
              </div>
            </div>
            <button type="submit" className="w-full bg-[#23211F] hover:bg-[#9B7E67] text-white font-bold text-xs tracking-widest uppercase py-3 rounded-xl transition-all duration-300">
              CREATE COUPON
            </button>
          </form>
          <p className="text-[10px] text-gray-400 mt-4 text-center">Coupons will appear in the Stripe dashboard.</p>
        </div>

        {/* Update Credentials Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:col-span-2">
          <h2 className="text-lg font-serif text-[#23211F] mb-4">Update Administrator Credentials</h2>
          <form action={updateAdminCredentials} className="space-y-4 max-w-xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">New Username (Email)</label>
                <input type="text" name="newUsername" required placeholder="admin" className="w-full border border-gray-200 rounded-xl px-3 py-3 sm:py-2 text-[#23211F] text-base sm:text-sm focus:outline-none focus:border-[#9B7E67]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">New Password</label>
                <input type="password" name="newPassword" required className="w-full border border-gray-200 rounded-xl px-3 py-3 sm:py-2 text-[#23211F] text-base sm:text-sm focus:outline-none focus:border-[#9B7E67]" />
              </div>
            </div>
            <button type="submit" className="w-full sm:w-auto bg-[#9c2b2b] hover:bg-[#7a2222] text-white font-bold text-xs tracking-widest uppercase py-3 px-8 rounded-xl transition-all duration-300 mt-2">
              UPDATE CREDENTIALS & LOGOUT
            </button>
            <p className="text-[10px] text-gray-400 mt-2">You will be logged out immediately upon updating these credentials.</p>
          </form>
        </div>
      </div>
    </div>
  );
}
