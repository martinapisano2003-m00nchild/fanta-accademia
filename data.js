// ==========================================
// FANTA-ACCADEMIA 2026 - OFFICIAL DATABASE
// ==========================================

const GLOBAL_PASSWORD = "FantaAccademia2026!";
const SQUAD_DEADLINE = "2026-10-18T23:59:59"; // Domenica 18 Ottobre 2026, Mezzanotte

// 1. CREDENZIALI ALLENATORI E RUOLI (Accesso esclusivo tramite Username e Password Personale)
const INITIAL_USERS = [
  { username: "Marco", password: "MarcoFanta2026!", role: "coach", avatar: "👨‍💼", bio: "Ex-presidente della consulta? Focus strategico e adrenalina pura." },
  { username: "Erika", password: "ErikaFanta2026!", role: "coach", avatar: "🧝‍♀️", bio: "Cosplayer di precisione millimetrica. Nessun malus nel suo destino!" },
  { username: "Bea", password: "BeaFanta2026!", role: "coach", avatar: "🎀", bio: "Borsa traboccante di peluche e odio represso per la fisica applicata all'arte." },
  { username: "Davi", password: "DaviFanta2026!", role: "coach", avatar: "🏃‍♂️", bio: "In corsa perpetua contro il blocco di laurea di Cavalluccio." },
  { username: "Mar", password: "MarFanta2026!", role: "coach", avatar: "🍷", bio: "Tra il vino da Meowali e il 30 e lode c'è solo un bicchiere di distanza." },
  { username: "Elisa", password: "ElisaFanta2026!", role: "coach", avatar: "😩", bio: "Pronuncia 'non ce la faccio più' 47 volte al giorno. Punti facili." },
  { username: "Moka", password: "MokaFanta2026!", role: "coach", avatar: "☕", bio: "Zen totale. Zero bonus, zero malus, pura stabilità quantistica." },
  { username: "Leryn", password: "LerynFanta2026!", role: "coach", avatar: "📚", bio: "L'eroe del triennio rapido: o svuota il libretto o diserta al primo anno." },
  { username: "Masi", password: "MasiFanta2026!", role: "coach", avatar: "⏰", bio: "Se varca il cancello e supera l'ora di permanenza è già festa patronale." },
  { username: "Kiril", password: "KirilFanta2026!", role: "coach", avatar: "🗺️", bio: "Presenza misteriosa tra i corridoi e le aule dell'accademia." },
  { username: "Nicole", password: "NicoleFanta2026!", role: "coach", avatar: "🚗", bio: "La pendolare dell'accademia. Sempre in viaggio verso Sassari." },
  { username: "Martina", password: "MasterMartina2026!", role: "master", avatar: "👑", bio: "LA MASTER & CREATRICE DEL GIOCO. Schierabile anche come Mascotte della squadra!" }
];

