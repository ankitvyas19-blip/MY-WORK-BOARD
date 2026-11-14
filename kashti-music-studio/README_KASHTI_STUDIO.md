# Kashti Music Studio (`@kashtimusicstudio`) — Weekly Automation Pipeline

यह फ़ोल्डर आपके YouTube चैनल **Kashti Music Studio (`https://www.youtube.com/@kashtimusicstudio`)** पर हर हफ्ते 1 नया म्यूजिक वीडियो ऑटोमेटिक बनाने और अपलोड करने का पूरा सिस्टम है।

---

## फ़ोल्डर स्ट्रक्चर (Directory Structure)

- [`kashti_auto_studio.py`](file:///home/antigravity/ankitvyas19-blip/MY-WORK-BOARD/kashti-music-studio/kashti_auto_studio.py) — मुख्य Python ऑटोमेशन इंजन (FFmpeg 16-Block Video Stitcher + Subtitle Burner + YouTube Data API v3 Auto-Uploader)।
- [`episodes/ep01_kids_hanuman_chalisa.json`](file:///home/antigravity/ankitvyas19-blip/MY-WORK-BOARD/kashti-music-studio/episodes/ep01_kids_hanuman_chalisa.json) — Episode 1 ("मेरा दोस्त बाल-हनुमान") का 16×15 सेकंड का पूरा सीन कॉन्फ़िगरेशन और YouTube SEO मेटाडेटा।
- [`episodes/ep01_hanuman_chalisa.srt`](file:///home/antigravity/ankitvyas19-blip/MY-WORK-BOARD/kashti-music-studio/episodes/ep01_hanuman_chalisa.srt) — पूरे 4 मिनट के गाने की सिंक की हुई हिंदी सबटाइटल फ़ाइल।
- `keyframes/` — 4 Master Photorealistic Live-Action Reference Images (`frame_01_greeting.jpg` से `frame_04_protecting.jpg`)।
- `clips/` — जब आप Gemini Pro / Google Vids से 8 छोटे वीडियो क्लिप्स डाउनलोड करें, तो उन्हें `clip_01.mp4` से `clip_08.mp4` नाम देकर यहाँ रखें।
- `audio/` — Suno / Udio से जनरेट किया गया 4-मिनट का गाना `ep01_kids_hanuman_chalisa.mp3` नाम से यहाँ रखें।
- `output/` — तैयार होने वाला फाइनल Full HD MP4 वीडियो यहाँ सेव होता है।

---

## हर हफ्ते 1 वीडियो बनाने के 3 आसान स्टेप्स (Weekly Workflow)

### Step 1: प्रिव्यू या पूरा 4-मिनट का वीडियो ऑटोमेटिक स्टिच करें
अगर आपके पास अभी सिर्फ 4 Master Reference Images हैं, तब भी यह स्क्रिप्ट उन पर सिनेमैटिक **Ken Burns Zoom/Pan Motion**, **Playful Audio**, और **Hindi Subtitles** लगाकर वीडियो तैयार कर देती है:

```bash
# 20-सेकंड का फास्ट टेस्ट प्रिव्यू वीडियो बनाने के लिए:
python3 kashti-music-studio/kashti_auto_studio.py --mode preview

# पूरा 4-मिनट (16 x 15s blocks) का वीडियो स्टिच करने के लिए:
python3 kashti-music-studio/kashti_auto_studio.py --mode stitch
```

### Step 2: Google Vids के साथ इस्तेमाल (Optional Hybrid Way)
1. हमारे द्वारा बनाए गए **Google Doc (`Episode 1 Google Vids Production Kit`)** और **Google Sheet (`Weekly Content Calendar`)** को खोलें।
2. Google Vids में `Create with Gemini` या `16 Scene Timeline` खोलकर प्रत्येक 15-सेकंड के ब्लॉक में `keyframes/` की इमेजेज़ और `audio/` का ट्रैक डालें।

### Step 3: YouTube पर ऑटोमेटिक अपलोड और शेड्यूल करें (`@kashtimusicstudio`)
1. Google Cloud Console में **YouTube Data API v3** ऑन करें और OAuth 2.0 `client_secrets.json` डाउनलोड करके `kashti-music-studio/client_secrets.json` पर रखें।
2. पहली बार चलाते समय यह एक बार ब्राउज़र में लॉगिन मांगेगा और फिर `youtube_token.json` सेव कर लेगा। उसके बाद हर हफ्ते बिना पूछे ऑटोमेटिक अपलोड होगा:

```bash
# स्टिच + सीधे YouTube पर शेड्यूल/अपलोड करने के लिए:
python3 kashti-music-studio/kashti_auto_studio.py --mode weekly-auto --publish-at "2026-11-20T12:30:00Z"
```
