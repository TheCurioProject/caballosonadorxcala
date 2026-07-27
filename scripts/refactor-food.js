const fs = require('fs');

let content = fs.readFileSync('src/components/booking/PremiumBookingModal.tsx', 'utf8');

// 1. Insert helper variables after totalCookServices
content = content.replace(
  'const totalCookServices = Object.values(cookSelections).reduce((a, b) => a + b, 0);',
  `const totalCookServices = Object.values(cookSelections).reduce((a, b) => a + b, 0);

  const isDinnerService = (name: string | undefined | null) => name?.toLowerCase().includes('dinner') || name?.toLowerCase().includes('cena');
  
  const getFoodServiceMax = (priceOption: any) => {
    const isDinner = isDinnerService(priceOption.name);
    const limit = isDinner ? Math.max(1, nights) : Math.max(1, nights + 1);
    const currentTotal = foodServices
      .filter(s => s.serviceType === 'FOOD_PRICE' && isDinnerService(s.name) === isDinner)
      .reduce((sum, s) => sum + (cookSelections[s.id.toString()] || 0), 0);
    return limit - currentTotal + (cookSelections[priceOption.id.toString()] || 0);
  };

  const globalMaxDishes = totalCookServices > 0 
    ? totalCookServices 
    : (isDinnerService(selectedCookService?.name) ? Math.max(1, nights) : Math.max(1, nights + 1));`
);

// 2. Update food_plan max logic
content = content.replace(
  /max=\{\(cookSelections\[priceOption\.id\.toString\(\)\] \|\| 0\) \+ \(Math\.max\(1, nights - 1\) - totalCookServices\)\}/g,
  'max={getFoodServiceMax(priceOption)}'
);

// 3. Update food_plan sublabel logic
content = content.replace(
  /sublabel=\{`\+\$\{formatPrice\(priceOption\.price \|\| 0\)\} \/ \$\{isEn \? 'day' : 'día'\}`\}/g,
  'sublabel={`+${formatPrice(priceOption.price || 0)} / ${isDinnerService(priceOption.name) ? (isEn ? "night" : "noche") : (isEn ? "day" : "día")}`}'
);

// 4. Update food_plan instructions text
content = content.replace(
  /\{isEn \? 'Please select an Assistance Plan for your days' : 'Por favor selecciona un Plan de Asistencia para tus días'\}/g,
  "{isEn ? 'Select Assistance (Breakfasts by days of stay, Dinners by nights)' : 'Selecciona tu Asistencia (Desayunos por días de estancia, Cenas por noches)'}"
);
content = content.replace(
  /\{isEn \? "Select an Assistance Plan" : "Selecciona un Plan de Asistencia"\}/g,
  "{isEn ? 'Select an Assistance Plan' : 'Selecciona un Plan de Asistencia'}\n                        </h3>\n                        <p className=\"text-sm text-gray-500 font-light mb-4\">\n                          {isEn ? 'Breakfast & Lunch plans are calculated per days of stay. Dinner plans per nights.' : 'Los planes de desayuno/comida se calculan por días de estancia. Las cenas por noches.'}\n                        </p>"
);


// 5. Replace Math.max(1, nights - 1) with globalMaxDishes globally
content = content.replace(/Math\.max\(1, nights - 1\)/g, 'globalMaxDishes');

// 6. Fix specific menu texts that relied on per day limit text (if it's not per day)
content = content.replace(
  /\{isEn \n                                    \? `Based on your stay, you can select up to \$\{globalMaxDishes\} dishes \(1 per day\)\.` \n                                    : `Basado en tu estadía, puedes seleccionar hasta \$\{globalMaxDishes\} platillos \(1 por día\)\.`\}/g,
  "{isEn \n                                    ? `Based on your selections, please pick ${globalMaxDishes} dish(es).` \n                                    : `Basado en tus selecciones, elige ${globalMaxDishes} platillo(s).`}"
);

fs.writeFileSync('src/components/booking/PremiumBookingModal.tsx', content);
console.log('Refactored food logic');
