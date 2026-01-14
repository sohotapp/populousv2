// Base population distributions for synthetic agent generation
// Phase 1: Pre-loaded US demographic distributions

export interface DemographicDistribution {
  [value: string]: number; // value -> probability (must sum to 1.0)
}

export interface PopulationDefinition {
  id: string;
  name: string;
  description: string;
  totalSize: number;
  distributions: {
    age: DemographicDistribution;
    gender: DemographicDistribution;
    income: DemographicDistribution;
    education: DemographicDistribution;
    location: DemographicDistribution;
    region: DemographicDistribution;
    employment?: DemographicDistribution;
    householdSize?: DemographicDistribution;
  };
  // Optional trait distributions for behavioral modeling
  traits?: {
    riskTolerance?: DemographicDistribution;
    pricesSensitivity?: DemographicDistribution;
    brandLoyalty?: DemographicDistribution;
    techAdoption?: DemographicDistribution;
  };
}

export const BASE_POPULATIONS: Record<string, PopulationDefinition> = {
  us_adults: {
    id: "us_adults",
    name: "US Adults (18+)",
    description: "General US adult population based on Census Bureau ACS data",
    totalSize: 258_000_000,
    distributions: {
      age: {
        "18-24": 0.12,
        "25-34": 0.18,
        "35-44": 0.16,
        "45-54": 0.16,
        "55-64": 0.17,
        "65+": 0.21,
      },
      gender: {
        male: 0.49,
        female: 0.51,
      },
      income: {
        under_30k: 0.20,
        "30k-50k": 0.18,
        "50k-75k": 0.17,
        "75k-100k": 0.12,
        "100k-150k": 0.15,
        over_150k: 0.18,
      },
      education: {
        less_than_high_school: 0.08,
        high_school: 0.27,
        some_college: 0.29,
        bachelors: 0.23,
        graduate: 0.13,
      },
      location: {
        urban: 0.31,
        suburban: 0.55,
        rural: 0.14,
      },
      region: {
        northeast: 0.17,
        midwest: 0.21,
        south: 0.38,
        west: 0.24,
      },
      employment: {
        employed_full_time: 0.48,
        employed_part_time: 0.12,
        self_employed: 0.07,
        unemployed: 0.04,
        retired: 0.21,
        student: 0.05,
        homemaker: 0.03,
      },
      householdSize: {
        "1": 0.29,
        "2": 0.34,
        "3": 0.15,
        "4": 0.13,
        "5+": 0.09,
      },
    },
    traits: {
      riskTolerance: {
        very_low: 0.15,
        low: 0.25,
        moderate: 0.35,
        high: 0.18,
        very_high: 0.07,
      },
      pricesSensitivity: {
        very_low: 0.10,
        low: 0.20,
        moderate: 0.35,
        high: 0.25,
        very_high: 0.10,
      },
      brandLoyalty: {
        very_low: 0.12,
        low: 0.23,
        moderate: 0.30,
        high: 0.25,
        very_high: 0.10,
      },
      techAdoption: {
        laggard: 0.16,
        late_majority: 0.34,
        early_majority: 0.34,
        early_adopter: 0.13,
        innovator: 0.03,
      },
    },
  },

  us_voters: {
    id: "us_voters",
    name: "US Registered Voters",
    description: "US registered voter population for policy/election modeling",
    totalSize: 168_000_000,
    distributions: {
      age: {
        "18-24": 0.08,
        "25-34": 0.15,
        "35-44": 0.16,
        "45-54": 0.18,
        "55-64": 0.20,
        "65+": 0.23,
      },
      gender: {
        male: 0.47,
        female: 0.53,
      },
      income: {
        under_30k: 0.16,
        "30k-50k": 0.17,
        "50k-75k": 0.18,
        "75k-100k": 0.14,
        "100k-150k": 0.17,
        over_150k: 0.18,
      },
      education: {
        less_than_high_school: 0.05,
        high_school: 0.24,
        some_college: 0.28,
        bachelors: 0.27,
        graduate: 0.16,
      },
      location: {
        urban: 0.33,
        suburban: 0.54,
        rural: 0.13,
      },
      region: {
        northeast: 0.18,
        midwest: 0.21,
        south: 0.37,
        west: 0.24,
      },
    },
    traits: {
      riskTolerance: {
        very_low: 0.18,
        low: 0.27,
        moderate: 0.32,
        high: 0.16,
        very_high: 0.07,
      },
    },
  },

  us_consumers: {
    id: "us_consumers",
    name: "US Active Consumers",
    description: "US adults with significant purchasing activity",
    totalSize: 210_000_000,
    distributions: {
      age: {
        "18-24": 0.14,
        "25-34": 0.22,
        "35-44": 0.20,
        "45-54": 0.18,
        "55-64": 0.15,
        "65+": 0.11,
      },
      gender: {
        male: 0.48,
        female: 0.52,
      },
      income: {
        under_30k: 0.14,
        "30k-50k": 0.16,
        "50k-75k": 0.18,
        "75k-100k": 0.15,
        "100k-150k": 0.19,
        over_150k: 0.18,
      },
      education: {
        less_than_high_school: 0.06,
        high_school: 0.22,
        some_college: 0.28,
        bachelors: 0.28,
        graduate: 0.16,
      },
      location: {
        urban: 0.35,
        suburban: 0.53,
        rural: 0.12,
      },
      region: {
        northeast: 0.18,
        midwest: 0.20,
        south: 0.36,
        west: 0.26,
      },
      employment: {
        employed_full_time: 0.58,
        employed_part_time: 0.14,
        self_employed: 0.09,
        unemployed: 0.03,
        retired: 0.10,
        student: 0.04,
        homemaker: 0.02,
      },
    },
    traits: {
      pricesSensitivity: {
        very_low: 0.08,
        low: 0.18,
        moderate: 0.38,
        high: 0.26,
        very_high: 0.10,
      },
      brandLoyalty: {
        very_low: 0.10,
        low: 0.20,
        moderate: 0.32,
        high: 0.28,
        very_high: 0.10,
      },
      techAdoption: {
        laggard: 0.10,
        late_majority: 0.30,
        early_majority: 0.38,
        early_adopter: 0.17,
        innovator: 0.05,
      },
    },
  },

  enterprise_decision_makers: {
    id: "enterprise_decision_makers",
    name: "Enterprise Decision Makers",
    description: "B2B decision makers for enterprise sales modeling",
    totalSize: 15_000_000,
    distributions: {
      age: {
        "25-34": 0.15,
        "35-44": 0.32,
        "45-54": 0.30,
        "55-64": 0.18,
        "65+": 0.05,
      },
      gender: {
        male: 0.62,
        female: 0.38,
      },
      income: {
        "75k-100k": 0.10,
        "100k-150k": 0.25,
        "150k-200k": 0.28,
        "200k-300k": 0.22,
        over_300k: 0.15,
      },
      education: {
        bachelors: 0.35,
        graduate: 0.55,
        some_college: 0.10,
      },
      location: {
        urban: 0.55,
        suburban: 0.42,
        rural: 0.03,
      },
      region: {
        northeast: 0.24,
        midwest: 0.18,
        south: 0.32,
        west: 0.26,
      },
    },
    traits: {
      riskTolerance: {
        very_low: 0.08,
        low: 0.22,
        moderate: 0.40,
        high: 0.22,
        very_high: 0.08,
      },
    },
  },
};

