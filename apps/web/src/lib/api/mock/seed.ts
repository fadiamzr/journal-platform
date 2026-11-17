import type {
  Article,
  Issue,
  JournalSettings,
  Review,
  ReviewAssignment,
  Submission,
  User,
} from "@/lib/domain/types";

export const SEED_USERS: User[] = [
  {
    id: "usr-author-01",
    fullName: "Harriet Vance",
    email: "author@journal.example",
    role: "author",
    preferredLocale: "en",
    affiliation: "Department of History, University of Edinburgh",
  },
  {
    id: "usr-rev-01",
    fullName: "Arthur Pendelton",
    email: "reviewer@journal.example",
    role: "reviewer",
    preferredLocale: "en",
    affiliation: "Faculty of Social Sciences, Oxford University",
  },
  {
    id: "usr-editor-01",
    fullName: "Hélène Vance",
    email: "editor@journal.example",
    role: "editor",
    preferredLocale: "fr",
    affiliation: "Institut d'Études Avancées, Sorbonne Université",
  },
  {
    id: "usr-admin-01",
    fullName: "Tariq Al-Mansoor",
    email: "admin@journal.example",
    role: "admin",
    preferredLocale: "ar",
    affiliation: "Faculty of Letters and Human Sciences, Mohammed V University",
  },
  {
    id: "usr-rev-02",
    fullName: "Nadia Chraïbi",
    email: "nadia.chraibi@journal.example",
    role: "reviewer",
    preferredLocale: "fr",
    affiliation: "Centre de Sociologie Urbaine, CNRS Lyon",
  },
  {
    id: "usr-rev-03",
    fullName: "Youssef Bennani",
    email: "youssef.bennani@journal.example",
    role: "reviewer",
    preferredLocale: "ar",
    affiliation: "Department of Philosophy, Hassan II University, Casablanca",
  },
  {
    id: "usr-rev-04",
    fullName: "Miriam Sorkin",
    email: "miriam.sorkin@journal.example",
    role: "reviewer",
    preferredLocale: "en",
    affiliation: "Committee on Social Thought, University of Chicago",
  },
];

export const SEED_ISSUES: Issue[] = [
  {
    id: "iss-2026-v2-n1",
    volume: 2,
    number: 1,
    year: 2026,
    title: {
      en: "Mediterranean Crossings: Memory, Migration, and Intellectual Trade",
      fr: "Traversées méditerranéennes : mémoire, migration et échanges intellectuels",
      ar: "التقاطعات المتوسطية: الذاكرة والهجرة والتبادلات الفكرية",
    },
    status: "published",
    publishedAt: "2026-04-15T10:00:00Z",
  },
  {
    id: "iss-2025-v1-n2",
    volume: 1,
    number: 2,
    year: 2025,
    title: {
      en: "Sovereignty, Ecology, and the State in Post-Colonial Thought",
      fr: "Souveraineté, écologie et État dans la pensée postcoloniale",
      ar: "السيادة والبيئة والدولة في الفكر ما بعد الاستعماري",
    },
    status: "published",
    publishedAt: "2025-10-20T10:00:00Z",
  },
  {
    id: "iss-2025-v1-n1",
    volume: 1,
    number: 1,
    year: 2025,
    title: {
      en: "Inaugural Issue: Epistemic Foundations of the Human Sciences",
      fr: "Numéro inaugural : fondements épistémiques des sciences humaines",
      ar: "العدد الافتتاحي: الأسس الإبستمولوجية للعلوم الإنسانية",
    },
    status: "published",
    publishedAt: "2025-04-10T10:00:00Z",
  },
];

