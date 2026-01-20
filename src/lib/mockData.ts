import { Watchpoint, NewsItem, Source } from '@/types';

export const watchpoints: Watchpoint[] = [
  {
    id: 'us',
    name: 'United States',
    shortName: 'US',
    priority: 1,
    activityLevel: 'normal',
    color: '#8b5cf6',
  },
  {
    id: 'latam',
    name: 'Latin America',
    shortName: 'LatAm',
    priority: 2,
    activityLevel: 'normal',
    color: '#10b981',
  },
  {
    id: 'middle-east',
    name: 'Middle East',
    shortName: 'M. East',
    priority: 3,
    activityLevel: 'elevated',
    color: '#ef4444',
  },
  {
    id: 'europe-russia',
    name: 'Europe & Russia',
    shortName: 'Europe',
    priority: 4,
    activityLevel: 'elevated',
    color: '#f59e0b',
  },
  {
    id: 'asia',
    name: 'Asia-Pacific',
    shortName: 'Asia',
    priority: 5,
    activityLevel: 'normal',
    color: '#3b82f6',
  },
];

// Mock sources based on our sources.md
const sources: Record<string, Source> = {
  idf: {
    id: 'idf',
    name: 'IDF',
    handle: '@IDF',
    platform: 'twitter',
    sourceType: 'official',
    confidence: 95,
    region: 'middle-east',
    url: 'https://twitter.com/IDF',
  },
  reuters: {
    id: 'reuters',
    name: 'Reuters',
    platform: 'rss',
    sourceType: 'reporter',
    confidence: 92,
    region: 'middle-east',
    url: 'https://reuters.com',
  },
  osintdefender: {
    id: 'osintdefender',
    name: 'OSINTdefender',
    handle: '@sentdefender',
    platform: 'twitter',
    sourceType: 'osint',
    confidence: 78,
    region: 'middle-east',
    url: 'https://twitter.com/sentdefender',
  },
  aurora: {
    id: 'aurora',
    name: 'Aurora Intel',
    handle: '@AuroraIntel',
    platform: 'twitter',
    sourceType: 'osint',
    confidence: 82,
    region: 'europe-russia',
    url: 'https://twitter.com/AuroraIntel',
  },
  bbc: {
    id: 'bbc',
    name: 'BBC News',
    platform: 'rss',
    sourceType: 'reporter',
    confidence: 90,
    region: 'europe-russia',
  },
  warmonitor: {
    id: 'warmonitor',
    name: 'War Monitor',
    platform: 'telegram',
    sourceType: 'osint',
    confidence: 70,
    region: 'europe-russia',
  },
  localreporter: {
    id: 'localreporter',
    name: 'Tehran Times',
    platform: 'twitter',
    sourceType: 'ground',
    confidence: 55,
    region: 'middle-east',
  },
};

// Mock news items
export const mockNewsItems: NewsItem[] = [
  {
    id: '1',
    title: 'IDF confirms interception of multiple drones over northern Israel',
    content:
      'The Israeli Defense Forces have confirmed the interception of several unmanned aerial vehicles over northern Israel. Air defense systems successfully neutralized all threats. No casualties reported.',
    source: sources.idf,
    timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    region: 'middle-east',
    verificationStatus: 'confirmed',
    isBreaking: true,
    url: 'https://twitter.com/IDF/status/123',
  },
  {
    id: '2',
    title: 'Reports of explosions heard in Tehran suburbs',
    content:
      'Multiple social media accounts reporting sounds of explosions in the eastern suburbs of Tehran. Cause unknown. No official statement yet.',
    source: sources.localreporter,
    timestamp: new Date(Date.now() - 12 * 60 * 1000), // 12 minutes ago
    region: 'middle-east',
    verificationStatus: 'unverified',
    isBreaking: true,
  },
  {
    id: '3',
    title: 'OSINT: Unusual flight activity detected over Persian Gulf',
    content:
      'ADS-B tracking shows multiple military refueling tankers in holding patterns over the Persian Gulf. This level of activity is above baseline for this time of day.',
    source: sources.osintdefender,
    timestamp: new Date(Date.now() - 25 * 60 * 1000), // 25 minutes ago
    region: 'middle-east',
    verificationStatus: 'multiple-sources',
    url: 'https://twitter.com/sentdefender/status/456',
  },
  {
    id: '4',
    title: 'Russia launches large-scale drone attack on Ukrainian infrastructure',
    content:
      'Ukrainian Air Force reports interception of 28 out of 35 Shahed drones targeting energy infrastructure in central and western Ukraine overnight.',
    source: sources.aurora,
    timestamp: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
    region: 'europe-russia',
    verificationStatus: 'multiple-sources',
    isBreaking: true,
  },
  {
    id: '5',
    title: 'Ukraine counteroffensive gains reported in Zaporizhzhia sector',
    content:
      'BBC sources indicate Ukrainian forces have made tactical gains in the southern Zaporizhzhia region. Russian military bloggers acknowledge loss of several positions.',
    source: sources.bbc,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    region: 'europe-russia',
    verificationStatus: 'confirmed',
    url: 'https://bbc.com/news/world-europe-123',
  },
  {
    id: '6',
    title: 'Heavy fighting reported near Bakhmut',
    content:
      'Telegram channels reporting intense artillery exchanges and infantry clashes in the Bakhmut sector. Both sides claiming successful defensive operations.',
    source: sources.warmonitor,
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
    region: 'europe-russia',
    verificationStatus: 'multiple-sources',
  },
  {
    id: '7',
    title: 'Reuters: US officials monitoring Iran nuclear facility activity',
    content:
      'Senior US officials report increased activity at Iranian nuclear enrichment facilities, according to satellite imagery analysis. Diplomatic channels remain open.',
    source: sources.reuters,
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
    region: 'middle-east',
    verificationStatus: 'confirmed',
    url: 'https://reuters.com/world/iran-nuclear-123',
  },
];
