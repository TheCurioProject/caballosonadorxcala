import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import React from 'react';
import fs from 'fs/promises';
import path from 'path';
import { Image as ImageIcon, Trash2, Tag, FileText } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminExperiencesPage() {
  const experiences = await prisma.experience.findMany({
    orderBy: { createdAt: 'desc' }
  });

  async function addExperience(formData: FormData) {
    'use server';
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const price = formData.get('price') as string;
    const imageFile = formData.get('image') as File | null;

    let imageUrl = null;

    if (imageFile && imageFile.size > 0) {
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      const ext = imageFile.name.split('.').pop();
      const filename = `exp-${Date.now()}.${ext}`;
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      
      try {
        await fs.access(uploadDir);
      } catch {
        await fs.mkdir(uploadDir, { recursive: true });
      }
      
      await fs.writeFile(path.join(uploadDir, filename), buffer);
      imageUrl = `/uploads/${filename}`;
    }

    if (title) {
      await prisma.experience.create({
        data: {
          title,
          description,
          price,
          imageUrl
        }
      });
      revalidatePath('/admin/experiences');
    }
  }

  async function removeExperience(formData: FormData) {
    'use server';
    const id = parseInt(formData.get('id') as string, 10);
    if (!isNaN(id)) {
      await prisma.experience.delete({ where: { id } });
      revalidatePath('/admin/experiences');
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div className="mb-8">
        <h2 className="text-4xl font-serif text-[#23211F]">Experiences / Packages</h2>
        <p className="text-gray-500 font-light mt-2">
          Manage all-inclusive experiences, events, and packages.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-serif text-[#23211F] mb-4">Add New Experience</h2>
            <form action={addExperience} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Title</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Tag className="h-4 w-4 text-gray-400" />
                  </div>
                  <input type="text" name="title" required placeholder="e.g. Romantic Dinner" className="w-full border border-gray-200 rounded-xl pl-10 px-3 py-2 text-[#23211F] text-sm focus:outline-none focus:border-[#9B7E67]" />
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Description (Optional)</label>
                <div className="relative">
                  <div className="absolute top-3 left-3 pointer-events-none">
                    <FileText className="h-4 w-4 text-gray-400" />
                  </div>
                  <textarea name="description" rows={3} placeholder="Experience details..." className="w-full border border-gray-200 rounded-xl pl-10 px-3 py-2 text-[#23211F] text-sm focus:outline-none focus:border-[#9B7E67] resize-none"></textarea>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Price (Optional)</label>
                <input type="text" name="price" placeholder="e.g. $1,500 MXN or 'Depends on group'" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[#23211F] text-sm focus:outline-none focus:border-[#9B7E67]" />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Cover Image (Optional)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <ImageIcon className="h-4 w-4 text-gray-400" />
                  </div>
                  <input type="file" name="image" accept="image/*" className="w-full border border-gray-200 rounded-xl pl-10 px-3 py-2 text-gray-500 text-sm focus:outline-none focus:border-[#9B7E67] bg-white transition-all file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100" />
                </div>
              </div>

              <button type="submit" className="w-full bg-[#23211F] hover:bg-[#9B7E67] text-white font-bold text-xs tracking-widest uppercase py-3 rounded-xl transition-all duration-300">
                ADD EXPERIENCE
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center">
              <h2 className="font-serif text-[#23211F] text-xl">Active Experiences</h2>
              <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">Total: {experiences.length}</span>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {experiences.map((exp) => (
                <div key={exp.id} className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white flex flex-col">
                  {exp.imageUrl ? (
                    <div className="h-40 w-full relative bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={exp.imageUrl} alt={exp.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="h-40 w-full bg-[#F9F7F4] flex items-center justify-center">
                      <ImageIcon className="w-10 h-10 text-gray-300" />
                    </div>
                  )}
                  
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-serif text-lg text-[#23211F] mb-1">{exp.title}</h3>
                    {exp.price && <span className="inline-block px-3 py-1 bg-green-50 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-widest self-start mb-3">{exp.price}</span>}
                    <p className="text-sm text-gray-500 font-light flex-1 line-clamp-3 mb-4">
                      {exp.description || 'No description provided.'}
                    </p>
                    
                    <div className="mt-auto pt-4 border-t border-gray-50 flex justify-end">
                      <form action={removeExperience}>
                        <input type="hidden" name="id" value={exp.id} />
                        <button type="submit" className="text-xs font-bold uppercase tracking-widest text-red-400 hover:text-red-600 transition-colors flex items-center gap-1">
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
              
              {experiences.length === 0 && (
                <div className="col-span-full py-12 text-center text-gray-400 italic">
                  No experiences created yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
