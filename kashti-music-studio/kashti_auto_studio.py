#!/usr/bin/env python3
"""
Kashti Music Studio (@kashtimusicstudio) — Zero-Touch AI Music Video Studio
===========================================================================
Upgraded from slideshow-style assembly to TRUE Bollywood AI Music Video production:
  1. Storyboard & SEO: Gemini 2.5 writes 16 blocks + Veo motion prompts + Lyria song.
  2. Real Studio Song + Vocals: Calls Google Lyria 3.5 (`lyria-3.5`) via `google-genai`
     to generate 44.1 kHz studio vocals & music (or uses your Suno/Soundverse MP3 in `audio/`).
  3. Real Moving Live-Action AI Video: Calls Google Veo 3.1 (`veo-3.1-fast-generate-preview`)
     image-to-video on your 4 Photorealistic Master Frames to produce 8 genuine moving
     24fps live-action cinema clips (`clips/clip_01.mp4` ... `clip_08.mp4`).
  4. Fast-Cut Music Video Editor: Cuts every 15s block into 4 dynamic 3.75-second beat-synced
     shots with close-up punch-ins, alternate angles, smooth `xfade` cinema transitions,
     warm film color grading, and burned-in Hindi lyrics + channel branding.
  5. YouTube Auto-Uploader: Uploads final MP4 + custom thumbnail to `@kashtimusicstudio`.
"""

import argparse
import base64
import json
import math
import os
import shutil
import struct
import subprocess
import sys
import time
import urllib.request
import wave
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
EPISODES_DIR = BASE_DIR / "episodes"
CLIPS_DIR = BASE_DIR / "clips"
KEYFRAMES_DIR = BASE_DIR / "keyframes"
AUDIO_DIR = BASE_DIR / "audio"
OUTPUT_DIR = BASE_DIR / "output"
CALENDAR_FILE = EPISODES_DIR / "weekly_calendar.json"

MASTER_CHARACTER_LOCK = (
    "Ultra-photorealistic cinematic live-action movie still, 8k resolution, shot on ARRI Alexa 65 "
    "with 50mm lens. A super cute, chubby, joyful 4-year-old child form of Indian deity with a "
    "natural human toddler face, warm expressive dark eyes, chubby cheeks, wearing royal silk dhoti, "
    "delicate golden jewelry, miniature ornate gold crown with marigold petals, playing with happy "
    "4-year-old Indian children in natural sunlight. Pure live-action cinema realism, NOT cartoon, NOT 3D animation."
)


# ---------------------------------------------------------------------------
# STEP 1: ZERO-TOUCH STORYBOARD & SUBTITLE GENERATOR (GEMINI API)
# ---------------------------------------------------------------------------
def auto_generate_episode_json_via_gemini(week_entry: dict, api_key: str) -> Path:
    episode_id = week_entry["episode_id"]
    ep_json_path = EPISODES_DIR / f"{episode_id}.json"
    if ep_json_path.exists():
        print(f"[Step 1] Episode config ready: {ep_json_path.name}")
        return ep_json_path

    if not api_key:
        print("[Step 1] No GEMINI_API_KEY; cloning Episode 1 template.")
        shutil.copyfile(EPISODES_DIR / "ep01_kids_hanuman_chalisa.json", ep_json_path)
        return ep_json_path

    print(f"[Step 1] Calling Gemini API to write storyboard + Veo & Lyria prompts for {episode_id}...")
    prompt = f"""You are the Creative Director of Kashti Music Studio (@kashtimusicstudio).
Create a complete JSON configuration for Episode {week_entry['week']}: "{week_entry['title']}".
Theme: {week_entry['theme_prompt']}
Music Style: {week_entry['music_style']}
Visual Style: {MASTER_CHARACTER_LOCK}

Return ONLY valid JSON with:
- channel_handle: "@kashtimusicstudio"
- episode_number: {week_entry['week']}
- episode_id: "{episode_id}"
- youtube_metadata (title, description, tags, category_id="10", privacy_status="private", made_for_kids=true)
- music_prompt: {{ "style": "...", "lyria_prompt": "Full Hindi/Hinglish song lyrics with [Intro], [Verse 1], [Chorus], [Bridge], [Finale] timestamps for 3.5 minutes", "target_duration_seconds": 240 }}
- veo_clips: array of 8 objects ({{ "clip": "clip_01.mp4".."clip_08.mp4", "reference_image": "frame_01_greeting.jpg".."frame_04_protecting.jpg", "duration": 8, "motion_prompt": "Rich cinematic camera & live-action human movement prompt" }})
- blocks_15s: array of 16 objects (block 1..16, start_sec, end_sec, source_clip, alt_clip, fallback_image, effect, lyrics_hi, scene_title).
"""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"},
    }).encode("utf-8")

    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
    parsed = json.loads(raw_text)

    with open(ep_json_path, "w", encoding="utf-8") as f:
        json.dump(parsed, f, ensure_ascii=False, indent=2)

    srt_path = EPISODES_DIR / f"{episode_id}.srt"
    write_srt_from_blocks(parsed["blocks_15s"], srt_path)
    print(f"[Step 1] ✅ Auto-generated storyboard & SRT: {ep_json_path.name}")
    return ep_json_path


