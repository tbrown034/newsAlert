/**
 * TRAVEL ADVISORIES API
 * =====================
 * Fetches US State Department travel advisories
 */

import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';

export const dynamic = 'force-dynamic';

// XML parser instance
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

interface TravelAdvisory {
  id: string;
  country: string;
  countryCode: string;
  level: 1 | 2 | 3 | 4;
  levelText: string;
  title: string;
  description: string;
  url: string;
  updatedAt: Date;
  coordinates: [number, number];
  risks: string[];
}

// State Dept RSS feed
const STATE_DEPT_RSS = 'https://travel.state.gov/_res/rss/TAsTWs.xml';

// Country code to coordinates mapping (capital cities)
const COUNTRY_COORDS: Record<string, { coords: [number, number]; name: string }> = {
  'AF': { coords: [69.17, 34.53], name: 'Afghanistan' },
  'AL': { coords: [19.82, 41.33], name: 'Albania' },
  'DZ': { coords: [3.04, 36.77], name: 'Algeria' },
  'AR': { coords: [-58.38, -34.60], name: 'Argentina' },
  'AM': { coords: [44.51, 40.18], name: 'Armenia' },
  'AU': { coords: [149.13, -35.28], name: 'Australia' },
  'AT': { coords: [16.37, 48.21], name: 'Austria' },
  'AZ': { coords: [49.87, 40.41], name: 'Azerbaijan' },
  'BD': { coords: [90.41, 23.81], name: 'Bangladesh' },
  'BY': { coords: [27.57, 53.90], name: 'Belarus' },
  'BE': { coords: [4.35, 50.85], name: 'Belgium' },
  'BR': { coords: [-47.93, -15.78], name: 'Brazil' },
  'BG': { coords: [23.32, 42.70], name: 'Bulgaria' },
  'MM': { coords: [96.13, 19.75], name: 'Myanmar' },
  'KH': { coords: [104.92, 11.56], name: 'Cambodia' },
  'CM': { coords: [11.52, 3.87], name: 'Cameroon' },
  'CA': { coords: [-75.70, 45.42], name: 'Canada' },
  'CF': { coords: [18.56, 4.36], name: 'Central African Republic' },
  'TD': { coords: [15.04, 12.11], name: 'Chad' },
  'CL': { coords: [-70.65, -33.45], name: 'Chile' },
  'CN': { coords: [116.40, 39.90], name: 'China' },
  'CO': { coords: [-74.08, 4.71], name: 'Colombia' },
  'KM': { coords: [43.26, -11.70], name: 'Comoros' },
  'CG': { coords: [15.83, -4.27], name: 'Congo' },
  'CD': { coords: [15.31, -4.32], name: 'Democratic Republic of the Congo' },
  'CR': { coords: [-84.09, 9.93], name: 'Costa Rica' },
  'HR': { coords: [15.98, 45.81], name: 'Croatia' },
  'CU': { coords: [-82.37, 23.11], name: 'Cuba' },
  'CY': { coords: [33.38, 35.17], name: 'Cyprus' },
  'CZ': { coords: [14.42, 50.09], name: 'Czech Republic' },
  'DK': { coords: [12.57, 55.68], name: 'Denmark' },
  'DO': { coords: [-69.90, 18.47], name: 'Dominican Republic' },
  'EC': { coords: [-78.52, -0.23], name: 'Ecuador' },
  'EG': { coords: [31.24, 30.04], name: 'Egypt' },
  'SV': { coords: [-89.19, 13.69], name: 'El Salvador' },
  'ER': { coords: [38.93, 15.33], name: 'Eritrea' },
  'ET': { coords: [38.75, 9.03], name: 'Ethiopia' },
  'FI': { coords: [24.94, 60.17], name: 'Finland' },
  'FR': { coords: [2.35, 48.85], name: 'France' },
  'GA': { coords: [9.45, 0.39], name: 'Gabon' },
  'GE': { coords: [44.79, 41.72], name: 'Georgia' },
  'DE': { coords: [13.40, 52.52], name: 'Germany' },
  'GR': { coords: [23.73, 37.98], name: 'Greece' },
  'GT': { coords: [-90.53, 14.62], name: 'Guatemala' },
  'HT': { coords: [-72.34, 18.54], name: 'Haiti' },
  'HN': { coords: [-87.22, 14.10], name: 'Honduras' },
  'HU': { coords: [19.04, 47.50], name: 'Hungary' },
  'IS': { coords: [-21.90, 64.14], name: 'Iceland' },
  'IN': { coords: [77.21, 28.61], name: 'India' },
  'ID': { coords: [106.85, -6.21], name: 'Indonesia' },
  'IR': { coords: [51.39, 35.69], name: 'Iran' },
  'IQ': { coords: [44.37, 33.31], name: 'Iraq' },
  'IE': { coords: [-6.26, 53.35], name: 'Ireland' },
  'IL': { coords: [35.22, 31.77], name: 'Israel' },
  'IT': { coords: [12.50, 41.90], name: 'Italy' },
  'JM': { coords: [-76.79, 17.97], name: 'Jamaica' },
  'JP': { coords: [139.69, 35.69], name: 'Japan' },
  'JO': { coords: [35.93, 31.95], name: 'Jordan' },
  'KZ': { coords: [71.43, 51.16], name: 'Kazakhstan' },
  'KE': { coords: [36.82, -1.29], name: 'Kenya' },
  'KP': { coords: [125.75, 39.03], name: 'North Korea' },
  'KR': { coords: [126.98, 37.57], name: 'South Korea' },
  'KW': { coords: [47.98, 29.38], name: 'Kuwait' },
  'KG': { coords: [74.59, 42.87], name: 'Kyrgyzstan' },
  'LA': { coords: [102.60, 17.97], name: 'Laos' },
  'LV': { coords: [24.11, 56.95], name: 'Latvia' },
  'LB': { coords: [35.50, 33.89], name: 'Lebanon' },
  'LY': { coords: [13.18, 32.89], name: 'Libya' },
  'LT': { coords: [25.28, 54.69], name: 'Lithuania' },
  'MK': { coords: [21.43, 42.00], name: 'North Macedonia' },
  'MG': { coords: [47.52, -18.91], name: 'Madagascar' },
  'MY': { coords: [101.69, 3.14], name: 'Malaysia' },
  'ML': { coords: [-8.00, 12.65], name: 'Mali' },
  'MT': { coords: [14.51, 35.90], name: 'Malta' },
  'MR': { coords: [-15.98, 18.09], name: 'Mauritania' },
  'MX': { coords: [-99.13, 19.43], name: 'Mexico' },
  'MD': { coords: [28.83, 47.01], name: 'Moldova' },
  'MN': { coords: [106.91, 47.92], name: 'Mongolia' },
  'MA': { coords: [-6.84, 34.02], name: 'Morocco' },
  'MZ': { coords: [32.57, -25.97], name: 'Mozambique' },
  'NP': { coords: [85.32, 27.72], name: 'Nepal' },
  'NL': { coords: [4.90, 52.37], name: 'Netherlands' },
  'NZ': { coords: [174.78, -41.29], name: 'New Zealand' },
  'NI': { coords: [-86.27, 12.11], name: 'Nicaragua' },
  'NE': { coords: [2.11, 13.51], name: 'Niger' },
  'NG': { coords: [7.49, 9.06], name: 'Nigeria' },
  'NO': { coords: [10.75, 59.91], name: 'Norway' },
  'PK': { coords: [73.04, 33.69], name: 'Pakistan' },
  'PA': { coords: [-79.53, 8.99], name: 'Panama' },
  'PY': { coords: [-57.64, -25.28], name: 'Paraguay' },
  'PE': { coords: [-77.03, -12.05], name: 'Peru' },
  'PH': { coords: [120.98, 14.60], name: 'Philippines' },
  'PL': { coords: [21.01, 52.23], name: 'Poland' },
  'PT': { coords: [-9.14, 38.72], name: 'Portugal' },
  'QA': { coords: [51.53, 25.29], name: 'Qatar' },
  'RO': { coords: [26.10, 44.43], name: 'Romania' },
  'RU': { coords: [37.62, 55.75], name: 'Russia' },
  'RW': { coords: [30.06, -1.95], name: 'Rwanda' },
  'SA': { coords: [46.72, 24.69], name: 'Saudi Arabia' },
  'SN': { coords: [-17.47, 14.69], name: 'Senegal' },
  'RS': { coords: [20.47, 44.82], name: 'Serbia' },
  'SG': { coords: [103.85, 1.29], name: 'Singapore' },
  'SK': { coords: [17.11, 48.15], name: 'Slovakia' },
  'SI': { coords: [14.51, 46.05], name: 'Slovenia' },
  'SO': { coords: [45.32, 2.04], name: 'Somalia' },
  'ZA': { coords: [28.19, -25.75], name: 'South Africa' },
  'SS': { coords: [31.58, 4.85], name: 'South Sudan' },
  'ES': { coords: [-3.70, 40.42], name: 'Spain' },
  'LK': { coords: [79.86, 6.93], name: 'Sri Lanka' },
  'SD': { coords: [32.53, 15.50], name: 'Sudan' },
  'SE': { coords: [18.07, 59.33], name: 'Sweden' },
  'CH': { coords: [7.45, 46.95], name: 'Switzerland' },
  'SY': { coords: [36.29, 33.51], name: 'Syria' },
  'TW': { coords: [121.56, 25.03], name: 'Taiwan' },
  'TJ': { coords: [68.77, 38.56], name: 'Tajikistan' },
  'TZ': { coords: [35.74, -6.17], name: 'Tanzania' },
  'TH': { coords: [100.50, 13.75], name: 'Thailand' },
  'TN': { coords: [10.17, 36.80], name: 'Tunisia' },
  'TR': { coords: [32.86, 39.93], name: 'Turkey' },
  'TM': { coords: [58.38, 37.95], name: 'Turkmenistan' },
  'UG': { coords: [32.58, 0.31], name: 'Uganda' },
  'UA': { coords: [30.52, 50.45], name: 'Ukraine' },
  'AE': { coords: [54.37, 24.47], name: 'United Arab Emirates' },
  'GB': { coords: [-0.13, 51.51], name: 'United Kingdom' },
  'UY': { coords: [-56.19, -34.90], name: 'Uruguay' },
  'UZ': { coords: [69.28, 41.31], name: 'Uzbekistan' },
  'VE': { coords: [-66.90, 10.49], name: 'Venezuela' },
  'VN': { coords: [105.85, 21.03], name: 'Vietnam' },
  'YE': { coords: [44.21, 15.35], name: 'Yemen' },
  'ZM': { coords: [28.28, -15.42], name: 'Zambia' },
  'ZW': { coords: [31.05, -17.83], name: 'Zimbabwe' },
};

