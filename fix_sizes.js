const fs = require('fs');
const file = 'src/components/booking/PremiumBookingModal.tsx';
let code = fs.readFileSync(file, 'utf8');

// Step Progress Indicator
code = code.replace(
  /className="w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center text-\[10px\] md:text-xs font-bold relative overflow-hidden shrink-0"/,
  'className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-xs md:text-sm font-bold relative overflow-hidden shrink-0"'
);

// Animation replacement for step pulse
code = code.replace(
  /className="absolute inset-0 rounded-full border-2 border-\[#9B7E67\] shrink-0"\s+initial=\{\{ scale: 1, opacity: 0\.5 \}\}\s+animate=\{\{ scale: 1\.5, opacity: 0 \}\}\s+transition=\{\{ duration: 1\.5, repeat: Infinity, ease: 'easeOut' \}\}/,
  `className="absolute inset-[-4px] md:inset-[-6px] rounded-full border-[1.5px] border-[#9B7E67] shrink-0"\n              animate={{ scale: [0.95, 1, 1.05, 1, 0.95], opacity: [0.2, 0.6, 1, 0.6, 0.2] }}\n              transition={{ duration: 1.2, repeat: Infinity, ease: "steps(5)" }}`
);

// Counter text
code = code.replace(/<span className="font-bold text-sm text-\[#23211F\]">\{label\}<\/span>/, '<span className="font-bold text-base text-[#23211F]">{label}</span>');
code = code.replace(/<span className="text-xs text-gray-400 mt-1">\{sublabel\}<\/span>/, '<span className="text-sm text-gray-400 mt-1">{sublabel}</span>');

// Step 1 text sizes
code = code.replace('text-[9px] font-bold uppercase', 'text-xs font-bold uppercase');
code = code.replace(/text-amber-600 text-xs/g, 'text-amber-600 text-sm');
code = code.replace(/text-red-500 text-xs/g, 'text-red-500 text-sm');

// Step 2 & 3 & 4 text sizes
code = code.replace(/text-xs text-\[#9B7E67\] font-bold tracking-widest uppercase mb-2 block w-full text-left/g, 'text-sm text-[#9B7E67] font-bold tracking-widest uppercase mb-2 block w-full text-left');
code = code.replace(/text-xs font-bold text-gray-500 bg-white px-3/g, 'text-sm font-bold text-gray-500 bg-white px-3');
code = code.replace(/text-xs text-gray-500 mb-4 font-light/g, 'text-sm text-gray-500 mb-4 font-light');
code = code.replace(/text-sm text-gray-600 font-light leading-relaxed/g, 'text-base text-gray-600 font-light leading-relaxed');
code = code.replace(/text-xs uppercase tracking-widest font-bold bg-\[#23211F\]/g, 'text-sm uppercase tracking-widest font-bold bg-[#23211F]');
code = code.replace(/text-xs uppercase tracking-widest font-bold text-red-500/g, 'text-sm uppercase tracking-widest font-bold text-red-500');

// Step 3 
code = code.replace(/text-[#9B7E67] p-4 rounded-xl mb-6 text-sm/g, 'text-[#9B7E67] p-4 rounded-xl mb-6 text-base');
code = code.replace(/bg-amber-50 text-amber-800 text-xs px-4 py-2/g, 'bg-amber-50 text-amber-800 text-sm px-4 py-2');
code = code.replace(/font-bold text-sm text-\[#23211F\] mb-2/g, 'font-bold text-base text-[#23211F] mb-2');

// Step 4
code = code.replace(/gap-4 text-xs uppercase tracking-\[0\.2em\] font-bold px-10 py-5/g, 'gap-4 text-sm uppercase tracking-[0.2em] font-bold px-10 py-5');

// Step 5
code = code.replace(/text-sm text-gray-500">\{nights\}/g, 'text-base text-gray-500">{nights}');
code = code.replace(/text-sm text-gray-600 mb-1/g, 'text-base text-gray-600 mb-1');
code = code.replace(/text-xs uppercase tracking-widest text-gray-400 font-bold mb-1/g, 'text-sm uppercase tracking-widest text-gray-400 font-bold mb-1');
code = code.replace(/text-sm text-gray-500 mb-0\.5 ml-2/g, 'text-base text-gray-500 mb-0.5 ml-2');
code = code.replace(/text-xs text-gray-400 uppercase tracking-widest">\{dict\.modal\?\.taxesIncluded\}/g, 'text-sm text-gray-400 uppercase tracking-widest">{dict.modal?.taxesIncluded}');
code = code.replace(/text-red-600 p-4 rounded-xl text-sm font-medium mb-6/g, 'text-red-600 p-4 rounded-xl text-base font-medium mb-6');

// Mobile Bottom Summary
code = code.replace(/text-\[10px\] uppercase tracking-widest font-bold text-gray-400 mb-1/g, 'text-xs uppercase tracking-widest font-bold text-gray-400 mb-1');
code = code.replace(/text-red-500 text-\[10px\] font-bold mb-1/g, 'text-red-500 text-xs font-bold mb-1');
code = code.replace(/rounded-full text-xs font-bold uppercase tracking-widest disabled:opacity-50/g, 'rounded-full text-sm font-bold uppercase tracking-widest disabled:opacity-50');
code = code.replace(/text-amber-600 text-\[10px\] font-bold mb-1/g, 'text-amber-600 text-xs font-bold mb-1');

// PremiumButton
code = code.replace(/font-bold text-xs uppercase tracking-widest flex items-center/g, 'font-bold text-sm uppercase tracking-widest flex items-center');

fs.writeFileSync(file, code);
