import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const COUNTRY_CODES = [
  { code: '+52', country: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: '+1', country: 'US', name: 'United States', flag: '🇺🇸' },
  { code: '+1', country: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: '+44', country: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: '+34', country: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: '+49', country: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'FR', name: 'France', flag: '🇫🇷' },
  { code: '+39', country: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: '+81', country: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: '+61', country: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: '+55', country: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: '+54', country: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: '+56', country: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: '+57', country: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: '+51', country: 'PE', name: 'Peru', flag: '🇵🇪' },
  { code: '+41', country: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: '+46', country: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: '+31', country: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: '+32', country: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: '+43', country: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: '+45', country: 'DK', name: 'Denmark', flag: '🇩🇰' },
  { code: '+47', country: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: '+351', country: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: '+353', country: 'IE', name: 'Ireland', flag: '🇮🇪' },
  { code: '+48', country: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: '+7', country: 'RU', name: 'Russia', flag: '🇷🇺' },
  { code: '+86', country: 'CN', name: 'China', flag: '🇨🇳' },
  { code: '+91', country: 'IN', name: 'India', flag: '🇮🇳' },
  { code: '+82', country: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: '+65', country: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: '+64', country: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: '+27', country: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: '+971', country: 'AE', name: 'UAE', flag: '🇦🇪' },
];

export const CountryCodeDropdown = ({ 
  value, 
  onChange, 
  label 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  label: string; 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selected = COUNTRY_CODES.find(c => c.code === value) || COUNTRY_CODES[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = COUNTRY_CODES.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.code.includes(search)
  );

  return (
    <div className="relative group" ref={dropdownRef}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full bg-transparent border-b-2 border-gray-200 py-4 text-[#23211F] text-lg focus:outline-none transition-colors flex items-center justify-between font-light"
        >
          <span className="flex items-center gap-2">
            <span>{selected.flag}</span>
            <span>{selected.code}</span>
          </span>
          <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        <motion.div
          className="absolute bottom-0 left-0 h-[2px] bg-[#9B7E67]"
          initial={{ width: '0%' }}
          animate={{ width: isOpen ? '100%' : '0%' }}
          transition={{ duration: 0.4 }}
        />
        <label className="absolute left-0 -top-7 text-xs text-[#9B7E67] font-bold tracking-widest uppercase">
          {label}
        </label>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 mt-2 w-[200px] bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden"
          >
            <div className="p-2 border-b border-gray-100">
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#9B7E67]"
              />
            </div>
            <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
              {filtered.map((c, i) => (
                <button
                  key={`${c.country}-${i}`}
                  type="button"
                  onClick={() => {
                    onChange(c.code);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors"
                >
                  <span className="text-xl">{c.flag}</span>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-[#23211F]">{c.name}</span>
                    <span className="text-xs text-gray-500">{c.code}</span>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="p-4 text-center text-sm text-gray-500">
                  No results
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
