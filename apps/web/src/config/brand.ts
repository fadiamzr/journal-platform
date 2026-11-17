export interface BrandConfig {
  name: string;
  tagline: {
    en: string;
    fr: string;
    ar: string;
  };
  description: {
    en: string;
    fr: string;
    ar: string;
  };
  issn: {
    print: string;
    online: string;
  };
  publisher: {
    name: string;
    location: string;
    url: string;
  };
  contact: {
    email: string;
    phone: string;
    address: string;
  };
  aimsAndScope: {
    en: string[];
    fr: string[];
    ar: string[];
  };
  editorialBoard: {
    editorInChief: {
      name: string;
      affiliation: string;
      orcid?: string;
    };
    associateEditors: Array<{
      name: string;
      affiliation: string;
      role: string;
    }>;
    editorialBoardMembers: Array<{
      name: string;
      affiliation: string;
    }>;
  };
  logo: {
    wordmark: string;
    alt: string;
    monogram?: {
      letter: string;
      subtext?: string;
    };
  };
}

export const brand: BrandConfig = {
  name: "Journal",
  tagline: {
    en: "An International Journal of Humanities & Social Sciences",
    fr: "Revue internationale de sciences humaines et sociales",
    ar: "مجلة دولية للعلوم الإنسانية والاجتماعية",
  },
  description: {
    en: "A peer-reviewed, open-access scholarly publication committed to rigor, independence, and double-blind academic excellence.",
    fr: "Une revue académique à comité de lecture et en libre accès, dédiée à la rigueur, à l'indépendance et à l'excellence en double aveugle.",
    ar: "دورية علمية محكّمة ومفتوحة الوصول ملتزمة بالدقة الأكاديمية والنزاهة والتحكيم مزدوج التعمية.",
  },
  issn: {
    print: "2940-1042",
    online: "2940-1050",
  },
  publisher: {
    name: "University Scholarly Press",
    location: "Casablanca & Paris",
    url: "https://press.university.example",
  },
  contact: {
    email: "editorial@journal.university.example",
    phone: "+33 1 40 00 00 00",
    address: "12 Rue de l'Université, 75007 Paris, France",
  },
  aimsAndScope: {
    en: [
      "The Journal publishes original, groundbreaking scholarship at the intersection of history, sociology, literary studies, and philosophical inquiry.",
      "We encourage comparative and cross-regional perspectives, with special emphasis on Mediterranean, North African, and European intellectual exchanges.",
      "All submissions undergo rigorous double-blind peer review by international experts.",
    ],
    fr: [
      "La Revue publie des travaux de recherche originaux au carrefour de l'histoire, de la sociologie, des études littéraires et de la philosophie.",
      "Nous encourageons les approches comparatistes et transrégionales, avec une attention particulière aux échanges intellectuels méditerranéens et euro-africains.",
      "Toutes les soumissions sont soumises à une évaluation rigoureuse par les pairs en double aveugle.",
    ],
    ar: [
      "تنشر المجلة بحوثاً أصيلة ومبتكرة عند تقاطع التاريخ، وعلم الاجتماع، والدراسات الأدبية، والفلسفة.",
      "نشجع المقاربات المقارنة والعابرة للأقاليم، مع تركيز خاص على التبادلات الفكرية المتوسطية وشمال الإفريقية والأوروبية.",
      "تخضع جميع البحوث المقدمة لمراجعة دقيقة ومزدوجة التعمية من قبل خبراء دوليين.",
    ],
  },
  editorialBoard: {
    editorInChief: {
      name: "Prof. Hélène Vance",
      affiliation: "Institut d'Études Avancées",
      orcid: "0000-0002-1825-0097",
    },
    associateEditors: [
      {
        name: "Dr. Tariq Al-Mansoor",
        affiliation: "Faculty of Letters & Human Sciences, Rabat",
        role: "Middle Eastern & North African Studies",
      },
      {
        name: "Prof. Arthur Pendelton",
        affiliation: "Department of Social History, Oxford",
        role: "European & Global History",
      },
      {
        name: "Dr. Nadia Chraïbi",
        affiliation: "Centre de Sociologie Urbaine, Lyon",
        role: "Contemporary Social Theory",
      },
    ],
    editorialBoardMembers: [
      { name: "Prof. Miriam Sorkin", affiliation: "University of Chicago" },
      { name: "Dr. Youssef Bennani", affiliation: "Université Mohammed V, Rabat" },
      { name: "Prof. Luc Renard", affiliation: "École des Hautes Études en Sciences Sociales" },
      { name: "Dr. Amina El-Khatib", affiliation: "American University of Beirut" },
      { name: "Prof. Carlos Mendez", affiliation: "Universidad Complutense de Madrid" },
    ],
  },
  logo: {
    wordmark: "JOURNAL",
    alt: "Journal of Humanities & Social Sciences",
    monogram: {
      letter: "J",
      subtext: "PRESS",
    },
  },
};
