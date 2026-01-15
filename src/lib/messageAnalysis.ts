/**
 * MESSAGE-LEVEL ANALYSIS
 * ======================
 * Parses individual posts to extract:
 * - Content Type: What kind of post is this? (breaking, report, statement, analysis, rumor)
 * - Verification: How verified is this? (confirmed, unverified, developing, denied)
 * - Provenance: Where did the info come from? (original, official, media, aggregating)
 * - Severity: How urgent? (inferred from verification + provenance signals)
 */

// =============================================================================
// TYPES
// =============================================================================

export type ContentType = 'breaking' | 'statement' | 'report' | 'analysis' | 'rumor' | 'general';
export type VerificationLevel = 'confirmed' | 'unverified' | 'developing' | 'denied';
export type MessageProvenance = 'original' | 'official' | 'media' | 'aggregating';

export interface MessageAnalysis {
  contentType: {
    type: ContentType;
    confidence: number;  // 0-1
    matchedPatterns: string[];
  };
  verification: {
    level: VerificationLevel;
    confidence: number;
    matchedPatterns: string[];
  };
  provenance: {
    type: MessageProvenance;
    confidence: number;
    matchedPatterns: string[];
    citedSources: string[];  // Extracted source names
  };
}

// =============================================================================
// CONTENT TYPE PATTERNS
// =============================================================================

const contentTypePatterns: Record<ContentType, { patterns: RegExp[]; weight: number }> = {
  breaking: {
    patterns: [
      /\bbreaking\b/i,
      /\bjust\s+in\b/i,
      /\bjust\s+in\s*:/i,
      /\balert\s*:/i,
      /\burgent\s*:/i,
      /^🚨/,
      /^⚠️/,
      /\bnow\s*:/i,
      /\bhappening now\b/i,
      /\bflash\s*:/i,
    ],
    weight: 1.2,  // Higher weight to prioritize over report
  },
  statement: {
    patterns: [
      /\bstatement\b/i,
      /\bannounces?\b/i,
      /\bdeclares?\b/i,
      /\bpress release\b/i,
      /\bofficial\s*(statement|response|position)\b/i,
      /\bspokesperson\s+(said|says|confirms?)\b/i,
      /\bministry\s+(of\s+\w+\s+)?(said|says|announces?)\b/i,
      /\bgovernment\s+(said|says|announces?)\b/i,
      // Direct quotes: "Name: quote" or "Name says" patterns
      /^(zelensky|putin|biden|netanyahu|trump|xi|macron|scholz|sunak)\s*:/i,
      /\b(zelensky|putin|biden|netanyahu|trump|xi|macron|scholz|sunak)\s+(said|says)\b/i,
      // Ministry/Defense patterns
      /\bministry\s+of\s+(defense|foreign\s+affairs|interior)\b/i,
      /\bdefense\s+ministry\b/i,
      /\bforeign\s+ministry\b/i,
      // Direct quote format: "Source: quote"
      /^(pentagon|idf|white\s+house|state\s+dept|ministry)\s*:/i,
    ],
    weight: 0.9,
  },
  report: {
    patterns: [
      /\breports?\s+(say|indicate|suggest|that)\b/i,
      /\baccording to\b/i,
      /\bsources?\s+(say|said|tell|told)\b/i,
      /\breportedly\b/i,
      /\ballegedly\b/i,
      /\bclaims?\b/i,
      /\bmultiple\s+sources?\b/i,
      // Media org reports patterns
      /\b(reuters|ap|afp|bbc|cnn)\s+reports?\b/i,
      /\b(isw|csis|iiss)\s+(says?|reports?|assesses?)\b/i,
      // Telegram/social patterns
      /\btelegram\s+channels?\s+(report|say|claim)/i,
      /\bsocial\s+media\s+(reports?|posts?)\b/i,
      // "tells Reuters" patterns - official talking to media
      /\b(official|source)\s+tells\s+(Reuters|AP|BBC|CNN)/i,
      /\btells\s+(Reuters|AP|BBC|CNN|AFP)\b/i,
      // Direct media quote format: "Reuters: quote"
      /^(reuters|ap|afp|bbc|cnn|al\s+jazeera)\s*:/i,
    ],
    weight: 0.8,
  },
  analysis: {
    patterns: [
      /\bthread\b/i,
      /\banalysis\b/i,
      /\bexplainer\b/i,
      /\bhere'?s\s+why\b/i,
      /\bwhat\s+(this|it)\s+means\b/i,
      /\bassessment\b/i,
      /\bbreakdown\b/i,
      /\b(1|one)\/\d+\b/i,  // Thread indicator like 1/12
      /🧵/,
    ],
    weight: 0.7,
  },
  rumor: {
    patterns: [
      /\brumou?rs?\b/i,
      /\bchatter\b/i,
      /\bhearing\b/i,
      /\bcan'?t\s+confirm\b/i,
      /\bcannot\s+confirm\b/i,
      /\bunsubstantiated\b/i,
      /\bspeculation\b/i,
      /\btake\s+with\s+(a\s+)?grain\b/i,
      /\bif\s+true\b/i,
    ],
    weight: 0.85,
  },
  general: {
    patterns: [],
    weight: 0,
  },
};

