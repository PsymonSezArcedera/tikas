// The one enforced restriction. A lightweight keyword pre-check runs on the
// user's message BEFORE it reaches Gemini; if it trips, we decline and refer to
// a professional without calling the model. Keyword matching is deliberately
// simple (and imperfect) — it errs toward catching medical-advice-seeking while
// leaving ordinary training talk ("my legs are sore", "muscle pain after leg
// day") alone. Coach-agnostic: the same screen protects all three coaches.

const MEDICAL_PATTERNS: RegExp[] = [
  // Diagnosis / treatment intent
  /\bdiagnos(e|is|ing|ed)\b/i,
  /\bis (this|it)(?: an?)? (injur|broken|fractur|torn|sprain|dislocat|herniat)/i,
  /\bwhat'?s wrong with my\b/i,
  /\bshould i (see|go to|visit)(?: a| the)? (doctor|dr|physio|physical therapist|hospital|er|clinic)/i,
  /\bmedical (advice|opinion|condition)\b/i,
  /\btreat(ment)? (for|my)\b/i,
  /\brehab(ilitation)? (for|my|plan|exercises)\b/i,

  // Medications
  /\b(medication|medicine|prescription|prescrib(e|ed)|antibiotic|ibuprofen|paracetamol|acetaminophen|painkiller|dosage|dose of|anabolic|steroids?)\b/i,

  // Acute symptoms
  /\bchest pain\b/i,
  /\b(shortness of breath|can'?t breathe|trouble breathing)\b/i,
  /\b(dizzy|dizziness|faint(ed|ing)?|light[- ]?headed)\b/i,
  /\b(numbness|numb|tingling)\b/i,
  /\b(palpitations|blurred vision|swelling|swollen|bleeding|vomiting|nausea|fever|migraine)\b/i,

  // Clinical injuries / conditions
  /\b(fractur(e|ed)|broken (bone|arm|leg|wrist|ankle|rib)|torn (acl|mcl|ligament|muscle|rotator|meniscus))\b/i,
  /\b(herniat(e|ed|ion)|hernia|slipped disc|dislocat(e|ed|ion)|tendin(itis|opathy)|concussion|sciatica|pinched nerve)\b/i,
  /\b(arthritis|diabet(es|ic)|hypertension|high blood pressure|asthma|heart (attack|condition|disease)|stroke|pregnan(t|cy))\b/i,

  // Pain with a clinical framing (leaves plain "sore"/"pain" alone)
  /\b(sharp|severe|chronic|shooting|stabbing) pain\b/i,
];

export function isMedicalConcern(message: string): boolean {
  return MEDICAL_PATTERNS.some((re) => re.test(message));
}

export const MEDICAL_DECLINE =
  "I'm not able to help with medical concerns or diagnose injuries — that's outside what I can safely do, and getting it wrong could cause harm. Please check in with a qualified healthcare professional (a doctor or physiotherapist) about this. Once you're cleared, I'm glad to help you train around it or build a plan that fits.";
