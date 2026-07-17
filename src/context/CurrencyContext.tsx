'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Currency = 'MXN' | 'USD' | 'CAD';

interface Rates {
  usd: number;
  cad: number;
}

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  rates: Rates;
  formatPrice: (amountInMxn: number) => string;
  getConvertedPrice: (amountInMxn: number) => number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>('MXN');
  const [rates, setRates] = useState<Rates>({ usd: 18.8, cad: 17.7 });

  useEffect(() => {
    // Check local storage for saved currency preference
    const saved = localStorage.getItem('preferred_currency') as Currency;
    if (saved && ['MXN', 'USD', 'CAD'].includes(saved)) {
      setCurrencyState(saved);
    }

    // Fetch live rates
    const fetchRates = async () => {
      try {
        const res = await fetch('/api/settings/rates');
        if (res.ok) {
          const data = await res.json();
          setRates({ usd: data.usd, cad: data.cad });
        }
      } catch (err) {
        console.error('Failed to fetch exchange rates', err);
      }
    };
    fetchRates();
  }, []);

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    localStorage.setItem('preferred_currency', c);
  };

  const formatPrice = (amountInMxn: number) => {
    if (currency === 'USD') {
      return `$${Math.round(amountInMxn / rates.usd)} USD`;
    }
    if (currency === 'CAD') {
      return `$${Math.round(amountInMxn / rates.cad)} CAD`;
    }
    return `$${Math.round(amountInMxn)} MXN`;
  };

  const getConvertedPrice = (amountInMxn: number) => {
    if (currency === 'USD') return Math.round(amountInMxn / rates.usd);
    if (currency === 'CAD') return Math.round(amountInMxn / rates.cad);
    return Math.round(amountInMxn);
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rates, formatPrice, getConvertedPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
