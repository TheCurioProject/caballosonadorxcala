export async function autoTranslate(text: string): Promise<string> {
  if (!text || text.trim() === '') {
    return text;
  }
  
  const trimmed = text.trim();
  
  // If it's already a JSON string (e.g., they tried to use the old format), just use it
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch (e) {
      // Not valid JSON, proceed to translation
    }
  }
  
  // If they used the divider | or /, let's keep it as is since PremiumBookingModal handles it
  if (trimmed.includes(' | ') || trimmed.includes(' / ')) {
    return trimmed;
  }

  try {
    const urlEn = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(trimmed)}`;
    const resEn = await fetch(urlEn);
    const dataEn = await resEn.json();
    
    // data[2] often contains the detected source language ('es', 'en', etc.)
    const detectedLang = dataEn[2] || 'es';
    const translatedToEn = dataEn[0].map((item: any) => item[0]).join('');

    let en = translatedToEn;
    let es = trimmed;

    if (detectedLang === 'en') {
      // Original text was English, translate to Spanish
      const urlEs = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=${encodeURIComponent(trimmed)}`;
      const resEs = await fetch(urlEs);
      const dataEs = await resEs.json();
      es = dataEs[0].map((item: any) => item[0]).join('');
      en = trimmed;
    }

    return JSON.stringify({ en, es, original: trimmed });
  } catch (error) {
    console.error('Error during automatic translation:', error);
    // Fallback: return the same text for both if API fails
    return JSON.stringify({ en: trimmed, es: trimmed, original: trimmed });
  }
}
