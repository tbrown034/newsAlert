/**
 * WEATHER ALERTS API
 * ==================
 * Fetches severe weather data from NOAA and other sources
 */

import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';

export const dynamic = 'force-dynamic';

// XML parser instance with namespace handling
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true, // Handle gdacs: and geo: prefixes
});

interface WeatherEvent {
  id: string;
  type: 'hurricane' | 'typhoon' | 'storm' | 'wildfire' | 'flood' | 'tornado' | 'extreme_temp';
  name: string;
  description: string;
  severity: 'extreme' | 'severe' | 'moderate' | 'minor';
  coordinates: [number, number]; // [lon, lat]
  startTime: Date;
  endTime?: Date;
  source: string;
  url?: string;
  windSpeed?: number; // mph for hurricanes
  category?: number; // hurricane category
  affectedAreas?: string[];
}

// NOAA NWS Active Alerts API
const NWS_ALERTS_API = 'https://api.weather.gov/alerts/active';

// EONET (NASA Earth Observatory Natural Events) for global events
const EONET_API = 'https://eonet.gsfc.nasa.gov/api/v3/events';

// GDACS (Global Disaster Alert and Coordination System) for international coverage
const GDACS_RSS = 'https://www.gdacs.org/xml/rss.xml';

// Map NWS event types to our categories
function mapNWSEventType(event: string): WeatherEvent['type'] | null {
  const lower = event.toLowerCase();
  if (lower.includes('hurricane') || lower.includes('tropical')) return 'hurricane';
  if (lower.includes('typhoon')) return 'typhoon';
  if (lower.includes('tornado')) return 'tornado';
  if (lower.includes('flood')) return 'flood';
  if (lower.includes('fire') || lower.includes('red flag')) return 'wildfire';
  if (lower.includes('storm') || lower.includes('thunder') || lower.includes('wind')) return 'storm';
  if (lower.includes('heat') || lower.includes('cold') || lower.includes('freeze') || lower.includes('winter')) return 'extreme_temp';
  return null;
}

// Map NWS severity
function mapNWSSeverity(severity: string): WeatherEvent['severity'] {
  switch (severity?.toLowerCase()) {
    case 'extreme': return 'extreme';
    case 'severe': return 'severe';
    case 'moderate': return 'moderate';
    default: return 'minor';
  }
}

// Map EONET category to our type
function mapEONETCategory(categoryId: string): WeatherEvent['type'] | null {
  switch (categoryId) {
    case 'wildfires': return 'wildfire';
    case 'severeStorms': return 'storm';
    case 'floods': return 'flood';
    case 'volcanoes': return null; // Skip volcanoes for now
    default: return null;
  }
}

// Map GDACS event type
function mapGDACSEventType(eventType: string): WeatherEvent['type'] | null {
  switch (eventType?.toUpperCase()) {
    case 'TC': return 'hurricane'; // Tropical cyclone
    case 'FL': return 'flood';
    case 'WF': return 'wildfire';
    case 'DR': return 'extreme_temp'; // Drought
    default: return null; // Skip EQ (earthquakes) - we have seismic tab
  }
}

// Map GDACS alert level to severity
function mapGDACSAlertLevel(level: string): WeatherEvent['severity'] {
  switch (level?.toLowerCase()) {
    case 'red': return 'extreme';
    case 'orange': return 'severe';
    case 'green': return 'moderate';
    default: return 'minor';
  }
}