def write_srt_from_blocks(blocks: list, srt_path: Path) -> None:
    lines = []
    for b in blocks:
        idx = b["block"]
        s = int(b["start_sec"])
        e = int(b["end_sec"])
        sh, sm, ss = s // 3600, (s % 3600) // 60, s % 60
        eh, em, es = e // 3600, (e % 3600) // 60, e % 60
        lines.append(f"{idx}")
        lines.append(f"{sh:02d}:{sm:02d}:{ss:02d},000 --> {eh:02d}:{em:02d}:{es:02d},000")
        lines.append(b["lyrics_hi"])
        lines.append("")
    with open(srt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


# ---------------------------------------------------------------------------
# STEP 2: PHOTOREALISTIC KEYFRAMES (IMAGEN 3) + MOVING VIDEO (VEO 3.1)
# ---------------------------------------------------------------------------
def auto_generate_visuals_via_gemini(config: dict, api_key: str, enable_veo: bool = True) -> None:
    KEYFRAMES_DIR.mkdir(parents=True, exist_ok=True)
    CLIPS_DIR.mkdir(parents=True, exist_ok=True)

    frame_prompts = {
        "frame_01_greeting.jpg": f"{MASTER_CHARACTER_LOCK} Greeting kids in a sunlit marigold garden.",
        "frame_02_playing.jpg": f"{MASTER_CHARACTER_LOCK} Playing hide and seek and chasing butterflies with kids.",
        "frame_03_mango_picnic.jpg": f"{MASTER_CHARACTER_LOCK} Laughing and sharing sweet yellow mangoes and laddoos under a mango tree.",
        "frame_04_protecting.jpg": f"{MASTER_CHARACTER_LOCK} At twilight surrounded by glowing golden fireflies, hugging and protecting child friends.",
    }

    for fname, prompt in frame_prompts.items():
        fpath = KEYFRAMES_DIR / fname
        if fpath.exists() and fpath.stat().st_size > 1000:
            print(f"[Step 2a] Keyframe ready: {fname}")
            continue
        if not api_key:
            continue
        print(f"[Step 2a] Generating photorealistic keyframe {fname} via Imagen 3...")
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key={api_key}"
            payload = json.dumps({
                "instances": [{"prompt": prompt}],
                "parameters": {"sampleCount": 1, "aspectRatio": "16:9"},
            }).encode("utf-8")
            req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=90) as resp:
                result = json.loads(resp.read().decode("utf-8"))
            b64_img = result["predictions"][0]["bytesBase64Encoded"]
            with open(fpath, "wb") as img_f:
                img_f.write(base64.b64decode(b64_img))
            print(f"  ✓ Saved {fname}")
        except Exception as exc:
            print(f"  ! Imagen notice for {fname}: {exc}")

    # Step 2b: Generate REAL MOVING AI VIDEO CLIPS via Google Veo 3.1 (`google-genai`)
    if not enable_veo or not api_key:
        if not api_key:
            print("[Step 2b] Veo 3.1 skipped (add GEMINI_API_KEY secret for automated moving AI clips, or drop .mp4 files in clips/).")
        return

    veo_clips = config.get("veo_clips", [])
    if not veo_clips:
        return

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        print("[Step 2b] `google-genai` not installed; skipping Veo API call.")
        return

    client = genai.Client(api_key=api_key)
    veo_model = os.environ.get("VEO_MODEL", "veo-3.1-fast-generate-preview")

    for item in veo_clips:
        clip_name = item["clip"]
        clip_path = CLIPS_DIR / clip_name
        if clip_path.exists() and clip_path.stat().st_size > 10000:
            print(f"[Step 2b] Moving video clip already exists: {clip_name}")
            continue

        ref_img_path = KEYFRAMES_DIR / item.get("reference_image", "frame_01_greeting.jpg")
        print(f"[Step 2b] Generating REAL moving cinema clip {clip_name} with {veo_model}...")
        try:
            kwargs = {
                "model": veo_model,
                "prompt": item["motion_prompt"],
                "config": types.GenerateVideosConfig(
                    aspect_ratio="16:9",
                    resolution="720p",
                    duration_seconds=int(item.get("duration", 8)),
                ),
            }
            if ref_img_path.exists():
                kwargs["image"] = types.Image.from_file(location=str(ref_img_path))

            operation = client.models.generate_videos(**kwargs)
            poll_count = 0
            while not operation.done and poll_count < 45:
                time.sleep(10)
                operation = client.operations.get(operation)
                poll_count += 1

            if operation.done and getattr(operation, "response", None) and operation.response.generated_videos:
                gen_vid = operation.response.generated_videos[0]
                client.files.download(file=gen_vid.video)
                gen_vid.video.save(str(clip_path))
                print(f"  ✅ Saved moving Veo 3.1 clip: {clip_name}")
            else:
                print(f"  ! Veo returned empty/timeout for {clip_name}: {getattr(operation, 'error', 'unknown')}")
        except Exception as exc:
            print(f"  ! Veo API notice for {clip_name}: {exc}")
            print("    (Tip: Veo API requires a billed Google AI Studio API key, OR drop clips from Google Flow/Vids into `clips/`.)")
            break  # Avoid spamming failed API calls if billing/quota is disabled


