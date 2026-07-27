export async function getTranslations(text: string): Promise<{ en: string, es: string }> {
  if (!text || text.trim() === '') {
    return { en: '', es: '' };
  }

  try {
    const urlEn = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    const resEn = await fetch(urlEn);
    const dataEn = await resEn.json();
    
    // data[2] often contains the detected source language ('es', 'en', etc.)
    const detectedLang = dataEn[2] || 'es';
    const translatedToEn = dataEn[0].map((item: any) => item[0]).join('');

    if (detectedLang === 'en') {
      // Original text was English, translate to Spanish
      const urlEs = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=${encodeURIComponent(text)}`;
      const resEs = await fetch(urlEs);
      const dataEs = await resEs.json();
      const translatedToEs = dataEs[0].map((item: any) => item[0]).join('');
      return { en: text, es: translatedToEs };
    } else {
      // Original was Spanish (or another language), so translatedToEn is English. Original is Spanish.
      return { en: translatedToEn, es: text };
    }
  } catch (error) {
    console.error('Error during automatic translation:', error);
    // Fallback: return the same text for both if API fails
    return { en: text, es: text };
  }
}
