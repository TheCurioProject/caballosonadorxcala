'use client';

import React from 'react';
import { RevealText } from './RevealText';
import { useDictionary } from '@/i18n/DictionaryContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const Experiences = ({ experiences }: { experiences?: any[] }) => {
  const dict = useDictionary();
  const pathname = usePathname();
  const langMatch = pathname.match(/^\/(es|en|de)/);
  const langPrefix = langMatch ? langMatch[0] : '/es';

  return (
    <section id="experiencias" className="relative bg-[#23211F]">
      <div className="h-[70vh] flex items-center justify-center text-center px-6 bg-[#23211F] text-white">
        <div className="max-w-3xl">
          <RevealText>
            <h2 className="uppercase tracking-[0.3em] text-xs font-bold mb-4">{(dict as any).tours.subtitle}</h2>
          </RevealText>
          <RevealText delay={0.1}>
            <h3 className="font-serif text-5xl md:text-7xl lg:text-8xl leading-tight">{(dict as any).tours.title}</h3>
          </RevealText>
          <RevealText delay={0.3}>
             <Link 
                href={`${langPrefix}/tours`}
                className="mt-12 inline-block border border-white text-white px-8 py-4 text-xs font-bold uppercase tracking-[0.2em] rounded-full hover:bg-white hover:text-[#23211F] transition-all duration-300"
             >
                {(dict as any).tours?.button || 'Descubrir Experiencias'}
             </Link>
          </RevealText>
        </div>
      </div>
    </section>
  );
};