// 2. DATABASE DOCENTI (20 PERSONAGGI CON LE INTRODUZIONI ORIGINALI ESATTE)
const DOCENTI = [
  // Molto Costosi (30 CFA)
  {
    id: "door-e",
    nome: "Door-e",
    fascia: "Molto Costoso",
    costoCFA: 30,
    avatar: "🚪",
    color: "#ef4444",
    bio: "Tutto ciò che potrebbe fare è uscire dalla porta dell'Accademia e non guardarsi più indietro, eppure continua ad essere nelle vite di tutti, sfortunatamente.",
    specificEvents: [
      { id: "door-e-uscita", nome: "Uscita dalla porta per sempre", desc: "Uscita improvvisa dalla porta dell'accademia senza tornare mai più", pt: 500 }
    ]
  },
  {
    id: "gucci",
    nome: "Gucci",
    fascia: "Molto Costoso",
    costoCFA: 30,
    avatar: "🕶️",
    color: "#f59e0b",
    bio: "Uno dei docenti più odiati e ammirati allo stesso tempo, migliore amico di Borsetta, non può presentarsi a lezione senza il suo taglio di capelli alla moda e la sua borsetta di marca.",
    specificEvents: [
      { id: "gucci-outfit", nome: "Outfit Appariscente Notato", desc: "Presentarsi a lezione con un outfit/taglio/accessorio di marca super appariscente che lui nota", pt: 25 }
    ]
  },
  {
    id: "rob-stampa",
    nome: "Rob-Stampa",
    fascia: "Molto Costoso",
    costoCFA: 30,
    avatar: "🖥️",
    color: "#6366f1",
    bio: "È da 10 anni che dice di dover andare in pensione, ma anche quest'anno lo vedi circolare tra i suoi Mac, un po' molesto ma, se non pensi alle sue idee politiche, ti piace pure.",
    specificEvents: [
      { id: "rob-politica", nome: "Comizio Politico / Lamentela", desc: "Citazione o lamentela sulle sue idee politiche", pt: 20 },
      { id: "rob-pensione", nome: "Annuncio Pensione Imminente", desc: "Annuncio di voler andare finalmente in pensione", pt: 50 }
    ]
  },
  {
    id: "peter",
    nome: "Peter",
    fascia: "Molto Costoso",
    costoCFA: 30,
    avatar: "🤖",
    color: "#ec4899",
    bio: "Ride da solo dei meme che crea con l'intelligenza artificiale sui suoi colleghi e ha una testa che riflette il sole anche quando piove.",
    specificEvents: [
      { id: "peter-meme", nome: "Risata Solitaria AI Meme", desc: "Risata da solo a un meme creato con l'IA sui colleghi", pt: 30 }
    ]
  },

  // Costosi (22 CFA)
  {
    id: "foglio-di-carta",
    nome: "Foglio di carta",
    fascia: "Costoso",
    costoCFA: 22,
    avatar: "📄",
    color: "#3b82f6",
    bio: "Ti serve un foglio di carta o devi dare web design? Lui sarà lì a scherzare con te finché non farà a pezzi il tuo esame con un 26.",
    specificEvents: [
      { id: "foglio-bozze", nome: "Bozze su Carta", desc: "Chiede espressamente di presentare le bozze su un foglio di carta", pt: 50 }
    ]
  },
  {
    id: "pane-e-vino",
    nome: "Pane e vino",
    fascia: "Costoso",
    costoCFA: 22,
    avatar: "🍞",
    color: "#d97706",
    bio: "I tuoi lamenti e grida di sofferenza sono musica per le sue orecchie, non sai mai quando sta ridendo con te o ridendo di te, solo lui sa perché deve esserci fisica in un'Accademia di Belle Arti.",
    specificEvents: [
      { id: "pane-ignoranza", nome: "Lamentela sull'Ignoranza", desc: "Si lamenta dell'ignoranza dei suoi allievi durante la lezione", pt: 15 },
      { id: "pane-gestione", nome: "Rant su Gestione Accademica", desc: "Si lamenta apertamente della gestione accademica", pt: 25 }
    ]
  },
  {
    id: "meowali",
    nome: "Meowali",
    fascia: "Costoso",
    costoCFA: 22,
    avatar: "🐱",
    color: "#10b981",
    bio: "La creatrice di questo gioco non ha nemmeno idea di che faccia abbia, ma sa che è un pilastro dell'accademia a cui piace il buon vino.",
    specificEvents: [
      { id: "meowali-pranzo", nome: "Organizzazione Pranzo Sociale", desc: "Organizza un pranzo conviviale", pt: 25 }
    ]
  },
  {
    id: "il-marito-di-martina",
    nome: "Il marito di Martina",
    fascia: "Costoso",
    costoCFA: 22,
    avatar: "🧇",
    color: "#8b5cf6",
    bio: "Laureato in filosofia e figlio di un ex-direttore, non manca mai di citare Maria Lai e Stranger Things, spesso entrambi nella stessa lezione.",
    specificEvents: [
      { id: "marito-combo", nome: "Combo Maria Lai + Stranger Things", desc: "Citazione contemporanea di Maria Lai e Stranger Things nella stessa lezione", pt: 40 }
    ]
  },
  {
    id: "pittores",
    nome: "Pittores",
    fascia: "Costoso",
    costoCFA: 22,
    avatar: "🎨",
    color: "#06b6d4",
    bio: "Una linea... due linee... milleottocentosettantaquattro linee... chissà se un giorno avrà tutti gli spazi che desidera per insegnare pittura.",
    specificEvents: [
      { id: "pittores-linee", nome: "Trance delle 1874 Linee", desc: "Spiegazione basata su tracciamento compulsivo di linee alla ricerca di spazio vitale", pt: 25 }
    ]
  },

  // Medi (15 CFA)
  {
    id: "cavalluccio",
    nome: "Cavalluccio",
    fascia: "Medio",
    costoCFA: 15,
    avatar: "🐴",
    color: "#14b8a6",
    bio: "Lavora facendo una sola materia per il triennio e vive sicuramente meglio di te, con la Sicilia nel cuore, o lo ami o lo ami.",
    specificEvents: [
      { id: "cavalluccio-gatti", nome: "Ode ai suoi Gatti", desc: "Interrompe la lezione o spiega parlando appassionatamente dei suoi gatti", pt: 20 },
      { id: "cavalluccio-sicilia", nome: "Nostalgia Siciliana", desc: "Menzione appassionata della Sicilia durante la spiegazione", pt: 20 }
    ]
  },
  {
    id: "nuvoloni",
    nome: "Nuvoloni",
    fascia: "Medio",
    costoCFA: 15,
    avatar: "☁️",
    color: "#64748b",
    bio: "L'accademia la manda avanti lui, può stamparti in 3D anche il cesso di casa tua.",
    specificEvents: [
      { id: "nuvoloni-3d", nome: "Stampa 3D Perfetta First-Try", desc: "Stampa 3D riuscita al primo colpo senza inceppamenti in laboratorio", pt: 25 }
    ]
  },
  {
    id: "ponzi-ponzi",
    nome: "Ponzi Ponzi POPOPO",
    fascia: "Medio",
    costoCFA: 15,
    avatar: "🎩",
    color: "#a855f7",
    bio: "Chill guy per eccellenza, sa la storia dell'arte moderna come se l'avesse vissuta lui stesso, forse è così per i suoi modi da gentil'uomo.",
    specificEvents: [
      { id: "ponzi-aneddoto", nome: "Testimone Oculare dell'Arte", desc: "Aneddoto di storia dell'arte raccontato come se lo avesse vissuto in prima persona", pt: 25 }
    ]
  },
  {
    id: "lo-scultore",
    nome: "Lo scultore",
    fascia: "Medio",
    costoCFA: 15,
    avatar: "🗿",
    color: "#78716c",
    bio: "Illustre scultore dell'accademia, per lui dovrebbe esistere solo il corso di Scultura e i suoi discepoli di argilla lobotomizzati.",
    specificEvents: [
      { id: "scultore-supremazia", nome: "Supremazia della Scultura", desc: "Elogio sviscerato della sola disciplina della Scultura screditando gli altri corsi", pt: 20 }
    ]
  },

  // Poco Costosi (10 CFA)
  {
    id: "borsetta",
    nome: "Borsetta",
    fascia: "Poco Costoso",
    costoCFA: 10,
    avatar: "👜",
    color: "#f43f5e",
    bio: "Bestie di Gucci, ha i tatuaggi più fighi di tutto il collegio docenti e ti spiega storia dell'arte contemporanea con dei video musicali, meglio di così?",
    specificEvents: [
      { id: "borsetta-mtv", nome: "Arte Contemporanea via MTV", desc: "Spiegazione di storia dell'arte contemporanea tramite video musicali e videoclip", pt: 20 }
    ]
  },
  {
    id: "oggi-cosi",
    nome: "Oggi così domani chissà",
    fascia: "Poco Costoso",
    costoCFA: 10,
    avatar: "🎭",
    color: "#e11d48",
    bio: "Che tua madre sia morta o tu abbia una grande disabilità, non gliene fregherà nulla e ti boccerà lo stesso alle sue revisioni di fotografia, con le stesse foto che due settimane prima erano perfette per l'elaborato finale.",
    specificEvents: [
      { id: "oggi-bocciatura", nome: "Bocciatura a Sorpresa su Foto Ok", desc: "Bocciatura spietata a una revisione di fotografia su foto precedentemente approvate", pt: 40 }
    ]
  },
  {
    id: "piton",
    nome: "Piton",
    fascia: "Poco Costoso",
    costoCFA: 10,
    avatar: "🧪",
    color: "#059669",
    bio: "Parlata da uomo di altri tempi, riesce in modo assurdamente sensato a paragonare la celebre opera Frankenstein di Mary Shelley al linguaggio a token dell'Intelligenza Artificiale.",
    specificEvents: [
      { id: "piton-ciabatte", nome: "Lezione in Ciabatte", desc: "Si presenta spavaldamente a lezione in ciabatte", pt: 20 },
      { id: "piton-frankenstein", nome: "Mary Shelley vs Token AI", desc: "Paragone colto e assurdo tra Frankenstein di Mary Shelley e i token dell'IA", pt: 35 }
    ]
  },
  {
    id: "salamino",
    nome: "Salamino",
    fascia: "Poco Costoso",
    costoCFA: 10,
    avatar: "🥩",
    color: "#ea580c",
    bio: "Immagina iscriverti all'accademia e dover studiare diritto con l'avvocato della scuola.",
    specificEvents: [
      { id: "salamino-tribunale", nome: "Aula di Tribunale", desc: "Lezione di diritto accademico tenuta con tono da severa aula di tribunale penale", pt: 20 }
    ]
  },

  // Occasione (5 CFA)
  {
    id: "il-bassista",
    nome: "Il Bassista",
    fascia: "Occasione",
    costoCFA: 5,
    avatar: "🎸",
    color: "#84cc16",
    bio: "Se lo vedi, la prima cosa che dici è 'swag', ti modella in 3D pure le emozioni e la sera fa il bassista nella sua band. Swag.",
    specificEvents: [
      { id: "bassista-swag", nome: "Swag Session & Playlist", desc: "Parla di musica, mette una sua playlist rock/funk o ha un atteggiamento 100% Swag", pt: 20 }
    ]
  },
  {
    id: "testina",
    nome: "Testina",
    fascia: "Occasione",
    costoCFA: 5,
    avatar: "🛋️",
    color: "#0284c7",
    bio: "Se hai fatto animazione con lui, non dimenticherai mai quel cuscino, quel maledetto cuscino.",
    specificEvents: [
      { id: "testina-cuscino", nome: "L'Eterno Ritorno del Cuscino", desc: "Spiega ancora come realizzare un cuscino dopo due mesi ininterrotti di lezione", pt: 25 }
    ]
  },
  {
    id: "capo-setta-incisione",
    nome: "Capo Setta Incisione",
    fascia: "Occasione",
    costoCFA: 5,
    avatar: "🧢",
    color: "#7c3aed",
    bio: "Con il suo cappellino riconoscibile, cerca sempre nuovi allievi per la sua setta nel quale ci saranno sempre i soliti tre fedeli.",
    specificEvents: [
      { id: "caposetta-reclutamento", nome: "Reclutamento per la Setta", desc: "Tentativo subdolo di reclutamento di nuovi allievi per il laboratorio di incisione", pt: 30 }
    ]
  }
];

