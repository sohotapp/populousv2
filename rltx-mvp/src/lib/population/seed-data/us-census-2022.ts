// US Census 2022 ACS Data with Conditional Distributions
// Source: American Community Survey 2022 1-year estimates
// Enhanced with conditional probabilities for realistic agent generation

import type { DemographicDistribution } from "../base-populations";

export interface ConditionalDistribution {
  [conditionValue: string]: DemographicDistribution;
}

export interface CensusData {
  demographics: {
    age: DemographicDistribution;
    gender: DemographicDistribution;
    income: DemographicDistribution;
    education: DemographicDistribution;
    location: DemographicDistribution;
    region: DemographicDistribution;
    employment: DemographicDistribution;
    householdSize: DemographicDistribution;
  };
  conditionals: {
    // P(income | education) - Income distribution conditional on education level
    incomeGivenEducation: ConditionalDistribution;
    // P(income | age) - Income distribution conditional on age
    incomeGivenAge: ConditionalDistribution;
    // P(techAdoption | age) - Technology adoption conditional on age
    techAdoptionGivenAge: ConditionalDistribution;
    // P(employment | age) - Employment status conditional on age
    employmentGivenAge: ConditionalDistribution;
    // P(riskTolerance | age) - Risk tolerance conditional on age
    riskToleranceGivenAge: ConditionalDistribution;
    // P(riskTolerance | income) - Risk tolerance conditional on income
    riskToleranceGivenIncome: ConditionalDistribution;
  };
  psychographics: {
    riskTolerance: DemographicDistribution;
    priceSensitivity: DemographicDistribution;
    brandLoyalty: DemographicDistribution;
    techAdoption: DemographicDistribution;
  };
}

