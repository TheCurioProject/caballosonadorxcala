'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Upload, RotateCcw, Loader2, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AdminConfirmModal } from '@/components/admin/AdminConfirmModal';

type SiteImage = {
  key: string;
  group: string;
  name: string;
  url: string;
  hasHistory: boolean;
  history: { id: number; url: string; createdAt: string }[];
};

export default function ContentAdminClient() {
  const [images, setImages] = useState<Record<string, SiteImage[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('HOMEPAGE');
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [restoringKey, setRestoringKey] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const fetchImages = async () => {
    try {
      const res = await fetch(`/api/admin/images?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setImages(data);
        setLastUpdated(Date.now());
      }
    } catch (error) {
      console.error('Error fetching images:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      if (file.type.includes('svg') || file.size <= 500 * 1024) {
        resolve(file);
        return;
      }
      const img = document.createElement('img');
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxWidth = 1920;
        const maxHeight = 1920;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                  type: 'image/webp',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            'image/webp',
            0.85
          );
        } else {
          resolve(file);
        }
      };
      img.onerror = () => resolve(file);
      img.src = url;
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingKey(key);
    try {
      const processedFile = await compressImage(file);
      const formData = new FormData();
      formData.append('file', processedFile);
      formData.append('key', key);

      const res = await fetch('/api/admin/images', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showNotification('success', 'Image successfully updated');
        await fetchImages();
      } else {
        showNotification('error', data.error || 'Error uploading image');
      }
    } catch (error) {
      showNotification('error', 'Network error uploading image');
    } finally {
      setUploadingKey(null);
      // Reset input
      if (fileInputRefs.current[key]) {
        fileInputRefs.current[key]!.value = '';
      }
    }
  };

  const [restoreTarget, setRestoreTarget] = useState<{ key: string; historyId: number } | null>(null);

  const triggerRestore = (key: string, historyId: number) => {
    setRestoreTarget({ key, historyId });
  };

  const handleRestoreConfirm = async () => {
    if (!restoreTarget) return;
    const { key, historyId } = restoreTarget;
    setRestoringKey(key);
    try {
      const res = await fetch('/api/admin/images/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, historyId }),
      });

      if (res.ok) {
        showNotification('success', 'Image successfully restored');
        await fetchImages();
      } else {
        showNotification('error', 'Error restoring image');
      }
    } catch (error) {
      showNotification('error', 'Network error restoring');
    } finally {
      setRestoringKey(null);
      setRestoreTarget(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-500 w-8 h-8" /></div>;
  }

  const tabKeys = Object.keys(images).sort();
  // Ensure HOMEPAGE is first if it exists
  if (tabKeys.includes('HOMEPAGE')) {
    tabKeys.splice(tabKeys.indexOf('HOMEPAGE'), 1);
    tabKeys.unshift('HOMEPAGE');
  }

  const tabs = tabKeys.map(key => ({
    id: key,
    label: key
  }));

  const activeImages = images[activeTab] || [];

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg flex items-center gap-3 ${
              notification.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <div className="w-5 h-5 bg-red-500 rounded-full" />}
            <p className="font-medium">{notification.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-4 overflow-x-auto pb-2 scrollbar-hide" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === tab.id
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Image Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {activeImages.map((img) => (
          <div key={img.key} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            {/* Image Preview - Maintains aspect ratio safely in a container */}
            <div className="relative w-full aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
              {img.url ? (
                <img
                  src={img.url.startsWith('data:') ? img.url : (img.url.includes('?') ? `${img.url}&t=${lastUpdated}` : `${img.url}?t=${lastUpdated}`)}
                  alt={img.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="w-12 h-12 text-gray-300" />
              )}
              
              {/* Overlay for uploading state */}
              <AnimatePresence>
                {uploadingKey === img.key && (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white backdrop-blur-sm z-10"
                  >
                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                    <span className="text-sm font-medium">Uploading...</span>
                  </motion.div>
                )}
                {restoringKey === img.key && (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white backdrop-blur-sm z-10"
                  >
                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                    <span className="text-sm font-medium">Restoring...</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Controls */}
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{img.name}</h3>
                <p className="text-xs text-gray-500 font-mono mt-1">{img.key}</p>
              </div>

              <div className="flex items-center gap-3 mt-auto">
                {/* Upload Button */}
                <div className="relative flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    onChange={(e) => handleFileChange(e, img.key)}
                    disabled={uploadingKey !== null || restoringKey !== null}
                    ref={(el) => { fileInputRefs.current[img.key] = el; }}
                  />
                  <div className="w-full bg-black text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium hover:bg-gray-800 transition-colors pointer-events-none">
                    <Upload className="w-4 h-4" />
                    <span>Change</span>
                  </div>
                </div>

                {/* Restore Button */}
                {img.hasHistory && img.history.length > 0 && (
                  <button
                    onClick={() => triggerRestore(img.key, img.history[0].id)}
                    disabled={uploadingKey !== null || restoringKey !== null}
                    className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-50 hover:text-black font-medium transition-colors disabled:opacity-50"
                    title="Restore to previous image"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span className="hidden sm:inline">Restore</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {activeImages.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500 bg-white border border-gray-200 border-dashed rounded-xl">
            There are no images configured for this section.
          </div>
        )}
      </div>

      <AdminConfirmModal
        isOpen={!!restoreTarget}
        title="Restore Previous Image"
        description="Are you sure you want to restore this image to its previous version? The current version will be overwritten."
        confirmText="Restore Image"
        variant="warning"
        isLoading={restoringKey !== null}
        onConfirm={handleRestoreConfirm}
        onCancel={() => setRestoreTarget(null)}
      />
    </div>
  );
}
