'use client';

import React, { createContext, useContext } from 'react';

type Dictionary = any; // We'll keep it as any for flexibility

const DictionaryContext = createContext<Dictionary>(null);

export const DictionaryProvider = ({
  dict,
  children,
}: {
  dict: Dictionary;
  children: React.ReactNode;
}) => {
  return (
    <DictionaryContext.Provider value={dict}>
      {children}
    </DictionaryContext.Provider>
  );
};

export const useDictionary = () => {
  const context = useContext(DictionaryContext);
  if (!context) {
    throw new Error('useDictionary must be used within a DictionaryProvider');
  }
  return context;
};
