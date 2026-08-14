export const bilingualDictionary: Record<string, string> = {
  // Food & Addons
  "Breakfast": "Desayuno / Breakfast",
  "Breakfast & Lunch": "Desayuno y Comida / Breakfast & Lunch",
  "Dinner": "Cena / Dinner",
  "Dinner Service (6 to 8 people)": "Servicio de Cena (6 a 8 personas) / Dinner Service (6 to 8 people)",
  "Dinner Service (10 to 12 people)": "Servicio de Cena (10 a 12 personas) / Dinner Service (10 to 12 people)",
  "Breakfast Assistance": "Asistencia de desayuno / Breakfast Assistance",
  "Dinner Assistance": "Asistencia para la cena / Dinner Assistance",
  "Breakfast & Dinner Assistance": "Asistencia para desayuno y cena / Breakfast & Dinner Assistance",
  "Red Enchiladas": "Enchiladas rojas / Red Enchiladas",
  "Stuffed Chiles": "Chiles rellenos / Stuffed Chiles",
  "Fillet in Capers": "Filete en alcaparras / Fillet in Capers",
  "Asada and Adobada Tacos": "Tacos de asada y adobada / Asada and Adobada Tacos",
  "Shrimp Spaghetti": "Spaguetti con camarones / Shrimp Spaghetti",
  "Paper-Wrapped Fillet": "Filete empapelado / Paper-Wrapped Fillet",
  // Tours
  "Water Eye": "Ojo de Agua / Water Eye",
  "Molote River": "Río Molote / Molote River",
  "The Caves": "Las Cuevas / The Caves",
  // General Services
  "Personalized Service": "Servicio Personalizado / Personalized Service",
  "Dinner Service": "Servicio de Cena / Dinner Service",
  "Tour": "Recorrido / Tour",
  "Transportation": "Transporte / Transportation",
  "Food": "Comida / Food",
  "Workshop": "Taller / Workshop",
  "Massage": "Masaje / Massage",
  "Yoga": "Yoga",
  "Meditation": "Meditación / Meditation",
  "Retreat": "Retiro / Retreat",
  "Event": "Evento / Event",
  // Extras
  "Early Check-in": "Llegada Anticipada / Early Check-in",
  "Late Check-out": "Salida Tardía / Late Check-out",
  "Extra Guest": "Huésped Extra / Extra Guest",
};

export function getBilingualText(text: string | undefined | null): string {
  if (!text) return '';
  
  // Check direct match
  if (bilingualDictionary[text]) {
    return bilingualDictionary[text];
  }
  
  // Check case-insensitive match
  const lowerText = text.toLowerCase().trim();
  const foundKey = Object.keys(bilingualDictionary).find(k => k.toLowerCase() === lowerText);
  if (foundKey) {
    return bilingualDictionary[foundKey];
  }

  // If no match found, fallback to the original text
  return text;
}
