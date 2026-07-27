const fs = require('fs');
let content = fs.readFileSync('src/components/booking/PremiumBookingModal.tsx', 'utf8');

// Replace exactly the exact instances of Math.max(1, nights - 1) after the food_plan step
// Specifically these occurrences:
content = content.replace(
  /\{selectedDishes\.length\} \/ \{Math\.max\(1, nights - 1\)\} \{isEn \? 'selected' : 'seleccionados'\}/g,
  "{selectedDishes.length} / {globalMaxDishes} {isEn ? 'selected' : 'seleccionados'}"
);

content = content.replace(
  /\{isEn \n                                    \? `Based on your stay, you can select up to \$\{Math\.max\(1, nights - 1\)\} dishes \(1 per day\)\.` \n                                    : `Basado en tu estadía, puedes seleccionar hasta \$\{Math\.max\(1, nights - 1\)\} platillos \(1 por día\)\.`\}/g,
  "{isEn \\n                                    ? `Based on your selections, please pick ${globalMaxDishes} dish(es).` \\n                                    : `Basado en tus selecciones, elige ${globalMaxDishes} platillo(s).`}"
);

content = content.replace(
  /const maxDishes = Math\.max\(1, nights - 1\);/g,
  "const maxDishes = globalMaxDishes;"
);

content = content.replace(
  /selectedDishes\.length < Math\.max\(1, nights - 1\)/g,
  "selectedDishes.length < globalMaxDishes"
);

content = content.replace(
  /\{isEn \? `Please select \$\{Math\.max\(1, nights - 1\) - selectedDishes\.length\} more dish\(es\)` : `Por favor selecciona \$\{Math\.max\(1, nights - 1\) - selectedDishes\.length\} platillo\(s\) más`\}/g,
  "{isEn ? `Please select ${globalMaxDishes - selectedDishes.length} more dish(es)` : `Por favor selecciona ${globalMaxDishes - selectedDishes.length} platillo(s) más`}"
);

fs.writeFileSync('src/components/booking/PremiumBookingModal.tsx', content);
