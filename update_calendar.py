import re

with open('src/app/admin/bookings/BookingCalendarClient.tsx', 'r') as f:
    content = f.read()

# 1. Imports
content = content.replace("from 'lucide-react';", "Lock, DollarSign } from 'lucide-react';")
content = content.replace("CheckCircle, Download }", "CheckCircle, Download,")

# 2. Types and Props
content = content.replace("type Booking = { checkIn: Date; checkOut: Date; };", "type Booking = { checkIn: Date; checkOut: Date; };\ntype PricingRule = { date: Date; priceOverride: number; };")
props_interface = """interface BookingCalendarProps {
  bookings: Booking[];
  blocks: BlockedDate[];
  pricingRules?: PricingRule[];
  addManualBooking: (formData: FormData) => Promise<{ success: boolean; bookingId?: number; error?: string }>;
  manageDateRange?: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
  basePrice: number;
}"""
content = re.sub(r"interface BookingCalendarProps \{.*?\n\}", props_interface, content, flags=re.DOTALL)

# 3. Component signature and state
old_sig = "export default function BookingCalendarClient({ bookings, blocks, addManualBooking, basePrice }: BookingCalendarProps) {"
new_sig = """export default function BookingCalendarClient({ bookings, blocks, pricingRules = [], addManualBooking, manageDateRange, basePrice }: BookingCalendarProps) {
  const [activeTab, setActiveTab] = useState<'booking' | 'block' | 'price'>('booking');
  const [manualPrice, setManualPrice] = useState<number>(basePrice);
  
  useEffect(() => {
    setCheckIn(null);
    setCheckOut(null);
  }, [activeTab]);"""
content = content.replace(old_sig, new_sig)

# 4. isDateUnavailable
old_is_unav = """  const isDateUnavailable = (day: Date) => {
    if (day < new Date(new Date().setHours(0,0,0,0))) return true;

    const isBlocked = blocks.some(b => {"""
new_is_unav = """  const isDateUnavailable = (day: Date) => {
    if (day < new Date(new Date().setHours(0,0,0,0))) return true;
    if (activeTab === 'block' || activeTab === 'price') return false;

    const isBlocked = blocks.some(b => {"""
content = content.replace(old_is_unav, new_is_unav)

# 5. handleDayClick
old_click = """  const handleDayClick = (day: Date) => {
    if (isDateUnavailable(day) && !checkIn) return;

    if (!checkIn) {
      setCheckIn(day);
      setCheckOut(null);
    } else if (checkIn && !checkOut) {
      if (day <= checkIn) {
        setCheckIn(day);
      } else {
        let d = addDays(checkIn, 1);
        let valid = true;
        while (d < day) {
          if (isDateUnavailable(d)) {
            valid = false;
            break;
          }
          d = addDays(d, 1);
        }
        if (valid) {
          setCheckOut(day);
        } else {
          setCheckIn(day);
        }
      }
    } else {
      setCheckIn(day);
      setCheckOut(null);
    }
  };"""
new_click = """  const handleDayClick = (day: Date) => {
    if (isDateUnavailable(day) && !checkIn) return;

    if (!checkIn) {
      setCheckIn(day);
      setCheckOut(activeTab === 'booking' ? null : day);
    } else if (checkIn && (!checkOut || isSameDay(checkIn, checkOut) || activeTab !== 'booking')) {
      if (day < checkIn) {
        setCheckIn(day);
        if (activeTab !== 'booking') setCheckOut(day);
      } else {
        let d = addDays(checkIn, 1);
        let valid = true;
        if (activeTab === 'booking') {
          while (d < day) {
            if (isDateUnavailable(d)) {
              valid = false;
              break;
            }
            d = addDays(d, 1);
          }
        }
        if (valid) {
          setCheckOut(day);
        } else {
          setCheckIn(day);
          if (activeTab !== 'booking') setCheckOut(day);
        }
      }
    } else {
      setCheckIn(day);
      setCheckOut(activeTab === 'booking' ? null : day);
    }
  };"""
content = content.replace(old_click, new_click)

# 6. useEffect price calc
old_eff = """  useEffect(() => {
    if (checkIn && checkOut) {
      const nights = differenceInDays(checkOut, checkIn);
      setCalculatedPrice(nights * basePrice);
    } else {
      setCalculatedPrice(0);
    }
  }, [checkIn, checkOut, basePrice]);"""
new_eff = """  useEffect(() => {
    if (checkIn && checkOut && activeTab === 'booking') {
      const nights = differenceInDays(checkOut, checkIn);
      let total = 0;
      let d = new Date(checkIn);
      for(let i=0; i<nights; i++) {
        const rule = pricingRules.find(r => isSameDay(new Date(r.date), d));
        total += rule ? rule.priceOverride : basePrice;
        d = addDays(d, 1);
      }
      setCalculatedPrice(total);
    } else {
      setCalculatedPrice(0);
    }
  }, [checkIn, checkOut, basePrice, pricingRules, activeTab]);"""
content = content.replace(old_eff, new_eff)