// =============================================================================
// VERIFICATION PATTERNS
// =============================================================================

const verificationPatterns: Record<VerificationLevel, { patterns: RegExp[]; weight: number }> = {
  confirmed: {
    patterns: [
      /^confirmed\b/i,  // Start of text
      /\bconfirmed\s*:/i,  // "CONFIRMED:"
      /\bwe\s+can\s+confirm\b/i,
      /\bofficially\s+confirmed\b/i,
      /\bindependently\s+verified\b/i,
      /\bmultiple\s+sources\s+confirm\b/i,
      /\bconfirmation\b/i,
      /\bhas\s+been\s+confirmed\b/i,
      /\bnow\s+confirmed\b/i,
    ],
    weight: 1.0,
  },
  unverified: {
    patterns: [
      /\bunverified\b/i,
      /\bunconfirmed\b/i,
      /\balleged(ly)?\b/i,
      /\bcannot\s+(be\s+)?(confirm|verif)/i,
      /\bunclear\b/i,
      /\bnot\s+(yet\s+)?confirmed\b/i,
      /\bawaiting\s+confirmation\b/i,
    ],
    weight: 1.0,
  },
  developing: {
    patterns: [
      /\bdeveloping\b/i,
      /\bupdating\b/i,
      /\bmore\s+(to\s+come|details|info)/i,
      /\bdetails\s+(emerging|unclear|coming)/i,
      /\bstill\s+coming\s+in\b/i,
      /\bsituation\s+fluid\b/i,
      /\bwill\s+update\b/i,
      /\bfollowing\s+closely\b/i,
    ],
    weight: 0.9,
  },
  denied: {
    patterns: [
      /\bdenies?\b/i,
      /\bdenied\b/i,
      /\brefutes?\b/i,
      /\bdebunked\b/i,
      /\bfalse\b/i,
      /\bmisinformation\b/i,
      /\bdismisses?\b/i,
      /\brejects?\s+(claims?|reports?)\b/i,
    ],
    weight: 1.0,
  },
};

// =============================================================================
// MESSAGE PROVENANCE PATTERNS
// =============================================================================

