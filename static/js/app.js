// Application State Management
class AppState {
    constructor() {
        this.currentVideoUrl = '';
        this.selectedPlatform = 'YouTube Shorts';
        this.clips = [];
        this.isAnalyzing = false;
        this.analysisComplete = false;
    }

    updatePlatform(platform) {
        this.selectedPlatform = platform;
        this.updatePlatformUI();
    }

    updatePlatformUI() {
        // Update platform button states
        document.querySelectorAll('.platform-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.platform === this.selectedPlatform) {
                btn.classList.add('active');
            }
        });
    }
}

// Global app state
const appState = new AppState();

// API Configuration
const API_BASE = window.location.origin;

// DOM Elements
const elements = {
    videoUrl: document.getElementById('videoUrl'),
    analyzeBtn: document.getElementById('analyzeBtn'),
    platformBtns: document.querySelectorAll('.platform-btn'),
    progressSection: document.getElementById('progressSection'),
    resultsSection: document.getElementById('resultsSection'),
    errorSection: document.getElementById('errorSection'),
    statusIndicator: document.getElementById('statusIndicator'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    urlValidation: document.getElementById('urlValidation'),
    progressFill: document.getElementById('progressFill'),
    progressStatus: document.getElementById('progressStatus'),
    clipsContainer: document.getElementById('clipsContainer'),
    highlightsGrid: document.getElementById('highlightsGrid'),
    totalClips: document.getElementById('totalClips'),
    avgScore: document.getElementById('avgScore'),
    topCategory: document.getElementById('topCategory'),
    sortBy: document.getElementById('sortBy'),
    filterCategory: document.getElementById('filterCategory'),
    minScore: document.getElementById('minScore'),
    minScoreValue: document.getElementById('minScoreValue'),
    retryBtn: document.getElementById('retryBtn'),
    errorMessage: document.getElementById('errorMessage')
};

// YouTube URL Validation
function isValidYouTubeUrl(url) {
    const patterns = [
        /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        /^https?:\/\/m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
        /^https?:\/\/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/
    ];
    return patterns.some(pattern => pattern.test(url));
}

function extractVideoId(url) {
    const patterns = [
        /[?&]v=([a-zA-Z0-9_-]{11})/,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /embed\/([a-zA-Z0-9_-]{11})/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

// UI Update Functions
function updateStatus(status, isError = false) {
    const statusText = elements.statusIndicator.querySelector('.status-text');
    const statusDot = elements.statusIndicator.querySelector('.status-dot');

    statusText.textContent = status;
    statusDot.style.background = isError ? 'var(--error)' : 'var(--success)';
}

function updateProgress(step, percentage, statusText) {
    // Update progress bar
    elements.progressFill.style.width = `${percentage}%`;
    elements.progressStatus.textContent = statusText;

    // Update step indicators
    document.querySelectorAll('.step').forEach((stepEl, index) => {
        stepEl.classList.toggle('active', index < step);
    });
}

function showSection(sectionToShow) {
    // Hide all sections
    [elements.progressSection, elements.resultsSection, elements.errorSection].forEach(section => {
        section.classList.add('hidden');
    });

    // Show target section
    if (sectionToShow) {
        sectionToShow.classList.remove('hidden');
    }
}

function showError(message) {
    elements.errorMessage.textContent = message;
    showSection(elements.errorSection);
    updateStatus('Error', true);
}

// Clip Rendering Functions
function createClipCard(clip, isHighlight = false) {
    const categoryClass = `category-${clip.category.split(' ')[1].toLowerCase()}`;

    const card = document.createElement('div');
    card.className = `clip-card ${isHighlight ? 'highlight' : ''}`;

    card.innerHTML = `
        <div class="clip-header">
            <div class="clip-rank">${clip.id}</div>
            <div class="virality-score">${clip.viralityScore}</div>
        </div>

        <h4 class="clip-title">${clip.title}</h4>

        <div class="clip-meta">
            <span><i class="fas fa-clock"></i> ${clip.startTime} - ${clip.endTime}</span>
            <span><i class="fas fa-stopwatch"></i> ${clip.duration}</span>
        </div>

        <div class="category-badge ${categoryClass}">
            ${clip.category}
        </div>

        <p class="hook-text">"${clip.hookText}"</p>

        <div class="triggers-container">
            <strong>Viral Triggers:</strong>
            <div class="triggers-grid">
                ${clip.triggers.map(trigger => `<span class="trigger-badge">${trigger}</span>`).join('')}
            </div>
        </div>

        <div class="clip-actions">
            <button class="btn btn-primary btn-small" onclick="previewClip('${clip.id}')">
                <i class="fas fa-play"></i> Preview
            </button>
            <button class="btn btn-secondary btn-small" onclick="copyFFmpeg('${clip.id}')">
                <i class="fas fa-copy"></i> Copy Command
            </button>
            <button class="btn btn-secondary btn-small" onclick="downloadClip('${clip.id}')">
                <i class="fas fa-download"></i> Download
            </button>
        </div>

        <div class="ffmpeg-command">
            <button class="copy-btn" onclick="copyToClipboard('${clip.ffmpegCommand}')">
                <i class="fas fa-copy"></i>
            </button>
            <code>${clip.ffmpegCommand}</code>
        </div>
    `;

    return card;
}

function renderClips(clips) {
    // Clear containers
    elements.clipsContainer.innerHTML = '';
    elements.highlightsGrid.innerHTML = '';

    if (clips.length === 0) {
        elements.clipsContainer.innerHTML = `
            <div class="text-center">
                <i class="fas fa-search" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                <p style="color: var(--text-muted);">No viral clips found. Try a different video or adjust your criteria.</p>
            </div>
        `;
        return;
    }

    // Render top 5 highlights
    const highlights = clips.slice(0, 5);
    highlights.forEach(clip => {
        const card = createClipCard(clip, true);
        elements.highlightsGrid.appendChild(card);
    });

    // Render all clips
    clips.forEach(clip => {
        const card = createClipCard(clip);
        elements.clipsContainer.appendChild(card);
    });

    // Update summary stats
    updateSummaryStats(clips);
}

function updateSummaryStats(clips) {
    const avgScore = clips.length > 0 ? (clips.reduce((sum, clip) => sum + clip.viralityScore, 0) / clips.length).toFixed(1) : '0.0';
    const categories = clips.map(clip => clip.category);
    const topCategory = categories.length > 0 ? 
        categories.reduce((a, b, i, arr) => 
            arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
        ) : 'None';

    elements.totalClips.textContent = clips.length;
    elements.avgScore.textContent = avgScore;
    elements.topCategory.textContent = topCategory;
}

// Clip Action Functions
function previewClip(clipId) {
    const clip = appState.clips.find(c => c.id == clipId);
    if (clip) {
        // Create preview URL for YouTube
        const videoId = extractVideoId(appState.currentVideoUrl);
        const startSeconds = timeToSeconds(clip.startTime);
        const previewUrl = `https://www.youtube.com/watch?v=${videoId}&t=${startSeconds}`;
        window.open(previewUrl, '_blank');
    }
}

function copyFFmpeg(clipId) {
    const clip = appState.clips.find(c => c.id == clipId);
    if (clip) {
        copyToClipboard(clip.ffmpegCommand);
    }
}

function downloadClip(clipId) {
    // In a real implementation, this would trigger the actual download
    // For now, we'll show instructions
    const clip = appState.clips.find(c => c.id == clipId);
    if (clip) {
        alert(`To download this clip, use the FFmpeg command that has been copied to your clipboard, or use a tool like yt-dlp with these timestamps: ${clip.startTime} to ${clip.endTime}`);
        copyFFmpeg(clipId);
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Show temporary success message
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--success);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: var(--radius-md);
            z-index: 1001;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = 'Copied to clipboard!';
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 2000);
    }).catch(err => {
        console.error('Copy failed:', err);
        alert('Copy failed. Please select and copy manually.');
    });
}

