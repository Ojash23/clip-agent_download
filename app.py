import os
import re
import requests
import subprocess
import hashlib
from dotenv import load_dotenv
from flask import Flask, request, render_template, jsonify, send_file
from werkzeug.utils import secure_filename

load_dotenv()

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max file size
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['OUTPUT_FOLDER'] = 'output_clips'

# Create directories if they don't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)

HF_TOKEN = os.getenv("HUGGINGFACE_API_TOKEN")
HF_MODEL = "cardiffnlp/twitter-roberta-base-sentiment"

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})

def youtube_id(url):
    if "youtu.be" in url:
        return url.split("/")[-1].split("?")[0]
    elif "watch?v=" in url:
        return url.split("watch?v=")[-1].split("&")[0]
    return None

def seconds_to_time(seconds):
    """Convert seconds to MM:SS or HH:MM:SS format"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes:02d}:{secs:02d}"

def time_to_seconds(time_str):
    """Convert HH:MM:SS,mmm or MM:SS,mmm to seconds"""
    # Remove milliseconds if present
    time_str = time_str.split(',')[0]
    
    parts = time_str.split(':')
    if len(parts) == 3:  # HH:MM:SS
        hours, minutes, seconds = map(int, parts)
        return hours * 3600 + minutes * 60 + seconds
    elif len(parts) == 2:  # MM:SS
        minutes, seconds = map(int, parts)
        return minutes * 60 + seconds
    else:
        return 0

def parse_srt_file(file_path):
    """Parse .srt file and return transcript-like data"""
    transcript = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        # Split by subtitle blocks (separated by double newlines)
        blocks = re.split(r'\n\s*\n', content.strip())
        
        for block in blocks:
            lines = block.strip().split('\n')
            if len(lines) >= 3:
                # Skip subtitle number (first line)
                # Second line is timestamp
                timestamp_line = lines[1]
                # Remaining lines are text
                text = ' '.join(lines[2:])
                
                # Parse timestamp (format: 00:00:20,000 --> 00:00:24,400)
                if ' --> ' in timestamp_line:
                    start_time, end_time = timestamp_line.split(' --> ')
                    start_seconds = time_to_seconds(start_time.strip())
                    
                    # Clean text
                    text = re.sub(r'<[^>]+>', '', text)  # Remove HTML tags
                    text = text.strip()
                    
                    if text and len(text) > 5:  # Only include meaningful text
                        transcript.append({
                            'start': start_seconds,
                            'text': text
                        })
    
    except Exception as e:
        print(f"Error parsing SRT file: {e}")
        return []
    
    return transcript

def get_transcript_safe(video_id):
    """Safely get transcript with proper error handling"""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        return transcript, None
    except Exception as e:
        error_msg = str(e)
        if "no element found" in error_msg:
            return None, "No captions available for this video"
        elif "TranscriptsDisabled" in error_msg:
            return None, "Transcripts are disabled for this video"
        elif "NoTranscriptFound" in error_msg:
            return None, "No transcript found for this video"
        else:
            return None, f"Transcript error: {error_msg}"

def analyze_text(text):
    """Analyze text sentiment using Hugging Face API"""
    headers = {"Authorization": f"Bearer {HF_TOKEN}"}
    payload = {"inputs": text}
    try:
        resp = requests.post(
            f"https://api-inference.huggingface.co/models/{HF_MODEL}",
            headers=headers, json=payload, timeout=10
        )
        if resp.status_code == 200:
            result = resp.json()
            # Handle different response formats from Hugging Face API
            if isinstance(result, list) and len(result) > 0:
                # If it's a nested list [[{...}]], get the inner list
                if isinstance(result[0], list):
                    scores = result
                else:
                    scores = result
                
                # Find the highest scoring sentiment
                if len(scores) > 0 and isinstance(scores[0], dict):
                    best_result = max(scores, key=lambda x: x.get('score', 0))
                    return best_result
                else:
                    return {"label": "POSITIVE", "score": 0.7}
            else:
                return {"label": "POSITIVE", "score": 0.7}
        else:
            print(f"HF API error: {resp.status_code} - {resp.text}")
            return {"label": "POSITIVE", "score": 0.7}
    except Exception as e:
        print(f"Analyze text error: {e}")
        return {"label": "POSITIVE", "score": 0.7}

def get_viral_triggers(text, score):
    """Determine viral triggers based on content analysis"""
    triggers = []
    
    # Pattern Interrupt - strong opinions, contrarian views
    if any(word in text.lower() for word in ['never', 'always', 'wrong', 'mistake', 'secret', 'truth']):
        triggers.append("Pattern Interrupt")
    
    # Curiosity Gap - questions, incomplete info
    if any(word in text.lower() for word in ['why', 'how', 'what', '?', 'here\'s', 'this is']):
        triggers.append("Curiosity Gap")
    
    # Emotional Resonance - high sentiment score
    if score > 0.7:
        triggers.append("Emotional Resonance")
    
    # Authority - experience, credentials
    if any(word in text.lower() for word in ['years', 'experience', 'professional', 'expert', 'I', 'my']):
        triggers.append("Authority")
    
    # Relatability - common experiences
    if any(word in text.lower() for word in ['most people', 'everyone', 'you', 'we', 'traders']):
        triggers.append("Relatability")
    
    # Social Currency - shareable insights
    if any(word in text.lower() for word in ['tip', 'strategy', 'learn', 'important', 'key']):
        triggers.append("Social Currency")
    
    # Transformation Arc - before/after
    if any(word in text.lower() for word in ['changed', 'improved', 'learned', 'realized', 'discovered']):
        triggers.append("Transformation Arc")
    
    # Default triggers if none found
    if not triggers:
        triggers = ["Authority", "Relatability"]
    
    return triggers[:3]  # Limit to top 3

def create_viral_title(text, clip_id, source_type):
    """Generate catchy viral titles based on content"""
    text_lower = text.lower()
    
    # Trading-specific titles
    if any(word in text_lower for word in ['risk', 'management', 'loss']):
        titles = [
            f"🚨 Risk Management Secret #{clip_id}",
            f"💰 How I Stopped Losing Money #{clip_id}",
            f"⚠️ Trading Risk Reality Check #{clip_id}"
        ]
    elif any(word in text_lower for word in ['strategy', 'setup', 'trade']):
        titles = [
            f"🎯 Winning Strategy #{clip_id}",
            f"🔥 Trading Setup That Changed Everything #{clip_id}",
            f"💡 Pro Trading Strategy #{clip_id}"
        ]
    elif any(word in text_lower for word in ['psychology', 'mindset', 'emotion']):
        titles = [
            f"🧠 Trading Psychology Breakthrough #{clip_id}",
            f"💭 Mindset That Makes Money #{clip_id}",
            f"😤 Emotional Trading Trap #{clip_id}"
        ]
    elif any(word in text_lower for word in ['money', 'profit', 'loss']):
        titles = [
            f"💵 How I Make Consistent Profits #{clip_id}",
            f"📈 Money Management Secret #{clip_id}",
            f"💸 Why You're Losing Money #{clip_id}"
        ]
    else:
        # Generic viral titles
        titles = [
            f"🔥 Game-Changing Insight #{clip_id}",
            f"💡 What They Don't Tell You #{clip_id}",
            f"⚡ Key Learning #{clip_id}",
            f"🎯 Essential Knowledge #{clip_id}"
        ]
    
    # Pick title based on clip ID for consistency
    return titles[clip_id % len(titles)]

def create_hook_text(text):
    """Create engaging hook text for captions"""
    # Shorten and add intrigue
    if len(text) > 80:
        # Find a good breaking point
        truncated = text[:80]
        last_space = truncated.rfind(' ')
        if last_space > 50:
            hook = text[:last_space] + "..."
        else:
            hook = text[:80] + "..."
    else:
        hook = text
    
    # Add engagement elements
    if not any(punct in hook for punct in ['!', '?', '...']):
        if 'how' in hook.lower() or 'why' in hook.lower():
            hook = hook.rstrip('.') + "?"
        else:
            hook = hook.rstrip('.') + "!"
    
    return hook

def sanitize_filename(filename):
    """Sanitize filename for safe file system usage"""
    # Remove or replace invalid characters
    filename = re.sub(r'[<>:"/\\|?*]', '', filename)
    filename = re.sub(r'[^\w\s-]', '', filename)
    filename = re.sub(r'\s+', '_', filename.strip())
    return filename[:50]  # Limit length

def download_youtube_segment(video_url, start_time, end_time, quality, output_path):
    """Download specific video segment using yt-dlp"""
    try:
        # Convert to yt-dlp format if needed
        download_section = f"*{start_time}-{end_time}"
        
        cmd = [
            'yt-dlp',
            '--download-sections', download_section,
            '-f', quality,
            '-o', output_path,
            '--no-playlist',
            video_url
        ]
        
        print(f"Running: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        
        if result.returncode == 0 and os.path.exists(output_path):
            return True, "Success"
        else:
            return False, result.stderr
            
    except subprocess.TimeoutExpired:
        return False, "Download timeout"
    except Exception as e:
        return False, str(e)

def analyze_transcript_data(transcript, source_type="transcript", video_url=None):
    """Enhanced function to analyze transcript data with full viral details"""
    clips = []
    
    if not transcript or len(transcript) < 3:
        return clips
    
    # Sample transcript chunks intelligently
    total_chunks = len(transcript)
    step = max(1, total_chunks // 15)  # Aim for ~15 clips
    
    clip_id = 1
    for i in range(0, total_chunks, step):
        if clip_id > 15:
            break
            
        chunk = transcript[i]
        text = chunk.get('text', '').strip()
        
        # Skip very short or empty text
        if len(text) < 20:
            continue
        
        # Get timestamp
        start_seconds = chunk.get('start', 0)
        
        # Analyze sentiment
        analysis = analyze_text(text)
        score = 0.5
        
        # Handle the analysis result properly
        if analysis and isinstance(analysis, dict):
            score = analysis.get('score', 0.5)
        
        # Filter for quality clips
        if score > 0.3 or any(word in text.lower() for word in ['trading', 'money', 'profit', 'loss', 'strategy', 'market', 'invest', 'risk', 'trade', 'price', 'important', 'key', 'learn', 'how', 'why', 'what']):
            
            clip_duration = 30 if source_type.lower() == "srt" else 45
            end_seconds = start_seconds + clip_duration
            
            start_time = seconds_to_time(start_seconds)
            end_time = seconds_to_time(end_seconds)
            
            # Determine category with better logic
            category = "General Content"
            if any(word in text.lower() for word in ['trading', 'trade', 'trader', 'market', 'profit', 'strategy']):
                category = "Trading Knowledge"
            elif any(word in text.lower() for word in ['psychology', 'mindset', 'emotion', 'feel', 'think', 'mental']):
                category = "Trading Psychology"
            elif any(word in text.lower() for word in ['risk', 'management', 'loss', 'money', 'capital']):
                category = "Risk Management"
            
            # Get viral triggers
            triggers = get_viral_triggers(text, score)
            
            # Create viral title
            title = create_viral_title(text, clip_id, source_type)
            
            # Create hook text
            hook_text = create_hook_text(text)
            
            # Calculate virality score (enhanced)
            base_score = round(score * 100)
            length_bonus = min(10, len(text) // 20)  # Bonus for longer content
            keyword_bonus = len([w for w in ['trading', 'money', 'profit', 'strategy'] if w in text.lower()]) * 5
            virality_score = min(100, base_score + length_bonus + keyword_bonus)
            
            clip_data = {
                "id": clip_id,
                "title": title,
                "startTime": start_time,
                "endTime": end_time,
                "duration": f"{clip_duration}s",
                "hookText": hook_text,
                "fullText": text,  # Store full text for preview
                "viralityScore": virality_score,
                "triggers": triggers,
                "category": category,
                "ffmpegCommand": f"ffmpeg -ss {start_time} -to {end_time} -i input.mp4 -c copy clip_{clip_id}.mp4",
                "sourceType": source_type,
                "startSeconds": start_seconds,
                "endSeconds": end_seconds
            }
            
            # Add video URL for YouTube clips
            if video_url and source_type.lower() == "youtube":
                clip_data["previewUrl"] = f"{video_url}&t={int(start_seconds)}"
                clip_data["videoUrl"] = video_url
            elif video_url and source_type.lower() == "srt":
                clip_data["videoUrl"] = video_url
            
            clips.append(clip_data)
            clip_id += 1
    
    # Sort by virality score
    clips.sort(key=lambda x: x["viralityScore"], reverse=True)
    return clips

@app.route("/api/analyze", methods=["POST"])
def analyze():
    try:
        data = request.get_json()
        video_url = data.get("videoUrl")
        platform = data.get("platform", "YouTube Shorts")
        
        if not video_url:
            return jsonify({"success": False, "error": "Missing videoUrl"}), 400
            
        vid_id = youtube_id(video_url)
        if not vid_id:
            return jsonify({"success": False, "error": "Invalid YouTube URL"}), 400
        
        # Try to get real transcript
        transcript, error = get_transcript_safe(vid_id)
        
        if transcript and len(transcript) > 10:
            print(f"✅ Got transcript with {len(transcript)} chunks for video {vid_id}")
            clips = analyze_transcript_data(transcript, "YouTube", video_url)
        else:
            print(f"❌ No transcript for video {vid_id}, error: {error}")
            # Generate unique mock clips based on video ID
            clips = []
            import hashlib
            seed = int(hashlib.md5(vid_id.encode()).hexdigest()[:8], 16)
            
            num_clips = 6 + (seed % 5)
            for i in range(num_clips):
                base_start = (seed + i * 1000) % 3600
                start_seconds = base_start + (i * 45)
                end_seconds = start_seconds + 30
                
                start_time = seconds_to_time(start_seconds)
                end_time = seconds_to_time(end_seconds)
                
                clips.append({
                    "id": i + 1,
                    "title": f"🔥 Sample Clip #{i+1}",
                    "startTime": start_time,
                    "endTime": end_time,
                    "duration": "30s",
                    "hookText": f"No transcript available (Error: {error}). Manual review needed.",
                    "fullText": f"No transcript available (Error: {error}). Manual review needed for {start_time} segment.",
                    "viralityScore": 50 + ((seed + i * 10) % 40),
                    "triggers": ["Manual Review", "No Transcript"],
                    "category": "Unknown Content",
                    "ffmpegCommand": f"ffmpeg -ss {start_time} -to {end_time} -i input.mp4 -c copy clip_{i+1}.mp4",
                    "sourceType": "YouTube",
                    "videoUrl": video_url
                })
        
        return jsonify({
            "success": True,
            "clips": clips,
            "canDownloadClips": True,  # Enable direct downloads
            "summary": {
                "totalClips": len(clips),
                "averageScore": sum(clip["viralityScore"] for clip in clips) / len(clips) if clips else 0,
                "topCategory": clips[0]["category"] if clips else "Content Analysis"
            }
        })
        
    except Exception as e:
        print(f"Analysis error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/analyze-srt", methods=["POST"])
def analyze_srt():
    try:
        # Check if files were uploaded
        if 'srtFile' not in request.files:
            return jsonify({"success": False, "error": "No SRT file uploaded"}), 400
        
        srt_file = request.files['srtFile']
        video_url = request.form.get('videoUrl', '')  # Optional YouTube URL
        
        if srt_file.filename == '':
            return jsonify({"success": False, "error": "No SRT file selected"}), 400
        
        # Check SRT file extension
        if not srt_file.filename.lower().endswith('.srt'):
            return jsonify({"success": False, "error": "Please upload a .srt file"}), 400
        
        # Save SRT file
        srt_filename = secure_filename(srt_file.filename)
        srt_path = os.path.join(app.config['UPLOAD_FOLDER'], srt_filename)
        srt_file.save(srt_path)
        
        print(f"✅ SRT file uploaded: {srt_filename}")
        
        # Parse SRT file
        transcript = parse_srt_file(srt_path)
        
        if not transcript:
            # Clean up file
            os.remove(srt_path)
            return jsonify({"success": False, "error": "Failed to parse SRT file. Please check the format."}), 400
        
        print(f"✅ Parsed SRT with {len(transcript)} subtitles")
        
        # Analyze the transcript data with enhanced details
        clips = analyze_transcript_data(transcript, "SRT", video_url if video_url else None)
        
        # Clean up SRT file
        os.remove(srt_path)
        
        return jsonify({
            "success": True,
            "clips": clips,
            "canDownloadClips": bool(video_url),  # Enable downloads only if YouTube URL provided
            "summary": {
                "totalClips": len(clips),
                "averageScore": sum(clip["viralityScore"] for clip in clips) / len(clips) if clips else 0,
                "topCategory": clips[0]["category"] if clips else "SRT Analysis"
            }
        })
        
    except Exception as e:
        print(f"SRT Analysis error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/download-clip", methods=["POST"])
def download_clip():
    try:
        data = request.get_json()
        video_url = data.get("videoUrl")
        start_time = data.get("startTime")
        end_time = data.get("endTime")
        hook_text = data.get("hookText", f"clip")
        quality = data.get("quality", "bestvideo[height<=1080]+bestaudio/best[height<=1080]")
        
        if not all([video_url, start_time, end_time]):
            return jsonify({"success": False, "error": "Missing required parameters"}), 400
        
        # Create safe filename from hook text
        safe_filename = sanitize_filename(hook_text)
        output_filename = f"{safe_filename}_{start_time.replace(':','-')}_{end_time.replace(':','-')}.%(ext)s"
        output_path = os.path.join(app.config['OUTPUT_FOLDER'], output_filename)
        
        # Download video segment
        success, message = download_youtube_segment(video_url, start_time, end_time, quality, output_path)
        
        if not success:
            return jsonify({"success": False, "error": f"Failed to download clip: {message}"}), 500
        
        # Find the actual downloaded file (yt-dlp adds extension)
        base_name = output_filename.replace('.%(ext)s', '')
        downloaded_file = None
        for file in os.listdir(app.config['OUTPUT_FOLDER']):
            if file.startswith(base_name):
                downloaded_file = os.path.join(app.config['OUTPUT_FOLDER'], file)
                break
        
        if not downloaded_file or not os.path.exists(downloaded_file):
            return jsonify({"success": False, "error": "Downloaded file not found"}), 500
        
        # Return file for download
        return send_file(
            downloaded_file,
            as_attachment=True,
            download_name=os.path.basename(downloaded_file),
            mimetype='video/mp4'
        )
        
    except Exception as e:
        print(f"Download clip error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
     port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
