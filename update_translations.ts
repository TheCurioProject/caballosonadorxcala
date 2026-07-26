import fs from 'fs';

const translationsToAdd = `
  "Enchiladas rojas": {
    en: "Red Enchiladas",
    es: "Enchiladas rojas"
  },
  "Tortilla enrollada, rellena de pollo, bañadas de salsa roja sin picante, acompañadas de lechuga, crema, queso y cebolla.": {
    en: "Rolled tortilla filled with chicken, topped with mild red sauce, served with lettuce, sour cream, cheese, and onion.",
    es: "Tortilla enrollada, rellena de pollo, bañadas de salsa roja sin picante, acompañadas de lechuga, crema, queso y cebolla."
  },
  "Chiles rellenos": {
    en: "Stuffed Peppers (Chiles Rellenos)",
    es: "Chiles rellenos"
  },
  "Chile poblano relleno de un guiso de camarón y queso gratinado, bañados de una salsa cremosa roja, acompañado con arroz rojo.": {
    en: "Poblano pepper stuffed with shrimp stew and melted cheese, covered in a creamy red sauce, served with red rice.",
    es: "Chile poblano relleno de un guiso de camarón y queso gratinado, bañados de una salsa cremosa roja, acompañado con arroz rojo."
  },
  "Filete en alcaparras": {
    en: "Caper Fish Fillet",
    es: "Filete en alcaparras"
  },
  "Filete a la plancha sobre una cama de puré de papa, bañado de una salsa con mantequilla y alcaparras.": {
    en: "Grilled fish fillet served on a bed of mashed potatoes, topped with a butter and caper sauce.",
    es: "Filete a la plancha sobre una cama de puré de papa, bañado de una salsa con mantequilla y alcaparras."
  },
  "Tacos de asada y adobada": {
    en: "Asada and Adobada Tacos",
    es: "Tacos de asada y adobada"
  },
  "Tortilla de maíz con carne, cilantro y cebolla. Se acompaña con variedad de salsas.": {
    en: "Corn tortilla with meat, cilantro, and onion. Served with a variety of salsas.",
    es: "Tortilla de maíz con carne, cilantro y cebolla. Se acompaña con variedad de salsas."
  },
  "Spaguetti con camarones": {
    en: "Shrimp Spaghetti",
    es: "Spaguetti con camarones"
  },
  "Spaguetti con camarones en salsa Alfredo.": {
    en: "Spaghetti with shrimp in Alfredo sauce.",
    es: "Spaguetti con camarones en salsa Alfredo."
  },
  "Filete empapelado": {
    en: "Fish Foil Packets (Filete empapelado)",
    es: "Filete empapelado"
  },
  "Filete sazonado con finas hierbas, envuelto en papel y acompañado de verduras salteadas y arroz.": {
    en: "Fish fillet seasoned with fine herbs, wrapped in foil, and served with sautéed vegetables and rice.",
    es: "Filete sazonado con finas hierbas, envuelto en papel y acompañado de verduras salteadas y arroz."
  },
`;

const file = 'src/components/booking/PremiumBookingModal.tsx';
let content = fs.readFileSync(file, 'utf-8');
content = content.replace(
  '"Ambos"\\n  }',
  '"Ambos"\\n  },' + translationsToAdd
);
fs.writeFileSync(file, content);
