// Application State Management
class AppState {
    constructor() {
        this.currentVideoUrl = '';
        this.selectedPlatform = 'YouTube Shorts';
        this.clips = [];
        this.isAnalyzing = false;
        this.analysisComplete = false;
        this.currentTab = 'url';
        this.canDownloadClips = false;
    }

    updatePlatform(platform) {
        this.selectedPlatform = platform;
        this.updatePlatformUI();
    }

    updatePlatformUI() {
        document.querySelectorAll('.platform-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.platform === this.selectedPlatform) {
                btn.classList.add('active');
            }
        });
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Show selected tab
        document.getElementById(tabName + '-tab').classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    }

    reset() {
        this.clips = [];
        this.isAnalyzing = false;
        this.analysisComplete = false;
        this.canDownloadClips = false;
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
    analyzeSrtBtn: document.getElementById('analyzeSrtBtn'),
    srtFile: document.getElementById('srtFile'),
    srtVideoUrl: document.getElementById('srtVideoUrl'),
    srtFileName: document.getElementById('srtFileName'),
    srtUploadArea: document.getElementById('srtUploadArea'),
    platformBtns: document.querySelectorAll('.platform-btn'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    progressSection: document.getElementById('progressSection'),
    resultsSection: document.getElementById('resultsSection'),
    errorSection: document.getElementById('errorSection'),
    statusIndicator: document.getElementById('statusIndicator'),
    urlValidation: document.getElementById('urlValidation'),
    srtUrlValidation: document.getElementById('srtUrlValidation'),
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
    if (!elements.statusIndicator) return;
    
    const statusText = elements.statusIndicator.querySelector('.status-text');
    const statusDot = elements.statusIndicator.querySelector('.status-dot');

    if (statusText) statusText.textContent = status;
    if (statusDot) statusDot.style.background = isError ? '#dc3545' : '#28a745';
}

function updateProgress(step, percentage, statusText) {
    if (elements.progressFill) {
        elements.progressFill.style.width = `${percentage}%`;
    }
    if (elements.progressStatus) {
        elements.progressStatus.textContent = statusText;
    }

    document.querySelectorAll('.step').forEach((stepEl, index) => {
        stepEl.classList.toggle('active', index < step);
    });
}

function showSection(sectionToShow) {
    [elements.progressSection, elements.resultsSection, elements.errorSection].forEach(section => {
        if (section) section.classList.add('hidden');
    });

    if (sectionToShow) {
        sectionToShow.classList.remove('hidden');
    }
}

function showError(message) {
    if (elements.errorMessage) {
        elements.errorMessage.textContent = message;
    }
    showSection(elements.errorSection);
    updateStatus('Error', true);
}

// File Upload Handling
function handleSrtFileSelect() {
    const file = elements.srtFile?.files[0];
    
    if (file) {
        if (elements.srtFileName) {
            elements.srtFileName.textContent = `Selected: ${file.name}`;
            elements.srtFileName.style.color = '#28a745';
        }
        if (elements.srtUploadArea) {
            elements.srtUploadArea.style.borderColor = '#28a745';
            elements.srtUploadArea.style.backgroundColor = '#f8f9fa';
        }
        
        if (elements.analyzeSrtBtn) {
            elements.analyzeSrtBtn.disabled = false;
        }
    } else {
        if (elements.srtFileName) {
            elements.srtFileName.textContent = '';
        }
        if (elements.srtUploadArea) {
            elements.srtUploadArea.style.borderColor = '#ddd';
            elements.srtUploadArea.style.backgroundColor = 'white';
        }
        if (elements.analyzeSrtBtn) {
            elements.analyzeSrtBtn.disabled = true;
        }
    }
}

// Drag and Drop for SRT files
function setupDragAndDrop() {
    if (!elements.srtUploadArea) return;
    
    const uploadArea = elements.srtUploadArea;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.style.borderColor = '#007cba';
            uploadArea.style.backgroundColor = '#e3f2fd';
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.style.borderColor = '#ddd';
            uploadArea.style.backgroundColor = 'white';
        });
    });

    uploadArea.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.name.toLowerCase().endsWith('.srt')) {
                elements.srtFile.files = files;
                handleSrtFileSelect();
            } else {
                showNotification('❌ Please upload a .srt file', 'error');
            }
        }
    });
}