// 3. DATABASE COLLEGHI (12 PERSONAGGI - SENZA SPOILER DEI BONUS SEGRETI)
const COLLEGHI = [
  // Costosi (18 CFA)
  {
    id: "collega-marco",
    nome: "Marco",
    fascia: "Costoso",
    costoCFA: 18,
    avatar: "👑",
    bio: "Pilastro della consulta e stratega accademico ad alta intensità.",
    secretRules: [
      { id: "marco-consulta", tipo: "malus", pt: -100, desc: "Lascia il ruolo di presidente della consulta (-100 pt)" },
      { id: "marco-urla", tipo: "bonus", pt: 300, desc: "Urla contro Door-e nelle aule comuni dell'accademia (+300 pt)" }
    ]
  },
  {
    id: "collega-erika",
    nome: "Erika",
    fascia: "Costoso",
    costoCFA: 18,
    avatar: "✂️",
    bio: "Mani fatate, regina dei cosplay e perfezionismo leggendario.",
    secretRules: [
      { id: "erika-cosplay", tipo: "bonus", pt: 80, desc: "Crea un nuovo cosplay fatto a mano (+80 pt)" },
      { id: "erika-immunita", tipo: "neutral", pt: 0, desc: "Immunità Divina: Nessun malus presente!" }
    ]
  },
  {
    id: "collega-bea",
    nome: "Bea",
    fascia: "Costoso",
    costoCFA: 18,
    avatar: "🧸",
    bio: "Mascotte portatile vivente con una tolleranza minima per Pane e vino.",
    secretRules: [
      { id: "bea-peluche", tipo: "bonus", pt: 80, desc: "Un docente le chiede come mai ha la borsa piena di peluche e portachiavi (+80 pt)" },
      { id: "bea-panevino", tipo: "malus", pt: -50, desc: "Sclera apertamente contro Pane e vino (-50 pt)" }
    ]
  },

  // Medi (12 CFA)
  {
    id: "collega-davi",
    nome: "Davi",
    fascia: "Medio",
    costoCFA: 12,
    avatar: "🎓",
    bio: "Soldato della frequenza ma sotto tiro perenne nella sessione di laurea.",
    secretRules: [
      { id: "davi-frequenza", tipo: "bonus", pt: 30, desc: "Va a tutte le lezioni senza saltarne nemmeno una per due settimane di fila (+30 pt ogni volta)" },
      { id: "davi-laurea", tipo: "malus", pt: -200, desc: "Cavalluccio non lo ammette alla sessione di laurea di marzo (-200 pt)" }
    ]
  },
  {
    id: "collega-mar",
    nome: "Mar",
    fascia: "Medio",
    costoCFA: 12,
    avatar: "🍻",
    bio: "Oscilla tra nottate alcoliche di lusso e l'ambizione del massimo dei voti.",
    secretRules: [
      { id: "mar-ubriaco", tipo: "bonus", pt: 40, desc: "Si ubriaca da Meowali (+40 pt ogni volta)" },
      { id: "mar-lode", tipo: "malus", pt: -10, desc: "Prende 30 e lode (-10 pt ogni volta - troppo secchione!)" }
    ]
  },
  {
    id: "collega-elisa",
    nome: "Elisa",
    fascia: "Medio",
    costoCFA: 12,
    avatar: "😫",
    bio: "Barometro dello stress collettivo: ogni sospiro è una rendita per la squadra.",
    secretRules: [
      { id: "elisa-noncelafaccio", tipo: "bonus", pt: 5, desc: "Dice di non farcela più (+5 pt ogni singola volta)" },
      { id: "elisa-incazzatura", tipo: "malus", pt: -10, desc: "Si incazza con uno di noi (-10 pt ogni volta)" }
    ]
  },
  {
    id: "collega-moka",
    nome: "Moka",
    fascia: "Medio",
    costoCFA: 12,
    avatar: "☕",
    bio: "Elemento neutro insondabile, imperturbabile dinanzi al caos accademico.",
    secretRules: [
      { id: "moka-pace", tipo: "neutral", pt: 0, desc: "Pace dei Sensi: Nessun bonus e nessun malus in assoluto (0 pt)" }
    ]
  },

  // Poco Costosi (6 CFA)
  {
    id: "collega-leryn",
    nome: "Leryn",
    fascia: "Poco Costoso",
    costoCFA: 6,
    avatar: "⚡",
    bio: "Scommessa ad altissimo rischio/rendimento: jackpot esami o diserzione fatale.",
    secretRules: [
      { id: "leryn-esami", tipo: "bonus", pt: 300, desc: "Dà tutti gli esami possibili nelle sessioni senza lasciarne nemmeno uno per dopo (+300 pt)" },
      { id: "leryn-molla", tipo: "malus", pt: -500, desc: "Molla l'accademia al primo anno (-500 pt catastrofico!)" }
    ]
  },
  {
    id: "collega-masi",
    nome: "Masi",
    fascia: "Poco Costoso",
    costoCFA: 6,
    avatar: "🚪",
    bio: "Spettro di corridoio: vederlo dentro per 60 minuti è come avvistare una cometa.",
    secretRules: [
      { id: "masi-60min", tipo: "bonus", pt: 80, desc: "Entra dentro l'accademia e ci sta per almeno 60 minuti (+80 pt ogni volta)" },
      { id: "masi-molla", tipo: "malus", pt: -250, desc: "Annuncia di mollare ufficialmente l'accademia (-250 pt)" }
    ]
  },

  // Mascotte Master (1 CFA - nessun spoiler dei 100pt o soffiate prima della conferma)
  {
    id: "collega-martina",
    nome: "Martina",
    fascia: "Mascotte Master",
    costoCFA: 1,
    avatar: "👑",
    bio: "La Master e creatrice del gioco! Prezzo simbolico 1 CFA per chi vuole arruolare la Mascotte ufficiale.",
    secretRules: [
      { id: "martina-benedizione", tipo: "bonus", pt: 100, desc: "BONUS AUTOMATICO IMMEDIATO: +100 pt alla conferma squadra e sblocco immediato della scheda esclusiva 'Soffiate dal Master'!" },
      { id: "martina-neutral", tipo: "neutral", pt: 0, desc: "Nessun malus o bonus specifico aggiuntivo" }
    ]
  },

  // Gratis / Esterni (0 CFA - nessun spoiler dei 20pt coraggio prima della conferma)
  {
    id: "collega-kiril",
    nome: "Kiril",
    fascia: "Gratis / Esterno",
    costoCFA: 0,
    avatar: "🛸",
    bio: "Presenza misteriosa tra i corridoi e le aule dell'accademia.",
    secretRules: [
      { id: "kiril-coraggio", tipo: "bonus", pt: 20, desc: "BONUS CORAGGIO: +20 pt immediati all'arruolamento!" },
      { id: "kiril-120min", tipo: "bonus", pt: 60, desc: "Entra in accademia e ci sta per più di 120 minuti (+60 pt ogni volta)" },
      { id: "kiril-dimentica", tipo: "malus", pt: -15, desc: "Non si ricorda o non sa di che professore si sta parlando (-15 pt ogni volta)" }
    ]
  },
  {
    id: "collega-nicole",
    nome: "Nicole",
    fascia: "Gratis / Esterno",
    costoCFA: 0,
    avatar: "🚗",
    bio: "La pendolare dell'accademia. Sempre in viaggio verso Sassari.",
    secretRules: [
      { id: "nicole-coraggio", tipo: "bonus", pt: 20, desc: "BONUS CORAGGIO: +20 pt immediati all'arruolamento!" },
      { id: "nicole-sassari", tipo: "bonus", pt: 30, desc: "Sale a Sassari (+30 pt ogni volta)" },
      { id: "nicole-neutral", tipo: "neutral", pt: 0, desc: "Nessun malus presente!" }
    ]
  }
];

