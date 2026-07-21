'use client';

import React, { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle, Utensils, Map } from 'lucide-react';

export default function AdminExperiencias() {
  const [foodServices, setFoodServices] = useState<any[]>([]);
  const [tours, setTours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [minTourPax, setMinTourPax] = useState(3);
  const [maxTourPax, setMaxTourPax] = useState(10);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [foodRes, toursRes, settingsRes] = await Promise.all([
        fetch('/api/admin/food'),
        fetch('/api/admin/tours'),
        fetch('/api/settings/tours')
      ]);
      
      if (foodRes.ok) setFoodServices(await foodRes.json());
      if (toursRes.ok) setTours(await toursRes.json());
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        setMinTourPax(settings.minTourPax || 3);
        setMaxTourPax(settings.maxTourPax || 10);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setMessage({ type: 'error', text: 'Error loading data' });
    } finally {
      setLoading(false);
    }
  };

  const handleFoodChange = (id: number, field: string, value: any) => {
    setFoodServices(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const handleTourChange = (id: number, field: string, value: any) => {
    setTours(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleSaveFood = async (service: any) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...service, price: parseFloat(service.price) })
      });
      if (res.ok) {
        setMessage({ type: 'success', text: `Saved: ${service.name}` });
      } else {
        setMessage({ type: 'error', text: 'Failed to save service' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleSaveTour = async (tour: any) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/tours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...tour, pricePerPax: parseFloat(tour.pricePerPax) })
      });
      if (res.ok) {
        setMessage({ type: 'success', text: `Saved: ${tour.name}` });
      } else {
        setMessage({ type: 'error', text: 'Failed to save tour' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings/tours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minTourPax, maxTourPax })
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully' });
      } else {
        setMessage({ type: 'error', text: 'Failed to save settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-12">
      <div>
        <h2 className="text-3xl font-serif text-[#23211F]">Services & Tours</h2>
        <p className="text-gray-500 font-light mt-2">
          Configure prices for food services and tour destinations. 
          These will be automatically displayed on the booking pages. (Prices in MXN)
        </p>
      </div>

      {message && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl flex items-center gap-3 shadow-lg ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          <AlertCircle size={20} />
          <span className="font-medium">{message.text}</span>
        </div>
      )}

      {/* Food Services Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#9B7E67]/10 flex items-center justify-center">
              <Utensils className="text-[#9B7E67] w-5 h-5" />
            </div>
            <h3 className="text-2xl font-serif text-[#23211F]">Food Services</h3>
          </div>
          <button 
            onClick={() => setFoodServices([{ id: 0, name: 'New Service', price: 0, isActive: true }, ...foodServices])}
            className="text-sm font-bold text-[#9B7E67] hover:text-[#23211F] transition-colors"
          >
            + Add Service
          </button>
        </div>

        {/* Mobile View: Cards */}
        <div className="space-y-4 sm:hidden">
          {foodServices.length === 0 ? (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center text-gray-500">
              No food services registered.
            </div>
          ) : (
            foodServices.map((service) => (
              <div key={service.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Service Name</label>
                  <input 
                    type="text" 
                    value={service.name}
                    onChange={(e) => handleFoodChange(service.id, 'name', e.target.value)}
                    className="w-full bg-[#F9F7F4] border-none rounded-xl px-4 py-2.5 text-[#23211F] font-medium text-sm focus:ring-2 focus:ring-[#9B7E67]"
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Price (MXN/Pax)</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                      <input 
                        type="number" 
                        value={service.price}
                        onChange={(e) => handleFoodChange(service.id, 'price', e.target.value)}
                        className="w-full pl-8 pr-3 py-2.5 bg-[#F9F7F4] border-none rounded-xl text-[#23211F] font-medium text-sm focus:ring-2 focus:ring-[#9B7E67]"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-center shrink-0">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Active</label>
                    <input 
                      type="checkbox"
                      checked={service.isActive}
                      onChange={(e) => handleFoodChange(service.id, 'isActive', e.target.checked)}
                      className="w-6 h-6 rounded text-[#9B7E67] focus:ring-[#9B7E67] border-gray-300"
                    />
                  </div>
                </div>
                <button 
                  onClick={() => handleSaveFood(service)}
                  disabled={saving}
                  className="w-full py-3 bg-[#23211F] text-white rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#9B7E67] transition-colors shadow-sm disabled:opacity-50"
                >
                  <Save size={16} />
                  Save Service
                </button>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden sm:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr>
                <th className="border-b border-gray-100 p-6 text-xs uppercase tracking-widest font-bold text-gray-400">Service</th>
                <th className="border-b border-gray-100 p-6 text-xs uppercase tracking-widest font-bold text-gray-400">Price (MXN/Pax)</th>
                <th className="border-b border-gray-100 p-6 text-xs uppercase tracking-widest font-bold text-gray-400 text-center">Active</th>
                <th className="border-b border-gray-100 p-6 text-xs uppercase tracking-widest font-bold text-gray-400 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {foodServices.length === 0 ? (
                <tr><td colSpan={4} className="p-6 text-center text-gray-500">No food services registered.</td></tr>
              ) : (
                foodServices.map((service) => (
                  <tr key={service.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="p-6">
                      <input 
                        type="text" 
                        value={service.name}
                        onChange={(e) => handleFoodChange(service.id, 'name', e.target.value)}
                        className="w-full bg-transparent border-none p-0 focus:ring-0 text-[#23211F] font-medium"
                      />
                    </td>
                    <td className="p-6">
                      <div className="relative w-32">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input 
                          type="number" 
                          value={service.price}
                          onChange={(e) => handleFoodChange(service.id, 'price', e.target.value)}
                          className="w-full pl-8 pr-4 py-2 bg-[#F9F7F4] border-none rounded-xl focus:ring-2 focus:ring-[#9B7E67] text-[#23211F] font-medium"
                        />
                      </div>
                    </td>
                    <td className="p-6 text-center">
                      <input 
                        type="checkbox"
                        checked={service.isActive}
                        onChange={(e) => handleFoodChange(service.id, 'isActive', e.target.checked)}
                        className="w-5 h-5 rounded text-[#9B7E67] focus:ring-[#9B7E67] border-gray-300"
                      />
                    </td>
                    <td className="p-6 text-right">
                      <button 
                        onClick={() => handleSaveFood(service)}
                        disabled={saving}
                        className="inline-flex items-center gap-2 bg-[#23211F] text-white px-5 py-2.5 rounded-xl hover:bg-[#9B7E67] transition-colors text-sm font-medium disabled:opacity-50 shadow-sm"
                      >
                        <Save size={16} />
                        Save
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Tour Destinations Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#9B7E67]/10 flex items-center justify-center">
              <Map className="text-[#9B7E67] w-5 h-5" />
            </div>
            <h3 className="text-2xl font-serif text-[#23211F]">Tour Destinations</h3>
          </div>
          <button 
            onClick={() => setTours([{ id: 0, name: 'New Destination', pricePerPax: 0, isActive: true }, ...tours])}
            className="text-sm font-bold text-[#9B7E67] hover:text-[#23211F] transition-colors"
          >
            + Add Destination
          </button>
        </div>

        {/* Mobile View: Cards */}
        <div className="space-y-4 sm:hidden">
          {tours.length === 0 ? (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center text-gray-500">
              No tour destinations registered.
            </div>
          ) : (
            tours.map((tour) => (
              <div key={tour.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Destination Name</label>
                  <input 
                    type="text" 
                    value={tour.name}
                    onChange={(e) => handleTourChange(tour.id, 'name', e.target.value)}
                    className="w-full bg-[#F9F7F4] border-none rounded-xl px-4 py-2.5 text-[#23211F] font-medium text-sm focus:ring-2 focus:ring-[#9B7E67]"
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Price (MXN/Pax)</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                      <input 
                        type="number" 
                        value={tour.pricePerPax}
                        onChange={(e) => handleTourChange(tour.id, 'pricePerPax', e.target.value)}
                        className="w-full pl-8 pr-3 py-2.5 bg-[#F9F7F4] border-none rounded-xl text-[#23211F] font-medium text-sm focus:ring-2 focus:ring-[#9B7E67]"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-center shrink-0">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Active</label>
                    <input 
                      type="checkbox"
                      checked={tour.isActive}
                      onChange={(e) => handleTourChange(tour.id, 'isActive', e.target.checked)}
                      className="w-6 h-6 rounded text-[#9B7E67] focus:ring-[#9B7E67] border-gray-300"
                    />
                  </div>
                </div>
                <button 
                  onClick={() => handleSaveTour(tour)}
                  disabled={saving}
                  className="w-full py-3 bg-[#23211F] text-white rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#9B7E67] transition-colors shadow-sm disabled:opacity-50"
                >
                  <Save size={16} />
                  Save Destination
                </button>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden sm:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr>
                <th className="border-b border-gray-100 p-6 text-xs uppercase tracking-widest font-bold text-gray-400">Destination</th>
                <th className="border-b border-gray-100 p-6 text-xs uppercase tracking-widest font-bold text-gray-400">Price (MXN/Pax)</th>
                <th className="border-b border-gray-100 p-6 text-xs uppercase tracking-widest font-bold text-gray-400 text-center">Active</th>
                <th className="border-b border-gray-100 p-6 text-xs uppercase tracking-widest font-bold text-gray-400 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {tours.length === 0 ? (
                <tr><td colSpan={4} className="p-6 text-center text-gray-500">No tour destinations registered.</td></tr>
              ) : (
                tours.map((tour) => (
                  <tr key={tour.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="p-6">
                      <input 
                        type="text" 
                        value={tour.name}
                        onChange={(e) => handleTourChange(tour.id, 'name', e.target.value)}
                        className="w-full bg-transparent border-none p-0 focus:ring-0 text-[#23211F] font-medium"
                      />
                    </td>
                    <td className="p-6">
                      <div className="relative w-32">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input 
                          type="number" 
                          value={tour.pricePerPax}
                          onChange={(e) => handleTourChange(tour.id, 'pricePerPax', e.target.value)}
                          className="w-full pl-8 pr-4 py-2 bg-[#F9F7F4] border-none rounded-xl focus:ring-2 focus:ring-[#9B7E67] text-[#23211F] font-medium"
                        />
                      </div>
                    </td>
                    <td className="p-6 text-center">
                      <input 
                        type="checkbox"
                        checked={tour.isActive}
                        onChange={(e) => handleTourChange(tour.id, 'isActive', e.target.checked)}
                        className="w-5 h-5 rounded text-[#9B7E67] focus:ring-[#9B7E67] border-gray-300"
                      />
                    </td>
                    <td className="p-6 text-right">
                      <button 
                        onClick={() => handleSaveTour(tour)}
                        disabled={saving}
                        className="inline-flex items-center gap-2 bg-[#23211F] text-white px-5 py-2.5 rounded-xl hover:bg-[#9B7E67] transition-colors text-sm font-medium disabled:opacity-50 shadow-sm"
                      >
                        <Save size={16} />
                        Save
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Global Tour Settings */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#9B7E67]/10 flex items-center justify-center">
            <Map className="text-[#9B7E67] w-5 h-5" />
          </div>
          <h3 className="text-2xl font-serif text-[#23211F]">Global Tour Settings</h3>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-8 flex flex-col md:flex-row gap-6 md:items-end">
          <div className="flex-1">
            <label className="block text-xs uppercase tracking-widest font-bold text-gray-500 mb-3">Minimum Guests</label>
            <input
              type="number"
              min="1"
              value={minTourPax}
              onChange={(e) => setMinTourPax(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-3 bg-[#F9F7F4] border-none rounded-xl focus:ring-2 focus:ring-[#9B7E67] text-[#23211F] font-medium"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs uppercase tracking-widest font-bold text-gray-500 mb-3">Maximum Guests</label>
            <input
              type="number"
              min="1"
              value={maxTourPax}
              onChange={(e) => setMaxTourPax(parseInt(e.target.value) || 10)}
              className="w-full px-4 py-3 bg-[#F9F7F4] border-none rounded-xl focus:ring-2 focus:ring-[#9B7E67] text-[#23211F] font-medium"
            />
          </div>
          <button 
            onClick={handleSaveSettings}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 bg-[#23211F] text-white px-8 py-3 rounded-xl hover:bg-[#9B7E67] transition-colors text-sm font-medium disabled:opacity-50 shadow-sm w-full md:w-auto h-[48px]"
          >
            <Save size={16} />
            Save Settings
          </button>
        </div>
      </section>

    </div>
  );
}
