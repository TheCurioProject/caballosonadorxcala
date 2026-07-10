const fs = require('fs');

const esPath = '/Users/macmini1tb/Desktop/hotelsonador/src/i18n/dictionaries/es.json';
const enPath = '/Users/macmini1tb/Desktop/hotelsonador/src/i18n/dictionaries/en.json';

const esData = JSON.parse(fs.readFileSync(esPath, 'utf8'));
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

const roomNames = {
  "1": "Paso Suave",
  "2": "Estrella",
  "3": "La Luna",
  "4": "Campo Abierto",
  "6": "Madera Viva",
  "7": "El Sueño del Mar"
};

for (const [id, name] of Object.entries(roomNames)) {
  if (esData.roomsData[id]) esData.roomsData[id].name = name;
  if (enData.roomsData[id]) enData.roomsData[id].name = name;
}

esData.suites.roomPrefix = "Habitación";
enData.suites.roomPrefix = "Room";

fs.writeFileSync(esPath, JSON.stringify(esData, null, 2));
fs.writeFileSync(enPath, JSON.stringify(enData, null, 2));
console.log("Updated dictionaries.");
