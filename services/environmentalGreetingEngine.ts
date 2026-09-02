import { SupportedLanguage } from '../contexts/LanguageContext';
import { FoodMemoryState } from '../domain/foodMemory';

export type CulinaryEnvironment = 'countertop' | 'pantry' | 'supermarket' | 'farm_market';

export type TimeOfDaySlot = 'morning' | 'afternoon' | 'evening' | 'night';

export interface EnvironmentalContext {
  environment: CulinaryEnvironment;
  timeSlot: TimeOfDaySlot;
  hour: number;
  userName?: string;
  dietary?: string;
  pantryCount: number;
  shoppingCount: number;
  expiringCount: number;
}

export interface ContextualGreetingResult {
  greeting: string;
  promptQuestion: string;
  fullSpokenText: string;
  suggestedActions: string[];
  recommendedSpecialist: 'chef' | 'pantry' | 'shopping' | 'habits';
  environmentLabel: string;
  environmentIcon: string;
  environmentDescription: string;
}

export const CULINARY_ENVIRONMENTS: Record<CulinaryEnvironment, {
  id: CulinaryEnvironment;
  icon: string;
  specialist: 'chef' | 'pantry' | 'shopping' | 'habits';
  translations: Record<SupportedLanguage, { label: string; desc: string }>;
}> = {
  countertop: {
    id: 'countertop',
    icon: 'countertops',
    specialist: 'chef',
    translations: {
      English: { label: 'Kitchen Countertop', desc: 'Step-by-step hands-free cooking & timers' },
      'हिन्दी': { label: 'रसोई काउंटरटॉप', desc: 'हाथों के उपयोग बिना चरण-दर-चरण पकाने का मार्गदर्शन' },
      'తెలుగు': { label: 'వంటగది కౌంటర్‌టాప్', desc: 'హ్యాండ్స్-ఫ్రీ వంట గైడెన్స్ మరియు టైమర్లు' },
      'Español': { label: 'Encimera de Cocina', desc: 'Guía paso a paso manos libres y temporizadores' },
      'Français': { label: 'Plan de Travail', desc: 'Cuisson étape par étape mains libres et minuteurs' },
    },
  },
  pantry: {
    id: 'pantry',
    icon: 'kitchen',
    specialist: 'pantry',
    translations: {
      English: { label: 'Home Pantry & Fridge', desc: 'Inventory audits, freshness & zero-waste' },
      'हिन्दी': { label: 'पेंट्री और फ्रिज', desc: 'सामग्री सूची, ताज़गी और शून्य-अपव्यय योजना' },
      'తెలుగు': { label: 'పాంట్రీ & ఫ్రిజ్', desc: 'సరుకుల జాబితా, తాజాదనం మరియు వేస్ట్ నివారణ' },
      'Español': { label: 'Despensa y Nevera', desc: 'Auditoría de inventario y cero desperdicio' },
      'Français': { label: 'Garde-manger & Frigo', desc: 'Audit d’inventaire et zéro gaspillage' },
    },
  },
  supermarket: {
    id: 'supermarket',
    icon: 'shopping_cart',
    specialist: 'shopping',
    translations: {
      English: { label: 'Supermarket & Aisle', desc: 'Shopping list matching & basket management' },
      'हिन्दी': { label: 'सुपरमार्केट और बाज़ार', desc: 'खरीदारी सूची मिलान और टोकरी प्रबंधन' },
      'తెలుగు': { label: 'సూపర్‌మార్కెట్', desc: 'షాపింగ్ లిస్ట్ సరిపోల్చడం మరియు సరుకులు' },
      'Español': { label: 'Supermercado y Pasillo', desc: 'Lista de compras y gestión de cesta' },
      'Français': { label: 'Supermarché', desc: 'Suivi de liste de courses et panier' },
    },
  },
  farm_market: {
    id: 'farm_market',
    icon: 'local_florist',
    specialist: 'shopping',
    translations: {
      English: { label: 'Farmers Market / Produce', desc: 'Produce freshness, ripeness & ethylene tips' },
      'हिन्दी': { label: 'सब्जी मंडी / ताज़ा उपज', desc: 'सब्जियों की ताज़गी और पके होने की जांच' },
      'తెలుగు': { label: 'రైతు బజార్ / తాజా కూరలు', desc: 'కూరగాయల తాజాదనం మరియు పక్వత పరిశీలన' },
      'Español': { label: 'Mercado Agrícola / Frescos', desc: 'Frescura de productos, madurez y consejos etileno' },
      'Français': { label: 'Marché Fermier / Primeur', desc: 'Fraîcheur des fruits & légumes et maturité' },
    },
  },
};