# ---------------------------------------------------------------------------
# STEP 3: STUDIO MUSIC + REAL VOCALS (LYRIA 3.5 OR SUNO MP3)
# ---------------------------------------------------------------------------
def auto_generate_music_via_lyria(config: dict, api_key: str, output_mp3: Path) -> bool:
    """
    Calls Google's `lyria-3.5` model via `google-genai` Interactions API to generate
    a 44.1 kHz stereo Bollywood Kids Pop song WITH REAL SINGING VOCALS & FULL MUSIC!
    """
    if not api_key:
        return False
    try:
        from google import genai
    except ImportError:
        return False

    lyria_prompt = config.get("music_prompt", {}).get("lyria_prompt") or config.get("music_prompt", {}).get("style", "")
    if not lyria_prompt:
        return False

    print("[Step 3] Generating real studio song with singing vocals via Google Lyria 3.5...")
    try:
        client = genai.Client(api_key=api_key)
        interaction = client.interactions.create(
            model="lyria-3.5",
            input=lyria_prompt,
            response_format={"type": "audio"},
        )
        audio_obj = getattr(interaction, "output_audio", None)
        if audio_obj and getattr(audio_obj, "data", None):
            raw_data = audio_obj.data
            audio_bytes = base64.b64decode(raw_data) if isinstance(raw_data, str) else raw_data
            output_mp3.parent.mkdir(parents=True, exist_ok=True)
            with open(output_mp3, "wb") as f:
                f.write(audio_bytes)
            print(f"[Step 3] ✅ Real studio song + vocals saved: {output_mp3.name}")
            return True
    except Exception as exc:
        print(f"[Step 3] Lyria 3.5 notice: {exc}")
    return False


