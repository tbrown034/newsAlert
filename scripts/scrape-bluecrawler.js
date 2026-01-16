#!/usr/bin/env node
/**
 * Scrape bluecrawler.com top 1000 using Playwright
 * Scrolls through the virtualized list to collect all accounts
 */

const { chromium } = require('playwright');
const fs = require('fs');

async function main() {
  console.log('Launching browser...');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Loading bluecrawler.com...');
  await page.goto('https://bluecrawler.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000); // Wait for JS to render

  // Wait for list to load
  await page.waitForSelector('[style*="position: absolute"]');

  const accounts = new Map();

  // Find the scrollable container
  const container = await page.$('[style*="overflow:auto"]');
  if (!container) {
    console.error('Could not find scrollable container');
    await browser.close();
    return;
  }

  console.log('Scrolling and collecting accounts...');

  let lastCount = 0;
  let scrollPos = 0;
  const scrollStep = 500;

  while (accounts.size < 1000) {
    // Extract visible accounts
    const rows = await page.$$eval('[style*="position: absolute"]', (elements) => {
      return elements.map(el => {
        const rank = el.querySelector('.pl-\\[10px\\]')?.textContent?.trim();
        const name = el.querySelector('.overflow-hidden > div')?.textContent?.trim();
        const handleEl = el.querySelector('a[href*="bsky.app"]');
        const handle = handleEl?.textContent?.replace('@', '').trim();
        const followers = el.querySelector('.w-\\[30\\%\\]')?.textContent?.replace(/,/g, '').trim();
        return { rank: parseInt(rank), name, handle, followers: parseInt(followers) };
      }).filter(r => r.rank && r.handle && r.followers);
    });

    for (const row of rows) {
      if (!accounts.has(row.handle)) {
        accounts.set(row.handle, row);
      }
    }

    // Progress update
    if (accounts.size !== lastCount && accounts.size % 50 === 0) {
      console.log(`Collected ${accounts.size} accounts...`);
    }
    lastCount = accounts.size;

    // Scroll down
    scrollPos += scrollStep;
    await container.evaluate((el, pos) => { el.scrollTop = pos; }, scrollPos);
    await page.waitForTimeout(100);

    // Check if we've scrolled too far (no new data)
    if (scrollPos > 60000) break; // 1000 rows * 55px + buffer
  }

  console.log(`\nCollected ${accounts.size} accounts total`);

  // Convert to array and sort by rank
  const sorted = [...accounts.values()].sort((a, b) => a.rank - b.rank);

  // Save to file
  fs.writeFileSync('bluecrawler-top1000.json', JSON.stringify(sorted, null, 2));
  console.log('Saved to bluecrawler-top1000.json');

  // Also save CSV
  const csv = 'rank,name,handle,followers\n' +
    sorted.map(r => `${r.rank},"${r.name}",${r.handle},${r.followers}`).join('\n');
  fs.writeFileSync('bluecrawler-top1000.csv', csv);
  console.log('Saved to bluecrawler-top1000.csv');

  await browser.close();

  // Print summary
  console.log('\n=== TOP 50 ===');
  for (const r of sorted.slice(0, 50)) {
    console.log(`${r.rank.toString().padStart(4)}. ${r.handle.padEnd(40)} ${r.followers.toLocaleString().padStart(12)} - ${r.name}`);
  }
}

main().catch(console.error);