export const SEED_ARTICLES: Article[] = [
  // ── Issue Vol 2 No 1 (2026) ────────────────────────────────────────────────
  {
    id: "art-01",
    submissionId: "sub-pub-01",
    issueId: "iss-2026-v2-n1",
    doi: "10.5555/journal.2026.02.01.001",
    volume: 2,
    number: 1,
    year: 2026,
    order: 1,
    manuscriptLanguage: "en",
    publishedAt: "2026-04-15T10:00:00Z",
    pdfUrl: "/mock-files/art-01.pdf",
    title: {
      en: "Archival Silence and Mediterranean Maritime Networks (1720–1785)",
      fr: "Le silence des archives et les réseaux maritimes méditerranéens (1720–1785)",
      ar: "صمت الأرشيف وشبكات الملاحة المتوسطية (1720–1785)",
    },
    abstract: {
      en: "This article investigates commercial and consular documentation between Marseille, Tunis, and Livorno to reconstruct informal mercantile networks that operated beyond state surveillance. Drawing on previously uncataloged consular registers, we demonstrate how quarantine records expose social ties among North African and European merchant families.",
      fr: "Cet article explore les archives consulaires et marchandes entre Marseille, Tunis et Livourne afin de reconstituer les réseaux informels de négoce. L'analyse des registres de quarantaine révèle la densité des liens tissés entre familles commerçantes nord-africaines et européennes.",
      ar: "تستقصي هذه الدراسة الوثائق القنصلية والتجارية بين مرسيليا وتونس وليفورنو لإعادة بناء شبكات التجارة غير الرسمية. وتكشف سجلات الحجر الصحي عن متانة الروابط الاجتماعية والتجارية بين العائلات المغاربية والأوروبية.",
    },
    keywords: {
      en: ["Mediterranean history", "mercantile networks", "consular archives", "quarantine"],
      fr: ["histoire méditerranéenne", "réseaux marchands", "archives consulaires", "quarantaine"],
      ar: ["تاريخ البحر الأبيض المتوسط", "شبكات التجارة", "الأرشيف القنصلي", "الحجر الصحي"],
    },
    authors: [
      {
        fullName: "Harriet Vance",
        affiliations: ["University of Edinburgh", "Institut Méditerranéen d'Histoire"],
        email: "h.vance@edinburgh.ac.uk",
        orcid: "0000-0002-1825-0097",
        isCorresponding: true,
      },
      {
        fullName: "Karim Bouzid",
        affiliations: ["Université de Tunis"],
        email: "karim.bouzid@utm.tn",
      },
    ],
  },
  {
    id: "art-02",
    submissionId: "sub-pub-02",
    issueId: "iss-2026-v2-n1",
    doi: "10.5555/journal.2026.02.01.002",
    volume: 2,
    number: 1,
    year: 2026,
    order: 2,
    manuscriptLanguage: "fr",
    publishedAt: "2026-04-15T10:00:00Z",
    pdfUrl: "/mock-files/art-02.pdf",
    title: {
      en: "Translations of Modernity: The Nahda Press in Maghrebi Intellectual Circles",
      fr: "Traductions de la modernité : la presse de la Nahda dans les cercles intellectuels maghrébins",
      ar: "ترجمات الحداثة: صحافة النهضة في الدوائر الفكرية المغاربية",
    },
    abstract: {
      en: "Examining Arabic and bilingual periodicals published in Tangier and Algiers between 1880 and 1914, this study re-evaluates the reception of Eastern Nahda intellectual currents. It argues that Maghrebi reformers forged a distinct synthesis balancing Islamic jurisprudence with contemporary sociopolitical reform.",
      fr: "À travers l'étude de périodiques arabes et bilingues diffusés à Tanger et Alger entre 1880 et 1914, cet article réévalue la réception des courants intellectuels de la Nahda. Les réformateurs maghrébins ont développé une synthèse originale entre jurisprudence réformiste et modernisme social.",
      ar: "تتناول هذه الدراسة الدوريات العربية وثنائية اللغة الصادرة في طنجة والجزائر بين عامي 1880 و1914 لإعادة تقييم تلقي تيارات النهضة المشرقية، مبرزة كيف صاغ المفكرون المغاربة رؤية توفيقية تجمع بين الاجتهاد الفقهي والإصلاح الاجتماعي.",
    },
    keywords: {
      en: ["Nahda", "periodical press", "Maghreb", "intellectual history"],
      fr: ["Nahda", "presse périodique", "Maghreb", "histoire des idées"],
      ar: ["النهضة", "الصحافة الدورية", "المغرب العربي", "تاريخ الأفكار"],
    },
    authors: [
      {
        fullName: "Slimane Haddad",
        affiliations: ["École des Hautes Études en Sciences Sociales", "Université d'Alger"],
        isCorresponding: true,
      },
    ],
  },
  {
    id: "art-03",
    submissionId: "sub-pub-03",
    issueId: "iss-2026-v2-n1",
    doi: "10.5555/journal.2026.02.01.003",
    volume: 2,
    number: 1,
    year: 2026,
    order: 3,
    manuscriptLanguage: "ar",
    publishedAt: "2026-04-15T10:00:00Z",
    pdfUrl: "/mock-files/art-03.pdf",
    title: {
      en: "Spatial Poetics in Classical Andalusian Travelogues: Ibn Jubayr Revisited",
      fr: "Poétique spatiale dans les récits de voyage andalous : relecture d'Ibn Jubayr",
      ar: "شعرية المكان في أدب الرحلة الأندلسي: قراءة تأويلية في رحلة ابن جبير",
    },
    abstract: {
      en: "This inquiry reconsiders Ibn Jubayr's 12th-century Rihla through the lens of spatial sociology and literary hermeneutics. We demonstrate how the narrative constructs sacred and secular geographies, transforming pilgrimage into an epistemological cartography of cross-cultural encounter.",
      fr: "Cette étude revisite la Rihla d'Ibn Jubayr (XIIe siècle) sous l'angle de la géographie culturelle et de l'herméneutique littéraire. Le récit structure une cartographie symbolique où le pèlerinage devient le lieu d'une observation critique des altérités méditerranéennes.",
      ar: "تقترح هذه الدراسة قراءة تأويلية جديدة لـ 'رحلة ابن جبير' (القرن السادس الهجري) بالاستناد إلى سوسيولوجيا المكان والشعرية الثقافية. وتكشف الدراسة كيف تحول النص الرحلي إلى تخطيط رمزي ومعرفي لتمثلات الفضاء والتفاعل الحضاري في الحوض المتوسطي.",
    },
    keywords: {
      en: ["Ibn Jubayr", "travel literature", "spatial poetics", "Andalusia"],
      fr: ["Ibn Jubayr", "littérature de voyage", "poétique de l'espace", "Andalousie"],
      ar: ["ابن جبير", "أدب الرحلة", "شعرية المكان", "الأندلس"],
    },
    authors: [
      {
        fullName: "Fatima Zahra Merroun",
        affiliations: ["جامعة القرويين، فاس"],
        orcid: "0000-0003-9104-5821",
        isCorresponding: true,
      },
      {
        fullName: "Edward Miller",
        affiliations: ["University of Cambridge"],
      },
    ],
  },
  {
    id: "art-04",
    submissionId: "sub-pub-04",
    issueId: "iss-2026-v2-n1",
    doi: "10.5555/journal.2026.02.01.004",
    volume: 2,
    number: 1,
    year: 2026,
    order: 4,
    manuscriptLanguage: "en",
    publishedAt: "2026-04-15T10:00:00Z",
    pdfUrl: "/mock-files/art-04.pdf",
    title: {
      en: "Urban Micro-Sociologies: Coffeehouses and Public Sphere in Late Ottoman Salonica",
      fr: "Micro-sociologies urbaines : cafés et espace public à Salonique à la fin de l'époque ottomane",
      ar: "سوسيولوجيا الفضاء الحضري: المقاهي والمجال العام في سالونيك العثمانية المتأخرة",
    },
    abstract: {
      en: "By combining municipal police records, Ottoman tax censuses, and local multilingual gazettes, this paper charts how waterfront coffeehouses served as polyglot nodes of political deliberation and clandestine publication during the Constitutional era.",
      fr: "En croisant rapports de police, recensements fiscaux et gazettes multilingues, cet article montre comment les cafés du front de mer ont constitué des espaces de politisation et d'imprimerie clandestine sous la Seconde ère constitutionnelle ottomane.",
      ar: "من خلال تقاطع تقارير الشرطة البلدية والسجلات الضريبية العثمانية والصحافة المتعددة اللغات، تبين هذه الدراسة كيف تحولت مقاهي الواجهة البحرية إلى فضاءات للحوار السياسي والنشر السري إبان الحقبة الدستورية.",
    },
    keywords: {
      en: ["Salonica", "urban sociology", "coffeehouses", "Ottoman public sphere"],
      fr: ["Salonique", "sociologie urbaine", "cafés", "espace public ottoman"],
      ar: ["سالونيك", "سوسيولوجيا الحضر", "المقاهي", "المجال العام العثماني"],
    },
    authors: [
      {
        fullName: "Panagiotis Kostas",
        affiliations: ["Aristotle University of Thessaloniki"],
        isCorresponding: true,
      },
    ],
  },

  // ── Issue Vol 1 No 2 (2025) ────────────────────────────────────────────────
  {
    id: "art-05",
    submissionId: "sub-pub-05",
    issueId: "iss-2025-v1-n2",
    doi: "10.5555/journal.2025.01.02.001",
    volume: 1,
    number: 2,
    year: 2025,
    order: 1,
    manuscriptLanguage: "en",
    publishedAt: "2025-10-20T10:00:00Z",
    pdfUrl: "/mock-files/art-05.pdf",
    title: {
      en: "Hydropolitics and Nomadic Territoriality in the Pre-Saharan Oases",
      fr: "Hydropolitique et territorialité nomade dans les oasis présahariennes",
      ar: "السياسات المائية ومجالات الترحال في الواحات شبه الصحراوية",
    },
    abstract: {
      en: "This article examines customary water distribution systems (khettaras) and tribal grazing pacts in the Draa and Ziz valleys between 1850 and 1930. We show that colonial attempts to codify customary water rights fractured ecological resilience.",
      fr: "Cette étude analyse les systèmes coutumiers de partage de l'eau (khettaras) et les accords de pâturage dans les vallées du Draa et du Ziz (1850–1930). La codification coloniale a fragilisé la résilience écologique et sociale oasienne.",
      ar: "تبحث هذه الورقة في الأعراف المائية التقليدية (الخطارات) ومواثيق الرعي القبلي في حوضي درعة وزيز بين 1850 و1930، وتوضح كيف أدى التدخل الاستعماري لتقنين المياه إلى تفكيك التوازن الإيكولوجي والاجتماعي للواحات.",
    },
    keywords: {
      en: ["hydropolitics", "khettara", "oases", "customary law", "Draa valley"],
      fr: ["hydropolitique", "khettara", "oasis", "droit coutumier", "vallée du Draa"],
      ar: ["السياسة المائية", "الخطارات", "الواحات", "العرف", "وادي درعة"],
    },
    authors: [
      {
        fullName: "Aicha Benkirane",
        affiliations: ["Institut Agronomique et Vétérinaire Hassan II"],
        isCorresponding: true,
      },
      {
        fullName: "Jean-Marc Dupré",
        affiliations: ["Université d'Aix-Marseille"],
      },
    ],
  },
  {
    id: "art-06",
    submissionId: "sub-pub-06",
    issueId: "iss-2025-v1-n2",
    doi: "10.5555/journal.2025.01.02.002",
    volume: 1,
    number: 2,
    year: 2025,
    order: 2,
    manuscriptLanguage: "fr",
    publishedAt: "2025-10-20T10:00:00Z",
    pdfUrl: "/mock-files/art-06.pdf",
    title: {
      en: "Fanon in Translation: Radical Pedagogy and Third-Worldist Networks in Rome and Tunis",
      fr: "Fanon en traduction : pédagogie radicale et réseaux tiers-mondistes à Rome et Tunis",
      ar: "فانون مترجَماً: البيداغوجيا الراديكالية وشبكات العالم الثالث بين روما وتونس",
    },
    abstract: {
      en: "Focusing on Italian and bilingual Tunisian translations of Frantz Fanon during the 1960s, this article investigates how anti-colonial theory was mobilized in European worker-student alliances and Mediterranean solidarity campaigns.",
      fr: "À partir des traductions italiennes et tunisiennes de Frantz Fanon dans les années 1960, cet article analyse la circulation des théories anticoloniales au sein des mouvements étudiants et des revues de solidarité méditerranéenne.",
      ar: "تستند هذه الدراسة إلى الترجمات الإيطالية والتونسية لكتابات فرانز فانون في ستينيات القرن العشرين، وتبين كيف وظفت النظريات المناهضة للاستعمار في الحركات الطلابية وشبكات التضامن المتوسطية.",
    },
    keywords: {
      en: ["Frantz Fanon", "translation studies", "Third Worldism", "radical pedagogy"],
      fr: ["Frantz Fanon", "traductologie", "tiers-mondisme", "pédagogie critique"],
      ar: ["فرانز فانون", "دراسات الترجمة", "العالم الثالث", "البيداغوجيا النقدية"],
    },
    authors: [
      {
        fullName: "Marco Vianello",
        affiliations: ["Università di Bologna"],
        isCorresponding: true,
      },
    ],
  },
  {
    id: "art-07",
    submissionId: "sub-pub-07",
    issueId: "iss-2025-v1-n2",
    doi: "10.5555/journal.2025.01.02.003",
    volume: 1,
    number: 2,
    year: 2025,
    order: 3,
    manuscriptLanguage: "ar",
    publishedAt: "2025-10-20T10:00:00Z",
    pdfUrl: "/mock-files/art-07.pdf",
    title: {
      en: "Linguistic Justice and Administrative Translation in Multilingual Maghreb",
      fr: "Justice linguistique et traduction administrative dans le Maghreb multilingue",
      ar: "العدالة اللغوية والترجمة الإدارية في الفضاء المغاربي متعدد اللغات",
    },
    abstract: {
      en: "This paper analyzes the dialectic between official legal texts and citizen everyday administrative interactions in Morocco and Algeria. We argue that linguistic justice requires institutional recognition of vernacular forms alongside standard national languages.",
      fr: "Cet article analyse la tension entre les textes de droit positif et les pratiques administratives quotidiennes au Maroc et en Algérie. L'équité linguistique exige la prise en compte institutionnelle des langues vernaculaires.",
      ar: "تبحث هذه الورقة في إشكالية التداول اللغوي بين النصوص القانونية الرسمية والممارسات الإدارية اليومية في المغرب والجزائر، مبرزة أن العدالة اللغوية تقتضي الاعتراف المؤسساتي بالتعددية اللغوية وحماية حقوق المتقاضين والمرتفقين.",
    },
    keywords: {
      en: ["linguistic justice", "sociolinguistics", "administrative translation", "Maghreb"],
      fr: ["justice linguistique", "sociolinguistique", "traduction administrative", "Maghreb"],
      ar: ["العدالة اللغوية", "السوسيولسانيات", "الترجمة الإدارية", "المغرب العربي"],
    },
    authors: [
      {
        fullName: "Mohammed Al-Idrissi",
        affiliations: ["جامعة محمد الخامس، الرباط"],
        isCorresponding: true,
      },
    ],
  },
  {
    id: "art-08",
    submissionId: "sub-pub-08",
    issueId: "iss-2025-v1-n2",
    doi: "10.5555/journal.2025.01.02.004",
    volume: 1,
    number: 2,
    year: 2025,
    order: 4,
    manuscriptLanguage: "en",
    publishedAt: "2025-10-20T10:00:00Z",
    pdfUrl: "/mock-files/art-08.pdf",
    title: {
      en: "Archaeologies of Salt: Trade, Extraction, and Labour in the Sebkhas of Western Sahara",
      fr: "Archéologies du sel : commerce, extraction et travail dans les sebkhas du Sahara occidental",
      ar: "أركيولوجيا الملح: التجارة والاستخراج والعمل في سبخات الصحراء الغربية",
    },
    abstract: {
      en: "Intertwining ethno-archaeological surveys and historical caravansary records, this paper reconstructs seasonal salt harvesting in the Sebkha of Tah and its exchange for grain along Atlantic caravan corridors.",
      fr: "Croisant prospections ethno-archéologiques et registres caravaniers, cet article retrace l'extraction saisonnière du sel à la Sebkha de Tah et son troc contre des céréales le long des routes transatlantiques.",
      ar: "تجمع هذه الدراسة بين المسح الأثري وسجلات القوافل التجارية لرصد آليات استخراج الملح الموسمي في سبخة طاح ومبادلته بالحبوب عبر المسالك التجارية الصحراوية.",
    },
    keywords: {
      en: ["salt trade", "Sahara", "historical archaeology", "caravan routes"],
      fr: ["commerce du sel", "Sahara", "archéologie historique", "routes caravanières"],
      ar: ["تجارة الملح", "الصحراء", "الأركيولوجيا التاريخية", "طرق القوافل"],
    },
    authors: [
      {
        fullName: "Rachel Sterling",
        affiliations: ["University College London"],
        isCorresponding: true,
      },
      {
        fullName: "Omar Lamrini",
        affiliations: ["Institut National des Sciences de l'Archéologie et du Patrimoine"],
      },
    ],
  },

  // ── Issue Vol 1 No 1 (2025) ────────────────────────────────────────────────
  {
    id: "art-09",
    submissionId: "sub-pub-09",
    issueId: "iss-2025-v1-n1",
    doi: "10.5555/journal.2025.01.01.001",
    volume: 1,
    number: 1,
    year: 2025,
    order: 1,
    manuscriptLanguage: "fr",
    publishedAt: "2025-04-10T10:00:00Z",
    pdfUrl: "/mock-files/art-09.pdf",
    title: {
      en: "Ibn Khaldun and the Epistemological Foundations of Historical Sociology",
      fr: "Ibn Khaldoun et les fondements épistémologiques de la sociologie historique",
      ar: "ابن خلدون والأسس الإبستمولوجية لعلم الاجتماع التاريخي",
    },
    abstract: {
      en: "This introductory essay re-examines the concept of 'Umran in the Muqaddimah. Rather than an embryonic precursor to European sociology, Ibn Khaldun's science of human civilization is read on its own rigorous dialectical terms.",
      fr: "Cet article inaugural réexamine la notion de 'Umran dans la Muqaddima d'Ibn Khaldoun. Loin d'être un simple précurseur des sociologies modernes, le penseur andalou-maghrébin fonde une épistémologie autonome du devenir historique.",
      ar: "تعيد هذه الدراسة الافتتاحية فحص مفهوم 'العمران البشري' في مقدمة ابن خلدون، مؤكدة أن أطروحته لا تمثل مجرد إرهاص مبكر للسوسيولوجيا الغربية، بل تؤسس لنسق معرفي متكامل لتفسير التحولات الاجتماعية.",
    },
    keywords: {
      en: ["Ibn Khaldun", "epistemology", "historical sociology", "Muqaddimah"],
      fr: ["Ibn Khaldoun", "épistémologie", "sociologie historique", "Muqaddima"],
      ar: ["ابن خلدون", "الإبستمولوجيا", "علم الاجتماع التاريخي", "المقدمة"],
    },
    authors: [
      {
        fullName: "Hélène Vance",
        affiliations: ["Sorbonne Université", "Institut d'Études Avancées"],
        isCorresponding: true,
      },
    ],
  },
  {
    id: "art-10",
    submissionId: "sub-pub-10",
    issueId: "iss-2025-v1-n1",
    doi: "10.5555/journal.2025.01.01.002",
    volume: 1,
    number: 1,
    year: 2025,
    order: 2,
    manuscriptLanguage: "en",
    publishedAt: "2025-04-10T10:00:00Z",
    pdfUrl: "/mock-files/art-10.pdf",
    title: {
      en: "Critique of Colonial Philology: Orientalist Editions of Medieval Arabic Manuscripts",
      fr: "Critique de la philologie coloniale : les éditions orientalistes de manuscrits arabes médiévaux",
      ar: "نقد الفيلولوجيا الاستعمارية: التحقيقات الاستشراقية للمخطوطات العربية الوسيطة",
    },
    abstract: {
      en: "Focusing on 19th-century European critical editions of classical Arabic historical chronicles, this paper exposes editorial interventions, silencings, and typographical normalizations that shaped European understandings of Islamic historiography.",
      fr: "Analysant les éditions critiques européennes du XIXe siècle de chroniques arabes médiévales, cet article met au jour les coupes, normalisations typographiques et biais philologiques ayant orienté l'historiographie occidentale.",
      ar: "تكشف هذه الدراسة من خلال فحص التحقيقات النقدية الأوروبية للتواريخ العربية في القرن التاسع عشر عن التدخلات التحريرية والتنميطات التي فرضتها الفيلولوجيا الاستشراقية على التراث المخطوط.",
    },
    keywords: {
      en: ["philology", "Orientalism", "Arabic manuscripts", "textual criticism"],
      fr: ["philologie", "orientalisme", "manuscrits arabes", "critique textuelle"],
      ar: ["الفيلولوجيا", "الاستشراق", "المخطوطات العربية", "التحقيق النقدي"],
    },
    authors: [
      {
        fullName: "Arthur Pendelton",
        affiliations: ["Oxford University"],
        isCorresponding: true,
      },
    ],
  },
  {
    id: "art-11",
    submissionId: "sub-pub-11",
    issueId: "iss-2025-v1-n1",
    doi: "10.5555/journal.2025.01.01.003",
    volume: 1,
    number: 1,
    year: 2025,
    order: 3,
    manuscriptLanguage: "ar",
    publishedAt: "2025-04-10T10:00:00Z",
    pdfUrl: "/mock-files/art-11.pdf",
    title: {
      en: "Hermeneutics of the Archive: Methodological Questions in Moroccan Micro-History",
      fr: "Herméneutique de l'archive : questions méthodologiques en micro-histoire marocaine",
      ar: "هيرمينوطيقا الأرشيف: قضايا المنهج في المايكرو-تاريخ المغربي",
    },
    abstract: {
      en: "This methodological study explores local judicial registers (Hawalat and Kunashat) in Fez and Tetouan to demonstrate how family endowment disputes reveal subtle negotiations of gender, inheritance, and urban property rights in the 18th century.",
      fr: "Cette étude méthodologique interroge les registres judiciaires locaux (Hawalat et Kounashat) à Fès et Tétouan. Les litiges successoraux liés aux biens habous éclairent les négociations quotidiennes autour des droits fonciers et du statut des femmes au XVIIIe siècle.",
      ar: "تعالج هذه الدراسة المنهجية سجلات الحوالات الوقفية والكناشات القضائية في فاس وتطوان خلال القرن الثامن عشر، مبرزة كيف تتيح المقاربة الميكروتاريخية استجلاء ديناميات الملكية العقارية وحقوق المرأة وإدارة الأوقاف.",
    },
    keywords: {
      en: ["micro-history", "Moroccan archive", "endowments", "Fez"],
      fr: ["micro-histoire", "archives marocaines", "habous", "Fès"],
      ar: ["التاريخ المصغر", "الأرشيف المغربي", "الأوقاف", "فاس"],
    },
    authors: [
      {
        fullName: "Tariq Al-Mansoor",
        affiliations: ["Mohammed V University, Rabat"],
        isCorresponding: true,
      },
    ],
  },
  {
    id: "art-12",
    submissionId: "sub-pub-12",
    issueId: "iss-2025-v1-n1",
    doi: "10.5555/journal.2025.01.01.004",
    volume: 1,
    number: 1,
    year: 2025,
    order: 4,
    manuscriptLanguage: "en",
    publishedAt: "2025-04-10T10:00:00Z",
    pdfUrl: "/mock-files/art-12.pdf",
    title: {
      en: "The Rhetoric of Decolonization in Mediterranean Leftist Cinema (1965–1975)",
      fr: "La rhétorique de la décolonisation dans le cinéma méditerranéen de gauche (1965–1975)",
      ar: "بلاغة التحرر في السينما المتوسطية اليسارية (1965–1975)",
    },
    abstract: {
      en: "Analyzing political co-productions between Algerian, Italian, and Yugoslav film collectives, this article charts the visual syntax of anti-imperialist solidarity and its subsequent institutional containment.",
      fr: "À travers l'étude des coproductions entre collectifs de cinéastes algériens, italiens et yougoslaves, cet article analyse la syntaxe visuelle de la solidarité anti-impérialiste et sa postérité esthétique.",
      ar: "تدرس هذه الورقة الإنتاجات السينمائية المشتركة بين مخرجين من الجزائر وإيطاليا ويوغوسلافيا لرصد الأبعاد الجمالية والسياسية لسينما التحرر الوطني في حوض البحر الأبيض المتوسط.",
    },
    keywords: {
      en: ["political cinema", "decolonization", "Mediterranean", "militant film"],
      fr: ["cinéma politique", "décolonisation", "Méditerranée", "cinéma militant"],
      ar: ["السينما السياسية", "التحرر من الاستعمار", "المتوسط", "السينما النضالية"],
    },
    authors: [
      {
        fullName: "Livia Moretti",
        affiliations: ["Sapienza Università di Roma"],
        isCorresponding: true,
      },
    ],
  },
];