const provenancePatterns: Record<MessageProvenance, { patterns: RegExp[]; weight: number }> = {
  original: {
    patterns: [
      /\bi('m| am)\s+(seeing|hearing|watching|at)\b/i,
      /\bwe('re| are)\s+(seeing|hearing|watching|at)\b/i,
      /\bon\s+(the\s+)?ground\b/i,
      /\beyewitness\b/i,
      /\bfirsthand\b/i,
      /\bfirst-hand\b/i,
      /\bi\s+can\s+(see|hear|confirm)\b/i,
      /\bmy\s+sources?\b/i,
      /\bour\s+team\b/i,
      /\bjust\s+spoke\s+(to|with)\b/i,
    ],
    weight: 1.0,
  },
  official: {
    patterns: [
      /\bofficials?\s+(say|said|confirm|announce|tell|told|state)/i,
      /\bministry\s+(of\s+\w+\s+)?(say|said|confirm|announce)/i,
      /\bspokesperson\b/i,
      /\bspokeswoman\b/i,
      /\bspokesman\b/i,
      /\bgovernment\s+(say|said|confirm|announce)/i,
      /\bpentagon\b/i,
      /\bwhite\s+house\b/i,
      /\bstate\s+department\b/i,
      /\bforeign\s+ministry\b/i,
      /\bdefense\s+ministry\b/i,
      /\bidf\s+(say|said|confirm|announce)/i,
      /\bkreml[ie]n\b/i,
      // Country actions (Russia denies, Israel says, etc.)
      /\b(russia|israel|ukraine|iran|china|usa?)\s+(says?|denies?|confirms?|announces?|claims?)\b/i,
      // Direct quotes from leaders
      /^(zelensky|putin|biden|netanyahu|trump|xi|macron|scholz|sunak)\s*:/i,
      /\b(zelensky|putin|biden|netanyahu|trump|xi|macron|scholz|sunak)\s*:\s/i,
    ],
    weight: 0.95,
  },
  media: {
    patterns: [
      /\breuters\b/i,
      /\bassociated\s+press\b/i,
      /\bAP\s+(say|said|report)/i,
      /\bAFP\b/i,
      /\bBBC\b/i,
      /\bCNN\b/i,
      /\bAl\s+Jazeera\b/i,
      /\bNYT(imes)?\b/i,
      /\bWashington\s+Post\b/i,
      /\bGuardian\b/i,
      /\bHaaretz\b/i,
      /\bTimes\s+of\s+Israel\b/i,
      /\bKyiv\s+(Post|Independent)\b/i,
      // Research/Think tanks
      /\bISW\b/,  // Institute for Study of War
      /\bCSIS\b/,
      /\bIISS\b/,
      /\bBellingcat\b/i,
      /\baccording\s+to\s+ISW\b/i,
    ],
    weight: 0.9,
  },
  aggregating: {
    patterns: [
      /\bper\s+@\w+/i,
      /\bvia\s+@\w+/i,
      /\bciting\b/i,
      /\baccording\s+to\s+@\w+/i,
      /\b(RT|retweet)\b/i,
      /\breports\s+that\s+.+\s+reports\b/i,
      /\bmultiple\s+accounts\s+(say|report|claim)/i,
      /\bseveral\s+sources\s+(say|report|claim)/i,
      /\bsocial\s+media\s+(reports?|posts?|claims?)\b/i,
      /\btelegram\s+channels?\s+(say|report|claim)/i,
      // Multiple sources pattern (aggregating from various)
      /\bmultiple\s+sources\s+(say|report|confirm)/i,
      /\baccording\s+to\s+multiple\s+sources\b/i,
      /\bcirculating\s+on\s+(telegram|twitter|social\s+media)/i,
      /\brumou?rs?\s+(circulating|spreading)/i,
    ],
    weight: 0.85,
  },
};

// Source extraction patterns (for cited sources)
const sourceExtractionPatterns = [
  /(?:per|via|according to|citing)\s+@(\w+)/gi,
  /(?:Reuters|AP|AFP|BBC|CNN|Al Jazeera|NYT|Washington Post|Guardian|Haaretz)/gi,
  /(?:IDF|Pentagon|White House|State Department|Foreign Ministry|Defense Ministry)/gi,
  /@(\w+)\s+(?:says?|reports?|claims?)/gi,
  // Research/Think tanks
  /(?:ISW|CSIS|IISS|Bellingcat)/gi,
  // "according to ISW" pattern
  /according\s+to\s+(ISW|CSIS|IISS|Bellingcat)/gi,
];

// =============================================================================
// ANALYSIS FUNCTIONS
// =============================================================================

/**
 * Detect content type from text
 */
function detectContentType(text: string): MessageAnalysis['contentType'] {
  const results: { type: ContentType; score: number; matches: string[] }[] = [];

  for (const [type, config] of Object.entries(contentTypePatterns)) {
    if (type === 'general') continue;

    const matches: string[] = [];
    let score = 0;

    for (const pattern of config.patterns) {
      const match = text.match(pattern);
      if (match) {
        matches.push(match[0]);
        score += config.weight;
      }
    }

    if (matches.length > 0) {
      results.push({ type: type as ContentType, score, matches });
    }
  }

  // Sort by score, pick highest
  results.sort((a, b) => b.score - a.score);

  if (results.length > 0) {
    const best = results[0];
    return {
      type: best.type,
      confidence: Math.min(best.score, 1),
      matchedPatterns: best.matches,
    };
  }

  return {
    type: 'general',
    confidence: 0,
    matchedPatterns: [],
  };
}

/**
 * Detect verification level from text
 */
function detectVerification(text: string): MessageAnalysis['verification'] {
  const results: { level: VerificationLevel; score: number; matches: string[] }[] = [];

  for (const [level, config] of Object.entries(verificationPatterns)) {
    const matches: string[] = [];
    let score = 0;

    for (const pattern of config.patterns) {
      const match = text.match(pattern);
      if (match) {
        matches.push(match[0]);
        score += config.weight;
      }
    }

    if (matches.length > 0) {
      results.push({ level: level as VerificationLevel, score, matches });
    }
  }

  // Sort by score, pick highest
  results.sort((a, b) => b.score - a.score);

  if (results.length > 0) {
    const best = results[0];
    return {
      level: best.level,
      confidence: Math.min(best.score, 1),
      matchedPatterns: best.matches,
    };
  }

  // Default to unverified if no signals found
  return {
    level: 'unverified',
    confidence: 0.3,  // Low confidence default
    matchedPatterns: [],
  };
}

/**
 * Detect message provenance from text
 */
function detectProvenance(text: string): MessageAnalysis['provenance'] {
  const results: { type: MessageProvenance; score: number; matches: string[] }[] = [];

  for (const [type, config] of Object.entries(provenancePatterns)) {
    const matches: string[] = [];
    let score = 0;

    for (const pattern of config.patterns) {
      const match = text.match(pattern);
      if (match) {
        matches.push(match[0]);
        score += config.weight;
      }
    }

    if (matches.length > 0) {
      results.push({ type: type as MessageProvenance, score, matches });
    }
  }

  // Extract cited sources
  const citedSources: string[] = [];
  for (const pattern of sourceExtractionPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const source = match[1] || match[0];
      if (source && !citedSources.includes(source)) {
        citedSources.push(source);
      }
    }
  }

  // Sort by score, pick highest
  results.sort((a, b) => b.score - a.score);

  if (results.length > 0) {
    const best = results[0];
    return {
      type: best.type,
      confidence: Math.min(best.score, 1),
      matchedPatterns: best.matches,
      citedSources,
    };
  }

  // Default based on cited sources
  if (citedSources.length > 0) {
    return {
      type: 'aggregating',
      confidence: 0.5,
      matchedPatterns: [],
      citedSources,
    };
  }

  return {
    type: 'original',  // Assume original if no citations
    confidence: 0.3,
    matchedPatterns: [],
    citedSources: [],
  };
}

/**
 * Main analysis function - analyze a message
 */
export function analyzeMessage(text: string): MessageAnalysis {
  const contentType = detectContentType(text);
  let verification = detectVerification(text);
  let provenance = detectProvenance(text);

  // Post-processing: Adjust provenance when media org is explicitly mentioned
  // "official tells Reuters" → provenance should be media (Reuters is reporting)
  const tellsMediaPattern = /\btells\s+(Reuters|AP|BBC|CNN|AFP|Al Jazeera)/i;
  if (tellsMediaPattern.test(text) && provenance.type === 'official') {
    const mediaMatch = text.match(tellsMediaPattern);
    provenance = {
      type: 'media',
      confidence: 0.9,
      matchedPatterns: mediaMatch ? [mediaMatch[0]] : [],
      citedSources: provenance.citedSources,
    };
  }

  // Post-processing: Infer verification level based on other signals
  // If it's an official statement and we haven't explicitly detected verification,
  // infer it's confirmed (officials don't usually issue unverified statements)
  if (
    contentType.type === 'statement' &&
    provenance.type === 'official' &&
    verification.matchedPatterns.length === 0  // No explicit verification markers
  ) {
    verification = {
      level: 'confirmed',
      confidence: 0.7,  // Inferred, not explicit
      matchedPatterns: ['[inferred from official statement]'],
    };
  }

  // If provenance is official and content says something "confirms", boost to confirmed
  if (
    provenance.type === 'official' &&
    /\bconfirms?\b/i.test(text) &&
    verification.level === 'unverified'
  ) {
    verification = {
      level: 'confirmed',
      confidence: 0.8,
      matchedPatterns: ['confirms'],
    };
  }

  return {
    contentType,
    verification,
    provenance,
  };
}
