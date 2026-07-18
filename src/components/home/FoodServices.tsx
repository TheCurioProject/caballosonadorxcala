'use client';

import React from 'react';
import { RevealText } from './RevealText';
import { useDictionary } from '@/i18n/DictionaryContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const FoodServices = () => {
  const dict = useDictionary();
  const pathname = usePathname();
  const langMatch = pathname.match(/^\/(es|en|de)/);
  const langPrefix = langMatch ? langMatch[0] : '/es';

  // Use the dictionary data for Servicios de comida
  const foodServiceData = (dict as any).services?.items?.[1];

  return (
    <section id="servicios-de-comida" className="relative bg-[#23211F]">
      <div className="h-[70vh] flex items-center justify-center text-center px-6 bg-[#23211F] text-white">
        <div className="max-w-3xl">
          <RevealText>
            <h2 className="uppercase tracking-[0.3em] text-xs font-bold mb-4 text-[#9B7E67]">
              {(dict as any).foodServices?.superTitle || 'Experiencia Culinaria'}
            </h2>
          </RevealText>
          <RevealText delay={0.1}>
            <h3 className="font-serif text-5xl md:text-7xl lg:text-8xl leading-tight text-white">
              {foodServiceData?.title || 'Servicios de Comida'}
            </h3>
          </RevealText>
          <RevealText delay={0.2}>
            <p className="mt-6 text-white/80 max-w-xl mx-auto font-light leading-relaxed">
              {foodServiceData?.short || 'Sabores tradicionales preparados para ti.'}
            </p>
          </RevealText>
          <RevealText delay={0.3}>
             <Link 
                href={`${langPrefix}/servicios-de-comida`}
                className="mt-12 inline-block border border-white/20 text-white bg-transparent px-8 py-4 text-xs font-bold uppercase tracking-[0.2em] rounded-full hover:bg-white hover:text-[#23211F] transition-all duration-300 shadow-sm"
             >
                {(dict as any).foodServices?.viewOptions || 'Ver Opciones'}
             </Link>
          </RevealText>
        </div>
      </div>
    </section>
  );
};
