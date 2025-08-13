
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import os
import re
import requests
from youtube_transcript_api import YouTubeTranscriptApi
from transformers import pipeline
import logging

app = Flask(__name__)
CORS(app)

# Set up logging
logging.basicConfig(level=logging.INFO)

# Initialize Hugging Face models (using free inference API)
HF_API_URL = "https://api-inference.huggingface.co/models/"
HF_TOKEN = os.environ.get('HUGGINGFACE_API_TOKEN', '')

# Trading-related keywords for content analysis
TRADING_KEYWORDS = {
    'knowledge': ['strategy', 'technical', 'analysis', 'chart', 'indicator', 'pattern', 'trend', 'support', 'resistance', 'volume', 'price', 'market', 'trading', 'forex', 'stocks', 'crypto'],
    'mindset': ['discipline', 'patience', 'consistency', 'focus', 'confidence', 'mindset', 'mental', 'approach', 'attitude', 'belief'],
    'psychology': ['emotion', 'fear', 'greed', 'anxiety', 'stress', 'psychology', 'behavior', 'bias', 'mistake', 'loss', 'profit', 'risk']
}

VIRAL_TRIGGERS = {
    'Pattern Interrupt': ['surprising', 'shocking', 'unexpected', 'never', 'secret', 'hidden', 'revealed'],
    'Curiosity Gap': ['why', 'how', 'what', 'discover', 'learn', 'find out', 'revealed', 'secret'],
    'Emotional Resonance': ['love', 'hate', 'amazing', 'terrible', 'incredible', 'shocking', 'devastating'],
    'Authority': ['expert', 'proven', 'research', 'study', 'data', 'statistics', 'successful'],
    'Relatability': ['struggle', 'problem', 'challenge', 'difficulty', 'everyone', 'most people'],
    'Social Currency': ['share', 'tell', 'news', 'breakthrough', 'revolutionary', 'game-changer'],
    'Transformation Arc': ['before', 'after', 'changed', 'transformed', 'improved', 'fixed', 'solved']
}