// Enhanced Clip Actions
function previewClip(clipId) {
    const clip = appState.clips.find(c => c.id == clipId);
    if (!clip) return;
    
    if (clip.sourceType === "YouTube" && clip.previewUrl) {
        // Open YouTube at specific timestamp
        window.open(clip.previewUrl, '_blank');
    } else {
        // Show text preview modal
        showTextPreview(clip);
    }
}

function showTextPreview(clip) {
    // Create modal for text preview
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;
    
    const downloadSection = appState.canDownloadClips && clip.videoUrl ? `
        <div style="text-align: center; margin: 20px 0; padding: 15px; background: #f0f8ff; border-radius: 8px;">
            <h4 style="margin-bottom: 10px; color: #007cba;">📹 Download Video Clip</h4>
            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                <button onclick="downloadVideoClip('${clip.id}', '1080')" style="
                    background: #dc3545;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 5px;
                    cursor: pointer;
                ">1080p</button>
                <button onclick="downloadVideoClip('${clip.id}', '720')" style="
                    background: #fd7e14;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 5px;
                    cursor: pointer;
                ">720p</button>
                <button onclick="downloadVideoClip('${clip.id}', '480')" style="
                    background: #6c757d;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 5px;
                    cursor: pointer;
                ">480p</button>
            </div>
        </div>
    ` : '';

    modal.innerHTML = `
        <div style="
            background: white;
            padding: 30px;
            border-radius: 10px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        ">
            <h3 style="color: #007cba; margin-bottom: 15px;">🎬 ${clip.title}</h3>
            <div style="margin: 15px 0; color: #666; font-size: 14px;">
                <strong>Timestamp:</strong> ${clip.startTime} - ${clip.endTime}
                <br>
                <strong>Duration:</strong> ${clip.duration}
                <br>
                <strong>Virality Score:</strong> ${clip.viralityScore}%
                <br>
                <strong>Category:</strong> ${clip.category}
                <br>
                <strong>Source:</strong> ${clip.sourceType}
            </div>
            
            ${downloadSection}
            
            <div style="
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                margin: 15px 0;
                font-style: italic;
                border-left: 4px solid #007cba;
            ">
                <strong>Content Preview:</strong><br><br>
                "${clip.fullText || clip.hookText}"
            </div>
            <div style="margin: 15px 0;">
                <strong>Viral Triggers:</strong><br>
                <div style="margin-top: 8px;">
                    ${clip.triggers.map(trigger => `<span style="
                        background: #ffc107;
                        color: #333;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 12px;
                        margin-right: 6px;
                        display: inline-block;
                        margin-bottom: 4px;
                    ">${trigger}</span>`).join('')}
                </div>
            </div>
            <div style="
                background: #f1f1f1;
                padding: 15px;
                border-radius: 5px;
                margin: 15px 0;
                font-family: monospace;
                font-size: 12px;
                overflow-x: auto;
            ">
                <strong>FFmpeg Command:</strong><br>
                <code>${clip.ffmpegCommand}</code>
            </div>
            <div style="text-align: center; margin-top: 25px;">
                <button onclick="copyToClipboard('${clip.ffmpegCommand}')" style="
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    margin-right: 10px;
                ">Copy FFmpeg</button>
                <button onclick="downloadClip('${clip.id}')" style="
                    background: #6c757d;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    margin-right: 10px;
                ">Download Info</button>
                <button onclick="this.closest('[style*=\"position: fixed\"]').remove()" style="
                    background: #007cba;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                ">Close Preview</button>
            </div>
        </div>
    `;
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Close on Escape key
    const closeOnEscape = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', closeOnEscape);
        }
    };
    document.addEventListener('keydown', closeOnEscape);
    
    document.body.appendChild(modal);
}

// Download actual video clip using yt-dlp
async function downloadVideoClip(clipId, quality = '1080') {
    const clip = appState.clips.find(c => c.id == clipId);
    if (!clip || !clip.videoUrl) {
        showNotification('❌ No video URL available for download', 'error');
        return;
    }

    const qualityMap = {
        '1080': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
        '720': 'bestvideo[height<=720]+bestaudio/best[height<=720]',
        '480': 'bestvideo[height<=480]+bestaudio/best[height<=480]'
    };

    try {
        showNotification(`🎬 Downloading ${quality}p clip... This may take a moment.`, 'info');

        const response = await fetch(`${API_BASE}/api/download-clip`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoUrl: clip.videoUrl,
                startTime: clip.startTime,
                endTime: clip.endTime,
                hookText: clip.hookText,
                quality: qualityMap[quality]
            })
        });

        if (!response.ok) {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to download clip');
            } else {
                throw new Error('Server error occurred');
            }
        }

        // Download the file
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sanitizeFilename(clip.hookText)}_${quality}p_clip_${clip.id}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification(`🎉 ${quality}p clip downloaded successfully!`, 'success');

    } catch (error) {
        console.error('Download error:', error);
        showNotification(`❌ Download failed: ${error.message}`, 'error');
    }
}

// Download text info about clip
function downloadClip(clipId) {
    const clip = appState.clips.find(c => c.id == clipId);
    if (!clip) return;
    
    // Create downloadable clip info as text file
    const clipInfo = `VIRAL CLIP EXTRACTION REPORT
===========================

Title: ${clip.title}
Timestamp: ${clip.startTime} - ${clip.endTime}
Duration: ${clip.duration}
Virality Score: ${clip.viralityScore}%
Category: ${clip.category}
Source: ${clip.sourceType}

HOOK TEXT
---------
"${clip.hookText}"

FULL CONTENT
------------
"${clip.fullText || clip.hookText}"

VIRAL TRIGGERS
--------------
${clip.triggers.map(trigger => `• ${trigger}`).join('\n')}

FFMPEG COMMAND
--------------
${clip.ffmpegCommand}

EXTRACTION INSTRUCTIONS
-----------------------
1. Copy the FFmpeg command above
2. Replace "input.mp4" with your video file name
3. Run the command in your terminal
4. The clip will be saved as "clip_${clip.id}.mp4"

${clip.videoUrl ? `YOUTUBE URL
-----------
${clip.videoUrl}

Alternative method using yt-dlp:
yt-dlp --download-sections "*${clip.startTime}-${clip.endTime}" "${clip.videoUrl}"` : ''}

Generated: ${new Date().toLocaleString()}
Report ID: ${Date.now()}`;
    
    // Create and download file
    const blob = new Blob([clipInfo], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `viral-clip-${clip.id}-${clip.sourceType.toLowerCase()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Copy FFmpeg command to clipboard
    copyToClipboard(clip.ffmpegCommand);
    
    // Show success notification
    showNotification('📥 Clip info downloaded! FFmpeg command copied to clipboard.', 'success');
}

// Utility Functions
function copyFFmpeg(clipId) {
    const clip = appState.clips.find(c => c.id == clipId);
    if (clip) {
        copyToClipboard(clip.ffmpegCommand);
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('📋 Copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Copy failed:', err);
        // Fallback method
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showNotification('📋 Copied to clipboard!', 'success');
        } catch (fallbackErr) {
            showNotification('❌ Copy failed. Please select and copy manually.', 'error');
        }
        document.body.removeChild(textArea);
    });
}

