'use client';

import React from 'react';
import { motion } from 'framer-motion';

const reviews = [
  {
    text: "An absolutely magical experience. The perfect blend of luxury and raw nature. We felt completely immersed in the beauty of Chacala while enjoying world-class comfort.",
    author: "Elena R.",
    location: "Los Angeles, CA"
  },
  {
    text: "Casa Caballo Soñador is a hidden gem. The attention to detail in the architecture and the warmth of the staff made our stay unforgettable.",
    author: "James M.",
    location: "Toronto, CAN"
  },
  {
    text: "Waking up to the sound of the ocean and the jungle birds was spectacular. Every suite is a piece of art. We will definitely be coming back every year.",
    author: "Sofía & Carlos",
    location: "Mexico City"
  }
];

export const Reviews = () => {
  return (
    <section id="reviews" className="py-16 md:py-24 bg-[#0A0908] text-[#F9F7F4] relative overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 md:px-16">
        
        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1.2, ease: [0.76, 0, 0.24, 1] }}
          className="text-center mb-16"
        >
          <motion.span 
            initial={{ opacity: 0, letterSpacing: "0em" }}
            whileInView={{ opacity: 1, letterSpacing: "0.3em" }}
            transition={{ duration: 1.5, delay: 0.2, ease: "easeOut" }}
            className="uppercase text-[#9b6e2f] text-sm font-bold block mb-4"
          >
            Guest Experiences
          </motion.span>
          <h2 className="font-serif text-4xl md:text-7xl">
            Reseñas
          </h2>
        </motion.div>

        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.3
              }
            }
          }}
          className="grid grid-cols-1 md:grid-cols-3 gap-12"
        >
          {reviews.map((review, idx) => (
            <motion.div
              key={idx}
              variants={{
                hidden: { opacity: 0, y: 50, scale: 0.9 },
                visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 1, ease: [0.76, 0, 0.24, 1] } }
              }}
              whileHover={{ scale: 1.05, transition: { duration: 0.4 } }}
              className="flex flex-col items-center text-center space-y-6 bg-[#161412] p-8 rounded-2xl border border-[#F9F7F4]/5 hover:border-[#9b6e2f]/30 transition-colors"
            >
              <div className="flex space-x-1 text-[#9b6e2f]">
                {[...Array(5)].map((_, i) => (
                  <motion.svg 
                    key={i} 
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + (i * 0.1), duration: 0.5, type: "spring" }}
                    className="w-5 h-5 fill-current" 
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </motion.svg>
                ))}
              </div>
              <p className="font-serif text-xl italic text-gray-300 leading-relaxed">
                "{review.text}"
              </p>
              <div>
                <h4 className="font-bold tracking-widest uppercase text-sm">{review.author}</h4>
                <span className="text-gray-500 text-xs tracking-widest uppercase">{review.location}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>

      </div>
    </section>
  );
};
