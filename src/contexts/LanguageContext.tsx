import { createContext, useContext, useState, type ReactNode } from "react";
import en from "@/i18n/en";
import pt from "@/i18n/pt";

type Lang = "en" | "pt";

const translations = { en, pt } as const;

interface LanguageCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: typeof en;
}

const LanguageContext = createContext<LanguageCtx>({
  lang: "en",
  setLang: () => {},
  t: en,
});

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem("apex_lang");
    return saved === "pt" ? "pt" : "en";
  });

  const setLang = (l: Lang) => {
    localStorage.setItem("apex_lang", l);
    setLangState(l);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