# 7. manageDateRange form handler
manage_form = """
  const onManageSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!checkIn || !checkOut || !manageDateRange) return;
    const formData = new FormData(e.currentTarget);
    formData.append('startDate', checkIn.toISOString());
    formData.append('endDate', checkOut.toISOString());
    
    startTransition(async () => {
      const result = await manageDateRange(formData);
      if (result.success) {
        setToastState({ isOpen: true, message: 'Updated successfully!', type: 'success' });
        setCheckIn(null);
        setCheckOut(null);
      } else {
        setToastState({ isOpen: true, message: result.error || 'Error updating', type: 'error' });
      }
    });
  };
"""
content = content.replace("const onSubmit =", manage_form + "\n  const onSubmit =")

# 8. Render days logic
old_bgclass = """                let bgClass = "bg-[#F9F7F4] hover:bg-[#E5D9C5] border border-[#D4C3AB]/40 cursor-pointer shadow-sm transition-all";
                let textClass = "text-[#23211F] font-medium";

                if (!isCurrentMonth) {
                  bgClass = "bg-transparent opacity-0 pointer-events-none";
                } else if (checkIn && checkOut && (isSameDay(day, checkIn) || isSameDay(day, checkOut))) {
                  bgClass = "bg-[#9B7E67] shadow-md";
                  textClass = "text-[#F9F7F4] font-bold";
                } else if (checkIn && !checkOut && isSameDay(day, checkIn)) {
                  bgClass = "bg-[#9B7E67] shadow-md"; 
                  textClass = "text-[#F9F7F4] font-bold";
                } else if (checkIn && checkOut && day > checkIn && day < checkOut) {
                  bgClass = "bg-[#D4A574] shadow-sm opacity-90";
                  textClass = "text-[#23211F] font-bold";
                } else if (isPast) {
                  bgClass = "bg-gray-50 border border-gray-200 cursor-not-allowed";
                  textClass = "text-gray-400 font-medium";
                } else if (isBooked || isBlocked) {
                  bgClass = "bg-[#c1121f] cursor-not-allowed shadow-inner";
                  textClass = "text-white font-bold";
                } else if (isCleaning) {
                  bgClass = "bg-[#D4A574] cursor-pointer shadow-sm border border-[#c9955c]";
                  textClass = "text-[#23211F] font-bold";
                }"""
new_bgclass = """                let bgClass = "bg-[#F9F7F4] hover:bg-[#E5D9C5] border border-[#D4C3AB]/40 cursor-pointer shadow-sm transition-all";
                let textClass = "text-[#23211F] font-medium";
                const hasPriceRule = pricingRules.find(r => isSameDay(new Date(r.date), day));
                const inRange = checkIn && checkOut && day >= checkIn && day <= checkOut;

                if (!isCurrentMonth) {
                  bgClass = "bg-transparent opacity-0 pointer-events-none";
                } else if (checkIn && checkOut && (isSameDay(day, checkIn) || isSameDay(day, checkOut))) {
                  bgClass = "bg-[#9B7E67] shadow-md";
                  textClass = "text-[#F9F7F4] font-bold";
                } else if (checkIn && !checkOut && isSameDay(day, checkIn)) {
                  bgClass = "bg-[#9B7E67] shadow-md"; 
                  textClass = "text-[#F9F7F4] font-bold";
                } else if (inRange) {
                  bgClass = "bg-[#D4A574] shadow-sm opacity-90";
                  textClass = "text-[#23211F] font-bold";
                } else if (isPast) {
                  bgClass = "bg-gray-50 border border-gray-200 cursor-not-allowed";
                  textClass = "text-gray-400 font-medium";
                } else if (isBooked || (isBlocked && activeTab === 'booking')) {
                  bgClass = "bg-[#c1121f] cursor-not-allowed shadow-inner";
                  textClass = "text-white font-bold";
                } else if (isBlocked && activeTab !== 'booking') {
                  bgClass = "bg-gray-300 shadow-inner";
                  textClass = "text-gray-600 font-bold";
                } else if (isCleaning) {
                  bgClass = "bg-[#D4A574] cursor-pointer shadow-sm border border-[#c9955c]";
                  textClass = "text-[#23211F] font-bold";
                }"""
content = content.replace(old_bgclass, new_bgclass)

old_day_render = """                    {isCurrentMonth && (
                      <span className={`text-xs sm:text-sm ${textClass}`}>
                        {format(day, 'd')}
                      </span>
                    )}"""
new_day_render = """                    {isCurrentMonth && (
                      <div className="relative flex items-center justify-center w-full h-full">
                        <span className={`text-xs sm:text-sm ${textClass}`}>
                          {format(day, 'd')}
                        </span>
                        {hasPriceRule && (
                          <div className="absolute top-0 right-0 p-[2px] bg-green-500/90 rounded-bl-md rounded-tr-md" title={`$${hasPriceRule.priceOverride}`}>
                            <DollarSign className="w-2 sm:w-3 h-2 sm:h-3 text-white" />
                          </div>
                        )}
                        {isBlocked && (
                          <div className="absolute top-0 left-0 p-[2px] bg-red-600/90 rounded-br-md rounded-tl-md">
                            <Lock className="w-2 sm:w-3 h-2 sm:h-3 text-white" />
                          </div>
                        )}
                      </div>
                    )}"""
