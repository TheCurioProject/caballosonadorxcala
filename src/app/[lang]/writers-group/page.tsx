import React from 'react';
import prisma from '@/lib/prisma';
import { WorkshopAccordion } from '@/components/writers-group/WorkshopAccordion';
import { Feather, BookOpen, Coffee, Users, Calendar } from 'lucide-react';
import { getDictionary } from '@/i18n/dictionaries';

export const metadata = {
  title: 'Chacala Writers Group | Hotel Soñador',
  description: 'Small group writing workshops and Word Church in Chacala, Nayarit.',
};

export default async function WritersGroupPage(props: { params: Promise<{ lang: string }> }) {
  const { lang } = await props.params;
  
  // Fetch active workshops
  const workshops = await prisma.writersWorkshop.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <main className="min-h-screen bg-[#F9F7F4] pt-24 md:pt-32 pb-20">
      <div className="max-w-[1200px] mx-auto px-6 md:px-12">
        {/* Header Section */}
        <div className="text-center mb-16 md:mb-24">
          <div className="flex justify-center mb-6 opacity-80">
            <Feather size={40} className="text-[#9B7E67]" strokeWidth={1} />
          </div>
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl text-[#2C2927] tracking-tight mb-8">
            Chacala Writers Group
          </h1>
          <div className="w-24 h-px bg-[#9B7E67]/50 mx-auto mb-10"></div>
          
          {/* Editorial Introduction Text */}
          <div className="max-w-3xl mx-auto space-y-6 text-lg md:text-xl text-[#2C2927]/80 font-light leading-relaxed">
            <p className="flex items-start gap-4 text-left">
              <BookOpen className="flex-shrink-0 mt-1 text-[#9B7E67] opacity-60" size={24} strokeWidth={1.5} />
              <span>Chacala Writers Group offers small group writing workshops designed to get you writing. Instructors provide prompts and exercises, helping you brainstorm new ideas and build consistent writing habits.</span>
            </p>
            
            <p className="flex items-start gap-4 text-left">
              <Users className="flex-shrink-0 mt-1 text-[#9B7E67] opacity-60" size={24} strokeWidth={1.5} />
              <span>Are you looking to connect with a local in-person group while in Chacala? Chacala Writers Group hosts Word Church every Sunday from November to April. Writers of all disciplines are welcome.</span>
            </p>
            
            <p className="flex items-start gap-4 text-left">
              <Coffee className="flex-shrink-0 mt-1 text-[#9B7E67] opacity-60" size={24} strokeWidth={1.5} />
              <span>Drop in and have a coffee. Share your work, receive feedback, or explore topics.</span>
            </p>
            
            <div className="bg-[#9B7E67]/5 p-8 rounded-2xl mt-12 border border-[#9B7E67]/10 text-center">
              <Calendar className="mx-auto mb-4 text-[#9B7E67]" size={32} strokeWidth={1} />
              <p className="font-serif text-2xl md:text-3xl text-[#2C2927] mb-2">Word Church meets every Sunday</p>
              <p className="text-base md:text-lg tracking-wide uppercase text-[#2C2927]/60 font-medium">Between 9 and 11 at Casa Pacifica</p>
              <p className="mt-6 font-serif italic text-xl text-[#9B7E67]">Come have coffee.</p>
            </div>
          </div>
        </div>

        {/* Workshops Section */}
        {workshops.length > 0 && (
          <div className="mt-24 md:mt-32">
            <h2 className="text-[10px] md:text-xs uppercase tracking-[0.3em] font-bold text-[#9B7E67] mb-8 border-b border-[#2C2927]/10 pb-4">
              Available Workshops
            </h2>
            <div className="flex flex-col">
              {workshops.map(workshop => (
                <WorkshopAccordion key={workshop.id} workshop={workshop} />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
