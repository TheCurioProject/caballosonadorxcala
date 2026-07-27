const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '../src/components/booking/PremiumBookingModal.tsx')
let content = fs.readFileSync(file, 'utf8')

// We need to find the Menu block inside step 2.
// It starts at: <div className="bg-[#FAF8F5] p-5 rounded-3xl border border-[#E8D5B7] mb-8">
// and ends at the end of the step 2 container.

// Let's use string manipulation.
const startMenuMarker = `<div className="bg-[#FAF8F5] p-5 rounded-3xl border border-[#E8D5B7] mb-8">`
const endMenuMarker = `                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ) : null}

                      {wantsCook && (
                        <div className="mt-8 shrink-0 flex gap-3">
                          <PremiumButton onClick={nextStep} disabled={totalCookServices === 0 || selectedDishes.length < Math.max(1, nights - 1)}>
                            {dict.modal?.continue} <ArrowRight size={16} />
                          </PremiumButton>
                        </div>
                      )}
                    </motion.div>
                  )}`

// Wait, the end menu marker varies slightly, let's just find the exact text using index
const menuStartIndex = content.indexOf(startMenuMarker)
if (menuStartIndex === -1) throw new Error("Could not find menu start")

// Find the end of step 2 container
const step3Index = content.indexOf('{step === 4 && (')
if (step3Index === -1) throw new Error("Could not find step 4 start")

// Let's do it safely by replacing specific chunks.
// First, replace the disabled condition in Step 2:
content = content.replace(
  'disabled={totalCookServices === 0 || selectedDishes.length < Math.max(1, nights - 1)}',
  'disabled={totalCookServices === 0}'
)

// Now we extract the menu HTML. 
// It's easier to use a regex or just replace the startMenuMarker with a closing div for step 2, 
// and then open step 3.

let newMenuHtml = `
                  {step === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                      className="min-h-full flex flex-col flex-1 max-md:absolute max-md:inset-0 max-md:overflow-y-auto max-md:p-6 max-md:pb-32"
                    >
                      <div className="mb-8 shrink-0 flex items-center gap-3">
                         <div className="w-12 h-12 bg-[#F9F7F4] rounded-full flex items-center justify-center text-[#9B7E67] shadow-sm border border-[#E8D5B7]">
                            <Utensils size={24} />
                          </div>
                         <h3 className="text-3xl font-serif text-[#23211F]">{dict.nav?.menu || "Menu"}</h3>
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="bg-[#FAF8F5] p-5 rounded-3xl border border-[#E8D5B7] mb-8">`

content = content.replace(startMenuMarker, `</div></div>)}</motion.div>) : null}
{wantsCook && (
  <div className="mt-8 shrink-0 flex gap-3">
    <PremiumButton onClick={nextStep} disabled={totalCookServices === 0}>
      {dict.modal?.continue} <ArrowRight size={16} />
    </PremiumButton>
  </div>
)}
</motion.div>)}
` + newMenuHtml)

// Wait! If I just replace `startMenuMarker`, I will leave the original button at the bottom of the old menu!
// Let me write a more precise script or just use my brain to edit the file directly using replace_file_content!
