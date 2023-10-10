import React from "react";
import "./App.css";
import GPXViewer from "./components/GPXViewer";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import Backend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";
import translationPT from './languages/pt/translations.json';
import translationEN from './languages/en/translations.json';

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      pt: {
        translation: translationPT
      },
      en: {
        translation: translationEN
      }
    },
    fallbackLng: "en",
    debug: true,
    interpolation: {
      escapeValue: false
    }
  });

function App() {
  return (
    <div className="App">
      {/*<header className="App-header">*/}
      {/*<h1>GPX Viewer</h1>*/}
      {/*</header>*/}
      <GPXViewer />
    </div>
  );
}

export default App;