// 4. REGOLAMENTO ED EVENTI
const EVENTI_CATALOGO = {
  attivita: [
    { id: "innominabile", nome: "L'Innominabile", pt: 20, desc: "Il prof spiega un argomento o software totalmente fuori programma." },
    { id: "orario-elastico", nome: "Orario Elastico", pt: 15, desc: "Il prof arriva con oltre 25 minuti di ritardo o finisce 45 minuti prima." },
    { id: "revisione-infinita", nome: "Revisione Infinita", pt: 25, desc: "Una revisione o spiegazione singola dura più di 60 minuti senza pausa." },
    { id: "ghosting", nome: "Ghosting", pt: 30, desc: "Email inviata al docente a cui non risponde entro 7 giorni lavorativi." },
    { id: "scontro-sguardi", nome: "Scontro di Sguardi", pt: 20, desc: "Tensione palpabile in aula tra un docente e uno studente durante la spiegazione." },
    { id: "addio-amici", nome: "Addio amici addio", pt: 200, desc: "Annuncio ufficiale di pensionamento." },
    { id: "ko-docenti", nome: "K.O.", pt: 250, desc: "Due docenti o più si ritrovano in una discussione particolarmente accesa tra di loro davanti agli studenti." },
    { id: "consigliere", nome: "Consigliere", pt: 100, desc: "Un docente entra a far parte del nuovo consiglio accademico." },
    { id: "direttore", nome: "Direttore", pt: 350, desc: "Un docente diventa il nuovo direttore dell'Accademia." },
    { id: "last-minute", nome: "Last minute", pt: 25, desc: "Un docente annulla la lezione meno di 10 ore prima dall'orario di inizio." }
  ],
  campus: [
    { id: "macchinetta-inghiotte", nome: "Macchinetta Demoniaca (Moneta/Chiavetta)", pt: -15, desc: "La macchinetta eroga il caffè/cibo incastrando monete o chiavette." },
    { id: "macchinetta-cibo-bloccato", nome: "Macchinetta Demoniaca (Cibo incastrato)", pt: -20, desc: "Il pacchetto di snack resta appeso al vetro della macchinetta." },
    { id: "macchinetta-salvataggio", nome: "Macchinetta Miracolo (Cibo recuperato)", pt: 20, desc: "Uno studente riesce a scuotere la macchinetta e recuperare lo snack!" },
    { id: "slang-sbagliato", nome: "Slang Sbagliato", pt: 40, desc: "Un docente usa uno slang giovanile (es. 'cringe', 'bro', 'skibidi') sbagliandolo clamorosamente." },
    { id: "meme-di-corso", nome: "Meme di Corso", pt: 50, desc: "Creazione spontanea di un meme che diventa virale nel gruppo dell'accademia." },
    { id: "errore-gruppo", nome: "Errore di Gruppo", pt: -50, desc: "Inviare per errore un messaggio goliardico o meme sul gruppo UFFICIALE della consulta o del corso!" }
  ]
};