function sanitizeFilename(filename) {
    return filename.replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, '_').toLowerCase().substring(0, 30);
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const bgColor = type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007cba';
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 1001;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideInRight 0.3s ease;
        max-width: 350px;
        word-wrap: break-word;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 5000);
}

// Clip Rendering Functions
function createClipCard(clip, isHighlight = false) {
    const categoryClass = `category-${clip.category.toLowerCase().replace(/\s+/g, '-')}`;
    const card = document.createElement('div');
    card.className = `clip-card ${isHighlight ? 'highlight' : ''}`;

    const previewIcon = clip.sourceType === 'YouTube' ? 'fa-play' : 'fa-eye';
    const previewText = clip.sourceType === 'YouTube' ? 'Preview' : 'Preview Text';

    // Show video download buttons if clips can be downloaded
    const downloadButtons = appState.canDownloadClips && clip.videoUrl ? `
        <div class="video-download-section">
            <strong>📹 Download Video:</strong>
            <div class="quality-buttons">
                <button class="btn btn-danger btn-small" onclick="downloadVideoClip('${clip.id}', '1080')" title="Download 1080p">
                    1080p
                </button>
                <button class="btn btn-warning btn-small" onclick="downloadVideoClip('${clip.id}', '720')" title="Download 720p">
                    720p
                </button>
                <button class="btn btn-secondary btn-small" onclick="downloadVideoClip('${clip.id}', '480')" title="Download 480p">
                    480p
                </button>
            </div>
        </div>
        <div class="other-downloads">
            <button class="btn btn-info btn-small" onclick="downloadClip('${clip.id}')" title="Download Info">
                <i class="fas fa-download"></i> Info
            </button>
        </div>
    ` : `
        <button class="btn btn-success btn-small" onclick="downloadClip('${clip.id}')" title="Download Clip Info">
            <i class="fas fa-download"></i> Download Info
        </button>
    `;

    card.innerHTML = `
        <div class="clip-header">
            <div class="clip-rank">#${clip.id}</div>
            <div class="virality-score">${clip.viralityScore}%</div>
        </div>

        <h4 class="clip-title">${clip.title}</h4>

        <div class="clip-meta">
            <span><i class="fas fa-clock"></i> ${clip.startTime} - ${clip.endTime}</span>
            <span><i class="fas fa-stopwatch"></i> ${clip.duration}</span>
            <span><i class="fas fa-tag"></i> ${clip.sourceType}</span>
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
            <button class="btn btn-primary btn-small" onclick="previewClip('${clip.id}')" title="${previewText}">
                <i class="fas ${previewIcon}"></i> ${previewText}
            </button>
            <button class="btn btn-secondary btn-small" onclick="copyFFmpeg('${clip.id}')" title="Copy FFmpeg Command">
                <i class="fas fa-copy"></i> Copy CMD
            </button>
        </div>

        <div class="download-section">
            ${downloadButtons}
        </div>

        <div class="ffmpeg-command">
            <div class="ffmpeg-header">
                <strong>FFmpeg Command:</strong>
                <button class="copy-btn" onclick="copyToClipboard('${clip.ffmpegCommand}')" title="Copy to clipboard">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
            <code>${clip.ffmpegCommand}</code>
        </div>
    `;

    return card;
}