def extract_video_id(url):
    """Extract video ID from YouTube URL"""
    patterns = [
        r'(?:v=|\/)([0-9A-Za-z_-]{11}).*',
        r'(?:embed\/)([0-9A-Za-z_-]{11})',
        r'(?:youtu\.be\/)([0-9A-Za-z_-]{11})'
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def get_video_transcript(video_id):
    """Get transcript from YouTube video"""
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        return transcript
    except Exception as e:
        logging.error(f"Error getting transcript: {e}")
        return None

def analyze_sentiment_hf(text):
    """Analyze sentiment using Hugging Face API"""
    try:
        headers = {"Authorization": f"Bearer {HF_TOKEN}"}
        model_url = f"{HF_API_URL}tabularisai/multilingual-sentiment-analysis"

        response = requests.post(
            model_url,
            headers=headers,
            json={"inputs": text},
            timeout=30
        )

        if response.status_code == 200:
            result = response.json()
            if isinstance(result, list) and len(result) > 0:
                return result[0]
        return {"label": "NEUTRAL", "score": 0.5}
    except Exception as e:
        logging.error(f"Sentiment analysis error: {e}")
        return {"label": "NEUTRAL", "score": 0.5}

def categorize_content(text):
    """Categorize content as Trading Knowledge, Mindset, or Psychology"""
    text_lower = text.lower()
    scores = {'Trading Knowledge': 0, 'Trading Mindset': 0, 'Trading Psychology': 0}

    for category, keywords in TRADING_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text_lower:
                if category == 'knowledge':
                    scores['Trading Knowledge'] += 1
                elif category == 'mindset':
                    scores['Trading Mindset'] += 1
                elif category == 'psychology':
                    scores['Trading Psychology'] += 1

    if max(scores.values()) == 0:
        return 'Trading Knowledge'  # Default category

    return max(scores, key=scores.get)

def detect_viral_triggers(text):
    """Detect viral psychology triggers in text"""
    text_lower = text.lower()
    detected_triggers = []

    for trigger, keywords in VIRAL_TRIGGERS.items():
        for keyword in keywords:
            if keyword in text_lower:
                detected_triggers.append(trigger)
                break

    return list(set(detected_triggers))  # Remove duplicates

def calculate_virality_score(text, sentiment, triggers, category):
    """Calculate virality potential score"""
    base_score = 50

    # Sentiment impact
    if sentiment['label'] in ['POSITIVE', 'VERY POSITIVE']:
        base_score += 15
    elif sentiment['label'] in ['NEGATIVE', 'VERY NEGATIVE']:
        base_score += 10  # Negative can be engaging too

    # Trigger impact
    trigger_bonus = len(triggers) * 8
    base_score += min(trigger_bonus, 25)  # Cap at 25 points

    # Category impact
    if category == 'Trading Psychology':
        base_score += 10  # Psychology content often performs well

    # Confidence score impact
    confidence_bonus = int(sentiment['score'] * 10)
    base_score += confidence_bonus

    return min(base_score, 100)  # Cap at 100

def analyze_clips(transcript, platform_requirements):
    """Analyze transcript and identify viral clips"""
    clips = []
    clip_id = 1

    # Group transcript entries into potential clips
    current_clip = []
    current_duration = 0
    start_time = 0

    for entry in transcript:
        current_clip.append(entry)
        current_duration += entry['duration']

        # Check if we have enough content for a clip (15-90 seconds)
        if current_duration >= 15 and len(current_clip) >= 3:
            # Combine text for analysis
            clip_text = ' '.join([item['text'] for item in current_clip])

            # Skip if clip is too short in terms of content
            if len(clip_text.split()) < 10:
                current_clip = []
                current_duration = 0
                start_time = entry['start'] + entry['duration']
                continue

            # Analyze the clip
            sentiment = analyze_sentiment_hf(clip_text)
            category = categorize_content(clip_text)
            triggers = detect_viral_triggers(clip_text)

            # Only proceed if we have at least 2 viral triggers
            if len(triggers) >= 2:
                virality_score = calculate_virality_score(clip_text, sentiment, triggers, category)

                # Generate title and hook
                title = generate_clip_title(clip_text, triggers)
                hook = generate_hook_text(clip_text, sentiment)

                # Format timestamps
                start_timestamp = format_timestamp(start_time)
                end_timestamp = format_timestamp(current_clip[-1]['start'] + current_clip[-1]['duration'])
                duration = f"{int(current_duration)}s"

                # Generate FFmpeg command
                ffmpeg_cmd = f'ffmpeg -ss {start_timestamp} -to {end_timestamp} -i input.mp4 -c copy "{title.lower().replace(" ", "_")}.mp4"'

                clip_data = {
                    'id': clip_id,
                    'title': title,
                    'startTime': start_timestamp,
                    'endTime': end_timestamp,
                    'duration': duration,
                    'hookText': hook,
                    'viralityScore': virality_score,
                    'triggers': triggers,
                    'category': category,
                    'ffmpegCommand': ffmpeg_cmd,
                    'sentiment': sentiment
                }

                clips.append(clip_data)
                clip_id += 1

                # Limit to 15 clips max
                if len(clips) >= 15:
                    break

            # Reset for next clip with some overlap
            overlap_entries = current_clip[-2:] if len(current_clip) >= 2 else []
            current_clip = overlap_entries
            current_duration = sum([e['duration'] for e in overlap_entries])
            start_time = overlap_entries[0]['start'] if overlap_entries else entry['start'] + entry['duration']

    # Sort clips by virality score
    clips.sort(key=lambda x: x['viralityScore'], reverse=True)

    return clips

def format_timestamp(seconds):
    """Convert seconds to MM:SS format"""
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{minutes:02d}:{secs:02d}"

def generate_clip_title(text, triggers):
    """Generate an engaging title based on content and triggers"""
    words = text.lower().split()

    # Trading-specific title templates
    templates = [
        "The {emotion} That Changed Everything",
        "Why Most Traders Fail at This",
        "The {number} Second Rule That Saves Accounts",
        "When {emotion} Becomes Your Biggest Asset",
        "The Psychology Behind This Trading Mistake",
        "How to Turn {emotion} Into Profit",
        "The Hidden Truth About Trading {concept}",
        "Why This Trading Psychology Trick Works",
        "The Mindset Shift That Changes Everything",
        "When Losing Becomes Winning"
    ]

    # Extract relevant words for templates
    emotions = ['fear', 'greed', 'anxiety', 'confidence', 'doubt', 'panic']
    concepts = ['discipline', 'strategy', 'risk', 'psychology', 'mindset']
    numbers = ['3', '5', '10', '30']

    found_emotion = next((e for e in emotions if e in words), 'fear')
    found_concept = next((c for c in concepts if c in words), 'psychology')
    found_number = next((n for n in numbers if n in words), '3')

    import random
    template = random.choice(templates)

    title = template.format(
        emotion=found_emotion.title(),
        concept=found_concept.title(),
        number=found_number
    )

    return title

def generate_hook_text(text, sentiment):
    """Generate engaging hook text"""
    # Take first compelling sentence or phrase
    sentences = text.split('.')[:2]
    hook = '. '.join(sentences).strip()

    if len(hook) > 100:
        hook = hook[:97] + "..."

    return hook

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/analyze', methods=['POST'])
def analyze_video():
    try:
        data = request.get_json()
        video_url = data.get('videoUrl')
        platform = data.get('platform', 'YouTube Shorts')

        if not video_url:
            return jsonify({'error': 'Video URL is required'}), 400

        # Extract video ID
        video_id = extract_video_id(video_url)
        if not video_id:
            return jsonify({'error': 'Invalid YouTube URL'}), 400

        # Get transcript
        transcript = get_video_transcript(video_id)
        if not transcript:
            return jsonify({'error': 'Could not retrieve transcript. Video may not have captions.'}), 400

        # Define platform requirements
        platform_requirements = {
            'YouTube Shorts': {'min': 15, 'max': 60, 'optimal': 30},
            'Instagram Reels': {'min': 15, 'max': 90, 'optimal': 30},
            'TikTok': {'min': 15, 'max': 180, 'optimal': 45}
        }

        # Analyze clips
        clips = analyze_clips(transcript, platform_requirements.get(platform, platform_requirements['YouTube Shorts']))

        # Generate summary statistics
        if clips:
            avg_score = sum(clip['viralityScore'] for clip in clips) / len(clips)
            top_category = max(set(clip['category'] for clip in clips), 
                             key=lambda x: sum(1 for clip in clips if clip['category'] == x))
            top_clips = clips[:5]
        else:
            avg_score = 0
            top_category = "No clips found"
            top_clips = []

        summary = {
            'totalClips': len(clips),
            'averageScore': round(avg_score, 1),
            'topCategory': top_category,
            'topClips': len(top_clips)
        }

        return jsonify({
            'success': True,
            'clips': clips,
            'summary': summary,
            'videoId': video_id
        })

    except Exception as e:
        logging.error(f"Analysis error: {e}")
        return jsonify({'error': f'Analysis failed: {str(e)}'}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'Viral Clip Extractor API is running'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
