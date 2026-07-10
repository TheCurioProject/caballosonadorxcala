const fs = require('fs');

const esPath = '/Users/macmini1tb/Desktop/hotelsonador/src/i18n/dictionaries/es.json';
const enPath = '/Users/macmini1tb/Desktop/hotelsonador/src/i18n/dictionaries/en.json';

const esData = JSON.parse(fs.readFileSync(esPath, 'utf8'));
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

esData.location = {
  title: "Descubre Chacala",
  subtitle: "Ubicación",
  intro1: 'Escondida en una pequeña cala a lo largo de la costa del Pacífico en el estado de Nayarit, Chacala destaca por su encanto único y belleza prístina. Al proporcionar una escapada serena, el pueblo cuenta con playas sin aglomeraciones y un ambiente acogedor.',
  intro2: 'El nombre del pueblo, que significa "donde hay camarones" en náhuatl, refleja su conexión con la cultura local y la abundante vida marina, añadiendo al carácter distintivo de esta joya costera.',
  findUs: 'Encuéntranos',
  riviera: 'Riviera Nayarit'
};

enData.location = {
  title: "Discover Chacala",
  subtitle: "Location",
  intro1: 'Hidden in a small cove along the Pacific coast in the state of Nayarit, Chacala stands out for its unique charm and pristine beauty. Providing a serene getaway, the village boasts uncrowded beaches and a welcoming atmosphere.',
  intro2: 'The town\'s name, meaning "where there are shrimp" in Nahuatl, reflects its connection to local culture and abundant marine life, adding to the distinctive character of this coastal gem.',
  findUs: 'Find Us',
  riviera: 'Riviera Nayarit'
};

fs.writeFileSync(esPath, JSON.stringify(esData, null, 2));
fs.writeFileSync(enPath, JSON.stringify(enData, null, 2));
console.log("Updated location texts.");
