import {test,expect} from 'vitest';
import {validateAddonDates,type VerifiedItem} from '../../src/lib/bookingPolicy';
const item=(date:string,type='FOOD_1'):VerifiedItem=>({type,name:'Comida',quantity:1,unitPrice:100,price:100,details:JSON.stringify({date})});
test('extras stay within the chosen dates, including a departure-day meal',()=>{
 expect(()=>validateAddonDates([item('2027-01-03')],'2027-01-01','2027-01-03')).not.toThrow();
 expect(()=>validateAddonDates([item('2027-01-04')],'2027-01-01','2027-01-03')).toThrow();
});
test('invalid dates and contradictory date suffixes cannot bypass validation',()=>{
 expect(()=>validateAddonDates([item('2027-02-30')],'2027-02-01','2027-03-03')).toThrow();
 expect(()=>validateAddonDates([item('2027-01-02','TOUR_1_2027-01-03')],'2027-01-01','2027-01-04')).toThrow();
});
