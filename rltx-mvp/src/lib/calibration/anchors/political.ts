// Political Domain Anchor Statements for SSR Calibration
// These anchor statements define what each response category "sounds like"
// SSR computes semantic similarity between agent responses and these anchors

export interface AnchorSet {
  id: string;
  domain: string;
  scale: string[];
  anchors: Record<string, string[]>;
}

// =============================================================================
// CONGRESSIONAL VOTE ANCHORS
// 6 anchor sets for stability (averaged during calibration)
// =============================================================================

export const VOTE_ANCHORS: AnchorSet = {
  id: "congressional_vote",
  domain: "political",
  scale: ["strong_yes", "lean_yes", "undecided", "lean_no", "strong_no"],
  anchors: {
    strong_yes: [
      "I will absolutely vote yes on this bill. It's essential legislation that addresses a critical national security threat.",
      "This bill has my full support. I've been calling for action on this issue for years.",
      "Without question, I'm voting yes. My constituents demand we take decisive action here.",
      "This is exactly the kind of legislation Congress needs to pass. I'm a firm yes vote.",
      "I strongly support this measure and will encourage my colleagues to join me in voting yes.",
      "National security must come first. I'm voting yes without hesitation.",
    ],
    lean_yes: [
      "I'm inclined to support this bill, though I have some concerns about specific provisions.",
      "On balance, I'll likely vote yes, but I want to see some amendments first.",
      "My initial assessment is favorable. I'm leaning toward yes pending final review.",
      "The merits outweigh my concerns. I'm probably voting yes on this.",
      "I'm supportive of the overall goal and will likely vote in favor.",
      "While not perfect, this bill deserves my vote. I'm tentatively in the yes column.",
    ],
    undecided: [
      "I'm still weighing the pros and cons. This is a complex issue that requires careful consideration.",
      "I haven't made up my mind yet. I need to hear more debate and consult with stakeholders.",
      "There are valid arguments on both sides. I'm genuinely undecided at this point.",
      "I'm torn on this one. The national security concerns are real, but so are the economic impacts.",
      "I want to see how the debate unfolds before committing either way.",
      "My constituents are split on this issue, and frankly, so am I.",
    ],
    lean_no: [
      "I have significant reservations about this bill and am leaning toward voting no.",
      "Unless substantial changes are made, I'll probably vote against this measure.",
      "My concerns outweigh the potential benefits. I'm likely a no vote.",
      "I'm skeptical this is the right approach. Leaning no at the moment.",
      "The unintended consequences worry me. I'm inclined to vote against.",
      "I sympathize with the goal but can't support this particular bill. Probably voting no.",
    ],
    strong_no: [
      "I will vote no on this bill. It's misguided policy that will harm American interests.",
      "Absolutely not. This legislation is fundamentally flawed and I oppose it completely.",
      "I'm a firm no vote. This bill sets a dangerous precedent.",
      "My constituents would never forgive me if I voted for this. I'm voting no.",
      "This is government overreach plain and simple. I strongly oppose this measure.",
      "I cannot in good conscience support this bill. Voting no.",
    ],
  },
};

// =============================================================================
// POLICY SUPPORT ANCHORS (for general policy questions)
// =============================================================================

export const POLICY_SUPPORT_ANCHORS: AnchorSet = {
  id: "policy_support",
  domain: "political",
  scale: ["strongly_support", "somewhat_support", "neutral", "somewhat_oppose", "strongly_oppose"],
  anchors: {
    strongly_support: [
      "I strongly support this policy. It aligns perfectly with my values and priorities.",
      "This is exactly what we need. I'm a passionate advocate for this approach.",
      "Absolutely support this. It's common sense policy that will benefit everyone.",
      "I've been pushing for this kind of policy for years. Full support.",
      "This policy gets it right. I'm fully behind it.",
      "Strong support from me. This is the direction our country needs to go.",
    ],
    somewhat_support: [
      "I generally support this policy, with a few reservations.",
      "On the whole, this is a step in the right direction. Somewhat supportive.",
      "I lean toward supporting this, though it's not perfect.",
      "More good than bad here. I'm cautiously supportive.",
      "I can get behind most of this policy. Moderate support.",
      "It's not everything I'd want, but I support the overall direction.",
    ],
    neutral: [
      "I don't have strong feelings either way on this policy.",
      "There are pros and cons that roughly balance out for me.",
      "I can see both sides of this issue. Neutral position.",
      "This isn't a priority issue for me. I'm indifferent.",
      "I'd need more information before forming a strong opinion.",
      "Neither particularly supportive nor opposed. Middle of the road.",
    ],
    somewhat_oppose: [
      "I have concerns about this policy. Leaning against it.",
      "On balance, I don't think this is the right approach. Somewhat opposed.",
      "There are too many problems with this policy for me to support it.",
      "I'm skeptical of the benefits and worried about the costs.",
      "This policy doesn't align well with my priorities. Mild opposition.",
      "I can't fully support this. More opposed than supportive.",
    ],
    strongly_oppose: [
      "I strongly oppose this policy. It would be harmful to our community.",
      "This is terrible policy that I will fight against.",
      "Absolutely against this. It goes against everything I believe in.",
      "This policy is misguided and dangerous. Strong opposition.",
      "I cannot support this under any circumstances. Firm no.",
      "This would be a disaster. I'm completely opposed.",
    ],
  },
};

