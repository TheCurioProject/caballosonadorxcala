import { ReactNode } from 'react';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-[#F9F7F4] text-[#23211F]">
      {/* Sidebar */}
      <aside className="w-64 bg-[#2C2927] text-[#F9F7F4] flex flex-col shadow-xl z-20 hidden md:flex">
        <div className="p-8 border-b border-[#F9F7F4]/10">
          <h1 className="font-serif text-2xl font-bold tracking-wide text-[#9B7E67]">Casa Soñador</h1>
          <p className="text-xs font-light opacity-60 uppercase tracking-widest mt-2">Admin Panel</p>
        </div>
        <nav className="flex-1 py-8 px-4 flex flex-col space-y-2">
          <Link href="/admin" className="px-4 py-3 rounded-lg hover:bg-[#9B7E67] transition-colors font-medium text-sm">Dashboard</Link>
          <Link href="/admin/bookings" className="px-4 py-3 rounded-lg hover:bg-[#9B7E67] transition-colors font-medium text-sm">Bookings</Link>
          <Link href="/admin/calendar" className="px-4 py-3 rounded-lg hover:bg-[#9B7E67] transition-colors font-medium text-sm">Master Calendar</Link>
          <Link href="/admin/experiences" className="px-4 py-3 rounded-lg hover:bg-[#9B7E67] transition-colors font-medium text-sm">Experiences</Link>
          <Link href="/admin/stripe" className="px-4 py-3 rounded-lg hover:bg-[#9B7E67] transition-colors font-medium text-sm">Stripe / Payments</Link>
          <Link href="/admin/settings" className="px-4 py-3 rounded-lg hover:bg-[#9B7E67] transition-colors font-medium text-sm">Settings & Rules</Link>
          <Link href="/admin/ical" className="px-4 py-3 rounded-lg hover:bg-[#9B7E67] transition-colors font-medium text-sm">iCal Integrations</Link>
        </nav>
        <div className="p-8 border-t border-[#F9F7F4]/10 text-xs opacity-50">
          v1.0.0
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
