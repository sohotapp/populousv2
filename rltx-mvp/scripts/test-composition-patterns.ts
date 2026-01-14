/**
 * Test script for canonical composition patterns
 *
 * Run with: npx tsx scripts/test-composition-patterns.ts
 */

import {
  CANONICAL_PATTERNS,
  detectPattern,
  generatePatternPromptSection,
  generateFewShotExamples,
} from "../src/lib/composition";

function testPatternDetection() {
  console.log("=" .repeat(60));
  console.log("RLTX Canonical Pattern Detection Test");
  console.log("=" .repeat(60));

  const testCases = [
    // Consumer Survey
    { query: "Would customers pay $20/month for premium features?", expected: "consumer_survey" },
    { query: "What percent of users would upgrade to Pro?", expected: "consumer_survey" },
    { query: "How do people feel about subscription pricing?", expected: "consumer_survey" },

    // Change Impact
    { query: "What if we increase prices by 15%?", expected: "change_impact" },
    { query: "Impact of removing the free tier on retention", expected: "change_impact" },
    { query: "Effect of adding dark mode on user satisfaction", expected: "change_impact" },

    // Competitive Response
    { query: "How will competitors respond to our price cut?", expected: "competitive_response" },
    { query: "What happens if our rival launches a free version?", expected: "competitive_response" },
    { query: "Competitive dynamics if we enter the enterprise market", expected: "competitive_response" },

    // Wargame
    { query: "How would an adversary respond to sanctions?", expected: "wargame" },
    { query: "Escalation dynamics in the South China Sea", expected: "wargame" },
    { query: "What deterrence options do we have?", expected: "wargame" },

    // Opinion Dynamics
    { query: "How will this feature spread through our user base?", expected: "opinion_dynamics" },
    { query: "Viral adoption potential for our referral program", expected: "opinion_dynamics" },
    { query: "Network effects and word of mouth dynamics", expected: "opinion_dynamics" },

    // Counterfactual
    { query: "Compare freemium vs paid-only launch strategy", expected: "counterfactual" },
    { query: "Which option is better: A/B test or staged rollout?", expected: "counterfactual" },
    { query: "Trade-off between speed and quality", expected: "counterfactual" },
  ];

  console.log("\n1. PATTERN DETECTION TESTS");
  console.log("-" .repeat(40));

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const detected = detectPattern(testCase.query);
    const detectedId = detected?.id || "none";
    const success = detectedId === testCase.expected;

    if (success) {
      passed++;
      console.log(`  ✓ "${testCase.query.slice(0, 40)}..." → ${detectedId}`);
    } else {
      failed++;
      console.log(`  ✗ "${testCase.query.slice(0, 40)}..."`);
      console.log(`    Expected: ${testCase.expected}, Got: ${detectedId}`);
    }
  }

  console.log(`\nResults: ${passed}/${testCases.length} passed`);

  console.log("\n2. CANONICAL PATTERNS SUMMARY");
  console.log("-" .repeat(40));

  for (const pattern of CANONICAL_PATTERNS) {
    console.log(`\n${pattern.name} (${pattern.id})`);
    console.log(`  Domain: ${pattern.domain}`);
    console.log(`  Triggers: ${pattern.triggerPhrases.slice(0, 3).join(", ")}...`);
    console.log(`  Nodes: ${pattern.structure.nodes.length}`);
    console.log(`  Required params: ${pattern.parameterSchema.required.join(", ")}`);
  }

  console.log("\n3. SYSTEM PROMPT SECTIONS");
  console.log("-" .repeat(40));

  const patternSection = generatePatternPromptSection();
  console.log(`\nPattern section length: ${patternSection.length} chars`);
  console.log("Preview:");
  console.log(patternSection.slice(0, 500) + "...");

  const fewShotSection = generateFewShotExamples();
  console.log(`\nFew-shot section length: ${fewShotSection.length} chars`);
  console.log("Contains examples for patterns:");
  const examplePatterns = fewShotSection.match(/Pattern detected: (\w+)/g) || [];
  examplePatterns.forEach((match) => console.log(`  - ${match}`));

  console.log("\n" + "=" .repeat(60));
  console.log("TEST COMPLETED");
  console.log("=" .repeat(60));

  return { passed, failed };
}

// Run tests
const results = testPatternDetection();
process.exit(results.failed > 0 ? 1 : 0);
