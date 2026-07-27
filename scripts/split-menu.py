import re

with open('src/components/booking/PremiumBookingModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# We want to find the start of the Menu div
menu_start = '<div className="bg-[#FAF8F5] p-5 rounded-3xl border border-[#E8D5B7] mb-8">'
# We want to find the end of the step 2 container which ends around line 1127
step_2_end = '                      ) : null}\n                    </motion.div>\n                  )}'
step_4_start = '{step === 4 && ('

idx_start = content.find(menu_start)
idx_end = content.find(step_2_end, idx_start)

if idx_start == -1 or idx_end == -1:
    print("Could not find boundaries")
    exit(1)

menu_content = content[idx_start:idx_end]

# We need to leave a Continue button in Step 2.
step2_continue = """
                              <div className="shrink-0 mt-4 hidden md:block">
                                <PremiumButton onClick={nextStep} disabled={totalCookServices === 0}>
                                  {dict.modal?.continue} <ArrowRight size={16} />
                                </PremiumButton>
                              </div>
                            </div>
                          )}
                        </motion.div>
"""

new_step_3 = """                  {step === 3 && (
                    <motion.div
                      key="stepMenu"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                      className="min-h-full flex flex-col flex-1 max-md:absolute max-md:inset-0 max-md:overflow-y-auto max-md:p-6 max-md:pb-32"
                    >
                      <div className="mb-6 shrink-0 flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#F9F7F4] rounded-full flex items-center justify-center text-[#9B7E67] shadow-sm border border-[#E8D5B7]">
                          <Utensils size={24} />
                        </div>
                        <h3 className="text-3xl font-serif text-[#23211F]">{isEn ? 'Menu' : 'Menú'}</h3>
                      </div>
""" + menu_content + """                    </motion.div>
                  )}
"""

# Replace the menu content in step 2 with the continue button
content = content[:idx_start] + step2_continue + content[idx_end:]

# Now insert new_step_3 right before step 4
idx_step_4 = content.find(step_4_start)
content = content[:idx_step_4] + new_step_3 + '\n                  ' + content[idx_step_4:]

with open('src/components/booking/PremiumBookingModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Split menu successfully")
