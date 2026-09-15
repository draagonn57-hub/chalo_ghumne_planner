import { createContext, useContext, useMemo, useState } from "react";

const dict = {
  en: {
    plan_my_trip: "Plan My Trip",
    login: "Log in",
    signup: "Sign up",
    logout: "Log out",
    profile: "Profile",
    dashboard: "Dashboard",
    admin: "Admin",
    tagline: "Journeys designed by intelligence, told with soul.",
    hero_sub: "Answer a few questions. Our AI crafts a day-by-day itinerary with hotels, food, transport, and hidden landmarks — tuned to your taste.",
    how_it_works: "How Voyage works",
    step1: "Tell us your vibe",
    step1_d: "A short questionnaire covers diet, budget, duration, interests, and who's coming along.",
    step2: "AI drafts your trip",
    step2_d: "Our engine matches destinations, stays, and moments that fit — with an explanation for every choice.",
    step3: "Refine & save",
    step3_d: "Swap activities, save trips, and revisit them on any device.",
    popular: "Popular right now",
    view_all: "View all",
  },
  es: {
    plan_my_trip: "Planea mi viaje",
    login: "Ingresar",
    signup: "Registrarse",
    logout: "Salir",
    profile: "Perfil",
    dashboard: "Panel",
    admin: "Admin",
    tagline: "Viajes diseñados por inteligencia, contados con alma.",
    hero_sub: "Responde unas preguntas. Nuestra IA crea un itinerario diario con hoteles, comida, transporte y lugares ocultos — a tu medida.",
    how_it_works: "Cómo funciona Voyage",
    step1: "Cuéntanos tu estilo",
    step1_d: "Un breve cuestionario cubre dieta, presupuesto, duración, intereses y compañía.",
    step2: "La IA diseña tu viaje",
    step2_d: "Nuestro motor combina destinos, hoteles y momentos que encajan — con una razón para cada elección.",
    step3: "Ajusta y guarda",
    step3_d: "Cambia actividades, guarda viajes y revísalos desde cualquier dispositivo.",
    popular: "Populares ahora",
    view_all: "Ver todos",
  },
  hi: {
    plan_my_trip: "मेरी यात्रा योजना",
    login: "लॉग इन",
    signup: "साइन अप",
    logout: "लॉग आउट",
    profile: "प्रोफ़ाइल",
    dashboard: "डैशबोर्ड",
    admin: "एडमिन",
    tagline: "बुद्धिमत्ता से रचित यात्राएँ, आत्मा से कही गयीं।",
    hero_sub: "कुछ प्रश्नों के उत्तर दीजिये। हमारा AI होटल, भोजन, परिवहन और छिपे स्थलों के साथ आपके स्वाद का दैनिक कार्यक्रम तैयार करेगा।",
    how_it_works: "Voyage कैसे काम करता है",
    step1: "अपनी पसंद बताइये",
    step1_d: "आहार, बजट, अवधि, रुचियाँ और साथी — एक छोटा सा प्रश्नोत्तर।",
    step2: "AI आपका दौरा बनायेगा",
    step2_d: "हमारा इंजन आपके लिए सही जगह, ठहराव और पल चुनेगा — हर चुनाव के कारण के साथ।",
    step3: "बदलें और सहेजें",
    step3_d: "गतिविधियाँ बदलें, यात्राएँ सहेजें और किसी भी डिवाइस पर देखें।",
    popular: "अभी लोकप्रिय",
    view_all: "सब देखें",
  },
};

const LangCtx = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState(localStorage.getItem("tp_lang") || "en");
  const t = useMemo(() => (key) => (dict[lang] && dict[lang][key]) || dict.en[key] || key, [lang]);
  const change = (l) => { setLang(l); localStorage.setItem("tp_lang", l); };
  return <LangCtx.Provider value={{ lang, t, setLang: change }}>{children}</LangCtx.Provider>;
}

export const useLang = () => useContext(LangCtx);