export async function GET() {
  const events: WeatherEvent[] = [];

  // Fetch from NWS (US alerts)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const nwsResponse = await fetch(`${NWS_ALERTS_API}?status=actual&message_type=alert`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'newsAlert/1.0 (OSINT Dashboard)',
        'Accept': 'application/geo+json',
      },
    });

    clearTimeout(timeoutId);

    if (nwsResponse.ok) {
      const nwsData = await nwsResponse.json();

      // Process NWS alerts - limit to significant ones
      const significantAlerts = (nwsData.features || [])
        .filter((f: any) => {
          const eventType = mapNWSEventType(f.properties?.event || '');
          const severity = f.properties?.severity;
          // Only include severe/extreme events of types we care about
          return eventType && (severity === 'Extreme' || severity === 'Severe');
        })
        .slice(0, 30); // Limit to 30 most recent

      for (const feature of significantAlerts) {
        const props = feature.properties;
        const eventType = mapNWSEventType(props.event);

        if (!eventType) continue;

        // Get centroid of affected area (simplified)
        let coordinates: [number, number] = [-98, 39]; // Default to US center

        if (feature.geometry?.coordinates) {
          // For polygon, get rough center
          const coords = feature.geometry.coordinates;
          if (Array.isArray(coords) && coords.length > 0) {
            if (feature.geometry.type === 'Polygon' && coords[0]?.length > 0) {
              const ring = coords[0];
              const avgLon = ring.reduce((sum: number, c: any) => sum + c[0], 0) / ring.length;
              const avgLat = ring.reduce((sum: number, c: any) => sum + c[1], 0) / ring.length;
              coordinates = [avgLon, avgLat];
            } else if (feature.geometry.type === 'Point') {
              coordinates = coords as [number, number];
            }
          }
        }

        events.push({
          id: props.id || `nws-${Date.now()}-${Math.random()}`,
          type: eventType,
          name: props.event,
          description: props.headline || props.description?.substring(0, 200) || '',
          severity: mapNWSSeverity(props.severity),
          coordinates,
          startTime: new Date(props.onset || props.effective),
          endTime: props.expires ? new Date(props.expires) : undefined,
          source: 'NWS',
          url: props['@id'],
          affectedAreas: props.areaDesc?.split(';').map((a: string) => a.trim()),
        });
      }
    }
  } catch (error) {
    console.error('NWS API error:', error);
  }

  // Fetch from EONET (global natural events)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const eonetResponse = await fetch(`${EONET_API}?status=open&limit=50`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'newsAlert/1.0 (OSINT Dashboard)',
      },
    });

    clearTimeout(timeoutId);

    if (eonetResponse.ok) {
      const eonetData = await eonetResponse.json();

      for (const event of eonetData.events || []) {
        const category = event.categories?.[0];
        const eventType = mapEONETCategory(category?.id);

        if (!eventType) continue;

        // Get most recent geometry
        const geometry = event.geometry?.[event.geometry.length - 1];
        if (!geometry?.coordinates) continue;

        events.push({
          id: event.id,
          type: eventType,
          name: event.title,
          description: `Active ${category?.title || eventType} event`,
          severity: 'severe', // EONET events are generally significant
          coordinates: geometry.coordinates as [number, number],
          startTime: new Date(geometry.date),
          source: 'NASA EONET',
          url: event.link,
        });
      }
    }
  } catch (error) {
    console.error('EONET API error:', error);
  }

  // Fetch from GDACS (Global Disaster Alerts) for international coverage
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const gdacsResponse = await fetch(GDACS_RSS, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'newsAlert/1.0 (OSINT Dashboard)',
      },
    });

    clearTimeout(timeoutId);

    if (gdacsResponse.ok) {
      const rssText = await gdacsResponse.text();

      // Parse RSS using fast-xml-parser
      const parsed = xmlParser.parse(rssText);
      const items = parsed?.rss?.channel?.item || [];
      const itemArray = Array.isArray(items) ? items : [items];

      for (const item of itemArray.slice(0, 30)) {
        const title = item.title;
        const link = item.link;
        const eventTypeVal = item.eventtype;
        const alertLevel = item.alertlevel;
        const lat = item.lat;
        const lon = item.long;
        const pubDate = item.pubDate;
        const country = item.country;

        if (!title || !eventTypeVal || lat === undefined || lon === undefined) continue;

        const eventType = mapGDACSEventType(String(eventTypeVal));
        if (!eventType) continue;

        const latNum = parseFloat(String(lat));
        const lonNum = parseFloat(String(lon));
        if (isNaN(latNum) || isNaN(lonNum)) continue;

        events.push({
          id: `gdacs-${eventTypeVal}-${latNum}-${lonNum}`,
          type: eventType,
          name: String(title).substring(0, 100),
          description: country ? `${eventType} event in ${country}` : String(title).substring(0, 150),
          severity: mapGDACSAlertLevel(alertLevel ? String(alertLevel) : 'green'),
          coordinates: [lonNum, latNum],
          startTime: pubDate ? new Date(String(pubDate)) : new Date(),
          source: 'GDACS',
          url: link ? String(link) : undefined,
          affectedAreas: country ? [String(country)] : undefined,
        });
      }
    }
  } catch (error) {
    console.error('GDACS API error:', error);
  }

  // Sort by severity then time
  const severityOrder = { extreme: 0, severe: 1, moderate: 2, minor: 3 };
  events.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
  });

  // Calculate stats
  const stats = {
    total: events.length,
    byType: {
      hurricane: events.filter(e => e.type === 'hurricane' || e.type === 'typhoon').length,
      storm: events.filter(e => e.type === 'storm' || e.type === 'tornado').length,
      wildfire: events.filter(e => e.type === 'wildfire').length,
      flood: events.filter(e => e.type === 'flood').length,
      extreme_temp: events.filter(e => e.type === 'extreme_temp').length,
    },
    extreme: events.filter(e => e.severity === 'extreme').length,
    severe: events.filter(e => e.severity === 'severe').length,
  };

  return NextResponse.json({
    events,
    stats,
    fetchedAt: new Date().toISOString(),
  });
}