// 5. SOFFIATE DAL MASTER (PULITE: solo avviso di aggiornamenti a breve)
const MASTER_TIPS = [
  {
    id: 1,
    titolo: "CANALE SEGRETO DEL MASTER ATTIVO",
    data: "In Aggiornamento",
    testo: "Benvenuto nel canale riservato del Master! A brevissimo verranno pubblicate qui le prime soffiate esclusive, indiscrezioni di corridoio e dritte strategiche sui docenti. Tieni d'occhio questa sezione!"
  }
];

// 6. AVVISI INIZIALI: SOLO LA SCADENZA UFFICIALE
const INITIAL_NOTICES = [
  {
    id: "notice-deadline",
    tipo: "ANNUNCIO MASTER",
    icona: "⏳",
    badge: "Ufficiale",
    titolo: "COUNTDOWN CHIUSURA SQUADRE: DOMENICA 18 OTTOBRE A MEZZANOTTE",
    data: "13 Ottobre 2026",
    testo: "Allenatori ricordatevi di confermare la vostra squadra (4 Docenti + 1 Collega) con budget massimo di 100 CFA entro la mezzanotte di Domenica 18 Ottobre 2026. Una volta confermata, la squadra sarà bloccata definitivamente!"
  }
];

// 7. BACHECA SOCIAL PULITA
const INITIAL_REPORTS = [];

