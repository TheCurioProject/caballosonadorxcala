const fs = require('fs');
const path = require('path');

const files = [
  "src/app/[lang]/checkout/success/page.tsx",
  "src/app/[lang]/events/page.tsx",
  "src/app/[lang]/layout.tsx",
  "src/app/[lang]/politicas/page.tsx",
  "src/app/[lang]/rooms/page.tsx",
  "src/app/admin/bookings/page.tsx",
  "src/app/admin/calendar/page.tsx",
  "src/app/admin/ical/page.tsx",
  "src/app/admin/page.tsx",
  "src/app/admin/settings/page.tsx",
  "src/app/api/checkout_sessions/route.ts",
  "src/app/layout.tsx",
  "src/components/Footer.tsx",
  "src/components/home/Hero.tsx",
  "src/components/home/Location.tsx",
  "src/components/home/Reviews.tsx",
  "src/components/pdf/InvoicePDF.tsx",
  "src/components/ui/AnimatedHorse.tsx",
  "src/i18n/dictionaries/en.json",
  "src/i18n/dictionaries/es.json",
  "src/lib/resend.ts"
];

let changedFiles = 0;

for (const file of files) {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    const newContent = content.replace(/Casa del Caballo Soñador/g, 'Casa Caballo Soñador');
    if (content !== newContent) {
      fs.writeFileSync(fullPath, newContent);
      changedFiles++;
      console.log(`Updated ${file}`);
    }
  } else {
    console.warn(`File not found: ${file}`);
  }
}

console.log(`Total files updated: ${changedFiles}`);
