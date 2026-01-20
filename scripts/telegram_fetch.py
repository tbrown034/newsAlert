#!/usr/bin/env python3
"""
Telegram Channel Fetcher
========================
Fetches posts from configured Telegram channels and outputs JSON.
Used as a data source for the Node.js app.

Usage:
  python scripts/telegram_fetch.py > data/telegram.json

Or with specific channels:
  python scripts/telegram_fetch.py DeepStateUA IranIntl_En
"""

import asyncio
import json
import os
import sys
from datetime import datetime, timedelta

API_ID = os.environ.get('TELEGRAM_API_ID', '34591236')
API_HASH = os.environ.get('TELEGRAM_API_HASH', '5aaa0b9349afe69aff162680f58633fd')

# Phase 1 high-value channels
DEFAULT_CHANNELS = [
    # Europe-Russia
    {'handle': 'DeepStateUA', 'region': 'europe-russia', 'confidence': 92, 'tier': 'official'},
    {'handle': 'DeepStateEN', 'region': 'europe-russia', 'confidence': 92, 'tier': 'official'},
    {'handle': 'wartranslated', 'region': 'europe-russia', 'confidence': 90, 'tier': 'osint'},
    {'handle': 'DIUkraine', 'region': 'europe-russia', 'confidence': 95, 'tier': 'official'},
    # Middle East
    {'handle': 'idfofficial', 'region': 'middle-east', 'confidence': 95, 'tier': 'official'},
    {'handle': 'englishabuali', 'region': 'middle-east', 'confidence': 82, 'tier': 'osint'},
    {'handle': 'IranIntl_En', 'region': 'middle-east', 'confidence': 85, 'tier': 'news-org'},
]


async def main():
    try:
        from telethon import TelegramClient
    except ImportError:
        print('{"error": "telethon not installed"}', file=sys.stderr)
        sys.exit(1)

    # Determine which channels to fetch
    if len(sys.argv) > 1:
        channels = [{'handle': h, 'region': 'all', 'confidence': 80, 'tier': 'osint'}
                   for h in sys.argv[1:]]
    else:
        channels = DEFAULT_CHANNELS

    # Create client
    client = TelegramClient('pulse_session', int(API_ID), API_HASH)
    await client.connect()

    if not await client.is_user_authorized():
        print('{"error": "not authorized - run telegram_test.py first"}', file=sys.stderr)
        sys.exit(1)

    results = []
    cutoff = datetime.utcnow() - timedelta(hours=24)

    for ch in channels:
        handle = ch['handle']
        try:
            channel = await client.get_entity(handle)

            async for msg in client.iter_messages(channel, limit=20):
                if msg.date.replace(tzinfo=None) < cutoff:
                    continue
                if not msg.message:
                    continue

                results.append({
                    'id': f"telegram-{handle}-{msg.id}",
                    'platform': 'telegram',
                    'handle': handle,
                    'region': ch['region'],
                    'confidence': ch['confidence'],
                    'tier': ch['tier'],
                    'text': msg.message,
                    'timestamp': msg.date.isoformat(),
                    'url': f"https://t.me/{handle}/{msg.id}",
                })

        except Exception as e:
            print(f'Error fetching @{handle}: {e}', file=sys.stderr)

    await client.disconnect()

    # Output JSON
    output = {
        'fetched_at': datetime.utcnow().isoformat(),
        'channel_count': len(channels),
        'post_count': len(results),
        'posts': sorted(results, key=lambda x: x['timestamp'], reverse=True)
    }

    print(json.dumps(output, indent=2))


if __name__ == '__main__':
    asyncio.run(main())
