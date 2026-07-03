'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';

const faqs = [
  {
    question: "How big is Chacala?",
    answer: "Chacala has about 300 full time resident with the population surging during Christmas and Semana Santa. Our town is very small, situated primarily around a small Bay and most hotels/residence are within a 6 minute walk of the beach."
  },
  {
    question: "Are there cooking facilities?",
    answer: "Yes, we have a fully stocked shared kitchen with full size appliances and most of the amenities you would find at home. Each room is also equipped with a mini fridge/microwave. We also have a BBQ available on request."
  },
  {
    question: "What is the bug situation?",
    answer: "We highly recommend DEET to repel mosquitoes. Smaller insects such as midges come out in the cooler hours of the evening."
  },
  {
    question: "What is the capacity of your Casa?",
    answer: "We can accommodate up to 14 people."
  },
  {
    question: "How do I get there from the airport?",
    answer: "You can rent a car or take a bus or taxi. We can assist with your arrangements."
  },
  {
    question: "Is there a drug store nearby?",
    answer: "There are several drug stores in Las Varas (10km from Chacala)."
  },
  {
    question: "Is there a hospital nearby?",
    answer: "There is a hospital in nearby Las Varas (10 km from Chacala) as well as a medical clinic that is open Monday - Friday 8am - 4 pm."
  },
  {
    question: "Is there a bank machine?",
    answer: "Chacala has 3 bank machines and there are several large banks in nearby Las Varas."
  },
  {
    question: "Is there a grocery store?",
    answer: "We have several small grocers in Chacala, and larger grocery stores in nearby Las Varas."
  },
  {
    question: "Is it quiet?",
    answer: "Our town always has construction going on during the day, but evenings are normally quiet. Our Casa is closer to the jungle on the outskirts and tend to be quieter."
  }
];

export const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-24 bg-[#F9F7F4] text-[#2C2927]">
      <div className="max-w-[800px] mx-auto px-6 md:px-16">
        
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1 }}
          className="text-center mb-16"
        >
          <span className="uppercase tracking-[0.3em] text-[#9b6e2f] text-sm font-bold block mb-4">
            Information
          </span>
          <h2 className="font-serif text-5xl md:text-6xl">
            Frequently Asked Questions
          </h2>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
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
              >
                <span className="font-serif text-2xl pr-8">{faq.question}</span>
                <div className="text-[#9b6e2f] shrink-0">
                  {openIndex === index ? <Minus size={24} /> : <Plus size={24} />}
                </div>
              </button>
              
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <div className="pb-8 text-gray-600 leading-relaxed font-light">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};