content = content.replace(old_day_render, new_day_render)

# 9. Tabs and Forms
old_form_section = "{/* Form or Invoice Prompt Section */}"
new_form_section = """{/* Tabs UI */}
      <div className="flex bg-gray-100 p-1 rounded-xl mx-auto w-full max-w-lg mb-2">
        <button
          onClick={() => setActiveTab('booking')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors uppercase tracking-widest ${activeTab === 'booking' ? 'bg-white shadow-sm text-[#23211F]' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Nueva Reserva
        </button>
        <button
          onClick={() => setActiveTab('block')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors uppercase tracking-widest ${activeTab === 'block' ? 'bg-white shadow-sm text-[#23211F]' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Bloquear Fechas
        </button>
        <button
          onClick={() => setActiveTab('price')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors uppercase tracking-widest ${activeTab === 'price' ? 'bg-white shadow-sm text-[#23211F]' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Precio Manual
        </button>
      </div>

      {/* Form or Invoice Prompt Section */}"""
content = content.replace(old_form_section, new_form_section)

old_booking_form_start = """            <motion.div
              key="booking-form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <h3 className="text-xl font-serif text-[#23211F] mb-6 flex items-center gap-2">
                <User className="w-5 h-5 text-[#9B7E67]" />
                Guest Details
              </h3>"""
new_booking_form_start = """            <motion.div
              key="forms"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              {activeTab === 'booking' && (
                <>
                  <h3 className="text-xl font-serif text-[#23211F] mb-6 flex items-center gap-2">
                    <User className="w-5 h-5 text-[#9B7E67]" />
                    Guest Details
                  </h3>"""
content = content.replace(old_booking_form_start, new_booking_form_start)

old_booking_form_end = """                  {isPending ? 'REGISTERING...' : 'CONFIRM BOOKING'}
                </button>
              </form>
            </motion.div>"""
new_booking_form_end = """                  {isPending ? 'REGISTERING...' : 'CONFIRM BOOKING'}
                </button>
              </form>
                </>
              )}

              {activeTab === 'block' && (
                <form onSubmit={onManageSubmit} className="space-y-6">
                  <h3 className="text-xl font-serif text-[#23211F] mb-2 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-red-500" />
                    Block Dates
                  </h3>
                  <p className="text-sm text-gray-500">Select a date or range in the calendar to block or unblock it.</p>
                  
                  <div className="flex gap-4">
                    <button 
                      type="submit" 
                      name="action"
                      value="BLOCK"
                      disabled={!checkIn || !checkOut || isPending}
                      className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs tracking-widest uppercase transition-colors disabled:opacity-50"
                    >
                      {isPending ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
                      Block Selected
                    </button>
                    <button 
                      type="submit" 
                      name="action"
                      value="UNBLOCK"
                      disabled={!checkIn || !checkOut || isPending}
                      className="flex-1 py-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold text-xs tracking-widest uppercase transition-colors disabled:opacity-50"
                    >
                      {isPending ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
                      Unblock
                    </button>
                  </div>
                </form>
              )}

              {activeTab === 'price' && (
                <form onSubmit={onManageSubmit} className="space-y-6">
                  <h3 className="text-xl font-serif text-[#23211F] mb-2 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    Manual Price Override
                  </h3>
                  <p className="text-sm text-gray-500">Set a custom price per night for the selected dates. Base price is ${basePrice}.</p>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">New Price per Night</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-400 font-bold">$</span>
                      </div>
                      <input 
                        type="number" 
                        name="price"
                        value={manualPrice}
                        onChange={e => setManualPrice(parseFloat(e.target.value) || 0)}
                        required 
                        className="w-full border border-gray-200 rounded-xl pl-8 px-3 py-3 text-[#23211F] font-bold text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all" 
                      />
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      type="submit" 
                      name="action"
                      value="SET_PRICE"
                      disabled={!checkIn || !checkOut || isPending}
                      className="flex-1 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs tracking-widest uppercase transition-colors disabled:opacity-50"
                    >
                      {isPending ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
                      Save Price
                    </button>
                    <button 
                      type="submit" 
                      name="action"
                      value="CLEAR_PRICE"
                      disabled={!checkIn || !checkOut || isPending}
                      className="flex-1 py-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold text-xs tracking-widest uppercase transition-colors disabled:opacity-50"
                    >
                      {isPending ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
                      Clear Override
                    </button>
                  </div>
                </form>
              )}
            </motion.div>"""
content = content.replace(old_booking_form_end, new_booking_form_end)

with open('src/app/admin/bookings/BookingCalendarClient.tsx', 'w') as f:
    f.write(content)

print("Updated BookingCalendarClient.tsx successfully.")