export const US_CENSUS_2022: CensusData = {
  demographics: {
    // Age distribution (US adults 18+, ACS 2022)
    age: {
      "18-24": 0.115,
      "25-34": 0.175,
      "35-44": 0.163,
      "45-54": 0.157,
      "55-64": 0.169,
      "65+": 0.221,
    },

    // Gender distribution
    gender: {
      male: 0.49,
      female: 0.51,
    },

    // Household income distribution (ACS 2022)
    income: {
      under_30k: 0.20,
      "30k-50k": 0.15,
      "50k-75k": 0.17,
      "75k-100k": 0.12,
      "100k-150k": 0.17,
      over_150k: 0.19,
    },

    // Education attainment (adults 25+, ACS 2022)
    education: {
      less_than_high_school: 0.10,
      high_school: 0.27,
      some_college: 0.20,
      bachelors: 0.23,
      graduate: 0.20,
    },

    // Urban/Suburban/Rural (Census Bureau)
    location: {
      urban: 0.31,
      suburban: 0.52,
      rural: 0.17,
    },

    // Census regions
    region: {
      northeast: 0.17,
      midwest: 0.21,
      south: 0.38,
      west: 0.24,
    },

    // Employment status (BLS 2022)
    employment: {
      employed_full_time: 0.47,
      employed_part_time: 0.13,
      self_employed: 0.07,
      unemployed: 0.04,
      retired: 0.19,
      student: 0.06,
      homemaker: 0.04,
    },

    // Household size
    householdSize: {
      "1": 0.29,
      "2": 0.35,
      "3": 0.15,
      "4": 0.12,
      "5+": 0.09,
    },
  },

  // CRITICAL: Conditional distributions for realistic correlations
  conditionals: {
    // P(income | education) - Higher education strongly correlates with higher income
    incomeGivenEducation: {
      graduate: {
        under_30k: 0.06,
        "30k-50k": 0.08,
        "50k-75k": 0.12,
        "75k-100k": 0.14,
        "100k-150k": 0.22,
        over_150k: 0.38,
      },
      bachelors: {
        under_30k: 0.10,
        "30k-50k": 0.12,
        "50k-75k": 0.18,
        "75k-100k": 0.16,
        "100k-150k": 0.22,
        over_150k: 0.22,
      },
      some_college: {
        under_30k: 0.22,
        "30k-50k": 0.20,
        "50k-75k": 0.22,
        "75k-100k": 0.14,
        "100k-150k": 0.14,
        over_150k: 0.08,
      },
      high_school: {
        under_30k: 0.32,
        "30k-50k": 0.24,
        "50k-75k": 0.20,
        "75k-100k": 0.10,
        "100k-150k": 0.09,
        over_150k: 0.05,
      },
      less_than_high_school: {
        under_30k: 0.52,
        "30k-50k": 0.25,
        "50k-75k": 0.13,
        "75k-100k": 0.05,
        "100k-150k": 0.03,
        over_150k: 0.02,
      },
    },

    // P(income | age) - Peak earning years 45-54
    incomeGivenAge: {
      "18-24": {
        under_30k: 0.52,
        "30k-50k": 0.22,
        "50k-75k": 0.14,
        "75k-100k": 0.06,
        "100k-150k": 0.04,
        over_150k: 0.02,
      },
      "25-34": {
        under_30k: 0.22,
        "30k-50k": 0.18,
        "50k-75k": 0.20,
        "75k-100k": 0.14,
        "100k-150k": 0.15,
        over_150k: 0.11,
      },
      "35-44": {
        under_30k: 0.14,
        "30k-50k": 0.12,
        "50k-75k": 0.16,
        "75k-100k": 0.14,
        "100k-150k": 0.20,
        over_150k: 0.24,
      },
      "45-54": {
        under_30k: 0.12,
        "30k-50k": 0.10,
        "50k-75k": 0.14,
        "75k-100k": 0.13,
        "100k-150k": 0.21,
        over_150k: 0.30,
      },
      "55-64": {
        under_30k: 0.16,
        "30k-50k": 0.12,
        "50k-75k": 0.15,
        "75k-100k": 0.12,
        "100k-150k": 0.19,
        over_150k: 0.26,
      },
      "65+": {
        under_30k: 0.28,
        "30k-50k": 0.18,
        "50k-75k": 0.17,
        "75k-100k": 0.11,
        "100k-150k": 0.13,
        over_150k: 0.13,
      },
    },

    // P(techAdoption | age) - Younger people adopt technology faster
    techAdoptionGivenAge: {
      "18-24": {
        innovator: 0.08,
        early_adopter: 0.28,
        early_majority: 0.42,
        late_majority: 0.18,
        laggard: 0.04,
      },
      "25-34": {
        innovator: 0.06,
        early_adopter: 0.24,
        early_majority: 0.42,
        late_majority: 0.22,
        laggard: 0.06,
      },
      "35-44": {
        innovator: 0.04,
        early_adopter: 0.16,
        early_majority: 0.40,
        late_majority: 0.30,
        laggard: 0.10,
      },
      "45-54": {
        innovator: 0.02,
        early_adopter: 0.10,
        early_majority: 0.35,
        late_majority: 0.38,
        laggard: 0.15,
      },
      "55-64": {
        innovator: 0.01,
        early_adopter: 0.06,
        early_majority: 0.28,
        late_majority: 0.42,
        laggard: 0.23,
      },
      "65+": {
        innovator: 0.01,
        early_adopter: 0.04,
        early_majority: 0.18,
        late_majority: 0.42,
        laggard: 0.35,
      },
    },

    // P(employment | age) - Retirement increases with age
    employmentGivenAge: {
      "18-24": {
        employed_full_time: 0.42,
        employed_part_time: 0.25,
        self_employed: 0.02,
        unemployed: 0.08,
        retired: 0.00,
        student: 0.20,
        homemaker: 0.03,
      },
      "25-34": {
        employed_full_time: 0.68,
        employed_part_time: 0.10,
        self_employed: 0.06,
        unemployed: 0.05,
        retired: 0.00,
        student: 0.05,
        homemaker: 0.06,
      },
      "35-44": {
        employed_full_time: 0.72,
        employed_part_time: 0.08,
        self_employed: 0.08,
        unemployed: 0.04,
        retired: 0.00,
        student: 0.02,
        homemaker: 0.06,
      },
      "45-54": {
        employed_full_time: 0.70,
        employed_part_time: 0.07,
        self_employed: 0.10,
        unemployed: 0.04,
        retired: 0.02,
        student: 0.01,
        homemaker: 0.06,
      },
      "55-64": {
        employed_full_time: 0.52,
        employed_part_time: 0.08,
        self_employed: 0.10,
        unemployed: 0.04,
        retired: 0.20,
        student: 0.01,
        homemaker: 0.05,
      },
      "65+": {
        employed_full_time: 0.08,
        employed_part_time: 0.06,
        self_employed: 0.04,
        unemployed: 0.01,
        retired: 0.78,
        student: 0.00,
        homemaker: 0.03,
      },
    },

    // P(riskTolerance | age) - Younger people take more risks
    riskToleranceGivenAge: {
      "18-24": {
        very_low: 0.08,
        low: 0.18,
        moderate: 0.32,
        high: 0.28,
        very_high: 0.14,
      },
      "25-34": {
        very_low: 0.10,
        low: 0.20,
        moderate: 0.35,
        high: 0.25,
        very_high: 0.10,
      },
      "35-44": {
        very_low: 0.12,
        low: 0.24,
        moderate: 0.38,
        high: 0.20,
        very_high: 0.06,
      },
      "45-54": {
        very_low: 0.16,
        low: 0.28,
        moderate: 0.36,
        high: 0.16,
        very_high: 0.04,
      },
      "55-64": {
        very_low: 0.20,
        low: 0.30,
        moderate: 0.34,
        high: 0.12,
        very_high: 0.04,
      },
      "65+": {
        very_low: 0.28,
        low: 0.32,
        moderate: 0.28,
        high: 0.09,
        very_high: 0.03,
      },
    },

    // P(riskTolerance | income) - Higher income = more risk tolerance
    riskToleranceGivenIncome: {
      under_30k: {
        very_low: 0.28,
        low: 0.32,
        moderate: 0.28,
        high: 0.09,
        very_high: 0.03,
      },
      "30k-50k": {
        very_low: 0.22,
        low: 0.30,
        moderate: 0.32,
        high: 0.12,
        very_high: 0.04,
      },
      "50k-75k": {
        very_low: 0.16,
        low: 0.26,
        moderate: 0.36,
        high: 0.16,
        very_high: 0.06,
      },
      "75k-100k": {
        very_low: 0.12,
        low: 0.22,
        moderate: 0.38,
        high: 0.20,
        very_high: 0.08,
      },
      "100k-150k": {
        very_low: 0.10,
        low: 0.20,
        moderate: 0.36,
        high: 0.24,
        very_high: 0.10,
      },
      over_150k: {
        very_low: 0.06,
        low: 0.16,
        moderate: 0.32,
        high: 0.30,
        very_high: 0.16,
      },
    },
  },

  // Psychographic trait distributions (independent baseline)
  psychographics: {
    riskTolerance: {
      very_low: 0.15,
      low: 0.25,
      moderate: 0.35,
      high: 0.18,
      very_high: 0.07,
    },
    priceSensitivity: {
      very_low: 0.08,
      low: 0.18,
      moderate: 0.38,
      high: 0.26,
      very_high: 0.10,
    },
    brandLoyalty: {
      very_low: 0.12,
      low: 0.23,
      moderate: 0.35,
      high: 0.20,
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
};

// Helper to sample from a conditional distribution
export function sampleConditional(
  conditional: ConditionalDistribution,
  conditionValue: string,
  rng: () => number
): string {
  const dist = conditional[conditionValue];
  if (!dist) {
    // Fall back to first available distribution
    const firstKey = Object.keys(conditional)[0];
    return sampleFromDist(conditional[firstKey], rng);
  }
  return sampleFromDist(dist, rng);
}

// Helper to sample from a distribution
function sampleFromDist(dist: DemographicDistribution, rng: () => number): string {
  const r = rng();
  let cumulative = 0;
  const entries = Object.entries(dist);

  for (const [value, prob] of entries) {
    cumulative += prob;
    if (r <= cumulative) {
      return value;
    }
  }

  return entries[entries.length - 1][0];
}

// Validate that all distributions sum to ~1.0
export function validateDistributions(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const tolerance = 0.01;

  const checkDist = (name: string, dist: DemographicDistribution) => {
    const sum = Object.values(dist).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > tolerance) {
      errors.push(`${name}: sums to ${sum.toFixed(3)} (should be 1.0)`);
    }
  };

  // Check marginal distributions
  for (const [key, dist] of Object.entries(US_CENSUS_2022.demographics)) {
    checkDist(`demographics.${key}`, dist);
  }

  // Check psychographics
  for (const [key, dist] of Object.entries(US_CENSUS_2022.psychographics)) {
    checkDist(`psychographics.${key}`, dist);
  }

  // Check conditional distributions
  for (const [condName, conditionalMap] of Object.entries(US_CENSUS_2022.conditionals)) {
    for (const [condValue, dist] of Object.entries(conditionalMap)) {
      checkDist(`conditionals.${condName}.${condValue}`, dist);
    }
  }

  return { valid: errors.length === 0, errors };
}
