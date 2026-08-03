'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, X, Image as ImageIcon, Loader2, BookOpen, Sparkles } from 'lucide-react';
import Image from 'next/image';

interface Workshop {
  id: number;
  titleEs: string;
  titleEn: string;
  summaryEs: string | null;
  summaryEn: string | null;
  descriptionEs: string;
  descriptionEn: string;
  imageUrl: string | null;
  instructorName: string | null;
  instructorBioEs: string | null;
  instructorBioEn: string | null;
  instructorImageUrl: string | null;
  price: string | null;
  dates: string | null;
  isActive: boolean;
}

export default function WritersGroupAdmin() {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorkshop, setEditingWorkshop] = useState<Workshop | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  // Instructor / Details form state
  const [instructorName, setInstructorName] = useState('');
  const [instructorBio, setInstructorBio] = useState('');
  const [price, setPrice] = useState('');
  const [dates, setDates] = useState('');
  const [instructorImageFile, setInstructorImageFile] = useState<File | null>(null);
  const [instructorImagePreview, setInstructorImagePreview] = useState<string | null>(null);
  const [removeInstructorImage, setRemoveInstructorImage] = useState(false);

  const fetchWorkshops = async () => {
    try {
      const res = await fetch('/api/admin/workshops');
      const data = await res.json();
      setWorkshops(data);
    } catch (error) {
      console.error('Error fetching workshops:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkshops();
  }, []);

  const openModal = (workshop?: Workshop) => {
    if (workshop) {
      setEditingWorkshop(workshop);
      setTitle(workshop.titleEs);
      setSummary(workshop.summaryEs || '');
      setDescription(workshop.descriptionEs);
      setIsActive(workshop.isActive);
      setImagePreview(workshop.imageUrl);
      setImageFile(null);
      setRemoveImage(false);
      setInstructorName(workshop.instructorName || '');
      setInstructorBio(workshop.instructorBioEs || '');
      setPrice(workshop.price || '');
      setDates(workshop.dates || '');
      setInstructorImagePreview(workshop.instructorImageUrl);
      setInstructorImageFile(null);
      setRemoveInstructorImage(false);
    } else {
      setEditingWorkshop(null);
      setTitle('');
      setSummary('');
      setDescription('');
      setIsActive(true);
      setImagePreview(null);
      setImageFile(null);
      setRemoveImage(false);
      setInstructorName('');
      setInstructorBio('');
      setPrice('');
      setDates('');
      setInstructorImagePreview(null);
      setInstructorImageFile(null);
      setRemoveInstructorImage(false);
    }
    setIsModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setRemoveImage(false);
    }
  };

  const handleInstructorImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInstructorImageFile(file);
      setInstructorImagePreview(URL.createObjectURL(file));
      setRemoveInstructorImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append('title', title);
    formData.append('summary', summary);
    formData.append('description', description);
    formData.append('isActive', isActive.toString());
    formData.append('instructorName', instructorName);
    formData.append('instructorBio', instructorBio);
    formData.append('price', price);
    formData.append('dates', dates);
    
    if (imageFile) {
      formData.append('image', imageFile);
    }
    if (removeImage) {
      formData.append('removeImage', 'true');
    }
    if (instructorImageFile) {
      formData.append('instructorImage', instructorImageFile);
    }
    if (removeInstructorImage) {
      formData.append('removeInstructorImage', 'true');
    }

    try {
      const method = editingWorkshop ? 'PUT' : 'POST';
      if (editingWorkshop) {
        formData.append('id', editingWorkshop.id.toString());
      }

      const res = await fetch('/api/admin/workshops', {
        method,
        body: formData,
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchWorkshops();
      } else {
        alert('Error saving workshop');
      }
    } catch (error) {
      console.error(error);
      alert('Error saving workshop');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this workshop?')) {
      try {
        await fetch(`/api/admin/workshops?id=${id}`, { method: 'DELETE' });
        fetchWorkshops();
      } catch (error) {
        console.error(error);
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-serif text-3xl text-[#2C2927]">Writers Group Workshops</h1>
          <p className="text-gray-500 mt-1">Manage Chacala Writers Group workshops and content</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-[#9B7E67] text-white px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-[#8A6D56] transition-colors"
        >
          <Plus size={18} />
          New Workshop
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="animate-spin text-[#9B7E67]" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {workshops.map(workshop => (
            <motion.div
              key={workshop.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white rounded-2xl border ${workshop.isActive ? 'border-gray-200 shadow-sm' : 'border-gray-200/50 opacity-70'} overflow-hidden flex flex-col`}
            >
              {workshop.imageUrl && (
                <div className="relative w-full h-48 bg-gray-100">
                  <Image src={workshop.imageUrl} alt={workshop.titleEs} fill className="object-cover" />
                </div>
              )}
              <div className="p-6 flex-grow flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-serif text-xl font-bold text-[#2C2927] line-clamp-2">{workshop.titleEs}</h3>
                  <div className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${workshop.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {workshop.isActive ? 'Active' : 'Draft'}
                  </div>
                </div>
                <p className="text-gray-500 text-sm line-clamp-3 mb-6 flex-grow whitespace-pre-wrap">{workshop.summaryEs || workshop.descriptionEs}</p>
                
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-auto">
                  <button
                    onClick={() => openModal(workshop)}
                    className="p-2 text-gray-500 hover:text-[#9B7E67] hover:bg-orange-50 rounded-lg transition-colors"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(workshop.id)}
                    className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
          {workshops.length === 0 && (
            <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
              <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">No workshops created yet.</p>
              <button onClick={() => openModal()} className="text-[#9B7E67] hover:underline mt-2">Create your first workshop</button>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-[#F9F7F4]">
                <h2 className="font-serif text-2xl text-[#2C2927]">
                  {editingWorkshop ? 'Edit Workshop' : 'New Workshop'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-grow">
                <form id="workshopForm" onSubmit={handleSubmit} className="space-y-6">
                  
                  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 mb-4">
                    <p className="text-sm text-blue-800 font-medium flex items-center gap-2">
                      <Sparkles size={18} className="text-blue-600 shrink-0" /> Automatic translation active! The system will cleanly generate and display English and Spanish versions.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#9B7E67]/20 focus:border-[#9B7E67] transition-all outline-none"
                      placeholder="e.g. Intensive Poetry Workshop"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Summary <span className="text-gray-400 font-normal">(1-2 lines)</span></label>
                    <textarea
                      rows={2}
                      value={summary}
                      onChange={e => setSummary(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#9B7E67]/20 focus:border-[#9B7E67] transition-all outline-none resize-none"
                      placeholder="Brief description for the main card..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Description</label>
                    <textarea
                      required
                      rows={8}
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#9B7E67]/20 focus:border-[#9B7E67] transition-all outline-none resize-none"
                      placeholder="Complete workshop details..."
                    />
                  </div>

                  <div className="pt-6 border-t border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Main Image (Optional)</label>
                    <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                      <div className="flex-1 w-full">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-gray-500">
                            <ImageIcon size={24} className="mb-2" />
                            <p className="text-sm">Click to upload image</p>
                          </div>
                          <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                        </label>
                      </div>
                      {(imagePreview || (editingWorkshop?.imageUrl && !removeImage)) && (
                        <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                          <Image src={imagePreview || editingWorkshop!.imageUrl!} alt="Preview" fill className="object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              setImageFile(null);
                              setImagePreview(null);
                              setRemoveImage(true);
                            }}
                            className="absolute top-1 right-1 bg-white/90 p-1 rounded-full text-red-500 hover:bg-white shadow-sm"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-100">
                    <h3 className="text-lg font-serif text-[#2C2927] mb-4">Workshop & Instructor Details (Optional)</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Dates (e.g. Nov 12 - Nov 16)</label>
                        <input
                          type="text"
                          value={dates}
                          onChange={e => setDates(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#9B7E67]/20 focus:border-[#9B7E67] transition-all outline-none"
                          placeholder="Workshop dates"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Price (e.g. $1,395 USD)</label>
                        <input
                          type="text"
                          value={price}
                          onChange={e => setPrice(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#9B7E67]/20 focus:border-[#9B7E67] transition-all outline-none"
                          placeholder="Optional price"
                        />
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Instructor Name</label>
                      <input
                        type="text"
                        value={instructorName}
                        onChange={e => setInstructorName(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#9B7E67]/20 focus:border-[#9B7E67] transition-all outline-none"
                        placeholder="Instructor Name"
                      />
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Instructor Bio</label>
                      <textarea
                        rows={4}
                        value={instructorBio}
                        onChange={e => setInstructorBio(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#9B7E67]/20 focus:border-[#9B7E67] transition-all outline-none resize-none"
                        placeholder="Short bio..."
                      />
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Instructor Image</label>
                      <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                        <div className="flex-1 w-full">
                          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-gray-500">
                              <ImageIcon size={24} className="mb-2" />
                              <p className="text-sm">Click to upload image</p>
                            </div>
                            <input type="file" className="hidden" accept="image/*" onChange={handleInstructorImageChange} />
                          </label>
                        </div>
                        {(instructorImagePreview || (editingWorkshop?.instructorImageUrl && !removeInstructorImage)) && (
                          <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                            <Image src={instructorImagePreview || editingWorkshop!.instructorImageUrl!} alt="Preview" fill className="object-cover" />
                            <button
                              type="button"
                              onClick={() => {
                                setInstructorImageFile(null);
                                setInstructorImagePreview(null);
                                setRemoveInstructorImage(true);
                              }}
                              className="absolute top-1 right-1 bg-white/90 p-1 rounded-full text-red-500 hover:bg-white shadow-sm"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <button
                      type="button"
                      onClick={() => setIsActive(!isActive)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${isActive ? 'bg-[#9B7E67]' : 'bg-gray-300'}`}
                    >
                      <motion.div
                        className="w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm"
                        animate={{ left: isActive ? '26px' : '2px' }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    </button>
                    <div>
                      <p className="font-medium text-gray-800 text-sm">Active Status</p>
                      <p className="text-xs text-gray-500">Visible on the public page</p>
                    </div>
                  </div>

                </form>
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="workshopForm"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-[#2C2927] text-white font-medium rounded-lg hover:bg-black transition-colors flex items-center gap-2 disabled:opacity-70"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  {editingWorkshop ? 'Save Changes' : 'Create Workshop'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
