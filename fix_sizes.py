import re

file_path = 'src/components/booking/PremiumBookingModal.tsx'

with open(file_path, 'r') as file:
    content = file.read()

# Counter
content = re.sub(r'<span className="font-bold text-sm text-\[\#23211F\]">\{label\}<\/span>', '<span className="font-bold text-base text-[#23211F]">{label}</span>', content)
content = re.sub(r'<span className="text-xs text-gray-400 mt-1">\{sublabel\}<\/span>', '<span className="text-sm text-gray-400 mt-1">{sublabel}</span>', content)

# Step 1
content = content.replace('text-[9px] font-bold uppercase', 'text-xs font-bold uppercase')
content = content.replace('text-amber-600 text-xs', 'text-amber-600 text-sm')
content = content.replace('text-red-500 text-xs', 'text-red-500 text-sm')

# Step 2 & 3 & 4
content = content.replace('text-xs text-[#9B7E67] font-bold tracking-widest uppercase mb-2 block w-full text-left', 'text-sm text-[#9B7E67] font-bold tracking-widest uppercase mb-2 block w-full text-left')
content = content.replace('text-xs font-bold text-gray-500 bg-white px-3', 'text-sm font-bold text-gray-500 bg-white px-3')
content = content.replace('text-xs text-gray-500 mb-4 font-light', 'text-sm text-gray-500 mb-4 font-light')
content = content.replace('text-sm text-gray-600 font-light leading-relaxed', 'text-base text-gray-600 font-light leading-relaxed')
content = content.replace('text-xs uppercase tracking-widest font-bold bg-[#23211F]', 'text-sm uppercase tracking-widest font-bold bg-[#23211F]')
content = content.replace('text-xs uppercase tracking-widest font-bold text-red-500', 'text-sm uppercase tracking-widest font-bold text-red-500')

# Step 3
content = content.replace('text-[#9B7E67] p-4 rounded-xl mb-6 text-sm', 'text-[#9B7E67] p-4 rounded-xl mb-6 text-base')
content = content.replace('bg-amber-50 text-amber-800 text-xs px-4 py-2', 'bg-amber-50 text-amber-800 text-sm px-4 py-2')
content = content.replace('font-bold text-sm text-[#23211F] mb-2', 'font-bold text-base text-[#23211F] mb-2')

# Step 4
content = content.replace('gap-4 text-xs uppercase tracking-[0.2em] font-bold px-10 py-5', 'gap-4 text-sm uppercase tracking-[0.2em] font-bold px-10 py-5')

# Step 5
content = content.replace('text-sm text-gray-500">{nights}', 'text-base text-gray-500">{nights}')
content = content.replace('text-sm text-gray-600 mb-1', 'text-base text-gray-600 mb-1')
content = content.replace('text-xs uppercase tracking-widest text-gray-400 font-bold mb-1', 'text-sm uppercase tracking-widest text-gray-400 font-bold mb-1')
content = content.replace('text-sm text-gray-500 mb-0.5 ml-2', 'text-base text-gray-500 mb-0.5 ml-2')
content = content.replace('text-xs text-gray-400 uppercase tracking-widest">{dict.modal?.taxesIncluded}', 'text-sm text-gray-400 uppercase tracking-widest">{dict.modal?.taxesIncluded}')
content = content.replace('text-red-600 p-4 rounded-xl text-sm font-medium mb-6', 'text-red-600 p-4 rounded-xl text-base font-medium mb-6')

# Mobile Bottom Summary
content = content.replace('text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1', 'text-xs uppercase tracking-widest font-bold text-gray-400 mb-1')
content = content.replace('text-red-500 text-[10px] font-bold mb-1', 'text-red-500 text-xs font-bold mb-1')
content = content.replace('rounded-full text-xs font-bold uppercase tracking-widest disabled:opacity-50', 'rounded-full text-sm font-bold uppercase tracking-widest disabled:opacity-50')
content = content.replace('text-amber-600 text-[10px] font-bold mb-1', 'text-amber-600 text-xs font-bold mb-1')

# PremiumButton
content = content.replace('font-bold text-xs uppercase tracking-widest flex items-center', 'font-bold text-sm uppercase tracking-widest flex items-center')

with open(file_path, 'w') as file:
    file.write(content)

