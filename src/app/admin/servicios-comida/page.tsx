import { getFoodServices, getFoodBookings, updateServicePrice } from './actions';
import { revalidatePath } from 'next/cache';
import { Utensils, Calendar as CalendarIcon } from 'lucide-react';

export default async function ServiciosComidaAdminPage() {
  const services = await getFoodServices();
  const bookings = await getFoodBookings();

  async function handleUpdatePrice(formData: FormData) {
    'use server';
    const id = parseInt(formData.get('id') as string);
    const price = parseFloat(formData.get('price') as string);
    if (!isNaN(id) && !isNaN(price)) {
      await updateServicePrice(id, price);
      revalidatePath('/admin/servicios-comida');
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto font-sans">
      <div className="mb-10 flex items-center gap-4">
        <div className="p-4 bg-[#9B7E67]/10 rounded-full text-[#9B7E67]">
          <Utensils size={32} />
        </div>
        <div>
          <h1 className="text-4xl font-serif text-[#2C2621]">Servicios de Comida</h1>
          <p className="text-gray-500 mt-1">Gestiona los precios y las reservas de alimentos (Cocinero Privado).</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Precios Section */}
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-2xl font-serif text-[#2C2621] mb-6 flex items-center gap-3">
            <span className="w-8 h-[2px] bg-[#9B7E67]"></span> Precios Base (MXN)
          </h2>
          <div className="space-y-6">
            {services.map(service => (
              <div key={service.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <h3 className="font-bold text-gray-800">{service.name}</h3>
                  <p className="text-xs text-gray-500">{service.description}</p>
                </div>
                <form action={handleUpdatePrice} className="mt-4 sm:mt-0 flex items-center gap-2">
                  <input type="hidden" name="id" value={service.id} />
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                    <input 
                      type="number" 
                      name="price" 
                      defaultValue={service.price} 
                      className="w-24 pl-7 pr-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#9B7E67] focus:border-transparent outline-none"
                    />
                  </div>
                  <button type="submit" className="bg-[#2C2621] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#9B7E67] transition-colors">
                    Guardar
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>

        {/* Reservas Section */}
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-2xl font-serif text-[#2C2621] mb-6 flex items-center gap-3">
            <span className="w-8 h-[2px] bg-[#9B7E67]"></span> Reservas de Comida
          </h2>
          
          {bookings.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
              <CalendarIcon className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No hay reservas de comida registradas aún.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map(booking => (
                <div key={booking.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-gray-800">{booking.guestName}</h3>
                    <p className="text-sm text-gray-600">{booking.guestEmail}</p>
                    <p className="text-xs text-[#9B7E67] mt-1 font-bold">
                      {new Date(booking.startDate).toLocaleDateString()} - {JSON.parse(booking.serviceDetails || '{}').serviceName || 'Servicio'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="block font-serif text-lg">${booking.totalPrice}</span>
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
