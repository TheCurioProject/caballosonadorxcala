import re

with open('src/components/booking/PremiumBookingModal.tsx', 'r') as f:
    content = f.read()

# Replace step === 2 logic
step_2_pattern = re.compile(r'\{step === 2 && \([\s\S]*?\{step === 3 && \(', re.MULTILINE)

new_steps_code = """{step === 'food_prompt' && (
                    <motion.div
                      key="step_food_prompt"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                      className="min-h-full flex flex-col flex-1 max-md:absolute max-md:inset-0 max-md:overflow-y-auto max-md:p-6 max-md:pb-32"
                    >
                      <div className="shrink-0 mb-8">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-[#F9F7F4] rounded-full flex items-center justify-center text-[#9B7E67] shadow-sm border border-[#E8D5B7]">
                            <Utensils size={24} />
                          </div>
                        </div>
                        <h3 className="text-3xl font-serif text-[#23211F] mb-2">
                          {dict.addons?.chefTitle}
                        </h3>
                        <p className="text-gray-500 font-light">
                          {dict.addons?.chefDesc}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-auto md:mt-0 pb-4">
                        <button onClick={() => handleWantsCook(true)} className="p-6 md:p-8 border-2 border-gray-200 rounded-2xl hover:border-[#9B7E67] text-[#23211F] font-bold text-sm md:text-lg transition-colors flex flex-col items-center gap-2 group bg-white">
                          <span className="w-8 h-8 rounded-full border-2 border-gray-300 group-hover:border-[#9B7E67] flex items-center justify-center text-transparent group-hover:bg-[#9B7E67] group-hover:text-white transition-all">✓</span>
                          {dict.addons?.yesPlease}
                        </button>
                        <button onClick={() => handleWantsCook(false)} className="p-6 md:p-8 border-2 border-gray-200 rounded-2xl hover:border-gray-400 text-gray-500 font-bold text-sm md:text-lg transition-colors flex flex-col items-center gap-2 group bg-white">
                          <span className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center text-transparent group-hover:bg-gray-400 group-hover:text-white transition-all">✕</span>
                          {dict.addons?.noThanks}
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {step === 'food_service' && (
                    <motion.div
                      key="step_food_service"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                      className="min-h-full flex flex-col flex-1 max-md:absolute max-md:inset-0 max-md:overflow-y-auto max-md:p-6 max-md:pb-32"
                    >
                      <div className="shrink-0 mb-8">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-[#F9F7F4] rounded-full flex items-center justify-center text-[#9B7E67] shadow-sm border border-[#E8D5B7]">
                            <Utensils size={24} />
                          </div>
                        </div>
                        <h3 className="text-3xl font-serif text-[#23211F] mb-2">
                          {isEn ? "Choose Your Service" : "Elige tu Servicio"}
                        </h3>
                        <p className="text-gray-500 font-light">
                          {isEn ? "We provide a staff member to assist with prep, cooking, and clean up. You provide the ingredients, and we cook it for you! Select an assistance plan below:" : "Proveemos personal para asistir con la preparación, cocina y limpieza. Usted pone los ingredientes, ¡nosotros lo cocinamos! Seleccione un plan de asistencia a continuación:"}
                        </p>
                      </div>

                      <div className="space-y-6 flex-1 pb-4">
                        <div className="grid gap-3">
                          {foodServices.filter(s => s.serviceType === 'FOOD_SERVICE').map(service => (
                            <button 
                              key={service.id}
                              onClick={() => {
                                setSelectedCookService(service);
                                setTimeout(() => nextStep(), 100);
                              }}
                              className="p-5 border border-[#E8D5B7] rounded-xl hover:bg-[#F9F7F4] text-left transition-colors flex flex-col group bg-white"
                            >
                              <span className="font-bold text-[#23211F] group-hover:text-[#9B7E67] transition-colors">{translateDB(service.name, isEn)}</span>
                              {service.description && <span className="text-sm text-gray-500 mt-1">{translateDB(service.description, isEn)}</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 'food_plan' && (
                    <motion.div
                      key="step_food_plan"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                      className="min-h-full flex flex-col flex-1 max-md:absolute max-md:inset-0 max-md:overflow-y-auto max-md:p-6 max-md:pb-32"
                    >
                      <div className="shrink-0 mb-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-[#F9F7F4] rounded-full flex items-center justify-center text-[#9B7E67] shadow-sm border border-[#E8D5B7]">
                            <Utensils size={24} />
                          </div>
                        </div>
                        <h3 className="text-3xl font-serif text-[#23211F] mb-2">
                          {isEn ? "Select an Assistance Plan" : "Selecciona un Plan de Asistencia"}
                        </h3>
                      </div>

                      <div className="space-y-6 flex-1 pb-4">
                        <div className="space-y-3 mb-8">
                          {foodServices.filter(s => s.serviceType === 'FOOD_PRICE').map(priceOption => {
                            return (
                              <Counter 
                                key={priceOption.id}
                                label={translateDB(priceOption.name, isEn)} 
                                value={cookSelections[priceOption.id.toString()] || 0} 
                                onChange={(val) => setCookSelections(prev => ({ ...prev, [priceOption.id.toString()]: val }))} 
                                max={(cookSelections[priceOption.id.toString()] || 0) + (Math.max(1, nights - 1) - totalCookServices)} 
                                sublabel={`+${formatPrice(priceOption.price || 0)} / ${isEn ? 'day' : 'día'}`} 
                              />
                            );
                          })}
                        </div>
                        
                        <div className="shrink-0 mt-4">
                          {totalCookServices === 0 && (
                            <p className="text-amber-600 text-sm font-bold mb-3 text-center animate-pulse">
                              {isEn ? 'Please select an Assistance Plan for your days' : 'Por favor selecciona un Plan de Asistencia para tus días'}
                            </p>
                          )}
                          <PremiumButton onClick={nextStep} disabled={totalCookServices === 0}>
                            {dict.modal?.continue} <ArrowRight size={16} />
                          </PremiumButton>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 'menu' && ("""

content = step_2_pattern.sub(new_steps_code, content)

content = content.replace("{step === 4 && (", "{step === 'tours' && (")
content = content.replace("{step === 5 && (", "{step === 'checkout' && (")
content = content.replace("{step === 6 && (", "{step === 'success' && (")

with open('src/components/booking/PremiumBookingModal.tsx', 'w') as f:
    f.write(content)

print("Refactor complete")