// Parse level from text
function parseLevel(text: string): { level: 1 | 2 | 3 | 4; levelText: string } {
  if (text.includes('Level 4') || text.includes('Do Not Travel')) {
    return { level: 4, levelText: 'Do Not Travel' };
  }
  if (text.includes('Level 3') || text.includes('Reconsider Travel')) {
    return { level: 3, levelText: 'Reconsider Travel' };
  }
  if (text.includes('Level 2') || text.includes('Exercise Increased Caution')) {
    return { level: 2, levelText: 'Exercise Increased Caution' };
  }
  return { level: 1, levelText: 'Exercise Normal Precautions' };
}

// Extract risks from description
function extractRisks(desc: string): string[] {
  const risks: string[] = [];
  const riskKeywords = [
    'crime', 'terrorism', 'civil unrest', 'armed conflict', 'kidnapping',
    'health', 'natural disaster', 'piracy', 'violence', 'wrongful detention',
  ];

  const lowerDesc = desc.toLowerCase();
  for (const keyword of riskKeywords) {
    if (lowerDesc.includes(keyword)) {
      risks.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
    }
  }

  return risks;
}

export async function GET() {
  const advisories: TravelAdvisory[] = [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(STATE_DEPT_RSS, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'newsAlert/1.0 (OSINT Dashboard)',
      },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const rssText = await response.text();

      // Parse RSS using fast-xml-parser
      const parsed = xmlParser.parse(rssText);
      const items = parsed?.rss?.channel?.item || [];
      const itemArray = Array.isArray(items) ? items : [items];

      for (const item of itemArray) {
        const title = item.title;
        const link = item.link;
        const desc = item.description;
        const pubDate = item.pubDate;
        // Category can be array or single object
        const categories = Array.isArray(item.category) ? item.category : [item.category];
        const countryTag = categories.find((c: any) => c?.['@_domain'] === 'Country-Tag');

        if (!title || !countryTag) continue;

        // Extract country code from category value
        const countryCode = (typeof countryTag === 'object' ? countryTag['#text'] : countryTag)?.toUpperCase();
        if (!countryCode) continue;

        const countryInfo = COUNTRY_COORDS[countryCode];
        if (!countryInfo) continue;

        const { level, levelText } = parseLevel(String(title));
        const description = desc ? String(desc).replace(/<[^>]+>/g, ' ').substring(0, 300) : '';
        const risks = extractRisks(description);

        advisories.push({
          id: `travel-${countryCode}`,
          country: countryInfo.name,
          countryCode,
          level,
          levelText,
          title: String(title),
          description: description.trim(),
          url: link ? String(link) : '',
          updatedAt: pubDate ? new Date(String(pubDate)) : new Date(),
          coordinates: countryInfo.coords,
          risks,
        });
      }
    }
  } catch (error) {
    console.error('State Dept RSS error:', error);
  }

  // Sort by level (highest first), then by country name
  advisories.sort((a, b) => {
    if (a.level !== b.level) return b.level - a.level;
    return a.country.localeCompare(b.country);
  });

  // Stats
  const stats = {
    total: advisories.length,
    level4: advisories.filter(a => a.level === 4).length,
    level3: advisories.filter(a => a.level === 3).length,
    level2: advisories.filter(a => a.level === 2).length,
    level1: advisories.filter(a => a.level === 1).length,
  };

  return NextResponse.json({
    advisories,
    stats,
    fetchedAt: new Date().toISOString(),
  });
}
