'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sun, Droplets, Coffee, Wind } from 'lucide-react';
import { RevealText } from './RevealText';
import { useDictionary } from '@/i18n/DictionaryContext';

export const Amenities = () => {
  const dict = useDictionary();
  const icons = [
    { icon: <Sun size={32}/>, title: dict.amenities.palapa, desc: dict.amenities.palapa_desc },
    { icon: <Droplets size={32}/>, title: dict.amenities.pool, desc: dict.amenities.pool_desc },
    { icon: <Coffee size={32}/>, title: dict.amenities.kitchen, desc: dict.amenities.kitchen_desc },
    { icon: <Wind size={32}/>, title: dict.amenities.comfort, desc: dict.amenities.comfort_desc }
  ];

  return (
    <section id="amenidades" className="py-16 md:py-32 px-6 md:px-16 bg-[#F9F7F4] text-[#23211F]">
      <div className="max-w-7xl mx-auto">
        <RevealText>
          <h2 className="font-serif text-5xl md:text-7xl text-center mb-24">{dict.amenities.title}</h2>
        </RevealText>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {icons.map((item, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ delay: i * 0.1, duration: 0.8 }}
              className="flex flex-col items-center text-center bg-white p-8 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow duration-500 group"
            >
              <div className="w-16 h-16 rounded-full bg-[#F9F7F4] flex items-center justify-center text-[#9B7E67] mb-6 group-hover:bg-[#9B7E67] group-hover:text-[#F9F7F4] transition-colors duration-500">
                {item.icon}
              </div>
              <h4 className="font-serif text-2xl mb-4">{item.title}</h4>
              <p className="font-light text-sm text-[#524D48] leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
