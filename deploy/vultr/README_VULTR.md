# Vultr Deployment Guide — Existing Mumbai VM (`65.20.71.124`)

This setup reuses your **existing Mumbai Vultr VM (`65.20.71.124`)** under `/opt/my-work-board` on port **`:8083`** — **without creating any new Vultr VM** and **without touching SCALPER Radar 2 (`:8081`) or Radar 1 (`:8082`)**.

## Port Layout on `65.20.71.124`
| Port | Service | Path |
|---|---|---|
| `:8081` | SCALPER Radar 2 (existing, untouched) | `/opt/...` |
| `:8082` | SCALPER Radar 1 (existing, untouched) | `/opt/...` |
| `:8083` | **MY-WORK-BOARD (24×7)** | `/opt/my-work-board` |
| Timer | **Kashti Music Studio** (Every Friday 12:00 PM IST) | `/opt/my-work-board/kashti-music-studio` |

---

## 1-Line Deploy on `65.20.71.124`

SSH into your Mumbai Vultr VM (or open the Vultr Web Console for `65.20.71.124`) and run:

```bash
curl -fsSL https://raw.githubusercontent.com/ankitvyas19-blip/MY-WORK-BOARD/main/deploy/vultr/deploy_vultr.sh | sudo bash
```

*(If `:8083` is already used by something else on your VM, pick `:8084` with `curl -fsSL https://raw.githubusercontent.com/ankitvyas19-blip/MY-WORK-BOARD/main/deploy/vultr/deploy_vultr.sh | sudo APP_PORT=8084 bash`.)*

---

## Configure Secrets (Once)

Edit `/opt/my-work-board/.env` on `65.20.71.124` and paste your keys:

```bash
sudo nano /opt/my-work-board/.env
```

Fill in:
- `GEMINI_API_KEY`
- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`

Then restart the web app (optional after `.env` edit):

```bash
sudo systemctl restart my-work-board.service
```

---

## Useful Commands on `65.20.71.124`

```bash
# Check 24x7 web app & weekly Friday timer status
systemctl status my-work-board.service kashti-studio.timer
systemctl list-timers kashti-studio.timer

# Trigger Kashti Music Studio immediately (Episode 1 preview test — 24s fast test)
/opt/my-work-board/kashti-music-studio/.venv/bin/python3 \
  /opt/my-work-board/kashti-music-studio/kashti_auto_studio.py --mode preview

# Trigger full zero-touch weekly pipeline right now
sudo systemctl start kashti-studio.service
journalctl -u kashti-studio.service -f
```