// Filter and Sort Functions
function applyFilters() {
    let filteredClips = [...appState.clips];

    // Apply category filter
    const categoryFilter = elements.filterCategory.value;
    if (categoryFilter !== 'all') {
        filteredClips = filteredClips.filter(clip => clip.category === categoryFilter);
    }

    // Apply score filter
    const minScore = parseInt(elements.minScore.value);
    filteredClips = filteredClips.filter(clip => clip.viralityScore >= minScore);

    // Apply sorting
    const sortBy = elements.sortBy.value;
    filteredClips.sort((a, b) => {
        switch (sortBy) {
            case 'score':
                return b.viralityScore - a.viralityScore;
            case 'duration':
                return timeToSeconds(a.duration) - timeToSeconds(b.duration);
            case 'category':
                return a.category.localeCompare(b.category);
            default:
                return 0;
        }
    });

    renderClips(filteredClips);
}

// Utility Functions
function timeToSeconds(timeStr) {
    if (timeStr.includes(':')) {
        const [minutes, seconds] = timeStr.split(':').map(Number);
        return minutes * 60 + seconds;
    }
    return parseInt(timeStr.replace('s', ''));
}

// API Functions
async function analyzeVideo(videoUrl, platform) {
    try {
        updateStatus('Analyzing...');
        showSection(elements.progressSection);

        // Simulate progress steps
        updateProgress(1, 10, 'Connecting to YouTube API...');

        const response = await fetch(`${API_BASE}/api/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                videoUrl: videoUrl,
                platform: platform
            })
        });

        updateProgress(2, 30, 'Fetching video transcript...');

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Analysis failed');
        }

        updateProgress(3, 60, 'Analyzing content with AI...');

        const data = await response.json();

        updateProgress(4, 90, 'Calculating virality scores...');

        if (data.success) {
            appState.clips = data.clips;
            appState.analysisComplete = true;

            updateProgress(4, 100, 'Analysis complete!');

            setTimeout(() => {
                showSection(elements.resultsSection);
                renderClips(data.clips);
                updateStatus('Analysis Complete');
            }, 1000);
        } else {
            throw new Error('Analysis failed');
        }

    } catch (error) {
        console.error('Analysis error:', error);
        showError(error.message || 'Failed to analyze video. Please check the URL and try again.');
    }
}

// Event Listeners
function initializeEventListeners() {
    // URL input validation
    elements.videoUrl.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        appState.currentVideoUrl = url;

        if (url === '') {
            elements.urlValidation.textContent = '';
            elements.analyzeBtn.disabled = true;
            return;
        }

        if (isValidYouTubeUrl(url)) {
            elements.urlValidation.innerHTML = '<i class="fas fa-check"></i> Valid YouTube URL detected';
            elements.urlValidation.className = 'url-validation validation-success';
            elements.analyzeBtn.disabled = false;
        } else {
            elements.urlValidation.innerHTML = '<i class="fas fa-times"></i> Please enter a valid YouTube URL';
            elements.urlValidation.className = 'url-validation validation-error';
            elements.analyzeBtn.disabled = true;
        }
    });

    // Platform selection
    elements.platformBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            appState.updatePlatform(btn.dataset.platform);
        });
    });

    // Analyze button
    elements.analyzeBtn.addEventListener('click', () => {
        if (!appState.isAnalyzing && appState.currentVideoUrl) {
            appState.isAnalyzing = true;
            analyzeVideo(appState.currentVideoUrl, appState.selectedPlatform);
        }
    });

    // Filter and sort controls
    if (elements.sortBy) {
        elements.sortBy.addEventListener('change', applyFilters);
    }

    if (elements.filterCategory) {
        elements.filterCategory.addEventListener('change', applyFilters);
    }

    if (elements.minScore) {
        elements.minScore.addEventListener('input', (e) => {
            elements.minScoreValue.textContent = e.target.value;
            applyFilters();
        });
    }

    // Retry button
    if (elements.retryBtn) {
        elements.retryBtn.addEventListener('click', () => {
            showSection(null);
            appState.isAnalyzing = false;
            updateStatus('Ready');
        });
    }

    // Enter key support
    elements.videoUrl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !elements.analyzeBtn.disabled) {
            elements.analyzeBtn.click();
        }
    });
}

// Health Check
async function checkAPIHealth() {
    try {
        const response = await fetch(`${API_BASE}/api/health`);
        if (response.ok) {
            updateStatus('Connected');
        } else {
            updateStatus('API Issues', true);
        }
    } catch (error) {
        updateStatus('Offline', true);
        console.error('Health check failed:', error);
    }
}

// Initialize App
function initializeApp() {
    // Set up initial state
    appState.updatePlatformUI();

    // Initialize event listeners
    initializeEventListeners();

    // Check API health
    checkAPIHealth();

    // Show initial status
    updateStatus('Ready');

    console.log('🚀 Viral Clip Extractor initialized successfully!');
}

// Start the application when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Add CSS animation keyframes dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);