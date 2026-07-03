import 'server-only';

const dictionaries = {
  es: () => import('./dictionaries/es.json').then((module) => module.default),
  en: () => import('./dictionaries/en.json').then((module) => module.default),
  de: () => import('./dictionaries/de.json').then((module) => module.default),
};

export const getDictionary = async (locale: 'es' | 'en' | 'de') => {
  return dictionaries[locale]?.() ?? dictionaries.es();
};
