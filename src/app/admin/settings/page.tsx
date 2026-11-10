import { revalidatePublicSite } from '@/lib/revalidatePublic';
import { requireAdmin, requireAdminPage } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import React from 'react';
import { createCoupon } from '@/lib/stripe';
import AdminEmailsEditor from './AdminEmailsEditor';
import SaveSettingsButton from './SaveSettingsButton';
import {supabaseServerClient} from '@/cala/infrastructure/supabase/server';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getServiceBlockedDates } from './service-actions';
import ServiceAvailabilitySection from './ServiceAvailabilitySection';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  await requireAdminPage();
  let property: any = null;
  try {
    const fetchProp = prisma.property.findFirst();
    const timeout = new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Prisma timeout')), 12000));
    property = await Promise.race([fetchProp, timeout]);
  } catch (error) {
    console.warn("Failed to fetch settings property from Prisma:", error);
  }

  if(!property)throw new Error('No se pudo cargar la configuración. Revisa la conexión de Supabase.');

  const allServiceBlocks = await getServiceBlockedDates();
  const foodBlocks = allServiceBlocks.filter(b => b.serviceType === 'FOOD');
  const tourBlocks = allServiceBlocks.filter(b => b.serviceType === 'TOUR');

  // Server Actions for this page
  async function updateSettings(formData: FormData) {
    'use server';
    await requireAdmin();
    // Nightly price and capacity are managed in CALA (Inventario / Tarifas);
    // this form only keeps the website's contact and notification details.
    const adminEmails = formData.get('adminEmails') as string || 'kelli9@telus.net';
    const whatsappNumber = formData.get('whatsappNumber') as string || '';

    await prisma.property.update({
      where: { id: property!.id },
      data: {
        adminEmails,
        whatsappNumber
      }
    });
    revalidatePath('/admin/settings');
    revalidatePublicSite();
  }

  async function handleCreateCoupon(formData: FormData) {
    'use server';
    await requireAdmin();
    const name = formData.get('name') as string;
    const type = formData.get('type') as string;
    const amount = parseFloat(formData.get('amount') as string);
    
    if (name && Number.isFinite(amount) && amount > 0 && (type !== 'percent' || amount <= 100)) {
      if (type === 'percent') {
        await createCoupon(name, null, amount);
      } else {
        await createCoupon(name, amount, null);
      }
      revalidatePath('/admin/settings');
      revalidatePublicSite();
    }
  }

  async function updateAdminCredentials(formData: FormData) {
    'use server';
    await requireAdmin();
    const newUsername = formData.get('newUsername') as string;
    const newPassword = formData.get('newPassword') as string;
    
    if (newUsername && newPassword) {
      const session = await getSession();
      if (!session || !session?.user?.id) {
        return;
      }
      
      const client=await supabaseServerClient();
      const {error}=await client.auth.updateUser({email:newUsername,password:newPassword});
      if(error)throw new Error('No se pudo actualizar el acceso. Reautentícate y revisa la política de Supabase.');
      await client.auth.signOut();
      redirect('/admin/login');
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div className="mb-4 sm:mb-8">
        <h2 className="text-2xl sm:text-4xl font-serif text-[#23211F]">Website Settings</h2>
        <p className="text-gray-500 font-light mt-1 sm:mt-2 text-sm sm:text-base">
          Contact details, coupons and service availability for the public website.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Settings Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-serif text-[#23211F] mb-1">Website Contact & Notifications</h2>
          <p className="text-xs text-gray-500 mb-4">Prices, capacity and booking rules are managed in CALA (Inventory and Rates).</p>
          <form action={updateSettings} className="space-y-4">
            <div>
              <label className="block text-xs md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">WhatsApp Number (incl. country code)</label>
              <input type="text" name="whatsappNumber" defaultValue={property.whatsappNumber} placeholder="e.g. +521234567890" className="w-full border border-gray-200 rounded-xl px-3 py-3 sm:py-2 text-[#23211F] text-base sm:text-sm focus:outline-none focus:border-[#9B7E67]" />
            </div>
            <div>
              <AdminEmailsEditor initialEmails={property.adminEmails} />
            </div>
            <SaveSettingsButton />
          </form>
        </div>

        {/* Coupon Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-serif text-[#23211F] mb-4">Create Discount Coupon (Stripe)</h2>
          <form action={handleCreateCoupon} className="space-y-4">
            <div>
              <label className="block text-xs md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Name / Code</label>
              <input type="text" name="name" required placeholder="e.g. SUMMER20" className="w-full border border-gray-200 rounded-xl px-3 py-3 sm:py-2 text-[#23211F] text-base sm:text-sm focus:outline-none focus:border-[#9B7E67]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Type</label>
                <select name="type" className="w-full border border-gray-200 rounded-xl px-3 py-3 sm:py-2 text-[#23211F] text-base sm:text-sm focus:outline-none focus:border-[#9B7E67]">
                  <option value="percent">Percentage (%)</option>
                  <option value="amount">Fixed Amount ($)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Value</label>
                <input type="number" name="amount" required className="w-full border border-gray-200 rounded-xl px-3 py-3 sm:py-2 text-[#23211F] text-base sm:text-sm focus:outline-none focus:border-[#9B7E67]" />
              </div>
            </div>
            <button type="submit" className="w-full bg-[#23211F] hover:bg-[#9B7E67] text-white font-bold text-xs tracking-widest uppercase py-3 rounded-xl transition-all duration-300">
              CREATE COUPON
            </button>
          </form>
          <p className="text-xs md:text-[10px] text-gray-400 mt-4 text-center">Coupons will appear in the Stripe dashboard.</p>
        </div>

        {/* Service Availability Section */}
        <ServiceAvailabilitySection foodBlocks={foodBlocks} tourBlocks={tourBlocks} />

        {/* Update Credentials Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:col-span-2">
          <h2 className="text-lg font-serif text-[#23211F] mb-4">Update Administrator Credentials</h2>
          <form action={updateAdminCredentials} className="space-y-4 max-w-xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">New Username (Email)</label>
                <input type="text" name="newUsername" required placeholder="admin" className="w-full border border-gray-200 rounded-xl px-3 py-3 sm:py-2 text-[#23211F] text-base sm:text-sm focus:outline-none focus:border-[#9B7E67]" />
              </div>
              <div>
                <label className="block text-xs md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">New Password</label>
                <input type="password" name="newPassword" required className="w-full border border-gray-200 rounded-xl px-3 py-3 sm:py-2 text-[#23211F] text-base sm:text-sm focus:outline-none focus:border-[#9B7E67]" />
              </div>
            </div>
            <button type="submit" className="w-full sm:w-auto bg-[#9c2b2b] hover:bg-[#7a2222] text-white font-bold text-xs tracking-widest uppercase py-3 px-8 rounded-xl transition-all duration-300 mt-2">
              ACTUALIZAR ACCESO DE SUPABASE
            </button>
            <p className="text-xs md:text-[10px] text-gray-400 mt-2">Supabase puede pedir confirmación del nuevo correo. Deberás iniciar sesión de nuevo.</p>
          </form>
        </div>
      </div>
    </div>
  );
}