function renderClips(clips) {
    if (!elements.clipsContainer || !elements.highlightsGrid) return;
    
    elements.clipsContainer.innerHTML = '';
    elements.highlightsGrid.innerHTML = '';

    if (clips.length === 0) {
        elements.clipsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                <h3>No clips found</h3>
                <p>Try adjusting your filters or use a different video/SRT file.</p>
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

    updateSummaryStats(clips);
}

function updateSummaryStats(clips) {
    if (!elements.totalClips || !elements.avgScore || !elements.topCategory) return;
    
    const avgScore = clips.length > 0 ? 
        (clips.reduce((sum, clip) => sum + clip.viralityScore, 0) / clips.length).toFixed(1) : '0.0';
    
    const categories = clips.map(clip => clip.category);
    const topCategory = categories.length > 0 ? 
        categories.reduce((a, b, i, arr) => 
            arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
        ) : 'None';

    elements.totalClips.textContent = clips.length;
    elements.avgScore.textContent = avgScore;
    elements.topCategory.textContent = topCategory;
}

// Filter and Sort Functions
function applyFilters() {
    if (!appState.clips.length) return;
    
    let filteredClips = [...appState.clips];

    // Apply category filter
    if (elements.filterCategory) {
        const categoryFilter = elements.filterCategory.value;
        if (categoryFilter !== 'all') {
            filteredClips = filteredClips.filter(clip => clip.category === categoryFilter);
        }
    }

    // Apply score filter
    if (elements.minScore) {
        const minScore = parseInt(elements.minScore.value);
        filteredClips = filteredClips.filter(clip => clip.viralityScore >= minScore);
    }

    // Apply sorting
    if (elements.sortBy) {
        const sortBy = elements.sortBy.value;
        filteredClips.sort((a, b) => {
            switch (sortBy) {
                case 'score':
                    return b.viralityScore - a.viralityScore;
                case 'duration':
                    return parseInt(a.duration) - parseInt(b.duration);
                case 'category':
                    return a.category.localeCompare(b.category);
                default:
                    return 0;
            }
        });
    }

    renderClips(filteredClips);
}

// Analysis Functions
async function analyzeUrl() {
    if (appState.isAnalyzing) return;
    
    const videoUrl = elements.videoUrl?.value;
    const platform = appState.selectedPlatform;

    if (!videoUrl) {
        showError('Please enter a YouTube URL');
        return;
    }

    if (!isValidYouTubeUrl(videoUrl)) {
        showError('Please enter a valid YouTube URL');
        return;
    }

    appState.isAnalyzing = true;
    appState.currentVideoUrl = videoUrl;

    try {
        updateStatus('Analyzing...');
        showSection(elements.progressSection);

        updateProgress(1, 10, 'Connecting to YouTube API...');

        const response = await fetch(`${API_BASE}/api/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoUrl, platform })
        });

        updateProgress(2, 30, 'Extracting transcript...');

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const text = await response.text();
            throw new Error('Server returned non-JSON response');
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Analysis failed');
        }

        updateProgress(3, 60, 'Analyzing content with AI...');

        const data = await response.json();

        updateProgress(4, 90, 'Calculating virality scores...');

        if (data.success && data.clips) {
            appState.clips = data.clips;
            appState.analysisComplete = true;
            appState.canDownloadClips = data.canDownloadClips || false;

            updateProgress(4, 100, 'Analysis complete!');

            setTimeout(() => {
                showSection(elements.resultsSection);
                renderClips(data.clips);
                updateStatus('Analysis Complete');
                
                const downloadMsg = appState.canDownloadClips ? 
                    ' Click any quality button to download video clips directly!' : 
                    ' Use FFmpeg commands to extract clips.';
                showNotification(`✅ Found ${data.clips.length} viral clips!${downloadMsg}`, 'success');
            }, 1000);
        } else {
            throw new Error(data.error || 'Analysis failed');
        }

    } catch (error) {
        console.error('Analysis error:', error);
        showError(error.message || 'Failed to analyze video. Please check the URL and try again.');
    } finally {
        appState.isAnalyzing = false;
    }
}

async function analyzeSrt() {
    if (appState.isAnalyzing) return;

    const srtFileInput = elements.srtFile;
    const videoUrl = elements.srtVideoUrl?.value || ''; // Get URL from SRT section
    
    if (!srtFileInput || srtFileInput.files.length === 0) {
        showError('Please select an SRT file');
        return;
    }

    appState.isAnalyzing = true;

    try {
        updateStatus('Analyzing SRT file...');
        showSection(elements.progressSection);

        updateProgress(1, 20, 'Uploading SRT file...');

        const formData = new FormData();
        formData.append('srtFile', srtFileInput.files[0]);
        
        // Add video URL if provided
        if (videoUrl && isValidYouTubeUrl(videoUrl)) {
            formData.append('videoUrl', videoUrl);
            updateProgress(1, 25, 'Uploading SRT file with video URL...');
        }

        updateProgress(2, 40, 'Parsing subtitle content...');

        const response = await fetch(`${API_BASE}/api/analyze-srt`, {
            method: 'POST',
            body: formData
        });

        updateProgress(3, 70, 'Analyzing content with AI...');

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error('Server returned non-JSON response');
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'SRT analysis failed');
        }

        const data = await response.json();

        updateProgress(4, 90, 'Calculating virality scores...');

        if (data.success && data.clips) {
            appState.clips = data.clips;
            appState.analysisComplete = true;
            appState.canDownloadClips = data.canDownloadClips || false;

            updateProgress(4, 100, 'Analysis complete!');

            setTimeout(() => {
                showSection(elements.resultsSection);
                renderClips(data.clips);
                updateStatus('SRT Analysis Complete');
                
                const videoMessage = data.canDownloadClips ? 
                    ' Video clips can be downloaded directly!' : 
                    ' Add a YouTube URL to enable direct video downloads.';
                showNotification(`✅ Found ${data.clips.length} viral clips!${videoMessage}`, 'success');
            }, 1000);
        } else {
            throw new Error(data.error || 'SRT analysis failed');
        }

    } catch (error) {
        console.error('SRT Analysis error:', error);
        showError(error.message || 'Failed to analyze SRT file. Please check the file format and try again.');
    } finally {
        appState.isAnalyzing = false;
    }
}

// Event Listeners
function initializeEventListeners() {
    // URL input validation
    if (elements.videoUrl) {
        elements.videoUrl.addEventListener('input', (e) => {
            const url = e.target.value.trim();
            appState.currentVideoUrl = url;

            if (url === '') {
                if (elements.urlValidation) elements.urlValidation.textContent = '';
                if (elements.analyzeBtn) elements.analyzeBtn.disabled = true;
                return;
            }

            if (isValidYouTubeUrl(url)) {
                if (elements.urlValidation) {
                    elements.urlValidation.innerHTML = '<i class="fas fa-check"></i> Valid YouTube URL detected';
                    elements.urlValidation.className = 'url-validation validation-success';
                }
                if (elements.analyzeBtn) elements.analyzeBtn.disabled = false;
            } else {
                if (elements.urlValidation) {
                    elements.urlValidation.innerHTML = '<i class="fas fa-times"></i> Please enter a valid YouTube URL';
                    elements.urlValidation.className = 'url-validation validation-error';
                }
                if (elements.analyzeBtn) elements.analyzeBtn.disabled = true;
            }
        });

        // Enter key support
        elements.videoUrl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && elements.analyzeBtn && !elements.analyzeBtn.disabled) {
                analyzeUrl();
            }
        });
    }

    // SRT Video URL validation
    if (elements.srtVideoUrl) {
        elements.srtVideoUrl.addEventListener('input', (e) => {
            const url = e.target.value.trim();

            if (url === '') {
                if (elements.srtUrlValidation) elements.srtUrlValidation.textContent = '';
                return;
            }

            if (isValidYouTubeUrl(url)) {
                if (elements.srtUrlValidation) {
                    elements.srtUrlValidation.innerHTML = '<i class="fas fa-check"></i> Valid YouTube URL - video downloads enabled';
                    elements.srtUrlValidation.className = 'url-validation validation-success';
                }
            } else {
                if (elements.srtUrlValidation) {
                    elements.srtUrlValidation.innerHTML = '<i class="fas fa-times"></i> Invalid YouTube URL';
                    elements.srtUrlValidation.className = 'url-validation validation-error';
                }
            }
        });
    }

    // Platform selection
    elements.platformBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            appState.updatePlatform(btn.dataset.platform);
        });
    });

    // Tab switching
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            appState.switchTab(btn.dataset.tab);
        });
    });

    // File upload handlers
    if (elements.srtFile) {
        elements.srtFile.addEventListener('change', handleSrtFileSelect);
    }

    // Click to upload handlers
    if (elements.srtUploadArea) {
        elements.srtUploadArea.addEventListener('click', () => {
            if (elements.srtFile) elements.srtFile.click();
        });
    }

    // Analyze buttons
    if (elements.analyzeBtn) {
        elements.analyzeBtn.addEventListener('click', analyzeUrl);
    }
    if (elements.analyzeSrtBtn) {
        elements.analyzeSrtBtn.addEventListener('click', analyzeSrt);
    }

    // Filter and sort controls
    if (elements.sortBy) {
        elements.sortBy.addEventListener('change', applyFilters);
    }

    if (elements.filterCategory) {
        elements.filterCategory.addEventListener('change', applyFilters);
    }

    if (elements.minScore) {
        elements.minScore.addEventListener('input', (e) => {
            if (elements.minScoreValue) {
                elements.minScoreValue.textContent = e.target.value;
            }
            applyFilters();
        });
    }

    // Retry button
    if (elements.retryBtn) {
        elements.retryBtn.addEventListener('click', () => {
            showSection(null);
            appState.reset();
            updateStatus('Ready');
            
            // Clear file inputs
            if (elements.srtFile) elements.srtFile.value = '';
            if (elements.videoUrl) elements.videoUrl.value = '';
            if (elements.srtVideoUrl) elements.srtVideoUrl.value = '';
            
            // Reset file displays
            handleSrtFileSelect();
            
            // Clear validations
            if (elements.urlValidation) elements.urlValidation.textContent = '';
            if (elements.srtUrlValidation) elements.srtUrlValidation.textContent = '';
        });
    }
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

    // Set up drag and drop
    setupDragAndDrop();

    // Check API health
    checkAPIHealth();

    // Show initial status
    updateStatus('Ready');

    console.log('🚀 Viral Clip Extractor initialized successfully!');
}

// CSS Animations and Styles
const cssAnimations = `
@keyframes slideInRight {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

@keyframes slideOutRight {
    from {
        transform: translateX(0);
        opacity: 1;
    }
    to {
        transform: translateX(100%);
        opacity: 0;
    }
}

.empty-state {
    text-align: center;
    padding: 60px 20px;
    color: #666;
}

.empty-state h3 {
    margin-bottom: 10px;
    color: #333;
}

.ffmpeg-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.btn {
    border: none;
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s ease;
    text-decoration: none;
    display: inline-block;
}

.btn-primary {
    background: #007cba;
    color: white;
}

.btn-primary:hover {
    background: #005a8b;
}

.btn-secondary {
    background: #6c757d;
    color: white;
}

.btn-secondary:hover {
    background: #545b62;
}

.btn-success {
    background: #28a745;
    color: white;
}

.btn-success:hover {
    background: #218838;
}

.btn-danger {
    background: #dc3545;
    color: white;
}

.btn-danger:hover {
    background: #c82333;
}

.btn-warning {
    background: #fd7e14;
    color: white;
}

.btn-warning:hover {
    background: #e8690b;
}

.btn-info {
    background: #17a2b8;
    color: white;
}

.btn-info:hover {
    background: #138496;
}

.btn-small {
    padding: 6px 10px;
    font-size: 11px;
}

.video-download-section {
    margin: 15px 0;
    padding: 10px;
    background: #f0f8ff;
    border-radius: 5px;
    border: 1px solid #e0e0e0;
}

.video-download-section strong {
    display: block;
    margin-bottom: 8px;
    color: #007cba;
}

.quality-buttons {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
}

.download-section {
    margin-top: 15px;
}

.other-downloads {
    margin-top: 10px;
}

.upload-section {
    margin-bottom: 20px;
}

.upload-section h3 {
    color: #333;
    margin-bottom: 10px;
}
`;

// Add CSS to page
const styleSheet = document.createElement('style');
styleSheet.textContent = cssAnimations;
document.head.appendChild(styleSheet);

// Start the application when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