export const SEED_SUBMISSIONS: Submission[] = [
  // 1. DRAFT (Author is preparing, manuscript uploaded)
  {
    id: "sub-draft-01",
    authorId: "usr-author-01",
    status: "draft",
    manuscriptLanguage: "en",
    currentRound: 1,
    createdAt: "2026-10-01T10:00:00Z",
    extractionStatus: "not_started",
    title: {
      en: "Agrarian Transformation in the Rif Mountains: A Fifty-Year Perspective",
      fr: "Transformation agraire dans les montagnes du Rif : une perspective de cinquante ans",
      ar: "التحولات الزراعية في جبال الريف: قراءة في مسار نصف قرن",
    },
    abstract: {
      en: "This draft analyzes ecological shifts and land tenure restructuring in northern Morocco since 1970.",
    },
    keywords: {
      en: ["Rif mountains", "agrarian change", "land tenure", "Morocco"],
    },
    authors: [
      {
        fullName: "Harriet Vance",
        affiliations: ["University of Edinburgh"],
        email: "h.vance@edinburgh.ac.uk",
        isCorresponding: true,
      },
    ],
    versions: [
      {
        round: 1,
        hasManuscript: true,
        hasBlindCopy: false,
        blindCopyVerified: false,
        sizeBytes: 412000,
      },
    ],
  },

  // 2. SUBMITTED - Unverified blind copy
  {
    id: "sub-submitted-unverified",
    authorId: "usr-author-01",
    status: "submitted",
    manuscriptLanguage: "fr",
    currentRound: 1,
    createdAt: "2026-10-10T09:00:00Z",
    submittedAt: "2026-10-12T14:30:00Z",
    extractionStatus: "succeeded",
    title: {
      en: "Genealogies of Moroccan Legal Modernity: The Drafting of the 1913 Dahir",
      fr: "Généalogies de la modernité juridique marocaine : la rédaction du Dahir de 1913",
      ar: "أنساب الحداثة القانونية المغربية: صياغة ظهير الالتزامات والعقود 1913",
    },
    abstract: {
      en: "An archival study of French and Moroccan jurists collaborating on the Code of Obligations and Contracts.",
      fr: "Une étude archivistique des interactions entre juristes français et marocains lors de l'élaboration du Code des obligations et des contrats.",
    },
    keywords: {
      en: ["legal history", "Dahir 1913", "comparative law"],
      fr: ["histoire du droit", "Dahir 1913", "droit comparé"],
    },
    authors: [
      {
        fullName: "Harriet Vance",
        affiliations: ["University of Edinburgh"],
        email: "h.vance@edinburgh.ac.uk",
        isCorresponding: true,
      },
    ],
    versions: [
      {
        round: 1,
        hasManuscript: true,
        hasBlindCopy: true,
        blindCopyVerified: false,
        sizeBytes: 520000,
      },
    ],
  },

  // 3. SUBMITTED - Blind copy verified by editor, ready for peer review assignment
  {
    id: "sub-submitted-verified",
    authorId: "usr-author-01",
    status: "submitted",
    manuscriptLanguage: "ar",
    currentRound: 1,
    createdAt: "2026-10-05T08:00:00Z",
    submittedAt: "2026-10-06T11:00:00Z",
    extractionStatus: "succeeded",
    title: {
      en: "Sufi Orders and Trade Caravans in the Sous Valley: 17th Century Manuscripts",
      fr: "Confréries soufies et caravanes marchandes dans le Souss : manuscrits du XVIIe siècle",
      ar: "الزوايا الصوفية وقوافل التجارة في حوض سوس: دراسة في وثائق القرن السابع عشر",
    },
    abstract: {
      en: "This study examines the role of the Illigh zawiya in brokering trans-Atlas commercial security.",
      ar: "تبحث هذه الدراسة في الأدوار الاقتصادية والتحكيمية لزاوية إليغ في تأمين مسالك القوافل عبر الأطلس.",
    },
    keywords: {
      en: ["Sufism", "Sous valley", "caravan trade", "Illigh"],
      ar: ["التصوف", "حوض سوس", "تجارة القوافل", "زاوية إليغ"],
    },
    authors: [
      {
        fullName: "Harriet Vance",
        affiliations: ["University of Edinburgh"],
        email: "h.vance@edinburgh.ac.uk",
        isCorresponding: true,
      },
    ],
    versions: [
      {
        round: 1,
        hasManuscript: true,
        hasBlindCopy: true,
        blindCopyVerified: true,
        sizeBytes: 610000,
      },
    ],
  },

  // 4. IN REVIEW (2 reviewers assigned: 1 completed, 1 in progress)
  {
    id: "sub-in-review-01",
    authorId: "usr-author-01",
    status: "in_review",
    manuscriptLanguage: "en",
    currentRound: 1,
    createdAt: "2026-09-15T08:00:00Z",
    submittedAt: "2026-09-16T12:00:00Z",
    extractionStatus: "succeeded",
    title: {
      en: "Cross-Cultural Intellectual Exchanges in Early Modern Aleppo and Livorno",
      fr: "Échanges intellectuels et commerciaux entre Alep et Livourne à l'époque moderne",
      ar: "التبادلات الفكرية والتجارية بين حلب وليفورنو في العصر الحديث المبكر",
    },
    abstract: {
      en: "This research examines merchant epistolary exchanges and translation bureaus linking northern Syria to the Grand Duchy of Tuscany.",
      fr: "Cette recherche examine les correspondances marchandes reliant le nord de la Syrie au grand-duché de Toscane.",
      ar: "تبحث هذه الدراسة في المراسلات التجارية وحركات الترجمة التي ربطت بين شمال سوريا ودوقية توسكانا.",
    },
    keywords: {
      en: ["Aleppo", "Livorno", "epistolary networks", "early modern Mediterranean"],
      ar: ["حلب", "ليفورنو", "المراسلات التجارية", "العصر الحديث المبكر"],
    },
    authors: [
      {
        fullName: "Harriet Vance",
        affiliations: ["University of Edinburgh"],
        email: "h.vance@edinburgh.ac.uk",
        isCorresponding: true,
      },
    ],
    versions: [
      {
        round: 1,
        hasManuscript: true,
        hasBlindCopy: true,
        blindCopyVerified: true,
        sizeBytes: 580000,
      },
    ],
  },

  // 5. REVISIONS REQUESTED (Author has received feedback and must revise)
  {
    id: "sub-revisions-req-01",
    authorId: "usr-author-01",
    status: "revisions_requested",
    manuscriptLanguage: "en",
    currentRound: 1,
    createdAt: "2026-08-20T08:00:00Z",
    submittedAt: "2026-08-22T10:00:00Z",
    decidedAt: "2026-10-02T15:00:00Z",
    decisionNote:
      "The reviewers praise the archival depth of the manuscript but require substantial revisions regarding the comparative framework in Section 3 and the inclusion of recent secondary literature.",
    extractionStatus: "succeeded",
    title: {
      en: "Customary Pasture Rights and Colonial Forestry in the Middle Atlas (1914–1936)",
      fr: "Droits pastoraux coutumiers et foresterie coloniale dans le Moyen Atlas (1914–1936)",
      ar: "حقوق الرعي العرفية والغابات في عهد الحماية بالريف الأوسط (1914–1936)",
    },
    abstract: {
      en: "This article investigates pastoral conflicts provoked by the Dahir des Eaux et Forêts of 1917.",
    },
    keywords: {
      en: ["Middle Atlas", "pastoralism", "forestry law", "colonial Morocco"],
    },
    authors: [
      {
        fullName: "Harriet Vance",
        affiliations: ["University of Edinburgh"],
        email: "h.vance@edinburgh.ac.uk",
        isCorresponding: true,
      },
    ],
    versions: [
      {
        round: 1,
        hasManuscript: true,
        hasBlindCopy: true,
        blindCopyVerified: true,
        sizeBytes: 670000,
      },
    ],
  },

  // 6. ACCEPTED - Ready for publication in upcoming issue
  {
    id: "sub-accepted-01",
    authorId: "usr-author-01",
    status: "accepted",
    manuscriptLanguage: "fr",
    currentRound: 2,
    createdAt: "2026-07-01T08:00:00Z",
    submittedAt: "2026-07-03T10:00:00Z",
    decidedAt: "2026-09-28T14:00:00Z",
    decisionNote: "The revised version fully addresses all reviewer comments. Accepted for publication.",
    extractionStatus: "succeeded",
    title: {
      en: "Epistolary Diplomacies: Moroccan Consular Correspondence in Venice (1600–1650)",
      fr: "Diplomaties épistolaires : correspondances consulaires marocaines à Venise (1600–1650)",
      ar: "دبلوماسية المراسلات: المكاتبات القنصلية المغربية في البندقية (1600–1650)",
    },
    abstract: {
      en: "An examination of early modern Saadian diplomatic letters preserved in the Venetian state archives.",
      fr: "Une analyse des lettres diplomatiques saadiennes conservées dans les archives d'État de Venise.",
      ar: "دراسة في الرسائل الدبلوماسية السعدية المحفوظة في أرشيف دولة البندقية.",
    },
    keywords: {
      en: ["Venice", "Saadian dynasty", "diplomacy", "consular history"],
      fr: ["Venise", "dynastie saadienne", "diplomatie", "histoire consulaire"],
    },
    authors: [
      {
        fullName: "Harriet Vance",
        affiliations: ["University of Edinburgh"],
        email: "h.vance@edinburgh.ac.uk",
        isCorresponding: true,
      },
    ],
    versions: [
      {
        round: 1,
        hasManuscript: true,
        hasBlindCopy: true,
        blindCopyVerified: true,
        sizeBytes: 540000,
      },
      {
        round: 2,
        hasManuscript: true,
        hasBlindCopy: true,
        blindCopyVerified: true,
        sizeBytes: 560000,
        responseToReviewers: "We have expanded the Venetian archival references in section 2.",
      },
    ],
  },

  // 7. REJECTED
  {
    id: "sub-rejected-01",
    authorId: "usr-author-01",
    status: "rejected",
    manuscriptLanguage: "en",
    currentRound: 1,
    createdAt: "2026-06-10T08:00:00Z",
    submittedAt: "2026-06-12T10:00:00Z",
    decidedAt: "2026-07-15T11:00:00Z",
    decisionNote:
      "Both peer reviewers concluded that while the subject is interesting, the methodology lacks archival empirical support and falls outside the current scope of the journal.",
    extractionStatus: "succeeded",
    title: {
      en: "Preliminary Reflections on Medieval Coinage Hoards in Central Asia",
      fr: "Réflexions préliminaires sur les trésors monétaires médiévaux en Asie centrale",
      ar: "ملاحظات أولية حول الكنوز النقدية الوسيطة في آسيا الوسطى",
    },
    abstract: {
      en: "A review of numismatic findings in Transoxiana.",
    },
    keywords: {
      en: ["numismatics", "Central Asia", "medieval coins"],
    },
    authors: [
      {
        fullName: "Harriet Vance",
        affiliations: ["University of Edinburgh"],
        email: "h.vance@edinburgh.ac.uk",
        isCorresponding: true,
      },
    ],
    versions: [
      {
        round: 1,
        hasManuscript: true,
        hasBlindCopy: true,
        blindCopyVerified: true,
        sizeBytes: 380000,
      },
    ],
  },

  // 8. PUBLISHED SUBMISSION REFERENCE (links to art-01)
  {
    id: "sub-pub-01",
    authorId: "usr-author-01",
    status: "published",
    manuscriptLanguage: "en",
    currentRound: 2,
    createdAt: "2025-11-01T08:00:00Z",
    submittedAt: "2025-11-04T10:00:00Z",
    decidedAt: "2026-02-15T12:00:00Z",
    issueId: "iss-2026-v2-n1",
    doi: "10.5555/journal.2026.02.01.001",
    extractionStatus: "succeeded",
    title: {
      en: "Archival Silence and Mediterranean Maritime Networks (1720–1785)",
      fr: "Le silence des archives et les réseaux maritimes méditerranéens (1720–1785)",
      ar: "صمت الأرشيف وشبكات الملاحة المتوسطية (1720–1785)",
    },
    abstract: {
      en: "This article investigates commercial and consular documentation between Marseille, Tunis, and Livorno.",
    },
    keywords: {
      en: ["Mediterranean history", "mercantile networks", "consular archives", "quarantine"],
    },
    authors: [
      {
        fullName: "Harriet Vance",
        affiliations: ["University of Edinburgh"],
        email: "h.vance@edinburgh.ac.uk",
        isCorresponding: true,
      },
    ],
    versions: [
      {
        round: 1,
        hasManuscript: true,
        hasBlindCopy: true,
        blindCopyVerified: true,
        sizeBytes: 710000,
      },
      {
        round: 2,
        hasManuscript: true,
        hasBlindCopy: true,
        blindCopyVerified: true,
        sizeBytes: 730000,
      },
    ],
  },
];

