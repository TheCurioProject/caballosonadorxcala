import type { MetadataRoute } from 'next';

const siteUrl = 'https://casadelcaballosonador.com';
const langs = ['es', 'en'] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Static routes per language
  const langRoutes = [
    { path: '', priority: 1.0, changeFrequency: 'weekly' as const },
    { path: '/tours', priority: 0.9, changeFrequency: 'monthly' as const },
    { path: '/servicios-de-comida', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/writers-group', priority: 0.7, changeFrequency: 'weekly' as const },
    { path: '/politicas', priority: 0.3, changeFrequency: 'yearly' as const },
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const lang of langs) {
    for (const route of langRoutes) {
      entries.push({
        url: `${siteUrl}/${lang}${route.path}`,
        lastModified: now,
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates: {
          languages: Object.fromEntries(
            langs.map((l) => [l, `${siteUrl}/${l}${route.path}`])
          ),
        },
      });
    }
  }

  // Root redirect
  entries.push({
    url: siteUrl,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 1.0,
  });

  return entries;
}
