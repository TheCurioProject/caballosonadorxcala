'use client';

import { CalaSpinner } from "@/cala/components/ui/cala-loader";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit2, Save, X, Plus } from 'lucide-react';

interface StayAmenity {
  id: number;
  titleEs: string;
  titleEn: string;
  shortEs: string;
  shortEn: string;
  descEs: string;
  descEn: string;
}

export default function DuringYourStayAdmin() {
  const [amenities, setAmenities] = useState<StayAmenity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAmenity, setEditingAmenity] = useState<StayAmenity | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [shortDesc, setShortDesc] = useState('');
  const [desc, setDesc] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchAmenities = async () => {
    try {
      const res = await fetch('/api/admin/amenities');
      if (res.ok) {
        const data = await res.json();
        setAmenities(data);
      }
    } catch (error) {
      console.error('Error fetching amenities:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAmenities();
  }, []);

  const openModal = (amenity: StayAmenity) => {
    setEditingAmenity(amenity);
    // Display English text in the form as requested
    setTitle(amenity.titleEn || amenity.titleEs || '');
    setShortDesc(amenity.shortEn || amenity.shortEs || '');
    setDesc(amenity.descEn || amenity.descEs || '');
  };

  const closeModal = () => {
    setEditingAmenity(null);
    setTitle('');
    setShortDesc('');
    setDesc('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAmenity) return;

    setIsSaving(true);
    const formData = new FormData();
    formData.append('id', editingAmenity.id.toString());
    formData.append('title', title);
    formData.append('short', shortDesc);
    formData.append('desc', desc);
    formData.append('lang', 'en');

    try {
      const res = await fetch('/api/admin/amenities', {
        method: 'PUT',
        body: formData,
      });

      if (res.ok) {
        await fetchAmenities();
        closeModal();
      } else {
        alert('Error saving amenity');
      }
    } catch (error) {
      console.error('Error saving amenity:', error);
      alert('Error saving amenity');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <CalaSpinner className="w-12 h-12 text-[#9B7E67]" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl text-[#9B7E67] font-bold mb-2">During Your Stay</h1>
          <p className="text-gray-500">Manage the 6 amenities cards on the homepage. Texts are auto-translated to Spanish on save.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {amenities.map((amenity) => (
          <div key={amenity.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col h-full">
            <h3 className="font-serif text-xl font-bold text-gray-900 mb-2">{amenity.titleEn || amenity.titleEs}</h3>
            <p className="text-sm text-[#9B7E67] mb-4 font-medium">{amenity.shortEn || amenity.shortEs}</p>
            <p className="text-gray-600 text-sm mb-6 flex-grow line-clamp-4">{amenity.descEn || amenity.descEs}</p>
            
            <button
              onClick={() => openModal(amenity)}
              className="w-full py-2.5 bg-gray-50 hover:bg-[#9B7E67] hover:text-white text-gray-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Edit Content
            </button>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {editingAmenity && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={closeModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="font-serif text-xl font-bold text-gray-900">
                  Edit Amenity
                </h2>
                <button
                  onClick={closeModal}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto">
                <form id="amenityForm" onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title (English)</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#9B7E67] focus:border-transparent transition-all text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Short Description (English)</label>
                    <input
                      type="text"
                      value={shortDesc}
                      onChange={(e) => setShortDesc(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#9B7E67] focus:border-transparent transition-all text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Description (English)</label>
                    <textarea
                      value={desc}
                      onChange={(e) => setDesc(e.target.value)}
                      required
                      rows={4}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#9B7E67] focus:border-transparent transition-all text-gray-900"
                    />
                  </div>
                </form>
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-xl transition-colors"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="amenityForm"
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-[#9B7E67] hover:bg-[#8A6D56] text-white font-medium rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <CalaSpinner className="w-5 h-5 text-white" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
