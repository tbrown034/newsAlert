#!/usr/bin/env python3
"""
Telegram Channel Reader Test
============================

Tests reading from public Telegram channels using Telethon.

SETUP:
1. pip install telethon
2. Go to https://my.telegram.org
3. Log in with your phone number
4. Go to "API development tools"
5. Create an app (name doesn't matter)
6. Copy your api_id and api_hash
7. Set them as environment variables or edit below

FIRST RUN:
- You'll be prompted for your phone number
- Then a code sent to your Telegram app
- This creates a session file so you don't need to re-auth

USAGE:
python scripts/telegram_test.py
"""

import asyncio
import os
import sys
from datetime import datetime, timedelta

# You'll need to set these - get them from https://my.telegram.org
API_ID = os.environ.get('TELEGRAM_API_ID', '')  # Your api_id (integer)
API_HASH = os.environ.get('TELEGRAM_API_HASH', '')  # Your api_hash (string)
PHONE = os.environ.get('TELEGRAM_PHONE', '')  # Your phone with country code
CODE = os.environ.get('TELEGRAM_CODE', '')  # Verification code from Telegram app

# High-value OSINT channels from sources.md
TEST_CHANNELS = [
    'DeepStateUA',      # Ukraine frontline maps (very high frequency)
    'IranIntl_En',      # Iran International English (high frequency)
    'AmwajMedia',       # Gulf/Iran policy (medium frequency)
]

async def main():
    if not API_ID or not API_HASH:
        print("""
╔════════════════════════════════════════════════════════════════╗
║                    TELEGRAM API SETUP                          ║
╠════════════════════════════════════════════════════════════════╣
║ 1. Go to https://my.telegram.org                               ║
║ 2. Log in with your phone number                               ║
║ 3. Click "API development tools"                               ║
║ 4. Create an app (any name is fine)                            ║
║ 5. Copy your api_id and api_hash                               ║
║                                                                ║
║ Then either:                                                   ║
║   - Set env vars: TELEGRAM_API_ID and TELEGRAM_API_HASH        ║
║   - Or edit this script directly                               ║
╚════════════════════════════════════════════════════════════════╝
        """)
        return

    try:
        from telethon import TelegramClient
        from telethon.tl.functions.messages import GetHistoryRequest
    except ImportError:
        print("Install telethon first: pip install telethon")
        return

    # Create client - session file saves your auth
    client = TelegramClient('pulse_session', int(API_ID), API_HASH)
    await client.connect()

    # Check if we need to authenticate
    if not await client.is_user_authorized():
        if not PHONE:
            print("First run - need your phone number.")
            print("Set TELEGRAM_PHONE=+1234567890 and run again.")
            print("Example: TELEGRAM_PHONE=+12025551234 python3 scripts/telegram_test.py")
            await client.disconnect()
            return

        if not CODE:
            # Request the code
            sent = await client.send_code_request(PHONE)
            # Save the hash for next run
            with open('pulse_code_hash.txt', 'w') as f:
                f.write(sent.phone_code_hash)
            print(f"✓ Code sent to {PHONE}")
            print("")
            print("Check your Telegram app for the verification code.")
            print("Then run again with TELEGRAM_CODE=12345")
            print("")
            print(f"Example: TELEGRAM_PHONE={PHONE} TELEGRAM_CODE=12345 python3 scripts/telegram_test.py")
            await client.disconnect()
            return
        else:
            # Sign in with the code
            try:
                # Load the hash from previous run
                with open('pulse_code_hash.txt', 'r') as f:
                    phone_code_hash = f.read().strip()
                await client.sign_in(PHONE, CODE, phone_code_hash=phone_code_hash)
                print("✓ Authenticated successfully!")
                # Clean up hash file
                import os as os_module
                os_module.remove('pulse_code_hash.txt')
            except Exception as e:
                print(f"Auth error: {e}")
                await client.disconnect()
                return

    print("✓ Connected to Telegram\n")

    # Test each channel
    for channel_name in TEST_CHANNELS:
        try:
            print(f"{'='*60}")
            print(f"Channel: @{channel_name}")
            print(f"{'='*60}")

            # Get the channel entity
            channel = await client.get_entity(channel_name)

            # Get recent messages (last 24 hours, max 10)
            cutoff = datetime.utcnow() - timedelta(hours=24)
            messages = []

            async for message in client.iter_messages(channel, limit=10):
                if message.date.replace(tzinfo=None) > cutoff:
                    messages.append(message)

            print(f"Messages in last 24h: {len(messages)}")
            print()

            # Show last 3 messages
            for msg in messages[:3]:
                timestamp = msg.date.strftime('%Y-%m-%d %H:%M UTC')
                text = msg.text[:200] + '...' if msg.text and len(msg.text) > 200 else msg.text
                print(f"[{timestamp}]")
                print(f"{text or '(media/no text)'}")
                print()

        except Exception as e:
            print(f"Error fetching @{channel_name}: {e}")
            print()

    await client.disconnect()
    print("\n✓ Test complete")


if __name__ == '__main__':
    asyncio.run(main())