// 8. SQUADRE PULITE
const INITIAL_TEAMS = {
  Marco:   { confirmed: false, docenti: [], collega: null, cfaSpesi: 0, puntiBase: 0, puntiStorico: [] },
  Erika:   { confirmed: false, docenti: [], collega: null, cfaSpesi: 0, puntiBase: 0, puntiStorico: [] },
  Bea:     { confirmed: false, docenti: [], collega: null, cfaSpesi: 0, puntiBase: 0, puntiStorico: [] },
  Davi:    { confirmed: false, docenti: [], collega: null, cfaSpesi: 0, puntiBase: 0, puntiStorico: [] },
  Mar:     { confirmed: false, docenti: [], collega: null, cfaSpesi: 0, puntiBase: 0, puntiStorico: [] },
  Elisa:   { confirmed: false, docenti: [], collega: null, cfaSpesi: 0, puntiBase: 0, puntiStorico: [] },
  Moka:    { confirmed: false, docenti: [], collega: null, cfaSpesi: 0, puntiBase: 0, puntiStorico: [] },
  Leryn:   { confirmed: false, docenti: [], collega: null, cfaSpesi: 0, puntiBase: 0, puntiStorico: [] },
  Masi:    { confirmed: false, docenti: [], collega: null, cfaSpesi: 0, puntiBase: 0, puntiStorico: [] },
  Kiril:   { confirmed: false, docenti: [], collega: null, cfaSpesi: 0, puntiBase: 0, puntiStorico: [] },
  Nicole:  { confirmed: false, docenti: [], collega: null, cfaSpesi: 0, puntiBase: 0, puntiStorico: [] },
  Martina: { confirmed: false, docenti: [], collega: null, cfaSpesi: 0, puntiBase: 0, puntiStorico: [] }
};
