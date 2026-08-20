const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

console.log('🚀 Starting YouTube Downloader with ytagent...');

// ─── Helper: Run ytagent command ───
function runCommand(command) {
    return new Promise((resolve, reject) => {
        console.log('▶️ Running:', command);
        
        exec(command, { 
            maxBuffer: 1024 * 1024 * 50, 
            timeout: 180000 
        }, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ Command error:', error.message);
                console.error('❌ stderr:', stderr);
                reject(new Error(stderr || error.message));
                return;
            }
            if (stderr) {
                console.log('⚠️ stderr:', stderr);
            }
            resolve(stdout);
        });
    });
}

// ─── Helper: Get video info using ytagent ───
async function getVideoInfo(url) {
    try {
        // First try with ytagent
        console.log('📥 Using ytagent to fetch info...');
        const command = `ytagent download "${url}" --format json --quality best`;
        const output = await runCommand(command);
        
        // Parse the JSON output
        const data = JSON.parse(output);
        console.log('✅ Video found via ytagent:', data.title);
        
        return {
            id: data.id || data.video_id,
            title: data.title || 'Untitled',
            channel: data.uploader || data.channel || 'Unknown',
            duration: data.duration || 0,
            views: data.view_count || 0,
            thumbnail: data.thumbnail || '',
            formats: data.formats || []
        };
    } catch (error) {
        console.error('❌ ytagent failed:', error.message);
        
        // Fallback: Try with yt-dlp (if available)
        console.log('🔄 Falling back to yt-dlp...');
        try {
            const command = `yt-dlp -j --no-warnings "${url}"`;
            const output = await runCommand(command);
            const data = JSON.parse(output);
            
            return {
                id: data.id,
                title: data.title || 'Untitled',
                channel: data.uploader || data.channel || 'Unknown',
                duration: data.duration || 0,
                views: data.view_count || 0,
                thumbnail: data.thumbnail || '',
                formats: data.formats || []
            };
        } catch (fallbackError) {
            console.error('❌ Both methods failed');
            throw new Error('Could not fetch video info. Please try again.');
        }
    }
}

// ─── Helper: Download video using ytagent ───
async function downloadVideo(url, mode, quality) {
    const tempId = Date.now();
    let extension = 'mp4';
    let filename = `video_${tempId}`;
    let formatOption = '';
    
    if (mode === 'audio') {
        extension = quality.split('-')[0] || 'mp3';
        filename = `audio_${tempId}`;
        formatOption = '--audio-only --audio-format ' + extension;
    } else if (mode === 'video') {
        const height = parseInt(quality);
        if (isNaN(height)) throw new Error('Invalid quality value');
        formatOption = `--quality ${quality}p --video-only`;
        filename = `video_${tempId}`;
    } else {
        const height = parseInt(quality);
        if (isNaN(height)) throw new Error('Invalid quality value');
        formatOption = `--quality ${quality}p`;
        filename = `full_${tempId}`;
    }
    
    const outputFile = path.join(__dirname, 'downloads', `${filename}.${extension}`);
    
    if (!fs.existsSync('downloads')) {
        fs.mkdirSync('downloads');
    }
    
    // Build ytagent command
    const command = `ytagent download "${url}" --output "${outputFile}" ${formatOption}`;
    console.log('▶️ Download command:', command);
    
    await runCommand(command);
    
    // Check if file exists
    if (!fs.existsSync(outputFile)) {
        throw new Error('Downloaded file not found');
    }
    
    return outputFile;
}

// ─── API: Get Video Info ───
app.post('/api/info', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'Please provide a YouTube URL' });
        }
        
        console.log('📥 Fetching URL:', url);
        const videoInfo = await getVideoInfo(url);
        res.json(videoInfo);
        
    } catch (error) {
        console.error('❌ Error details:', error.message);
        res.status(500).json({ 
            error: 'Failed to get video info: ' + error.message 
        });
    }
});

// ─── API: Download Video ───
app.post('/api/download', async (req, res) => {
    try {
        const { url, mode, quality } = req.body;
        if (!url || !mode || !quality) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }
        
        console.log(`📥 Downloading: ${mode} | Quality: ${quality}`);
        
        const outputFile = await downloadVideo(url, mode, quality);
        const stat = fs.statSync(outputFile);
        
        // Get filename
        const filename = path.basename(outputFile);
        
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        const fileStream = fs.createReadStream(outputFile);
        fileStream.pipe(res);
        
        fileStream.on('end', () => {
            setTimeout(() => {
                try {
                    fs.unlinkSync(outputFile);
                    console.log('🗑️ Deleted:', outputFile);
                } catch (err) {}
            }, 5000);
        });
        
    } catch (error) {
        console.error('❌ Download error:', error.message);
        res.status(500).json({ 
            error: 'Download failed: ' + error.message 
        });
    }
});

// ─── Serve frontend ───
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Health check ───
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'YouTube Downloader is running with ytagent!' });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Open: http://localhost:${PORT}`);
});
