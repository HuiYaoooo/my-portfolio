import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const LanguageContext=createContext({language:'en',setLanguage:()=>{},t:english=>english});

export function LanguageProvider({children}) {
  const [language,setLanguage]=useState('en');
  const t=useCallback((english,chinese)=>language==='zh'?(chinese??english):english,[language]);
  useEffect(()=>{
    document.documentElement.lang=language==='zh'?'zh-CN':'en';
    document.documentElement.dataset.language=language;
  },[language]);
  const value=useMemo(()=>({language,setLanguage,t}),[language,t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage=()=>useContext(LanguageContext);
