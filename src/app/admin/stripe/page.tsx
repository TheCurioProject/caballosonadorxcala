import React from 'react';
import { listCoupons, deleteCoupon, getRecentPayments, getAccountBalance } from '@/lib/stripe';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export default async function AdminStripePage() {
  const coupons = await listCoupons();
  const recentPayments = await getRecentPayments();
  const balance = await getAccountBalance();

  async function handleDeleteCoupon(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    if (id) {
      await deleteCoupon(id);
      revalidatePath('/admin/stripe');
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div className="mb-8">
        <h2 className="text-4xl font-serif text-[#23211F]">Stripe / Payments</h2>
        <p className="text-gray-500 font-light mt-2">
          Management of payments, coupons, and account balance.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Stats & Balance */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            </div>
            <h2 className="text-lg font-serif text-[#23211F] mb-2">Stripe Balance</h2>
            {balance ? (
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Available</p>
                  <p className="text-3xl font-serif text-[#9B7E67]">
                    ${((balance.available[0]?.amount || 0) / 100).toFixed(2)} <span className="text-sm text-gray-400">{balance.available[0]?.currency.toUpperCase() || 'MXN'}</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Pending</p>
                  <p className="text-xl font-serif text-gray-500">
                    ${((balance.pending[0]?.amount || 0) / 100).toFixed(2)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-4 text-sm text-gray-500 italic">
                Could not connect to Stripe. Check your API Key.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Coupons & Payments */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Coupons Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center">
              <h2 className="font-serif text-[#23211F] text-xl">Active Coupons</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max">
                <thead>
                  <tr className="bg-[#F9F7F4] text-[10px] font-bold text-gray-400 uppercase tracking-widest text-left">
                    <th className="py-4 px-6">Code / Name</th>
                    <th className="py-4 px-6 text-center">Discount</th>
                    <th className="py-4 px-6 text-center">Duration</th>
                    <th className="py-4 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-sm">
                  {coupons.map((coupon) => (
                    <tr key={coupon.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6 font-medium text-[#23211F]">{coupon.name || coupon.id}</td>
                      <td className="py-4 px-6 text-center font-serif text-[#9B7E67]">
                        {coupon.amount_off ? `$${(coupon.amount_off / 100).toFixed(2)} MXN` : `${coupon.percent_off}%`}
                      </td>
                      <td className="py-4 px-6 text-center text-gray-500 capitalize">{coupon.duration}</td>
                      <td className="py-4 px-6 text-right">
                        <form action={handleDeleteCoupon}>
                          <input type="hidden" name="id" value={coupon.id} />
                          <button type="submit" className="text-xs font-bold uppercase tracking-widest text-red-400 hover:text-red-600 transition-colors">
                            Delete
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {coupons.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-sm text-gray-400 italic">No active coupons. Create one from Settings.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Payments */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center">
              <h2 className="font-serif text-[#23211F] text-xl">Recent Payments</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max">
                <thead>
                  <tr className="bg-[#F9F7F4] text-[10px] font-bold text-gray-400 uppercase tracking-widest text-left">
                    <th className="py-4 px-6">Date</th>
                    <th className="py-4 px-6">Amount</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-sm">
                  {recentPayments.map((charge) => (
                    <tr key={charge.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6 text-gray-600">
                        {new Date(charge.created * 1000).toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-4 px-6 font-serif text-[#9B7E67]">
                        ${(charge.amount / 100).toFixed(2)} {charge.currency.toUpperCase()}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase ${charge.status === 'succeeded' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                          {charge.status === 'succeeded' ? 'Paid' : charge.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-500 truncate max-w-[200px]">
                        {charge.description || charge.receipt_email || 'Web Charge'}
                      </td>
                    </tr>
                  ))}
                  {recentPayments.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-sm text-gray-400 italic">No recent payments.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