// =============================================================================
// CANDIDATE/ELECTION ANCHORS
// =============================================================================

export const CANDIDATE_SUPPORT_ANCHORS: AnchorSet = {
  id: "candidate_support",
  domain: "political",
  scale: ["definitely_vote", "probably_vote", "might_vote", "probably_not_vote", "definitely_not_vote"],
  anchors: {
    definitely_vote: [
      "I'm definitely voting for this candidate. They have my full support.",
      "Without question, this is my candidate. I'll be at the polls on election day.",
      "I'm enthusiastic about this candidate and will absolutely be voting for them.",
      "This candidate has earned my vote. I'm 100% committed.",
      "Definitely voting for them. They represent exactly what I'm looking for.",
      "My mind is made up. This candidate gets my vote.",
    ],
    probably_vote: [
      "I'll probably vote for this candidate, barring any surprises.",
      "I'm leaning toward voting for them. Likely to pull the lever in their favor.",
      "Good chance I vote for this candidate. They're my preferred choice right now.",
      "I'm inclined to support this candidate at the ballot box.",
      "Probably voting for them, though I want to see the debates first.",
      "They're currently my top choice. Likely voting for them.",
    ],
    might_vote: [
      "I might vote for this candidate. Still making up my mind.",
      "It's a possibility. I could see myself voting either way.",
      "They're on my consideration list. Not sure yet.",
      "I'm open to voting for them but haven't decided.",
      "Maybe. Depends on how the race shapes up.",
      "Could go either way. They're in the running for my vote.",
    ],
    probably_not_vote: [
      "I probably won't vote for this candidate. They're not my top choice.",
      "Unlikely to get my vote. I have better options.",
      "Leaning against voting for them. Not really what I'm looking for.",
      "I don't think so. They haven't convinced me.",
      "Probably not. Their positions don't align with mine.",
      "I'm inclined to vote for someone else. Low probability.",
    ],
    definitely_not_vote: [
      "I will definitely not vote for this candidate. Absolutely not.",
      "No way am I voting for them. They're completely wrong for the job.",
      "Hard no. This candidate will never get my vote.",
      "I'm firmly against this candidate. Zero chance.",
      "Under no circumstances would I vote for them.",
      "Definitely not. They represent everything I oppose.",
    ],
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function getAnchorsForDomain(
  domain: "vote" | "policy" | "candidate"
): AnchorSet {
  switch (domain) {
    case "vote":
      return VOTE_ANCHORS;
    case "policy":
      return POLICY_SUPPORT_ANCHORS;
    case "candidate":
      return CANDIDATE_SUPPORT_ANCHORS;
    default:
      return VOTE_ANCHORS;
  }
}

export function getAllPoliticalAnchors(): AnchorSet[] {
  return [VOTE_ANCHORS, POLICY_SUPPORT_ANCHORS, CANDIDATE_SUPPORT_ANCHORS];
}

// =============================================================================
// ANCHOR TEXT FLATTENING (for embedding)
// =============================================================================

export function flattenAnchors(anchorSet: AnchorSet): {
  category: string;
  text: string;
}[] {
  const result: { category: string; text: string }[] = [];
  for (const [category, texts] of Object.entries(anchorSet.anchors)) {
    for (const text of texts) {
      result.push({ category, text });
    }
  }
  return result;
}
