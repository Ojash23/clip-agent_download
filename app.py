import os
import time
import random
import requests
from flask import Flask, request, render_template, jsonify
from youtube_transcript_api import (
    YouTubeTranscriptApi,
    TranscriptsDisabled,
    NoTranscriptFound,
    CouldNotRetrieveTranscript
)

app = Flask(__name__)

HF_TOKEN = os.getenv("HUGGINGFACE_API_TOKEN")
HF_MODEL = "cardiffnlp/twitter-roberta-base-sentiment"

PROXY_LIST = []

# --- Fetch free proxies from multiple sources ---
def fetch_free_proxies():
    app.logger.info("Fetching free proxy list...")
    proxy_api_urls = [
        "https://www.proxy-list.download/api/v1/get?type=https",
        "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt"
    ]
    proxies = []
    for api_url in proxy_api_urls:
        try:
            r = requests.get(api_url, timeout=10)
            if r.status_code == 200:
                proxies += [p.strip() for p in r.text.split("\n") if p.strip()]
        except Exception as e:
            app.logger.error(f"Error fetching from {api_url}: {e}")
    return list(set([f"http://{p}" if not p.startswith("http") else p for p in proxies]))

# --- Test and keep only fast proxies ---
def filter_fast_proxies(proxies, test_url="https://www.google.com", timeout=2):
    working = []
    for proxy in proxies:
        try:
            start = time.time()
            requests.get(test_url, proxies={"http": proxy, "https": proxy}, timeout=timeout)
            if (time.time() - start) <= timeout:
                working.append(proxy)
        except:
            continue
    app.logger.info(f"✅ {len(working)} fast proxies available after filtering.")
    return working

# --- Refresh proxies if needed ---
def refresh_proxies():
    global PROXY_LIST
    app.logger.warning("♻ Refreshing proxy list...")
    PROXY_LIST = filter_fast_proxies(fetch_free_proxies())
    if not PROXY_LIST:
        app.logger.error("❌ No working proxies found! Try again later.")
    else:
        app.logger.info(f"🔄 Proxy list refreshed with {len(PROXY_LIST)} working proxies.")

# --- Get random proxy + refresh if empty ---
def get_random_proxy():
    if not PROXY_LIST:
        refresh_proxies()
    if not PROXY_LIST:
        return None
    proxy = random.choice(PROXY_LIST)
    return {"http": proxy, "https": proxy}

# --- Extract YouTube video ID ---
def youtube_id(url):
    if "youtu.be" in url:
        return url.split("/")[-1]
    elif "watch?v=" in url:
        return url.split("watch?v=")[-1].split("&")[0]
    return None

# --- Hugging Face sentiment analysis ---
def analyze_text(text):
    headers = {"Authorization": f"Bearer {HF_TOKEN}"}
    payload = {"inputs": text}
    proxy_cfg = get_random_proxy()
    resp = requests.post(
        f"https://api-inference.huggingface.co/models/{HF_MODEL}",
        headers=headers, json=payload, timeout=30, proxies=proxy_cfg
    )
    return resp.json()

# --- Robust transcript fetching with retries + live proxy refresh ---
def get_transcript_with_retry(video_id, retries=7, base_delay=5):
    for attempt in range(retries):
        try:
            proxy_cfg = get_random_proxy()
            app.logger.info(f"Attempt {attempt+1}/{retries} - Using proxy: {proxy_cfg}")
            return YouTubeTranscriptApi.get_transcript(video_id, proxies=proxy_cfg)
        except TranscriptsDisabled:
            raise Exception("Transcripts are disabled for this video.")
        except NoTranscriptFound:
            raise Exception("No transcript found for this video.")
        except CouldNotRetrieveTranscript:
            wait = base_delay * (2 ** attempt) + random.uniform(0, 2)
            app.logger.warning(f"Rate limit. Retrying in {wait:.1f}s...")
            time.sleep(wait)
            if attempt == retries // 2:  # Midway — refresh proxies to avoid repeat failure
                refresh_proxies()
        except Exception as e:
            wait = base_delay * (2 ** attempt)
            app.logger.error(f"Error: {e}. Retrying in {wait}s...")
            time.sleep(wait)
            if attempt == retries // 2:
                refresh_proxies()
    raise Exception("Failed to retrieve transcript after retries & new proxy list.")

# --- Viral clip detection ---
def find_viral_clips(transcript, target_length):
    clips = []
    for chunk in transcript:
        text = chunk['text']
        analysis = analyze_text(text)
        score = float(analysis[0][0]['score']) if analysis and isinstance(analysis, list) else 0.5
        if score > 0.6:
            clips.append({
                "title": f"🔥 Viral Trading Tip #{len(clips)+1}",
                "start": chunk['start'],
                "end": min(chunk['start'] + target_length, transcript[-1]['start']),
                "hook": text[:80] + "...",
                "score": round(score * 100, 1)
            })
    clips.sort(key=lambda x: x['score'], reverse=True)
    return clips

# --- Routes ---
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/process", methods=["POST"])
def process():
    url = request.form["url"]
    platform = request.form["platform"]

    length_map = {"youtube": 60, "tiktok": 45, "instagram": 30}
    clip_length = length_map.get(platform, 60)

    vid_id = youtube_id(url)
    if not vid_id:
        return jsonify({"error": "Invalid YouTube URL"})

    try:
        transcript = get_transcript_with_retry(vid_id)
        clips = find_viral_clips(transcript, clip_length)
        return jsonify({"clips": clips})
    except Exception as e:
        return jsonify({"error": str(e)})

if __name__ == "__main__":
    refresh_proxies()  # Fetch & test proxies at startup
    app.run(host="0.0.0.0", port=5000)
