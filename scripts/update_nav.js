const fs = require('fs');

const esPath = '/Users/macmini1tb/Desktop/hotelsonador/src/i18n/dictionaries/es.json';
const enPath = '/Users/macmini1tb/Desktop/hotelsonador/src/i18n/dictionaries/en.json';

const esData = JSON.parse(fs.readFileSync(esPath, 'utf8'));
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

if (!esData.nav) esData.nav = {};
if (!enData.nav) enData.nav = {};

esData.nav.rooms = "Habitaciones";
enData.nav.rooms = "Rooms";

fs.writeFileSync(esPath, JSON.stringify(esData, null, 2));
fs.writeFileSync(enPath, JSON.stringify(enData, null, 2));
console.log("Updated nav texts.");