export const getTimeSlot = (hour: number = new Date().getHours()): TimeOfDaySlot => {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
};

export class EnvironmentalGreetingEngine {
  public static generateGreeting(
    env: CulinaryEnvironment,
    lang: SupportedLanguage,
    contextData: {
      userName?: string;
      dietary?: string;
      memoryState?: FoodMemoryState;
      hour?: number;
    } = {}
  ): ContextualGreetingResult {
    const hour = typeof contextData.hour === 'number' ? contextData.hour : new Date().getHours();
    const timeSlot = getTimeSlot(hour);
    const rawName = contextData.userName || localStorage.getItem('benkut_display_name') || '';
    const cleanName = rawName.trim();
    const namePrefix = cleanName ? ` ${cleanName}` : '';

    const memory = contextData.memoryState || { pantryLots: [], shoppingList: [], shoppingItems: [] } as any;
    const pantryCount = memory.pantryLots?.length || 0;
    const shoppingCount = (memory.shoppingList?.length || memory.shoppingItems?.length) || 0;
    const dietary = contextData.dietary || memory.familyHabits?.dietaryRestrictions?.[0] || '';

    const envInfo = CULINARY_ENVIRONMENTS[env] || CULINARY_ENVIRONMENTS.countertop;
    const envTranslation = envInfo.translations[lang] || envInfo.translations.English;

    let greeting = 'Hello!';
    let promptQuestion = 'How can I assist in your kitchen right now?';
    let suggestedActions: string[] = ['Cook with pantry', 'Scan ingredients', 'Check shopping list'];

    // 1. SPANISH
    if (lang === 'Español') {
      if (timeSlot === 'morning') {
        greeting = `¡Buenos días${namePrefix}!`;
        if (env === 'countertop') {
          promptQuestion = pantryCount > 0 
            ? `Listo en la encimera. Tienes ${pantryCount} ingredientes en la despensa; ¿preparamos un desayuno energizante?` 
            : 'Listo en la encimera. ¿Qué preparamos para el desayuno hoy?';
          suggestedActions = ['Desayuno rápido', 'Escanear ingredientes', 'Poner temporizador'];
        } else if (env === 'pantry') {
          promptQuestion = `Auditando despensa matutina. Tienes ${pantryCount} artículos registrados; ¿revisamos qué hace falta antes de salir?`;
          suggestedActions = ['Escanear estantes', 'Ver lista de compras', 'Recetas con lo que tengo'];
        } else if (env === 'supermarket') {
          promptQuestion = shoppingCount > 0
            ? `¡En el supermercado! Tienes ${shoppingCount} artículos en tu lista de compras. ¿Los revisamos mientras caminas?`
            : '¡En el supermercado! ¿Qué ingredientes necesitamos comprar hoy?';
          suggestedActions = ['Ver lista de compras', 'Inspeccionar producto', 'Agregar a despensa'];
        } else {
          promptQuestion = 'En el mercado agrícola. Muéstrame cualquier fruta o verdura con la cámara para evaluar su frescura.';
          suggestedActions = ['Inspeccionar frescura', 'Consejos de madurez', 'Guardar en despensa'];
        }
      } else if (timeSlot === 'afternoon') {
        greeting = `¡Buenas tardes${namePrefix}!`;
        if (env === 'countertop') {
          promptQuestion = 'Hora del almuerzo en la encimera. ¿Cocinamos algo rápido y delicioso con tus ingredientes disponibles?';
          suggestedActions = ['Almuerzo en 20 min', 'Técnica de corte', 'Temporizador'];
        } else if (env === 'pantry') {
          promptQuestion = `Revisando inventario de la tarde. Tienes ${pantryCount} artículos listos para cocinar.`;
          suggestedActions = ['Escanear despensa', 'Planificar cena', 'Agregar faltantes'];
        } else if (env === 'supermarket') {
          promptQuestion = `Compras de media tarde. ¿Revisamos los ${shoppingCount} productos pendientes en tu lista?`;
          suggestedActions = ['Revisar lista', 'Escanear verduras', 'Calcular raciones'];
        } else {
          promptQuestion = 'Inspección de productos frescos. Abre la cámara para verificar firmeza y color.';
          suggestedActions = ['Inspeccionar verdura', 'Comprobar madurez', 'Receta de aprovechamiento'];
        }
      } else if (timeSlot === 'evening') {
        greeting = `¡Buenas tardes${namePrefix}!`;
        if (env === 'countertop') {
          promptQuestion = pantryCount > 0
            ? `Hora de la cena. Tu despensa tiene ${pantryCount} ingredientes; ¿te guío paso a paso con las manos libres?`
            : 'Hora de la cena. ¿Qué menú saludable preparamos juntos hoy?';
          suggestedActions = ['Cenar con lo que tengo', 'Guía paso a paso', 'Ajustar nivel de picante'];
        } else if (env === 'pantry') {
          promptQuestion = 'Revisión nocturna de despensa. ¿Buscamos ingredientes para una cena reconfortante?';
          suggestedActions = ['Receta cena rápida', 'Escanear refrigerador', 'Lista de compras'];
        } else if (env === 'supermarket') {
          promptQuestion = `Compras para la cena. Revisemos los ${shoppingCount} artículos de tu lista antes de pagar.`;
          suggestedActions = ['Lista de compras', 'Inspeccionar frescos', 'Marcar comprados'];
        } else {
          promptQuestion = 'Seleccionando productos de temporada para la cena. ¿Qué verdura deseas examinar?';
          suggestedActions = ['Evaluar frescura', 'Trucos de conservación', 'Consejo de cocción'];
        }
      } else {
        greeting = `¡Buenas noches${namePrefix}!`;
        promptQuestion = '¿Buscas un bocadillo nocturno o planeamos el menú y la despensa de mañana?';
        suggestedActions = ['Bocadillo saludable', 'Planificar mañana', 'Auditar despensa'];
      }
    }

    // 2. HINDI
    else if (lang === 'हिन्दी') {
      if (timeSlot === 'morning') {
        greeting = `सुप्रभात${namePrefix}!`;
        if (env === 'countertop') {
          promptQuestion = pantryCount > 0
            ? `काउंटरटॉप पर स्वागत है। आपकी पेंट्री में ${pantryCount} सामग्रियां हैं; चलिए नाश्ते के लिए कुछ पौष्टिक बनाएं?`
            : 'काउंटरटॉप पर तैयार। आज सुबह नाश्ते में क्या बनाने की योजना है?';
          suggestedActions = ['झटपट नाश्ता', 'सामग्री स्कैन करें', 'टाइमर लगाएं'];
        } else if (env === 'pantry') {
          promptQuestion = `पेंट्री में ${pantryCount} वस्तुएं मौजूद हैं। बाज़ार जाने से पहले सामग्री की जांच कर लें?`;
          suggestedActions = ['शेल्फ स्कैन करें', 'खरीदारी सूची देखें', 'उपलब्ध सामग्री से व्यंजन'];
        } else if (env === 'supermarket') {
          promptQuestion = `सुपरमार्केट में स्वागत है। आपकी खरीदारी सूची में ${shoppingCount} वस्तुएं हैं।`;
          suggestedActions = ['खरीदारी सूची', 'सब्जी ताज़गी जांचें', 'पेंट्री में जोड़ें'];
        } else {
          promptQuestion = 'सब्जी मंडी में ताज़ा उपज की जांच के लिए कैमरा चालू करें।';
          suggestedActions = ['ताज़गी स्कोर', 'सब्जी पकने की जांच', 'भंडारण सुझाव'];
        }
      } else if (timeSlot === 'afternoon') {
        greeting = `शुभ दोपहर${namePrefix}!`;
        if (env === 'countertop') {
          promptQuestion = 'दोपहर का भोजन पकाने का समय। उपलब्ध सामग्री से क्या स्वादिष्ट और तेज़ बनाएं?';
          suggestedActions = ['20 मिनट में लंच', 'स्टेप-बाय-स्टेप गाइड', 'मसाला स्तर बदलें'];
        } else if (env === 'pantry') {
          promptQuestion = `पेंट्री में ${pantryCount} सामग्रियां उपलब्ध हैं। क्या शाम की तैयारी करें?`;
          suggestedActions = ['पेंट्री जांचें', 'शाम का नाश्ता', 'सामग्री जोड़ें'];
        } else if (env === 'supermarket') {
          promptQuestion = `खरीदारी सूची में ${shoppingCount} वस्तुएं बाकी हैं। क्या मिलान करें?`;
          suggestedActions = ['सूची देखें', 'उत्पाद जांचें', 'पूर्ण चिह्नित करें'];
        } else {
          promptQuestion = 'उपज की ताज़गी और गुणवत्ता जांचने के लिए कैमरे के सामने रखें।';
          suggestedActions = ['गुणवत्ता जांच', 'एथिलीन गैस सलाह', 'बचाव रेसिपी'];
        }
      } else if (timeSlot === 'evening') {
        greeting = `शुभ संध्या${namePrefix}!`;
        if (env === 'countertop') {
          promptQuestion = pantryCount > 0
            ? `रात के खाने का समय! पेंट्री में ${pantryCount} सामग्रियां हैं। क्या हाथों के बिना स्टेप-बाय-स्टेप गाइड शुरू करें?`
            : 'रात के खाने का समय! आज परिवार के लिए क्या खास बना रहे हैं?';
          suggestedActions = ['रात का भोजन गाइड', 'पेंट्री से रेसिपी', 'टाइमर सेट करें'];
        } else if (env === 'pantry') {
          promptQuestion = 'शाम की पेंट्री जांच। चलिए रात के खाने के लिए सही सामग्री खोजें।';
          suggestedActions = ['डिनर रेसिपी', 'फ्रिज स्कैन', 'सूची में जोड़ें'];
        } else if (env === 'supermarket') {
          promptQuestion = `डिनर की सामग्री की खरीदारी। आपकी सूची में ${shoppingCount} वस्तुएं हैं।`;
          suggestedActions = ['खरीदारी सूची', 'सब्जियां जांचें', 'सहेजें'];
        } else {
          promptQuestion = 'रात के भोजन के लिए ताज़ी सब्जियां चुन रहे हैं। जांच शुरू करें?';
          suggestedActions = ['सब्जी स्कोर', 'ताज़गी जांच', 'पकाने की विधि'];
        }
      } else {
        greeting = `शुभ रात्रि${namePrefix}!`;
        promptQuestion = 'क्या आप हल्का रात का नाश्ता चाहते हैं या कल के भोजन की योजना बनाएं?';
        suggestedActions = ['हल्का स्नैक', 'कल की योजना', 'पेंट्री रिकॉर्ड'];
      }
    }

    // 3. TELUGU
    else if (lang === 'తెలుగు') {
      if (timeSlot === 'morning') {
        greeting = `శుభోదయం${namePrefix}!`;
        if (env === 'countertop') {
          promptQuestion = pantryCount > 0
            ? `కౌంటర్‌టాప్‌లో సిద్ధంగా ఉన్నాను. పాంట్రీలో ${pantryCount} సరుకులు ఉన్నాయి; మంచి అల్పాహారం చేద్దామా?`
            : 'కౌంటర్‌టాప్‌లో సిద్ధం. ఈ రోజు బ్రేక్‌ఫాస్ట్ కోసం ఏం తయారు చేద్దాం?';
          suggestedActions = ['త్వరిత అల్పాహారం', 'సరుకులు స్కాన్', 'టైమర్ సెట్'];
        } else if (env === 'pantry') {
          promptQuestion = `పాంట్రీలో ${pantryCount} వస్తువులు ఉన్నాయి. షాపింగ్‌కు వెళ్లేముందు సరిచూద్దామా?`;
          suggestedActions = ['షెల్ఫ్ స్కాన్', 'షాపింగ్ లిస్ట్', 'ఉన్న సరుకులతో వంట'];
        } else if (env === 'supermarket') {
          promptQuestion = `సూపర్‌మార్కెట్‌లో ఉన్నారు. మీ షాపింగ్ లిస్ట్‌లో ${shoppingCount} వస్తువులు ఉన్నాయి.`;
          suggestedActions = ['షాపింగ్ లిస్ట్', 'సరుకుల తనిఖీ', 'పాంట్రీకి జోడించు'];
        } else {
          promptQuestion = 'రైతు బజార్‌లో తాజా కూరగాయలను పరిశీలించడానికి కెమెరాను ఆన్ చేయండి.';
          suggestedActions = ['తాజాదనం స్కోర్', 'పక్వత పరీక్ష', 'నిల్వ చిట్కాలు'];
        }
      } else if (timeSlot === 'afternoon') {
        greeting = `శుభ మధ్యాహ్నం${namePrefix}!`;
        if (env === 'countertop') {
          promptQuestion = 'లంచ్ వండే సమయం. అందుబాటులో ఉన్న సరుకులతో త్వరగా రుచికరమైన వంట చేద్దామా?';
          suggestedActions = ['20 నిమిషాల లంచ్', 'దశలవారీ గైడ్', 'కారం లెవల్ మార్పు'];
        } else if (env === 'pantry') {
          promptQuestion = `పాంట్రీలో ${pantryCount} సరుకులు సిద్ధంగా ఉన్నాయి. సాయంత్రం లేదా రాత్రి భోజనం ప్లాన్ చేద్దామా?`;
          suggestedActions = ['పాంట్రీ తనిఖీ', 'లంచ్ రెసిపీ', 'సరుకు రాయండి'];
        } else if (env === 'supermarket') {
          promptQuestion = `షాపింగ్ లిస్ట్‌లో ${shoppingCount} సరుకులు మిగిలి ఉన్నాయి. సరిపోల్చుదామా?`;
          suggestedActions = ['లిస్ట్ పరిశీలన', 'కూరగాయల నాణ్యత', 'పూర్తి చేయి'];
        } else {
          promptQuestion = 'కూరగాయల నాణ్యతను పరీక్షించడానికి కెమెరా ముందు ఉంచండి.';
          suggestedActions = ['నాణ్యత తనిఖీ', 'నిల్వ సలహా', 'వేస్ట్ నివారణ'];
        }
      } else if (timeSlot === 'evening') {
        greeting = `శుభ సాయంత్రం${namePrefix}!`;
        if (env === 'countertop') {
          promptQuestion = pantryCount > 0
            ? `డిన్నర్ వండే సమయం! పాంట్రీలో ${pantryCount} సరుకులు ఉన్నాయి. హ్యాండ్స్-ఫ్రీగా వంట ప్రారంభిద్దామా?`
            : 'రాత్రి భోజనం సమయం! ఈ రోజు కుటుంబం కోసం ఏం స్పెషల్ వండుతున్నారు?';
          suggestedActions = ['డిన్నర్ గైడ్', 'పాంట్రీ వంటకాలు', 'టైమర్ పెట్టు'];
        } else if (env === 'pantry') {
          promptQuestion = 'సాయంత్రం పాంట్రీ తనిఖీ. రాత్రి భోజనానికి తగిన సరుకులను ఎంచుకుందామా?';
          suggestedActions = ['డిన్నర్ రెసిపీ', 'ఫ్రిజ్ స్కాన్', 'లిస్ట్‌కు జోడించు'];
        } else if (env === 'supermarket') {
          promptQuestion = `రాత్రి భోజన సరుకుల కొనుగోలు. మీ లిస్ట్‌లో ${shoppingCount} వస్తువులు ఉన్నాయి.`;
          suggestedActions = ['షాపింగ్ లిస్ట్', 'సరుకులు స్కాన్', 'సేవ్ చేయి'];
        } else {
          promptQuestion = 'డిన్నర్ కోసం తాజా కూరగాయలను ఎంచుకుంటున్నారు. పరీక్ష ప్రారంభిద్దామా?';
          suggestedActions = ['తాజాదనం స్కోర్', 'వంట చిట్కా', 'పక్వత పరిశీలన'];
        }
      } else {
        greeting = `శుభ రాత్రి${namePrefix}!`;
        promptQuestion = 'రాత్రి తేలికపాటి చిరుతిండి కావాలా లేదా రేపటి భోజనం ప్లాన్ చేద్దామా?';
        suggestedActions = ['తేలికపాటి స్నాక్', 'రేపటి ప్లాన్', 'పాంట్రీ నమోదు'];
      }
    }

    // 4. FRENCH
    else if (lang === 'Français') {
      if (timeSlot === 'morning') {
        greeting = `Bonjour${namePrefix} !`;
        if (env === 'countertop') {
          promptQuestion = pantryCount > 0
            ? `Prêt sur le plan de travail. Vous avez ${pantryCount} ingrédients dans le garde-manger ; préparons un bon petit-déjeuner ?`
            : 'Prêt sur le plan de travail. Que cuisinons-nous pour le petit-déjeuner aujourd\'hui ?';
          suggestedActions = ['Petit-déjeuner sain', 'Scanner ingrédients', 'Lancer minuteur'];
        } else if (env === 'pantry') {
          promptQuestion = `Audit matinal du garde-manger. ${pantryCount} articles en stock ; vérifions ce qu\'il manque avant vos courses ?`;
          suggestedActions = ['Scanner étagères', 'Liste de courses', 'Recettes antigaspillage'];
        } else if (env === 'supermarket') {
          promptQuestion = `Au supermarché ! Vous avez ${shoppingCount} articles sur votre liste de courses. Les vérifions-nous ensemble ?`;
          suggestedActions = ['Voir ma liste', 'Inspecter produit', 'Ajouter au stock'];
        } else {
          promptQuestion = 'Au marché fermier. Présentez un fruit ou légume devant la caméra pour vérifier sa fraîcheur.';
          suggestedActions = ['Score de fraîcheur', 'Conseils maturité', 'Conservation éthylène'];
        }
      } else if (timeSlot === 'afternoon') {
        greeting = `Bon après-midi${namePrefix} !`;
        if (env === 'countertop') {
          promptQuestion = 'L\'heure du déjeuner sur le plan de travail. Cuisinons un plat rapide et savoureux avec vos ingrédients disponibles.';
          suggestedActions = ['Déjeuner en 20 min', 'Technique de découpe', 'Minuteur'];
        } else if (env === 'pantry') {
          promptQuestion = `Garde-manger de l'après-midi : ${pantryCount} ingrédients prêts. Préparons le dîner ?`;
          suggestedActions = ['Vérifier frigo', 'Idée repas du soir', 'Ajouter à la liste'];
        } else if (env === 'supermarket') {
          promptQuestion = `Courses de mi-journée : ${shoppingCount} articles restants sur votre liste.`;
          suggestedActions = ['Consulter liste', 'Scanner fruits', 'Calculer portions'];
        } else {
          promptQuestion = 'Inspection primeur. Utilisez la caméra pour évaluer la fermeté et la maturité.';
          suggestedActions = ['Inspecter légume', 'Maturité optimale', 'Recette récupération'];
        }
      } else if (timeSlot === 'evening') {
        greeting = `Bonsoir${namePrefix} !`;
        if (env === 'countertop') {
          promptQuestion = pantryCount > 0
            ? `C'est l'heure du dîner ! Votre garde-manger contient ${pantryCount} ingrédients. Vous guide-je pas à pas les mains libres ?`
            : "C'est l'heure du dîner ! Que préparons-nous de délicieux ce soir ?";
          suggestedActions = ['Cuisiner mes restes', 'Guide pas à pas', 'Ajuster épices'];
        } else if (env === 'pantry') {
          promptQuestion = 'Revue du soir du garde-manger. Trouvons la recette parfaite pour le dîner.';
          suggestedActions = ['Recette dîner rapide', 'Scanner frigo', 'Ajouter à la liste'];
        } else if (env === 'supermarket') {
          promptQuestion = `Courses pour le dîner : ${shoppingCount} articles à récupérer sur votre liste.`;
          suggestedActions = ['Liste de courses', 'Inspecter primeur', 'Valider achats'];
        } else {
          promptQuestion = 'Sélection de produits de saison pour le dîner. Quel produit souhaitez-vous analyser ?';
          suggestedActions = ['Évaluer fraîcheur', 'Astuce conservation', 'Idée cuisson'];
        }
      } else {
        greeting = `Bonne soirée${namePrefix} !`;
        promptQuestion = 'Envie d\'une collation légère ou planifions-nous les repas et le garde-manger de demain ?';
        suggestedActions = ['Collation saine', 'Planifier demain', 'Auditer stock'];
      }
    }

    // 5. DEFAULT ENGLISH
    else {
      if (timeSlot === 'morning') {
        greeting = `Good morning${namePrefix}!`;
        if (env === 'countertop') {
          promptQuestion = pantryCount > 0
            ? `Ready on your countertop. You have ${pantryCount} ingredients in your pantry; shall we whip up a wholesome breakfast?`
            : 'Ready on your countertop. What are we making for breakfast today?';
          suggestedActions = ['Quick breakfast', 'Scan ingredients', 'Set cooking timer'];
        } else if (env === 'pantry') {
          promptQuestion = `Morning pantry audit. You have ${pantryCount} items logged; want to check what you need before heading out?`;
          suggestedActions = ['Scan fridge shelves', 'View shopping list', 'Use-it-first recipes'];
        } else if (env === 'supermarket') {
          promptQuestion = shoppingCount > 0
            ? `You're at the supermarket! You have ${shoppingCount} items on your shopping list. Let's check them off as you walk the aisles.`
            : 'You\'re at the supermarket! What ingredients should we find and add to your kitchen today?';
          suggestedActions = ['Check shopping list', 'Inspect produce', 'Add to pantry'];
        } else {
          promptQuestion = 'At the farmers market or produce aisle! Point your camera at any fruit or vegetable to evaluate its freshness score.';
          suggestedActions = ['Inspect freshness', 'Ripeness tips', 'Ethylene gas guide'];
        }
      } else if (timeSlot === 'afternoon') {
        greeting = `Good afternoon${namePrefix}!`;
        if (env === 'countertop') {
          promptQuestion = 'Lunchtime on the countertop! Looking for a fast, flavorful meal with your available pantry items?';
          suggestedActions = ['20-minute lunch', 'Knife technique help', 'Set a 15m timer'];
        } else if (env === 'pantry') {
          promptQuestion = `Afternoon pantry check. You have ${pantryCount} ingredients ready to cook. Shall we plan ahead for dinner?`;
          suggestedActions = ['Audit fridge', 'Plan evening dinner', 'Add missing spices'];
        } else if (env === 'supermarket') {
          promptQuestion = `Midday grocery run! You have ${shoppingCount} items pending on your shopping list.`;
          suggestedActions = ['View shopping list', 'Scan produce', 'Portion calculator'];
        } else {
          promptQuestion = 'Produce stand inspection. Open the camera to check firmness, color, and zero-waste storage tips.';
          suggestedActions = ['Inspect produce', 'Check ripeness', 'Salvage recipe'];
        }
      } else if (timeSlot === 'evening') {
        greeting = `Good evening${namePrefix}!`;
        if (env === 'countertop') {
          promptQuestion = pantryCount > 0
            ? `Dinner time! Your pantry has ${pantryCount} ingredients ready. Want me to guide you hands-free step-by-step?`
            : 'Dinner time! What delicious and healthy meal are we cooking together tonight?';
          suggestedActions = ['Cook with pantry', 'Step-by-step guide', 'Adjust spice level'];
        } else if (env === 'pantry') {
          promptQuestion = 'Evening pantry review. Let\'s find the perfect ingredients for a comforting dinner.';
          suggestedActions = ['Quick dinner recipe', 'Scan fridge', 'Add to shopping list'];
        } else if (env === 'supermarket') {
          promptQuestion = `Dinner shopping run! Let\'s knock out the ${shoppingCount} items on your grocery list.`;
          suggestedActions = ['Shopping list', 'Inspect produce', 'Mark items bought'];
        } else {
          promptQuestion = 'Picking fresh produce for dinner. Which vegetable or fruit would you like to evaluate?';
          suggestedActions = ['Evaluate freshness', 'Ethylene storage advice', 'Cooking tip'];
        }
      } else {
        greeting = `Good evening${namePrefix}!`;
        promptQuestion = 'Craving a late night bite or want to get a head start on tomorrow\'s meal planning?';
        suggestedActions = ['Healthy night snack', 'Plan tomorrow', 'Audit pantry items'];
      }
    }

    if (dietary && dietary !== 'All Foods / No Restrictions') {
      promptQuestion += ` (Tailored for ${dietary})`;
    }

    return {
      greeting,
      promptQuestion,
      fullSpokenText: `${greeting} ${promptQuestion}`,
      suggestedActions,
      recommendedSpecialist: envInfo.specialist,
      environmentLabel: envTranslation.label,
      environmentIcon: envInfo.icon,
      environmentDescription: envTranslation.desc,
    };
  }
}
