/**
 * SOURCE UTILITIES
 * ================
 * Helper functions for source classification and detection.
 * Extracted from sources.ts during cleanup (2026-01-27).
 */

import type { WatchpointId } from '@/types';

// Region keywords for classification - used for quick region detection
// Note: Order matters - first match wins, so more specific regions first
export const regionKeywords: Record<WatchpointId, string[]> = {
  'middle-east': [
    'iran', 'israel', 'gaza', 'palestinian', 'hamas', 'hezbollah',
    'lebanon', 'syria', 'iraq', 'saudi', 'yemen', 'houthi',
    'tehran', 'jerusalem', 'tel aviv', 'idf', 'irgc', 'strait of hormuz',
    'rafah', 'west bank', 'netanyahu', 'beirut', 'damascus', 'baghdad',
    'red sea', 'qatar', 'doha', 'dubai', 'emirates', 'jordan', 'amman',
  ],
  'europe-russia': [
    'ukraine', 'russia', 'kyiv', 'moscow', 'crimea', 'donbas',
    'zelensky', 'putin', 'nato', 'kherson', 'bakhmut', 'avdiivka',
    'wagner', 'kursk', 'frontline', 'brussels', 'european union',
    'kharkiv', 'odesa', 'mariupol', 'belarus', 'lukashenko', 'minsk',
    'germany', 'berlin', 'france', 'paris', 'macron', 'poland', 'warsaw',
    'britain', 'london', 'latvia', 'lithuania', 'estonia', 'finland',
  ],
  'asia': [
    'taiwan', 'china', 'beijing', 'taipei', 'xi jinping',
    'south china sea', 'pla', 'tsmc', 'semiconductors',
    'japan', 'korea', 'india', 'tokyo', 'seoul', 'pyongyang',
    'kim jong', 'hong kong', 'xinjiang', 'tibet', 'shanghai',
    'vietnam', 'hanoi', 'thailand', 'bangkok', 'indonesia', 'jakarta',
    'philippines', 'manila', 'singapore', 'malaysia', 'pakistan',
    'modi', 'new delhi', 'islamabad', 'myanmar', 'cambodia',
  ],
  'latam': [
    'venezuela', 'maduro', 'caracas', 'guaido', 'pdvsa',
    'brazil', 'lula', 'bolsonaro', 'sao paulo', 'rio de janeiro',
    'mexico', 'mexico city', 'cartel', 'argentina', 'buenos aires', 'milei',
    'colombia', 'bogota', 'peru', 'lima', 'chile', 'santiago',
    'ecuador', 'quito', 'bolivia', 'paraguay', 'uruguay',
    'cuba', 'havana', 'haiti', 'dominican', 'puerto rico',
    'central america', 'caribbean', 'latin america', 'latam',
    'panama', 'costa rica', 'nicaragua', 'honduras', 'el salvador', 'guatemala',
  ],
  'us': [
    'washington', 'pentagon', 'white house', 'congress', 'senate',
    'biden', 'trump', 'harris', 'state department', 'cia', 'fbi', 'doj',
    'supreme court', 'capitol', 'republican', 'democrat', 'gop',
    'new york', 'los angeles', 'chicago', 'texas', 'florida', 'california',
  ],
  'seismic': [], // Seismic data comes from USGS API, not keyword classification
  all: [],
};

/**
 * Classify news item by region based on content.
 * Simple keyword matching - first match wins.
 */
export function classifyRegion(title: string, content: string): WatchpointId {
  const text = `${title} ${content}`.toLowerCase();

  for (const [region, keywords] of Object.entries(regionKeywords)) {
    if (region === 'all') continue;
    if (keywords.some((kw) => text.includes(kw))) {
      return region as WatchpointId;
    }
  }

  return 'all';
}

// Breaking news keywords - focused on geopolitical events
export const breakingKeywords = [
  'breaking:', 'urgent:', 'alert:', 'just in:', 'developing:',
  'explosion', 'airstrike', 'missile strike', 'rocket attack',
  'troops', 'military operation', 'invasion', 'declaration of war',
  'ceasefire', 'peace deal', 'hostage', 'assassination',
  'coup', 'martial law', 'state of emergency', 'sanctions',
  'nuclear', 'chemical weapons', 'biological weapons',
  'embassy', 'diplomat expelled', 'protests',
];

// Keywords that indicate NOT breaking (sports, entertainment, etc.)
const notBreakingKeywords = [
  'semifinal', 'final score', 'match', 'goal', 'tournament',
  'cup of nations', 'world cup', 'premier league', 'champions league',
  'nba', 'nfl', 'mlb', 'tennis', 'golf', 'cricket',
  'box office', 'movie', 'album', 'concert', 'celebrity',
  'recipe', 'weather forecast', 'stock market', 'earnings',
];

/**
 * Check if content appears to be breaking news.
 * Excludes sports/entertainment, then checks for breaking indicators.
 */
export function isBreakingNews(title: string, content: string): boolean {
  const text = `${title} ${content}`.toLowerCase();

  // First check if it's clearly NOT breaking (sports, entertainment)
  if (notBreakingKeywords.some((kw) => text.includes(kw))) {
    return false;
  }

  // Then check for actual breaking news indicators
  return breakingKeywords.some((kw) => text.includes(kw));
}