export const SEED_ASSIGNMENTS: ReviewAssignment[] = [
  // Assignments for sub-in-review-01:
  // Reviewer 1 (Arthur Pendelton): completed
  {
    id: "asg-01",
    submissionId: "sub-in-review-01",
    round: 1,
    reviewerId: "usr-rev-01",
    status: "completed",
    invitedAt: "2026-09-17T09:00:00Z",
    dueAt: "2026-10-15T23:59:59Z",
  },
  // Reviewer 2 (Nadia Chraïbi): accepted, working on review
  {
    id: "asg-02",
    submissionId: "sub-in-review-01",
    round: 1,
    reviewerId: "usr-rev-02",
    status: "accepted",
    invitedAt: "2026-09-17T09:00:00Z",
    dueAt: "2026-10-20T23:59:59Z",
  },

  // Assignment for sub-revisions-req-01 (Round 1 completed)
  {
    id: "asg-03",
    submissionId: "sub-revisions-req-01",
    round: 1,
    reviewerId: "usr-rev-01",
    status: "completed",
    invitedAt: "2026-08-25T09:00:00Z",
    dueAt: "2026-09-20T23:59:59Z",
  },
  {
    id: "asg-04",
    submissionId: "sub-revisions-req-01",
    round: 1,
    reviewerId: "usr-rev-04",
    status: "completed",
    invitedAt: "2026-08-25T09:00:00Z",
    dueAt: "2026-09-20T23:59:59Z",
  },

  // Assignment for sub-rejected-01
  {
    id: "asg-05",
    submissionId: "sub-rejected-01",
    round: 1,
    reviewerId: "usr-rev-03",
    status: "completed",
    invitedAt: "2026-06-15T09:00:00Z",
    dueAt: "2026-07-05T23:59:59Z",
  },
];

