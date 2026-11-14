#!/usr/bin/env python3
"""
One-Time Setup Helper for Kashti Music Studio (@kashtimusicstudio)
==================================================================
Run this ONCE on your computer after downloading `client_secrets.json` from
Google Cloud Console (YouTube Data API v3). It opens a browser login once and
prints out the 3 GitHub Secrets (`YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`,
`YOUTUBE_REFRESH_TOKEN`) needed for 100% Zero-Touch Weekly GitHub Actions uploads!
"""

import json
from pathlib import Path
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
SECRETS_FILE = Path(__file__).resolve().parent / "client_secrets.json"


def main() -> None:
    if not SECRETS_FILE.exists():
        print(f"Place your Google Cloud OAuth 2.0 JSON at: {SECRETS_FILE}")
        return

    flow = InstalledAppFlow.from_client_secrets_file(str(SECRETS_FILE), SCOPES)
    creds = flow.run_local_server(port=0, access_type="offline", prompt="consent")
    data = json.loads(creds.to_json())

    print("\n==================================================================")
    print("✅ COPY THESE 3 SECRETS INTO YOUR GITHUB REPOSITORY SECRETS ONCE:")
    print("==================================================================")
    print(f"YOUTUBE_CLIENT_ID     = {data.get('client_id')}")
    print(f"YOUTUBE_CLIENT_SECRET = {data.get('client_secret')}")
    print(f"YOUTUBE_REFRESH_TOKEN = {data.get('refresh_token')}")
    print("==================================================================\n")


if __name__ == "__main__":
    main()
