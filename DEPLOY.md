# 🚀 Deployment Guide

## Quick Deploy to Vercel

1. **Fork/Clone the repository**
2. **Get Hugging Face API Token**: 
   - Visit https://huggingface.co/settings/tokens
   - Create new token with "Read" access
3. **Deploy to Vercel**:
   - Connect GitHub repository
   - Add environment variable: `HUGGINGFACE_API_TOKEN`
   - Deploy automatically

## Quick Deploy to Render

1. **Create Web Service** on Render
2. **Connect GitHub** repository
3. **Configure**:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn app:app`
4. **Add Environment Variables**:
   - `HUGGINGFACE_API_TOKEN`: Your HF token
5. **Deploy**

## Local Development

```bash
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API token
python app.py
```

Visit http://localhost:5000
