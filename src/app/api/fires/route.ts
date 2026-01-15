/**
 * FIRES / WILDFIRE API
 * ====================
 * Aggregates wildfire data from NASA FIRMS, EONET, and GDACS
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface FireEvent {
  id: string;
  title: string;
  description: string;
  coordinates: [number, number];
  date: Date;
  source: 'EONET' | 'GDACS' | 'FIRMS';
  severity: 'critical' | 'severe' | 'moderate' | 'minor';
  url: string;
  category?: string;
  area?: string;
  brightness?: number;
  confidence?: string;
}

// NASA FIRMS API for satellite fire detection
// API key should be in environment variables for security
const FIRMS_API_KEY = process.env.NASA_FIRMS_API_KEY || '';
const FIRMS_API = FIRMS_API_KEY
  ? `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_API_KEY}/VIIRS_SNPP_NRT/world/1`
  : '';
// NASA EONET API for natural events including wildfires
const EONET_API = 'https://eonet.gsfc.nasa.gov/api/v3/events';
// GDACS RSS for global disasters
const GDACS_RSS = 'https://www.gdacs.org/xml/rss.xml';

function determineSeverity(title: string, description: string): FireEvent['severity'] {
  const text = `${title} ${description}`.toLowerCase();
  if (text.includes('major') || text.includes('extreme') || text.includes('catastroph') || text.includes('emergency')) {
    return 'critical';
  }
  if (text.includes('large') || text.includes('significant') || text.includes('spreading')) {
    return 'severe';
  }
  if (text.includes('contained') || text.includes('controlled')) {
    return 'minor';
  }
  return 'moderate';
}

// Determine severity based on FIRMS brightness/FRP
function firmssSeverity(brightness: number, confidence: string): FireEvent['severity'] {
  // VIIRS brightness temp thresholds
  if (brightness >= 400 || confidence === 'high') return 'critical';
  if (brightness >= 350) return 'severe';
  if (brightness >= 320) return 'moderate';
  return 'minor';
}

// Cluster nearby FIRMS points into single fire events
function clusterFirmsPoints(points: any[]): any[] {
  const clusters: any[][] = [];
  const used = new Set<number>();

  for (let i = 0; i < points.length; i++) {
    if (used.has(i)) continue;

    const cluster = [points[i]];
    used.add(i);

    for (let j = i + 1; j < points.length; j++) {
      if (used.has(j)) continue;

      const latDiff = Math.abs(points[i].latitude - points[j].latitude);
      const lonDiff = Math.abs(points[i].longitude - points[j].longitude);

      // Cluster points within ~25km
      if (latDiff < 0.25 && lonDiff < 0.25) {
        cluster.push(points[j]);
        used.add(j);
      }
    }

    clusters.push(cluster);
  }

  // Return cluster centroids with max brightness
  return clusters.map(cluster => {
    const avgLat = cluster.reduce((s, p) => s + p.latitude, 0) / cluster.length;
    const avgLon = cluster.reduce((s, p) => s + p.longitude, 0) / cluster.length;
    const maxBrightness = Math.max(...cluster.map(p => p.bright_ti4 || p.brightness || 0));
    const bestConfidence = cluster.some(p => p.confidence === 'high') ? 'high' :
                          cluster.some(p => p.confidence === 'nominal') ? 'nominal' : 'low';

    return {
      latitude: avgLat,
      longitude: avgLon,
      brightness: maxBrightness,
      confidence: bestConfidence,
      acq_date: cluster[0].acq_date,
      acq_time: cluster[0].acq_time,
      count: cluster.length,
    };
  });
}

export async function GET() {
  const fires: FireEvent[] = [];

  // Fetch from NASA FIRMS (satellite fire detections)
  // Skip if no API key configured
  if (FIRMS_API) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(FIRMS_API, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'newsAlert/1.0 (OSINT Dashboard)',
      },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const csvText = await response.text();
      const lines = csvText.trim().split('\n');

      if (lines.length > 1) {
        const headers = lines[0].split(',');
        const latIdx = headers.indexOf('latitude');
        const lonIdx = headers.indexOf('longitude');
        const brightIdx = headers.indexOf('bright_ti4');
        const dateIdx = headers.indexOf('acq_date');
        const timeIdx = headers.indexOf('acq_time');
        const confIdx = headers.indexOf('confidence');

        const points: any[] = [];

        for (let i = 1; i < lines.length && i < 5000; i++) {
          const values = lines[i].split(',');
          if (values.length < headers.length) continue;

          const lat = parseFloat(values[latIdx]);
          const lon = parseFloat(values[lonIdx]);
          const brightness = parseFloat(values[brightIdx]) || 0;

          if (isNaN(lat) || isNaN(lon)) continue;

          points.push({
            latitude: lat,
            longitude: lon,
            brightness,
            acq_date: values[dateIdx],
            acq_time: values[timeIdx],
            confidence: values[confIdx] || 'nominal',
          });
        }

        // Cluster points into fire events (limit to top 100 clusters)
        const clusters = clusterFirmsPoints(points).slice(0, 100);

        for (const cluster of clusters) {
          const severity = firmssSeverity(cluster.brightness, cluster.confidence);

          // Parse date
          const dateStr = cluster.acq_date; // Format: YYYY-MM-DD
          const timeStr = cluster.acq_time?.toString().padStart(4, '0') || '0000';
          const dateTime = new Date(`${dateStr}T${timeStr.slice(0, 2)}:${timeStr.slice(2)}:00Z`);

          fires.push({
            id: `firms-${cluster.latitude.toFixed(2)}-${cluster.longitude.toFixed(2)}`,
            title: `Fire Detected (${cluster.count} hotspot${cluster.count > 1 ? 's' : ''})`,
            description: `Satellite-detected fire activity. Brightness: ${cluster.brightness.toFixed(0)}K, Confidence: ${cluster.confidence}`,
            coordinates: [cluster.longitude, cluster.latitude],
            date: dateTime,
            source: 'FIRMS',
            severity,
            url: `https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@${cluster.longitude},${cluster.latitude},10z`,
            category: 'Satellite Detection',
            brightness: cluster.brightness,
            confidence: cluster.confidence,
          });
        }
      }
    }
  } catch (error) {
    console.error('FIRMS fetch error:', error);
  }
}

  // Fetch from NASA EONET (wildfires category = 8)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${EONET_API}?category=wildfires&status=open&limit=50`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'newsAlert/1.0 (OSINT Dashboard)',
      },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();

      for (const event of data.events || []) {
        // Get most recent geometry
        const geometry = event.geometry?.[0];
        if (!geometry?.coordinates) continue;

        fires.push({
          id: `eonet-${event.id}`,
          title: event.title,
          description: event.description || `Active wildfire: ${event.title}`,
          coordinates: [geometry.coordinates[0], geometry.coordinates[1]],
          date: new Date(geometry.date || event.geometry?.[0]?.date),
          source: 'EONET',
          severity: determineSeverity(event.title, event.description || ''),
          url: event.link || `https://eonet.gsfc.nasa.gov/api/v3/events/${event.id}`,
          category: 'Wildfire',
        });
      }
    }
  } catch (error) {
    console.error('EONET fires fetch error:', error);
  }

  // Fetch from GDACS (filter for wildfires - WF)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(GDACS_RSS, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'newsAlert/1.0 (OSINT Dashboard)',
      },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const rssText = await response.text();
      const items = rssText.match(/<item>[\s\S]*?<\/item>/g) || [];

      for (const item of items) {
        // Only process wildfire events
        const eventTypeMatch = item.match(/<gdacs:eventtype>([^<]+)<\/gdacs:eventtype>/);
        if (!eventTypeMatch || eventTypeMatch[1] !== 'WF') continue;

        const titleMatch = item.match(/<title>([^<]+)<\/title>/);
        const linkMatch = item.match(/<link>([^<]+)<\/link>/);
        const descMatch = item.match(/<description>([^<]+)<\/description>/);
        const dateMatch = item.match(/<pubDate>([^<]+)<\/pubDate>/);
        const latMatch = item.match(/<geo:lat>([^<]+)<\/geo:lat>/);
        const lonMatch = item.match(/<geo:long>([^<]+)<\/geo:long>/);
        const alertMatch = item.match(/<gdacs:alertlevel[^>]*>([^<]+)<\/gdacs:alertlevel>/);
        const countryMatch = item.match(/<gdacs:country>([^<]+)<\/gdacs:country>/);

        if (!titleMatch || !latMatch || !lonMatch) continue;

        const alertLevel = alertMatch?.[1]?.toLowerCase();
        let severity: FireEvent['severity'] = 'moderate';
        if (alertLevel === 'red') severity = 'critical';
        else if (alertLevel === 'orange') severity = 'severe';
        else if (alertLevel === 'green') severity = 'minor';

        fires.push({
          id: `gdacs-wf-${titleMatch[1].replace(/\s+/g, '-').toLowerCase().substring(0, 30)}`,
          title: titleMatch[1],
          description: descMatch?.[1] || titleMatch[1],
          coordinates: [parseFloat(lonMatch[1]), parseFloat(latMatch[1])],
          date: dateMatch ? new Date(dateMatch[1]) : new Date(),
          source: 'GDACS',
          severity,
          url: linkMatch?.[1] || 'https://www.gdacs.org',
          category: 'Wildfire',
          area: countryMatch?.[1],
        });
      }
    }
  } catch (error) {
    console.error('GDACS fires fetch error:', error);
  }

  // Sort by date (newest first) and deduplicate by proximity
  fires.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Deduplicate fires that are very close (within ~50km)
  const uniqueFires: FireEvent[] = [];
  for (const fire of fires) {
    const isDuplicate = uniqueFires.some(existing => {
      const latDiff = Math.abs(existing.coordinates[1] - fire.coordinates[1]);
      const lonDiff = Math.abs(existing.coordinates[0] - fire.coordinates[0]);
      return latDiff < 0.5 && lonDiff < 0.5;
    });
    if (!isDuplicate) {
      uniqueFires.push(fire);
    }
  }

  // Stats
  const stats = {
    total: uniqueFires.length,
    critical: uniqueFires.filter(f => f.severity === 'critical').length,
    severe: uniqueFires.filter(f => f.severity === 'severe').length,
    moderate: uniqueFires.filter(f => f.severity === 'moderate').length,
    minor: uniqueFires.filter(f => f.severity === 'minor').length,
    sources: {
      firms: uniqueFires.filter(f => f.source === 'FIRMS').length,
      eonet: uniqueFires.filter(f => f.source === 'EONET').length,
      gdacs: uniqueFires.filter(f => f.source === 'GDACS').length,
    },
  };

  return NextResponse.json({
    fires: uniqueFires,
    stats,
    fetchedAt: new Date().toISOString(),
  });
}