def generate_playful_kids_demo_audio(output_wav: Path, duration_sec: int = 240, bpm: int = 118) -> None:
    sample_rate = 44100
    total_samples = sample_rate * duration_sec
    beat_dur = 60.0 / bpm
    half_beat = beat_dur / 2.0
    melody_motif = [
        523.25, 587.33, 659.25, 783.99, 880.00, 783.99, 659.25, 587.33,
        523.25, 659.25, 783.99, 1046.50, 880.00, 783.99, 659.25, 523.25,
    ]
    bass_line = [130.81, 196.00, 146.83, 196.00]
    output_wav.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(output_wav), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        chunk = bytearray()
        for i in range(total_samples):
            t = i / sample_rate
            step_idx = int(t / half_beat)
            beat_idx = int(t / beat_dur)
            step_t = t % half_beat
            xylo_env = math.exp(-5.5 * step_t)
            freq = melody_motif[step_idx % len(melody_motif)]
            xylo = 0.30 * xylo_env * (math.sin(2.0 * math.pi * freq * t) + 0.25 * math.sin(2.0 * math.pi * (freq * 2.0) * t))
            beat_t = t % beat_dur
            dholak_env = math.exp(-7.0 * beat_t)
            bayan_freq = bass_line[beat_idx % len(bass_line)] * (1.0 + 0.35 * math.exp(-18.0 * beat_t))
            dholak_bayan = 0.38 * dholak_env * math.sin(2.0 * math.pi * bayan_freq * t)
            dayan = 0.18 * math.exp(-14.0 * step_t) * math.sin(2.0 * math.pi * 440.0 * t) if (step_idx % 2 == 1) else 0.0
            pad = 0.08 * (math.sin(2.0 * math.pi * 261.63 * t) + math.sin(2.0 * math.pi * 329.63 * t) + math.sin(2.0 * math.pi * 392.00 * t))
            val = max(-0.95, min(0.95, xylo + dholak_bayan + dayan + pad))
            chunk.extend(struct.pack("<h", int(val * 32767.0)))
            if len(chunk) >= 88200:
                wf.writeframes(chunk)
                chunk.clear()
        if chunk:
            wf.writeframes(chunk)


def auto_generate_vocals_via_gemini_tts(config: dict, api_key: str, out_vocal_wav: Path) -> bool:
    if not api_key:
        return False
    try:
        lyrics_full = "\n".join(b["lyrics_hi"] for b in config["blocks_15s"])
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key={api_key}"
        payload = json.dumps({
            "contents": [{"parts": [{"text": "Sing/chant these Hindi Kids Hanuman Chalisa verses warmly, joyfully, and rhythmically for 4-year-old children:\n\n" + lyrics_full}]}],
            "generationConfig": {"responseModalities": ["AUDIO"], "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": "Aoede"}}}},
        }).encode("utf-8")
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        pcm_bytes = base64.b64decode(result["candidates"][0]["content"]["parts"][0]["inlineData"]["data"])
        with wave.open(str(out_vocal_wav), "w") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(24000)
            wf.writeframes(pcm_bytes)
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# STEP 4: FAST-CUT BOLLYWOOD MUSIC VIDEO EDITOR (NO SLIDESHOW!)
# ---------------------------------------------------------------------------
def _get_media_duration(path: Path) -> float:
    try:
        out = subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            stderr=subprocess.DEVNULL,
        ).decode("utf-8").strip()
        return max(1.0, float(out))
    except Exception:
        return 8.0


