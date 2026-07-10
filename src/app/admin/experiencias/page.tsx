'use client';

import React, { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle, Utensils, Map } from 'lucide-react';

export default function AdminExperiencias() {
  const [foodServices, setFoodServices] = useState<any[]>([]);
  const [tours, setTours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [foodRes, toursRes] = await Promise.all([
        fetch('/api/admin/food'),
        fetch('/api/admin/tours')
      ]);
      
      if (foodRes.ok) setFoodServices(await foodRes.json());
      if (toursRes.ok) setTours(await toursRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
      setMessage({ type: 'error', text: 'Error al cargar los datos' });
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
        setMessage({ type: 'success', text: `Guardado: ${service.name}` });
      } else {
        setMessage({ type: 'error', text: 'Error al guardar servicio' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de red' });
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
        setMessage({ type: 'success', text: `Guardado: ${tour.name}` });
      } else {
        setMessage({ type: 'error', text: 'Error al guardar tour' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de red' });
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
        <h2 className="text-3xl font-serif text-[#23211F]">Servicios y Tours</h2>
        <p className="text-gray-500 font-light mt-2">
          Configura los precios para los servicios de comida y los destinos de tour. 
          Estos se mostrarán automáticamente en las páginas de reservas correspondientes. (Los precios son en USD)
        </p>
      </div>

      {message && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl flex items-center gap-3 shadow-lg ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          <AlertCircle size={20} />
          <span className="font-medium">{message.text}</span>
        </div>
      )}

      {/* Food Services Table */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#9B7E67]/10 flex items-center justify-center">
              <Utensils className="text-[#9B7E67] w-5 h-5" />
            </div>
            <h3 className="text-2xl font-serif text-[#23211F]">Servicios de Comida</h3>
          </div>
          <button 
            onClick={() => setFoodServices([{ id: 0, name: 'Nuevo Servicio', price: 0, isActive: true }, ...foodServices])}
            className="text-sm font-bold text-[#9B7E67] hover:text-[#23211F] transition-colors"
          >
            + Añadir Servicio
          </button>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="border-b border-gray-100 p-6 text-xs uppercase tracking-widest font-bold text-gray-400">Servicio</th>
                <th className="border-b border-gray-100 p-6 text-xs uppercase tracking-widest font-bold text-gray-400">Precio (USD/Pax)</th>
                <th className="border-b border-gray-100 p-6 text-xs uppercase tracking-widest font-bold text-gray-400 text-center">Activo</th>
                <th className="border-b border-gray-100 p-6 text-xs uppercase tracking-widest font-bold text-gray-400 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {foodServices.length === 0 ? (
                <tr><td colSpan={4} className="p-6 text-center text-gray-500">No hay servicios de comida registrados.</td></tr>
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
                        Guardar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Tour Destinations Table */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#9B7E67]/10 flex items-center justify-center">
              <Map className="text-[#9B7E67] w-5 h-5" />
            </div>
            <h3 className="text-2xl font-serif text-[#23211F]">Destinos de Tours</h3>
          </div>
          <button 
            onClick={() => setTours([{ id: 0, name: 'Nuevo Destino', pricePerPax: 0, isActive: true }, ...tours])}
            className="text-sm font-bold text-[#9B7E67] hover:text-[#23211F] transition-colors"
          >
            + Añadir Destino
          </button>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="border-b border-gray-100 p-6 text-xs uppercase tracking-widest font-bold text-gray-400">Destino</th>
                <th className="border-b border-gray-100 p-6 text-xs uppercase tracking-widest font-bold text-gray-400">Precio (USD/Pax)</th>
                <th className="border-b border-gray-100 p-6 text-xs uppercase tracking-widest font-bold text-gray-400 text-center">Activo</th>
                <th className="border-b border-gray-100 p-6 text-xs uppercase tracking-widest font-bold text-gray-400 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {tours.length === 0 ? (
                <tr><td colSpan={4} className="p-6 text-center text-gray-500">No hay destinos de tour registrados.</td></tr>
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
                        Guardar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}
