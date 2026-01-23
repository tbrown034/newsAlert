import HomeClient from './HomeClient';
import { WatchpointId, NewsItem } from '@/types';
import { RegionActivity } from '@/lib/activityDetection';

// Don't statically generate - this page fetches live data
export const dynamic = 'force-dynamic';

interface ApiResponse {
  items: NewsItem[];
  activity: Record<string, RegionActivity>;
  fetchedAt: string;
  totalItems: number;
}

// Server Component - fetches initial data at request time
export default async function Home() {
  let initialData: ApiResponse | null = null;
  let initialRegion: WatchpointId = 'all';

  try {
    // Server-side fetch - no network hop, direct function call would be even better
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    // Fetch T1 first for fast initial load, client will fetch T2 async
    const response = await fetch(`${baseUrl}/api/news?region=all&tier=T1&hours=12&limit=100`, {
      next: { revalidate: 60 }, // Cache for 60s on server
    });

    if (response.ok) {
      initialData = await response.json();

      // Auto-select hottest region
      if (initialData?.activity) {
        const activityPriority: Record<string, number> = {
          critical: 3,
          elevated: 2,
          normal: 1,
        };

        const regions = Object.entries(initialData.activity)
          .filter(([id]) => id !== 'all')
          .map(([id, activity]) => ({
            id: id as WatchpointId,
            priority: activityPriority[activity.level] || 0,
          }))
          .sort((a, b) => b.priority - a.priority);

        if (regions.length > 0 && regions[0].priority >= 2) {
          initialRegion = regions[0].id;
        }
      }
    }
  } catch (error) {
    console.error('[Page] Failed to fetch initial data:', error);
  }

  return <HomeClient initialData={initialData} initialRegion={initialRegion} />;
}