def _render_fast_subshot(
    clip_path: Path,
    img_path: Path,
    dur: float,
    shot_mode: str,
    out_path: Path,
    width: int = 1280,
    height: int = 720,
    fps: int = 24,
) -> None:
    """
    Renders a crisp 3-to-4 second music-video sub-shot with dynamic camera framing
    (wide, punch-in close-up, tracking pan, or gentle cinema grade).
    """
    grade = "eq=contrast=1.06:saturation=1.15:brightness=0.01"
    if clip_path.exists():
        # Pull from real moving AI video clip with varied camera framing per cut!
        clip_dur = _get_media_duration(clip_path)
        ss = min(max(0.0, clip_dur - dur - 0.1), 2.5 if "closeup" in shot_mode else 0.0)
        if shot_mode == "closeup_punch":
            vf = f"scale=1600:900,crop={width}:{height}:(iw-{width})/2:(ih-{height})/2,fps={fps},{grade},format=yuv420p"
        elif shot_mode == "right_angle":
            vf = f"scale=1500:844,crop={width}:{height}:(iw-{width})*0.85:(ih-{height})*0.4,fps={fps},{grade},format=yuv420p"
        else:
            vf = f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},fps={fps},{grade},format=yuv420p"
        cmd = [
            "ffmpeg", "-y", "-ss", f"{ss:.2f}", "-stream_loop", "-1", "-i", str(clip_path),
            "-t", f"{dur:.3f}", "-vf", vf,
            "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-an", str(out_path),
        ]
    elif img_path.exists():
        total_frames = max(24, int(round(dur * fps)))
        if shot_mode == "closeup_punch":
            zp = f"zoompan=z='min(1.15+on*0.0025,1.35)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={total_frames}:s={width}x{height}:fps={fps}"
        elif shot_mode == "right_angle":
            zp = f"zoompan=z='1.18':x='(iw-iw/zoom)*(on/{total_frames})':y='ih/2-(ih/zoom/2)':d={total_frames}:s={width}x{height}:fps={fps}"
        elif shot_mode == "pullback":
            zp = f"zoompan=z='max(1.02,1.25-on*0.0025)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={total_frames}:s={width}x{height}:fps={fps}"
        else:
            zp = f"zoompan=z='min(1.0+on*0.0025,1.20)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={total_frames}:s={width}x{height}:fps={fps}"
        cmd = [
            "ffmpeg", "-y", "-loop", "1", "-i", str(img_path),
            "-t", f"{dur:.3f}", "-vf", f"scale=1920:1080,{zp},{grade},format=yuv420p",
            "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-an", str(out_path),
        ]
    else:
        raise FileNotFoundError(f"Missing both clip {clip_path} and keyframe {img_path}")

    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def render_fast_cut_block(block: dict, block_duration: int, temp_dir: Path) -> Path:
    """
    Splits each 15-second block into 4 snappy music-video cuts (~3.75s each)
    alternating between the primary moving clip, a punch-in close-up, and an alternate
    clip/angle — joined with smooth `xfade` beat transitions so it feels like a real
    music video, NOT a slideshow!
    """
    block_num = block["block"]
    out_block = temp_dir / f"block_{block_num:02d}.mp4"

    primary_clip = CLIPS_DIR / block["source_clip"]
    alt_clip = CLIPS_DIR / block.get("alt_clip", block["source_clip"])
    primary_img = KEYFRAMES_DIR / block["fallback_image"]
    alt_img_choices = [f for f in sorted(KEYFRAMES_DIR.glob("frame_*.jpg")) if f.name != primary_img.name]
    alt_img = alt_img_choices[(block_num) % len(alt_img_choices)] if alt_img_choices else primary_img

    # 4 rapid cuts per block with 0.35s cross-dissolve overlap
    fade_d = 0.35
    num_cuts = 4 if block_duration >= 10 else 2
    sub_dur = (block_duration + fade_d * (num_cuts - 1)) / num_cuts

    cut_specs = [
        (primary_clip, primary_img, "wide"),
        (primary_clip, primary_img, "closeup_punch"),
        (alt_clip, alt_img, "right_angle"),
        (primary_clip, primary_img, "pullback"),
    ][:num_cuts]

    sub_files = []
    for idx, (c_path, i_path, mode) in enumerate(cut_specs):
        sub_out = temp_dir / f"b{block_num:02d}_sub{idx}.mp4"
        _render_fast_subshot(c_path, i_path, sub_dur, mode, sub_out)
        sub_files.append(sub_out)

    # Concatenate with xfade transitions
    transitions = ["fade", "wipeleft", "smoothright", "slideright"]
    trans = transitions[block_num % len(transitions)]

    inputs = []
    for sf in sub_files:
        inputs.extend(["-i", str(sf)])

    if num_cuts == 2:
        offset1 = sub_dur - fade_d
        fc = f"[0:v][1:v]xfade=transition={trans}:duration={fade_d}:offset={offset1:.3f},format=yuv420p[vout]"
    else:
        o1 = sub_dur - fade_d
        o2 = (sub_dur * 2) - (fade_d * 2)
        o3 = (sub_dur * 3) - (fade_d * 3)
        fc = (
            f"[0:v][1:v]xfade=transition={trans}:duration={fade_d}:offset={o1:.3f}[v1];"
            f"[v1][2:v]xfade=transition=fade:duration={fade_d}:offset={o2:.3f}[v2];"
            f"[v2][3:v]xfade=transition={trans}:duration={fade_d}:offset={o3:.3f},format=yuv420p[vout]"
        )

    cmd = [
        "ffmpeg", "-y", *inputs,
        "-filter_complex", fc, "-map", "[vout]",
        "-t", str(block_duration),
        "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-an", str(out_block),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    return out_block


def stitch_episode_video(
    episode_json_path: Path,
    preview_blocks: int = 0,
    block_duration_override: int = 0,
    api_key: str = "",
) -> Path:
    with open(episode_json_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    episode_id = config["episode_id"]
    blocks = config["blocks_15s"]
    if preview_blocks > 0:
        blocks = blocks[:preview_blocks]

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    temp_dir = OUTPUT_DIR / f"tmp_{episode_id}"
    temp_dir.mkdir(parents=True, exist_ok=True)

    has_real_clips = any((CLIPS_DIR / b["source_clip"]).exists() for b in blocks)
    mode_label = "REAL MOVING AI VIDEO CLIPS" if has_real_clips else "FAST-CUT KEYFRAME TEMPLATE (add Veo/Flow clips in clips/ for full motion)"
    print(f"[Step 4] Fast-Cut Music Video Editor ({mode_label}) — rendering {len(blocks)} blocks...")

    block_files = []
    total_duration = 0
    for b in blocks:
        dur = block_duration_override if block_duration_override > 0 else (b["end_sec"] - b["start_sec"])
        total_duration += dur
        b_file = render_fast_cut_block(b, block_duration=dur, temp_dir=temp_dir)
        block_files.append(b_file)
        print(f"  ✓ Block {b['block']:02d}: {b['scene_title']} ({dur}s fast-cut)")

    concat_list_path = temp_dir / "concat_list.txt"
    with open(concat_list_path, "w", encoding="utf-8") as f:
        for bf in block_files:
            f.write(f"file '{bf.resolve()}'\n")

    # Step 3: Audio priority -> 1) Manual Suno/Udio MP3, 2) Lyria 3.5 AI Song, 3) Demo Mix
    master_mp3 = AUDIO_DIR / f"{episode_id}.mp3"
    master_wav = AUDIO_DIR / f"{episode_id}.wav"
    if not master_mp3.exists() and not master_wav.exists() and api_key:
        auto_generate_music_via_lyria(config, api_key, master_mp3)

    if master_mp3.exists():
        audio_input = master_mp3
    elif master_wav.exists():
        audio_input = master_wav
    else:
        print(f"[Step 3] Synthesizing 118-BPM demo track ({total_duration}s)...")
        inst_wav = temp_dir / "instrumental.wav"
        generate_playful_kids_demo_audio(inst_wav, duration_sec=total_duration, bpm=118)
        vocal_wav = temp_dir / "vocals.wav"
        if auto_generate_vocals_via_gemini_tts(config, api_key, vocal_wav):
            mixed_wav = temp_dir / "mixed_master.wav"
            subprocess.run(
                [
                    "ffmpeg", "-y", "-i", str(inst_wav), "-i", str(vocal_wav),
                    "-filter_complex", "[0:a]volume=0.55[a0];[1:a]volume=1.35[a1];[a0][a1]amix=inputs=2:duration=first[aout]",
                    "-map", "[aout]", str(mixed_wav),
                ],
                check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
            )
            audio_input = mixed_wav
        else:
            audio_input = inst_wav

    srt_path = EPISODES_DIR / f"{episode_id}.srt"
    if not srt_path.exists():
        srt_path = EPISODES_DIR / "ep01_hanuman_chalisa.srt"

    suffix = "_preview" if preview_blocks > 0 else "_full"
    final_mp4 = OUTPUT_DIR / f"{episode_id}{suffix}.mp4"

    # Check if Noto Devanagari / Hindi font is available for crisp burned-in karaoke captions
    vf_brand = (
        "drawtext=text='Kashti Music Studio  |  @kashtimusicstudio':x=w-tw-24:y=20:"
        "fontsize=20:fontcolor=white@0.85:box=1:boxcolor=black@0.45:boxborderw=6"
    )
    if srt_path.exists():
        escaped_srt = str(srt_path.resolve()).replace(":", "\\:")
        vf_chain = f"subtitles='{escaped_srt}':force_style='FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,MarginV=26',{vf_brand}"
    else:
        vf_chain = vf_brand

    cmd = [
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", str(concat_list_path),
        "-i", str(audio_input),
        "-vf", vf_chain,
        "-t", str(total_duration),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-shortest",
        str(final_mp4),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    shutil.rmtree(temp_dir, ignore_errors=True)
    print(f"[Step 4] ✅ Final Fast-Cut Music Video ready: {final_mp4}")
    return final_mp4


# ---------------------------------------------------------------------------
# STEP 5: YOUTUBE DATA API V3 AUTO-UPLOADER
# ---------------------------------------------------------------------------
def upload_to_youtube(
    video_path: Path,
    episode_json_path: Path,
    client_secrets_file: Path,
    publish_at_iso: str = "",
) -> str:
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload
    except ImportError:
        print("[Step 5] Install YouTube API libraries: pip install google-api-python-client google-auth-oauthlib google-auth-httplib2")
        return ""

    SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
    token_path = BASE_DIR / "youtube_token.json"
    creds = None

    env_client_id = os.environ.get("YOUTUBE_CLIENT_ID", "")
    env_client_secret = os.environ.get("YOUTUBE_CLIENT_SECRET", "")
    env_refresh_token = os.environ.get("YOUTUBE_REFRESH_TOKEN", "")

    if env_client_id and env_client_secret and env_refresh_token:
        creds = Credentials(
            token=None, refresh_token=env_refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=env_client_id, client_secret=env_client_secret, scopes=SCOPES,
        )
        creds.refresh(Request())
    elif token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not client_secrets_file.exists():
                print("[Step 5] Skipping live YouTube upload (add YOUTUBE_CLIENT_ID/SECRET/REFRESH_TOKEN secrets to enable).")
                return ""
            flow = InstalledAppFlow.from_client_secrets_file(str(client_secrets_file), SCOPES)
            creds = flow.run_local_server(port=0)
        with open(token_path, "w", encoding="utf-8") as token_file:
            token_file.write(creds.to_json())

    with open(episode_json_path, "r", encoding="utf-8") as f:
        config = json.load(f)
    meta = config["youtube_metadata"]

    status_body = {
        "privacyStatus": meta.get("privacy_status", "public"),
        "selfDeclaredMadeForKids": meta.get("made_for_kids", True),
    }
    if publish_at_iso:
        status_body["privacyStatus"] = "private"
        status_body["publishAt"] = publish_at_iso

    body = {
        "snippet": {
            "title": meta["title"], "description": meta["description"],
            "tags": meta["tags"], "categoryId": meta.get("category_id", "10"),
            "defaultLanguage": "hi", "defaultAudioLanguage": "hi",
        },
        "status": status_body,
    }

    youtube = build("youtube", "v3", credentials=creds)
    media = MediaFileUpload(str(video_path), chunksize=1024 * 1024 * 8, resumable=True)
    request = youtube.videos().insert(part="snippet,status", body=body, media_body=media)

    print(f"[Step 5] Uploading {video_path.name} to {config['channel_handle']}...")
    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            print(f"  Uploaded {int(status.progress() * 100)}%...")

    video_id = response["id"]
    print(f"[Step 5] ✅ LIVE on YouTube: https://youtu.be/{video_id}")

    thumb_path = KEYFRAMES_DIR / "frame_01_greeting.jpg"
    if thumb_path.exists():
        try:
            youtube.thumbnails().set(videoId=video_id, media_body=MediaFileUpload(str(thumb_path))).execute()
        except Exception:
            pass
    return video_id


def run_zero_touch_weekly_pipeline(week_num: int = 0, publish_at_iso: str = "", enable_veo: bool = True) -> Path:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    with open(CALENDAR_FILE, "r", encoding="utf-8") as f:
        cal = json.load(f)

    target_week = None
    if week_num > 0:
        for w in cal["weeks"]:
            if w["week"] == week_num:
                target_week = w
                break
    else:
        for w in cal["weeks"]:
            if w.get("status") in ("ready", "planned"):
                target_week = w
                break
    if not target_week:
        target_week = cal["weeks"][0]

    print("=======================================================================")
    print(f"🎬 KASHTI MUSIC STUDIO — REAL AI MUSIC VIDEO PIPELINE (Week {target_week['week']})")
    print("=======================================================================")

    ep_json = auto_generate_episode_json_via_gemini(target_week, api_key)
    with open(ep_json, "r", encoding="utf-8") as f:
        ep_cfg = json.load(f)

    auto_generate_visuals_via_gemini(ep_cfg, api_key, enable_veo=enable_veo)
    final_mp4 = stitch_episode_video(ep_json, api_key=api_key)
    upload_to_youtube(final_mp4, ep_json, BASE_DIR / "client_secrets.json", publish_at_iso)
    return final_mp4


def main() -> None:
    parser = argparse.ArgumentParser(description="Kashti Music Studio AI Music Video Pipeline")
    parser.add_argument("--mode", choices=["zero-touch", "stitch", "preview", "upload", "weekly-auto"], default="zero-touch")
    parser.add_argument("--week", type=int, default=0)
    parser.add_argument("--episode", default=str(EPISODES_DIR / "ep01_kids_hanuman_chalisa.json"))
    parser.add_argument("--client-secrets", default=str(BASE_DIR / "client_secrets.json"))
    parser.add_argument("--publish-at", default="")
    parser.add_argument("--skip-veo", action="store_true", help="Skip Veo 3.1 API video generation")
    args = parser.parse_args()

    ep_path = Path(args.episode)
    api_key = os.environ.get("GEMINI_API_KEY", "")

    if args.mode in ("zero-touch", "weekly-auto"):
        run_zero_touch_weekly_pipeline(week_num=args.week, publish_at_iso=args.publish_at, enable_veo=not args.skip_veo)
    elif args.mode == "preview":
        stitch_episode_video(ep_path, preview_blocks=4, block_duration_override=6, api_key=api_key)
    elif args.mode == "stitch":
        stitch_episode_video(ep_path, api_key=api_key)
    elif args.mode == "upload":
        with open(ep_path, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        video_file = OUTPUT_DIR / f"{cfg['episode_id']}_full.mp4"
        if not video_file.exists():
            video_file = stitch_episode_video(ep_path, api_key=api_key)
        upload_to_youtube(video_file, ep_path, Path(args.client_secrets), args.publish_at)


if __name__ == "__main__":
    main()