export const SEED_REVIEWS: Review[] = [
  // Review on asg-01 (sub-in-review-01, reviewer 1)
  {
    assignmentId: "asg-01",
    scores: {
      originality: 4,
      methodology: 4,
      clarity: 5,
      significance: 4,
      relevance: 5,
    },
    recommendation: "minor_revisions",
    commentsToAuthor:
      "This is an impeccably researched article with a commendable use of multilingual archival records. I suggest expanding footnote 14 to reference recent scholarship on Livornese maritime contracts and refining the terminology regarding early modern mercantile jurisdiction.",
    confidentialCommentsToEditor:
      "A strong piece. Harriet Vance (or whoever the author is, since it's blind) knows the Tuscan archives inside out. Once minor citations are added, this should be accepted.",
    submittedAt: "2026-10-08T16:20:00Z",
  },

  // Review on asg-03 (sub-revisions-req-01)
  {
    assignmentId: "asg-03",
    scores: {
      originality: 4,
      methodology: 3,
      clarity: 4,
      significance: 4,
      relevance: 4,
    },
    recommendation: "major_revisions",
    commentsToAuthor:
      "The empirical material on Middle Atlas forestry litigation is remarkable. However, the theoretical engagement with property rights needs substantial grounding. Section 3 should be restructured to contextualize customary pastoralism against broader North African legal debates.",
    confidentialCommentsToEditor:
      "Promising empirical data, but the theoretical scaffolding is currently weak. Recommend major revisions with a second round of review.",
    submittedAt: "2026-09-18T11:45:00Z",
  },

  // Review on asg-04 (sub-revisions-req-01)
  {
    assignmentId: "asg-04",
    scores: {
      originality: 4,
      methodology: 4,
      clarity: 3,
      significance: 4,
      relevance: 4,
    },
    recommendation: "minor_revisions",
    commentsToAuthor:
      "An informative and valuable contribution. Please clarify the timeline of French military surveys in the forestry zone and correct two transcription errors in the archival Arabic quotations on page 19.",
    confidentialCommentsToEditor:
      "Solid empirical study. Minor revisions required before publication.",
    submittedAt: "2026-09-20T14:10:00Z",
  },

  // Review on asg-05 (sub-rejected-01)
  {
    assignmentId: "asg-05",
    scores: {
      originality: 2,
      methodology: 2,
      clarity: 3,
      significance: 2,
      relevance: 1,
    },
    recommendation: "reject",
    commentsToAuthor:
      "While numismatic discoveries in Transoxiana are inherently interesting, this paper presents little original archival or archaeological methodology and would be better suited for a specialized numismatics journal.",
    confidentialCommentsToEditor:
      "Clearly out of scope for our journal. Recommend reject.",
    submittedAt: "2026-07-01T15:30:00Z",
  },
];

export const SEED_SETTINGS: JournalSettings = {
  journalName: "Journal",
  issnPrint: "2940-1042",
  issnOnline: "2940-1050",
  publisherName: "University Scholarly Press",
  contactEmail: "editorial@journal.university.example",
  allowOpenSubmissions: true,
};
