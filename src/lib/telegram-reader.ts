/**
 * Telegram Data Reader
 * Reads cached Telegram posts from JSON file (populated by Python script)
 */

import { NewsItem, Source } from '@/types';
import { classifyRegion, isBreakingNews } from './sources';
import * as fs from 'fs';
import * as path from 'path';

interface TelegramPost {
  id: string;
  platform: 'telegram';
  handle: string;
  region: string;
  confidence: number;
  tier: string;
  text: string;
  timestamp: string;
  url: string;
}

interface TelegramData {
  fetched_at: string;
  channel_count: number;
  post_count: number;
  posts: TelegramPost[];
}

// Map tier string to source type
function mapTierToSourceType(tier: string): Source['sourceType'] {
  switch (tier) {
    case 'official':
      return 'official';
    case 'osint':
      return 'osint';
    case 'news-org':
      return 'news-org';
    case 'reporter':
      return 'reporter';
    default:
      return 'ground';
  }
}

// Determine verification status based on source type and confidence
function getVerificationStatus(
  sourceType: Source['sourceType'],
  confidence: number
): 'confirmed' | 'multiple-sources' | 'unverified' {
  if (sourceType === 'official' || confidence >= 90) return 'confirmed';
  if (sourceType === 'reporter' || sourceType === 'news-org' || confidence >= 75) return 'multiple-sources';
  return 'unverified';
}

/**
 * Read Telegram posts from the cached JSON file
 * Returns empty array if file doesn't exist or is stale
 */
export function readTelegramPosts(): NewsItem[] {
  const dataPath = path.join(process.cwd(), 'data', 'telegram.json');

  try {
    if (!fs.existsSync(dataPath)) {
      console.log('[Telegram] No data file found at', dataPath);
      return [];
    }

    const raw = fs.readFileSync(dataPath, 'utf-8');
    const data: TelegramData = JSON.parse(raw);

    // Check freshness - skip if older than 30 minutes
    const fetchedAt = new Date(data.fetched_at);
    const ageMinutes = (Date.now() - fetchedAt.getTime()) / 1000 / 60;

    if (ageMinutes > 30) {
      console.log(`[Telegram] Data is ${Math.round(ageMinutes)} minutes old, consider refreshing`);
    }

    // Convert to NewsItems
    const items: NewsItem[] = data.posts.map((post) => {
      const sourceType = mapTierToSourceType(post.tier);

      const source: Source = {
        id: `telegram-${post.handle}`,
        name: `@${post.handle}`,
        platform: 'telegram',
        confidence: post.confidence,
        sourceType,
        region: post.region as any,
      };

      const region = post.region !== 'all'
        ? post.region
        : classifyRegion(post.text, post.text);

      return {
        id: post.id,
        title: post.text.slice(0, 280),
        content: post.text,
        source,
        timestamp: new Date(post.timestamp),
        region: region as any,
        verificationStatus: getVerificationStatus(sourceType, post.confidence),
        url: post.url,
        alertStatus: null,
        isBreaking: isBreakingNews(post.text, post.text),
      };
    });

    console.log(`[Telegram] Loaded ${items.length} posts from cache`);
    return items;

  } catch (error) {
    console.error('[Telegram] Error reading data:', error);
    return [];
  }
}

/**
 * Check if Telegram data exists and is fresh
 */
export function isTelegramDataFresh(maxAgeMinutes: number = 30): boolean {
  const dataPath = path.join(process.cwd(), 'data', 'telegram.json');

  try {
    if (!fs.existsSync(dataPath)) return false;

    const raw = fs.readFileSync(dataPath, 'utf-8');
    const data: TelegramData = JSON.parse(raw);

    const fetchedAt = new Date(data.fetched_at);
    const ageMinutes = (Date.now() - fetchedAt.getTime()) / 1000 / 60;

    return ageMinutes <= maxAgeMinutes;
  } catch {
    return false;
  }
}
