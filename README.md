# 🚀 Viral Clip Extractor - AI-Powered Trading Content Analysis

An intelligent web application that analyzes YouTube trading videos and extracts viral-worthy clips using Hugging Face AI models and advanced sentiment analysis.

## ✨ Features

- **AI-Powered Analysis**: Uses Hugging Face transformer models for sentiment analysis and content categorization
- **Real YouTube Integration**: Extracts accurate timestamps from actual video transcripts
- **Trading Psychology Focus**: Specialized for trading knowledge, mindset, and psychology content
- **Viral Score Calculation**: Advanced algorithm to predict viral potential based on 7 psychology triggers
- **Multi-Platform Support**: Optimized for YouTube Shorts, Instagram Reels, and TikTok
- **Professional UI**: Modern, responsive interface with real-time progress tracking
- **Export Ready**: Generates FFmpeg commands for easy clip extraction

## 🎯 Viral Psychology Triggers

The AI identifies clips containing these proven viral triggers:

1. **Pattern Interrupt** - Surprising, unexpected content
2. **Curiosity Gap** - Creates questions that need answers  
3. **Emotional Resonance** - Triggers strong emotional responses
4. **Authority** - Cites credible data and expert opinions
5. **Relatability** - Addresses common trader struggles
6. **Social Currency** - Shareable insights and "news"
7. **Transformation Arc** - Before/after or problem-to-solution stories

## 🛠 Technology Stack

### Backend
- **Flask** - Python web framework
- **Hugging Face Transformers** - AI sentiment analysis
- **YouTube Transcript API** - Real transcript extraction
- **Advanced NLP** - Trading keyword detection and scoring

### Frontend  
- **HTML5/CSS3** - Modern responsive design
- **Vanilla JavaScript** - No framework dependencies
- **Font Awesome** - Professional icons
- **CSS Grid/Flexbox** - Responsive layouts

### Deployment
- **Vercel** - Serverless deployment
- **Render** - Container-based hosting
- **Environment Variables** - Secure API key management

## 📋 Prerequisites

- Python 3.11+
- Hugging Face API Token (free)
- Git and GitHub account
- Vercel or Render account

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/clip-agent.git
cd clip-agent
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Environment Setup

Create a `.env` file:

```env
HUGGINGFACE_API_TOKEN=your_token_here
FLASK_ENV=development
PORT=5000
```

Get your free Hugging Face token:
1. Visit https://huggingface.co/settings/tokens
2. Create a new token with read access
3. Copy and paste into your `.env` file

### 4. Run Locally

```bash
python app.py
```

Visit `http://localhost:5000` to use the application.

## 🌐 Deployment

### Deploy to Vercel

1. **Connect GitHub**: Link your repository to Vercel
2. **Configure Build**: Vercel will auto-detect Python and use vercel.json
3. **Environment Variables**: Add your `HUGGINGFACE_API_TOKEN`
4. **Deploy**: Automatic deployment on every push

### Deploy to Render

1. **Create Web Service**: Connect your GitHub repository
2. **Configure Settings**:
   - Language: `Python 3`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn app:app`
3. **Environment Variables**: Add your `HUGGINGFACE_API_TOKEN`
4. **Deploy**: Manual or automatic deployment

## 📁 Project Structure

```
clip-agent/
├── app.py                 # Flask backend application
├── requirements.txt       # Python dependencies
├── vercel.json           # Vercel deployment config
├── runtime.txt           # Python runtime version
├── .env.example          # Environment variables template
├── templates/
│   └── index.html        # Main HTML template
├── static/
│   ├── css/
│   │   └── style.css     # Application styles
│   └── js/
│       └── app.js        # Frontend JavaScript
└── README.md             # This file
```

## 🔧 API Endpoints

### POST /api/analyze
Analyzes a YouTube video and returns viral clips.

**Request Body:**
```json
{
  "videoUrl": "https://youtube.com/watch?v=...",
  "platform": "YouTube Shorts"
}
```

**Response:**
```json
{
  "success": true,
  "clips": [
    {
      "id": 1,
      "title": "When Losing Becomes Winning",
      "startTime": "02:15",
      "endTime": "02:48",
      "duration": "33s",
      "hookText": "This mindset shift changed everything...",
      "viralityScore": 92,
      "triggers": ["Pattern Interrupt", "Transformation Arc"],
      "category": "Trading Psychology",
      "ffmpegCommand": "ffmpeg -ss 00:02:15 -to 00:02:48..."
    }
  ],
  "summary": {
    "totalClips": 12,
    "averageScore": 78.5,
    "topCategory": "Trading Psychology"
  }
}
```

## 🎨 How It Works

1. **Input**: Enter any YouTube trading video URL
2. **Analysis**: AI extracts transcript and analyzes content
3. **Scoring**: Each potential clip gets a virality score (0-100)
4. **Output**: Ranked list of clips with timestamps and download commands

## 🔑 Getting Hugging Face API Token

1. Go to https://huggingface.co/
2. Create a free account
3. Navigate to Settings > Access Tokens
4. Create a new token with "Read" access
5. Copy the token to your `.env` file

**Note**: The free tier includes generous usage limits suitable for development and moderate production use.

## 🛡 Features in Detail

### AI Content Analysis
- **Sentiment Analysis**: Detects emotional tone using multilingual models
- **Content Categorization**: Classifies as Knowledge, Mindset, or Psychology
- **Keyword Detection**: Identifies trading-specific terminology
- **Trigger Recognition**: Scans for viral psychology patterns

### Platform Optimization
- **YouTube Shorts**: 15-60 second clips optimized for mobile viewing
- **Instagram Reels**: 15-30 second clips with high engagement potential  
- **TikTok**: 15-60 second clips optimized for algorithm discovery

### Export Options
- **FFmpeg Commands**: Ready-to-use video trimming commands
- **Timestamp Export**: Precise start/end times for manual editing
- **Batch Processing**: Multiple clips from single video analysis

## 🔐 Environment Variables

```env
# Required
HUGGINGFACE_API_TOKEN=hf_your_token_here

# Optional
FLASK_ENV=production
PORT=5000
```

## 🚨 Troubleshooting

### Common Issues

**"Invalid YouTube URL"**
- Ensure the URL is a valid YouTube link
- Check that the video is public and accessible

**"Could not retrieve transcript"**
- Video must have captions (auto-generated or manual)
- Some videos may have transcript access disabled

**"Analysis failed"**
- Verify your Hugging Face API token is valid
- Check internet connectivity
- Ensure the video has sufficient content (>2 minutes recommended)

### Debug Tips

1. Check browser console for JavaScript errors
2. Verify API token in environment variables
3. Test with known working YouTube videos
4. Check Hugging Face API status

## 📊 Scoring System

The virality score (0-100) is calculated based on:

- **Content Quality** (30%): Clarity, structure, and trading relevance
- **Emotional Impact** (25%): Sentiment strength and authenticity  
- **Viral Triggers** (25%): Number and strength of psychological hooks
- **Engagement Factors** (20%): Length, pacing, and shareability

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Development Setup

```bash
# Clone your fork
git clone https://github.com/yourusername/clip-agent.git

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Edit .env with your API keys

# Run in development mode
FLASK_ENV=development python app.py
```

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- [Hugging Face](https://huggingface.co/) for free AI model access
- [YouTube Transcript API](https://github.com/jdepoix/youtube-transcript-api) for transcript extraction
- Trading psychology research and viral content studies
- Open source community for tools and inspiration

---

**Ready to turn your trading content viral? 🚀**

*Harness the power of AI to identify the most engaging moments in your trading videos and create content that resonates with your audience.*
