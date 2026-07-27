import re

with open('src/components/booking/PremiumBookingModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix mobile footer step 2
content = content.replace(
    '''                {step === 2 && (
                  <div className="flex flex-col items-end">
                    {wantsCook === null ? <span className="text-amber-600 text-xs font-bold mb-1 mr-2">{isEn ? 'Select an option' : 'Selecciona una opción'}</span> : wantsCook && (totalCookServices === 0 || selectedDishes.length < Math.max(1, nights - 1)) ? <span className="text-amber-600 text-xs font-bold mb-1 mr-2">{isEn ? 'Select your dishes' : 'Selecciona tus platillos'}</span> : null}
                    <button onClick={nextStep} disabled={wantsCook === null || (wantsCook && (totalCookServices === 0 || selectedDishes.length < Math.max(1, nights - 1)))} className="bg-[#23211F] text-white px-6 py-3 rounded-full text-sm font-bold uppercase tracking-widest disabled:opacity-50 transition-colors">
                      {dictContext?.modal?.next || (isEn ? 'Next' : 'Siguiente')}
                    </button>
                  </div>
                )}''',
    '''                {step === 2 && (
                  <div className="flex flex-col items-end">
                    {wantsCook === null ? <span className="text-amber-600 text-xs font-bold mb-1 mr-2">{isEn ? 'Select an option' : 'Selecciona una opción'}</span> : wantsCook && totalCookServices === 0 ? <span className="text-amber-600 text-xs font-bold mb-1 mr-2">{isEn ? 'Select your plan' : 'Selecciona tu plan'}</span> : null}
                    <button onClick={nextStep} disabled={wantsCook === null || (wantsCook && totalCookServices === 0)} className="bg-[#23211F] text-white px-6 py-3 rounded-full text-sm font-bold uppercase tracking-widest disabled:opacity-50 transition-colors">
                      {dictContext?.modal?.next || (isEn ? 'Next' : 'Siguiente')}
                    </button>
                  </div>
                )}
                {step === 3 && (
                  <div className="flex flex-col items-end">
                    {selectedDishes.length < Math.max(1, nights - 1) ? <span className="text-amber-600 text-xs font-bold mb-1 mr-2">{isEn ? 'Select your dishes' : 'Selecciona tus platillos'}</span> : null}
                    <button onClick={nextStep} disabled={selectedDishes.length < Math.max(1, nights - 1)} className="bg-[#23211F] text-white px-6 py-3 rounded-full text-sm font-bold uppercase tracking-widest disabled:opacity-50 transition-colors">
                      {dictContext?.modal?.next || (isEn ? 'Next' : 'Siguiente')}
                    </button>
                  </div>
                )}'''
)

# Fix mobile footer step 5 visibility (previously step 5 was hidden by `step < 5`)
content = content.replace(
    '{isMobile && step < 5 && (',
    '{isMobile && step < 6 && ('
)

# Fix image block rendering
img_block_old_1 = '''                {step === 1 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
                    <img src="https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&q=80" alt="Villa Exterior" className="w-full h-full object-cover" />
                  </motion.div>
                )}'''

img_block_old_2 = '''                {step === 2 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
                    <img src="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80" alt="Private Chef" className="w-full h-full object-cover" />
                  </motion.div>
                )}'''

img_block_old_3 = '''                {step === 4 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
                    <img src="https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80" alt="ATV Tour" className="w-full h-full object-cover" />
                  </motion.div>
                )}'''
# Wait, let's just make the left sidebar image persist for step 3 using the same image as step 2.
content = content.replace(
    img_block_old_2,
    '''                {(step === 2 || step === 3) && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
                    <img src="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80" alt="Private Chef" className="w-full h-full object-cover" />
                  </motion.div>
                )}'''
)

with open('src/components/booking/PremiumBookingModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed mobile footer")
