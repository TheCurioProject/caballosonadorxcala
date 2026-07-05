'use client';

import React, { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle } from 'lucide-react';

const DEFAULT_ADDONS = [
  { type: 'CHEF_BREAKFAST', name: 'Chef - Desayuno (por persona)' },
  { type: 'CHEF_LUNCH', name: 'Chef - Comida (por persona)' },
  { type: 'CHEF_DINNER', name: 'Chef - Cena (por persona)' },
  { type: 'ATV_OJO_DE_AGUA', name: 'ATV - Ojo de Agua (por persona)' },
  { type: 'ATV_RIO_MOLOTE', name: 'ATV - Río Molote (por persona)' },
  { type: 'ATV_EL_CAPOMO', name: 'ATV - El Capomo (por persona)' },
  { type: 'ATV_LAS_CUEVAS', name: 'ATV - Las Cuevas (por persona)' },
];

export default function AdminExperiencias() {
  const [addons, setAddons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    fetchAddons();
  }, []);

  const fetchAddons = async () => {
    try {
      const res = await fetch('/api/admin/addons');
      if (res.ok) {
        const data = await res.json();
        // Merge with defaults to ensure all fields are shown even if not in DB yet
        const merged = DEFAULT_ADDONS.map(def => {
          const found = data.find((d: any) => d.type === def.type);
          return found ? found : { ...def, price: 0, isActive: true };
        });
        setAddons(merged);
      }
    } catch (error) {
      console.error('Error fetching addons:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (type: string, value: string) => {
    setAddons(prev => prev.map(a => a.type === type ? { ...a, price: parseFloat(value) || 0 } : a));
  };

  const handleSave = async (addon: any) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/addons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addon)
      });
      if (res.ok) {
        setMessage({ type: 'success', text: `Guardado: ${addon.name}` });
      } else {
        setMessage({ type: 'error', text: 'Error al guardar' });
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
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-serif text-[#23211F]">Experiencias y Extras</h2>
        <p className="text-gray-500 font-light mt-2">Configura los precios para los servicios de Chef y Tours ATV. Estos precios se mostrarán en el formulario de reservas (los precios son en USD).</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          <AlertCircle size={20} />
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="border-b border-gray-100 p-6 text-xs uppercase tracking-widest font-bold text-gray-400">Servicio Extra</th>
              <th className="border-b border-gray-100 p-6 text-xs uppercase tracking-widest font-bold text-gray-400">Precio (USD)</th>
              <th className="border-b border-gray-100 p-6 text-xs uppercase tracking-widest font-bold text-gray-400 text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {addons.map((addon) => (
              <tr key={addon.type} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="p-6 font-medium text-[#23211F]">{addon.name}</td>
                <td className="p-6">
                  <div className="relative w-32">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input 
                      type="number" 
                      value={addon.price}
                      onChange={(e) => handlePriceChange(addon.type, e.target.value)}
                      className="w-full pl-8 pr-4 py-3 bg-[#F9F7F4] border-none rounded-xl focus:ring-2 focus:ring-[#9B7E67] text-[#23211F] font-medium"
                    />
                  </div>
                </td>
                <td className="p-6 text-right">
                  <button 
                    onClick={() => handleSave(addon)}
                    disabled={saving}
                    className="inline-flex items-center gap-2 bg-[#23211F] text-white px-6 py-3 rounded-xl hover:bg-[#9B7E67] transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    <Save size={16} />
                    Guardar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