// Helper to get population by ID with fallback
export function getPopulation(id: string): PopulationDefinition {
  return BASE_POPULATIONS[id] || BASE_POPULATIONS.us_adults;
}

// Helper to list available populations
export function listPopulations(): Array<{ id: string; name: string; size: number }> {
  return Object.values(BASE_POPULATIONS).map((p) => ({
    id: p.id,
    name: p.name,
    size: p.totalSize,
  }));
}

// Demographic value labels for human-readable output
export const DEMOGRAPHIC_LABELS: Record<string, Record<string, string>> = {
  age: {
    "18-24": "18-24 years old",
    "25-34": "25-34 years old",
    "35-44": "35-44 years old",
    "45-54": "45-54 years old",
    "55-64": "55-64 years old",
    "65+": "65 or older",
  },
  income: {
    under_30k: "under $30,000/year",
    "30k-50k": "$30,000-$50,000/year",
    "50k-75k": "$50,000-$75,000/year",
    "75k-100k": "$75,000-$100,000/year",
    "100k-150k": "$100,000-$150,000/year",
    over_150k: "over $150,000/year",
    "150k-200k": "$150,000-$200,000/year",
    "200k-300k": "$200,000-$300,000/year",
    over_300k: "over $300,000/year",
  },
  education: {
    less_than_high_school: "less than high school",
    high_school: "high school graduate",
    some_college: "some college or associate degree",
    bachelors: "bachelor's degree",
    graduate: "graduate or professional degree",
  },
  location: {
    urban: "urban area",
    suburban: "suburban area",
    rural: "rural area",
  },
  region: {
    northeast: "Northeast US",
    midwest: "Midwest US",
    south: "Southern US",
    west: "Western US",
  },
  employment: {
    employed_full_time: "employed full-time",
    employed_part_time: "employed part-time",
    self_employed: "self-employed",
    unemployed: "unemployed",
    retired: "retired",
    student: "student",
    homemaker: "homemaker",
  },
  riskTolerance: {
    very_low: "very risk-averse",
    low: "somewhat risk-averse",
    moderate: "moderate risk tolerance",
    high: "somewhat risk-tolerant",
    very_high: "very risk-tolerant",
  },
  pricesSensitivity: {
    very_low: "not price-sensitive (premium buyer)",
    low: "somewhat price-insensitive",
    moderate: "moderately price-conscious",
    high: "quite price-sensitive",
    very_high: "extremely price-sensitive (budget buyer)",
  },
  brandLoyalty: {
    very_low: "no brand loyalty (always shops around)",
    low: "low brand loyalty",
    moderate: "moderate brand loyalty",
    high: "high brand loyalty",
    very_high: "extremely brand loyal",
  },
  techAdoption: {
    laggard: "technology laggard (last to adopt)",
    late_majority: "late majority adopter",
    early_majority: "early majority adopter",
    early_adopter: "early adopter",
    innovator: "technology innovator (first to try)",
  },
};
