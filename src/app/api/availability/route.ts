import {calaConfiguration} from '@/lib/cala/config';
import { activeBookingWhere, activeServiceWhere } from '@/lib/bookingPolicy';
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { expandRecurringPricing } from '@/lib/pricing';
import { getLodgings, getLodgingAvailability } from '@/lib/lodgings.server';

export async function GET(request: Request) {
  if(!calaConfiguration().ready)return NextResponse.json({error:"Las reservas están en preparación. Contacta al alojamiento para consultar disponibilidad."},{status:503});
  try {
    const lodgingId = request ? new URL(request.url).searchParams.get('lodgingId') : null;
    const catalog = await getLodgings();
    if (lodgingId || catalog.length) {
      if (!lodgingId || !catalog.some(l => l.id === lodgingId)) return NextResponse.json({error: 'Selecciona la casa completa o una habitación.'}, {status: 400});
      const [data, serviceBlocks, tours] = await Promise.all([
        getLodgingAvailability(lodgingId),
        prisma.serviceBlockedDate.findMany({where: {endDate: {gte: new Date()}}}),
        prisma.serviceBooking.findMany({where: {serviceType: 'TOUR', ...activeServiceWhere(), endDate: {gte: new Date()}}}),
      ]);
      const previousDay = (day: string) => new Date(Date.parse(day + 'T00:00:00Z') - 86400000).toISOString().slice(0,10);
      const bookedRanges = data.reservations.map(r => ({from: r.checkIn, to: previousDay(r.checkOut)}));
      const blockedRanges = [...data.blocks.filter(b => !b.buffer), ...data.salesClosures].map(b => ({from: b.startDate, to: b.endDate}));
      const bufferRanges = data.blocks.filter(b => b.buffer).map(b => ({from: b.startDate, to: b.endDate}));
      const closedRates = data.pricingRules.filter(r => r.closed).map(r => ({from: r.date, to: r.date}));
      const tourBookedDates: string[] = [];
      for (const tour of tours) {
        for (let day = new Date(tour.startDate); day <= new Date(tour.endDate); day.setUTCDate(day.getUTCDate()+1)) tourBookedDates.push(day.toISOString().slice(0,10));
      }
      return NextResponse.json({lodgingId, disabledRanges: [...bookedRanges, ...blockedRanges, ...bufferRanges, ...closedRates], bookedRanges, blockedRanges, bufferRanges, tourBookedDates,
        foodBlockedRanges: serviceBlocks.filter(b => b.serviceType === 'FOOD').map(b => ({from: b.startDate, to: b.endDate})),
        tourBlockedRanges: serviceBlocks.filter(b => b.serviceType === 'TOUR').map(b => ({from: b.startDate, to: b.endDate})),
        pricingRules: data.pricingRules, propertySettings: {...data, reservations: undefined, blocks: undefined, salesClosures: undefined, pricingRules: undefined},
      }, {headers: {'Cache-Control':'no-store'}});
    }
    const property = await prisma.property.findFirst({
      where:{isActive:true},orderBy:{id:"asc"},
      include: {
        pricingRules: true
      }
    });
    
    if (!property) {
      return NextResponse.json({ error: 'Alojamiento sin configurar' }, {status:503});
    }

    // Get all manual blocks for this property that are in the future (or current month)
    let blocks = await prisma.blockedDate.findMany({
      where: {
        propertyId: property.id,
        endDate: { gte: new Date() }
      }
    });

    // Get all confirmed bookings AND valid pending bookings
    let bookings = await prisma.booking.findMany({
      where: {
        propertyId: property.id,
        ...activeBookingWhere(),
        checkOut: { gte: new Date() }
      }
    });

    let canonical: {pricingRules: {date:string;priceOverride:number}[];basePrice:number}|null=null;
    if(process.env.DATA_BACKEND==='supabase') {
      const rows=await prisma.$queryRaw<Array<{data:{reservations:Array<{checkIn:string;checkOut:string}>;blocks:Array<{startDate:string;endDate:string}>;pricingRules:Array<{date:string;priceOverride:number}>;basePrice:number}}>>`SELECT site.cala_availability(${property.id}::integer) AS data`;
      if(!rows[0])throw new Error('CALA_MAPPING_MISSING');
      const dto=rows[0].data;canonical=dto;
      bookings=dto.reservations.map(row=>({...row,checkIn:new Date(row.checkIn),checkOut:new Date(row.checkOut)})) as typeof bookings;
      blocks=dto.blocks.map(row=>({...row,startDate:new Date(row.startDate),endDate:new Date(row.endDate)})) as typeof blocks;
    }
    // Get all TOUR service bookings
    const tourBookings = await prisma.serviceBooking.findMany({
      where: {
        serviceType: 'TOUR',
        ...activeServiceWhere(),
        endDate: { gte: new Date() }
      }
    });

    // We will send back a list of blocked ranges split by type
    const disabledRanges = [];
    const bookedRanges = [];
    const bufferRanges = [];
    const blockedRanges = [];
    const tourBookedDates = []; // List of specific dates that have a tour booked
    const foodBlockedRanges = [];
    const tourBlockedRanges = [];

    // Get service blocks
    let serviceBlocks: any[] = [];
    try {
      serviceBlocks = await prisma.serviceBlockedDate.findMany({
        where: {
          endDate: { gte: new Date() }
        }
      });
    } catch (error) {
      console.warn("Could not fetch service blocked dates (table might not exist):", error);
    }

    for (const sb of serviceBlocks) {
      if (sb.serviceType === 'FOOD') {
        foodBlockedRanges.push({ from: sb.startDate, to: sb.endDate });
      } else if (sb.serviceType === 'TOUR') {
        tourBlockedRanges.push({ from: sb.startDate, to: sb.endDate });
      }
    }

    for (const b of blocks) {
      disabledRanges.push({ from: b.startDate, to: b.endDate });
      blockedRanges.push({ from: b.startDate, to: b.endDate });
    }

    for (const b of bookings) {
      disabledRanges.push({ from: b.checkIn, to: b.checkOut });
      
      // The booked nights
      const checkoutMinusOne = new Date(b.checkOut);
      checkoutMinusOne.setUTCDate(checkoutMinusOne.getUTCDate() - 1);
      if (b.checkIn <= checkoutMinusOne) {
        bookedRanges.push({ from: b.checkIn, to: checkoutMinusOne });
      }
      
      // The buffer day (checkout day itself)
      bufferRanges.push({ from: b.checkOut, to: b.checkOut });
    }

    // Populate tour booked dates
    for (const t of tourBookings) {
      let d = new Date(t.startDate);
      d.setUTCHours(0,0,0,0);
      const end = new Date(t.endDate);
      end.setUTCHours(0,0,0,0);
      while (d <= end) {
        tourBookedDates.push(d.toISOString());
        d = new Date(d.setUTCDate(d.getUTCDate() + 1));
      }
    }

    return NextResponse.json({ 
      disabledRanges,
      bookedRanges,
      bufferRanges,
      blockedRanges,
      tourBookedDates,
      foodBlockedRanges,
      tourBlockedRanges,
      pricingRules: canonical?.pricingRules ?? expandRecurringPricing(property.pricingRules || []),
      propertySettings: {
        checkInTime: "15:00",
        checkOutTime: "12:00",
        basePrice: canonical?.basePrice ?? property.basePrice
      }
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 });
  }
}
