'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';
import { useDictionary } from '@/i18n/DictionaryContext';

export const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const dict = useDictionary();
  const faqData = (dict as any).faq;

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  if (!faqData) return null;

  // Build FAQPage JSON-LD for Google rich snippets
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqData.items.map((item: any) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };

  return (
    <section id="faq" className="py-24 bg-[#F9F7F4] text-[#2C2927]">
      {/* FAQPage structured data for Google rich snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="max-w-[800px] mx-auto px-6 md:px-16">
        
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1 }}
          className="text-center mb-16"
        >
          <span className="uppercase tracking-[0.3em] text-[#9b6e2f] text-base md:text-lg font-bold block mb-4">
            {faqData.subtitle}
          </span>
          <h2 className="font-serif text-5xl md:text-6xl">
            {faqData.title}
          </h2>
        </motion.div>

        <div className="space-y-4">
          {faqData.items.map((faq: any, index: number) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="border-b border-gray-300 overflow-hidden"
            >
              <button
                onClick={() => toggleFaq(index)}
                className="w-full flex justify-between items-center py-6 text-left focus:outline-none"
                aria-expanded={openIndex === index}
                aria-controls={`faq-answer-${index}`}
              >
                <span className="font-serif text-2xl pr-8">{faq.q}</span>
                <div className="text-[#9b6e2f] shrink-0">
                  {openIndex === index ? <Minus size={24} /> : <Plus size={24} />}
                </div>
              </button>
              
              <div 
                id={`faq-answer-${index}`}
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                  openIndex === index ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="pb-8 text-gray-600 leading-relaxed font-light">
                    {faq.a}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};
