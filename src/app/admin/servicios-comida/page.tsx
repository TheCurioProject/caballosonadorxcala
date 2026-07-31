import { getFoodServices, getFoodBookings, updateServiceDetails } from './actions';
import { revalidatePath } from 'next/cache';
import { Utensils, Calendar as CalendarIcon } from 'lucide-react';

export default async function ServiciosComidaAdminPage() {
  let services: any[] = [];
  let bookings: any[] = [];
  try {
    const fetchServices = getFoodServices();
    const fetchBookings = getFoodBookings();
    const timeout = new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('Prisma timeout')), 12000));
    services = await Promise.race([fetchServices, timeout]);
    bookings = await Promise.race([fetchBookings, timeout]);
  } catch (error) {
    console.warn("Failed to fetch food services/bookings from Prisma:", error);
  }

  async function handleUpdateService(formData: FormData) {
    'use server';
    const id = parseInt(formData.get('id') as string);
    const price = parseFloat(formData.get('price') as string);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    
    if (!isNaN(id) && !isNaN(price) && name && description) {
      await updateServiceDetails(id, price, name, description);
      revalidatePath('/admin/servicios-comida');
    }
  }


  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto font-sans">
      <div className="mb-10 flex items-center gap-4">
        <div className="p-4 bg-[#9B7E67]/10 rounded-full text-[#9B7E67] shrink-0">
          <Utensils size={32} />
        </div>
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#2C2621]">Food Services</h1>
          <p className="text-gray-500 mt-1 text-base md:text-lg sm:text-base">Manage prices and private chef food bookings.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10">
        {/* Precios Section */}
        <section className="bg-white p-5 sm:p-8 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-2xl font-serif text-[#2C2621] mb-6 flex items-center gap-3">
            <span className="w-8 h-[2px] bg-[#9B7E67]"></span> Base Prices (MXN)
          </h2>
          <div className="space-y-6">
            {services.map(service => (
              <div key={service.id} className="flex flex-col p-4 bg-gray-50 rounded-xl border border-gray-100">
                <form action={handleUpdateService} className="flex flex-col gap-4">
                  <input type="hidden" name="id" value={service.id} />
                  
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 space-y-3">
                      <div>
                        <label className="text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider mb-1 block">Service Name</label>
                        <input 
                          type="text" 
                          name="name" 
                          defaultValue={service.name} 
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#9B7E67] focus:border-transparent outline-none font-bold text-gray-800"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider mb-1 block">Description / Details</label>
                        <textarea 
                          name="description" 
                          defaultValue={service.description || ''} 
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#9B7E67] focus:border-transparent outline-none text-base md:text-lg text-gray-600 resize-none h-20"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="w-full sm:w-32 flex flex-col justify-end gap-3 shrink-0 border-t sm:border-t-0 sm:border-l border-gray-200 pt-4 sm:pt-0 sm:pl-4">
                      <div>
                        <label className="text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider mb-1 block">Base Price</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                          <input 
                            type="number" 
                            name="price" 
                            defaultValue={service.price} 
                            className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#9B7E67] focus:border-transparent outline-none font-medium"
                            required
                          />
                        </div>
                      </div>
                      <button type="submit" className="w-full bg-[#2C2621] text-white px-4 py-2 rounded-lg text-base md:text-lg hover:bg-[#9B7E67] transition-colors font-medium">
                        Save
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            ))}
          </div>
        </section>

        {/* Reservas Section */}
        <section className="bg-white p-5 sm:p-8 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-2xl font-serif text-[#2C2621] mb-6 flex items-center gap-3">
            <span className="w-8 h-[2px] bg-[#9B7E67]"></span> Food Bookings
          </h2>
          
          {bookings.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
              <CalendarIcon className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No food bookings registered yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map(booking => (
                <div key={booking.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-gray-800">{booking.guestName}</h3>
                    <p className="text-base md:text-lg text-gray-600">{booking.guestEmail}</p>
                    <p className="text-sm md:text-base text-[#9B7E67] mt-1 font-bold">
                      {new Date(booking.startDate).toLocaleDateString()} - {JSON.parse(booking.serviceDetails || '{}').serviceName || 'Service'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="block font-serif text-xl md:text-2xl">${booking.totalPrice}</span>
                    <span className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-wider font-bold ${
                      booking.paymentStatus === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {booking.paymentStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
