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

function runCommand(command) {
  return new Promise((resolve, reject) => {
    console.log('▶️ Running:', command);
    exec(command, { maxBuffer: 1024 * 1024 * 50, timeout: 120000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Error:', stderr || error.message);
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

app.post('/api/info', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Please provide a YouTube URL' });
    console.log('🔍 Fetching info for:', url);
    const command = `yt-dlp -j --no-warnings "${url}"`;
    const output = await runCommand(command);
    const data = JSON.parse(output);
    const videoInfo = {
      id: data.id,
      title: data.title || 'Untitled',
      channel: data.uploader || data.channel || 'Unknown',
      duration: data.duration || 0,
      views: data.view_count || 0,
      thumbnail: data.thumbnail || '',
    };
    console.log('✅ Found:', videoInfo.title);
    res.json(videoInfo);
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ error: 'Failed to get video info. Please check the URL and try again.' });
  }
});

app.post('/api/download', async (req, res) => {
  try {
    const { url, mode, quality } = req.body;
    if (!url || !mode || !quality) return res.status(400).json({ error: 'Missing required parameters' });
    console.log(`📥 Downloading: ${mode} | Quality: ${quality}`);
    let formatSelector = '';
    let extension = 'mp4';
    let filename = 'video';
    if (mode === 'audio') {
      const bitrateMap = {
        'mp3-320': 'bestaudio[ext=mp3]/bestaudio[abr>=320]',
        'mp3-256': 'bestaudio[ext=mp3]/bestaudio[abr>=256]',
        'mp3-192': 'bestaudio[ext=mp3]/bestaudio[abr>=192]',
        'm4a-256': 'bestaudio[ext=m4a]/bestaudio[abr>=256]',
        'm4a-128': 'bestaudio[ext=m4a]/bestaudio[abr>=128]',
        'aac-320': 'bestaudio[ext=aac]/bestaudio[abr>=320]',
        'aac-256': 'bestaudio[ext=aac]/bestaudio[abr>=256]',
      };
      formatSelector = bitrateMap[quality] || 'bestaudio/best';
      extension = quality.split('-')[0] || 'mp3';
      filename = `audio_${quality}`;
    } else if (mode === 'video') {
      const height = parseInt(quality);
      if (isNaN(height)) return res.status(400).json({ error: 'Invalid quality value' });
      formatSelector = `bestvideo[height<=${height}]`;
      extension = 'mp4';
      filename = `video_${quality}p`;
    } else {
      const height = parseInt(quality);
      if (isNaN(height)) return res.status(400).json({ error: 'Invalid quality value' });
      formatSelector = `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${height}]`;
      extension = 'mp4';
      filename = `full_${quality}p`;
    }
    const tempId = Date.now();
    const outputFile = path.join(__dirname, 'downloads', `${filename}_${tempId}.${extension}`);
    if (!fs.existsSync('downloads')) fs.mkdirSync('downloads');
    let command = `yt-dlp -f "${formatSelector}" -o "${outputFile}" "${url}"`;
    if (mode === 'audio') {
      const codec = quality.split('-')[0];
      if (codec === 'mp3') {
        command = `yt-dlp -f bestaudio -x --audio-format mp3 --audio-quality 0 -o "${outputFile.replace('.mp3', '.mp3')}" "${url}"`;
      } else if (codec === 'm4a') {
        command = `yt-dlp -f bestaudio -x --audio-format m4a --audio-quality 0 -o "${outputFile.replace('.m4a', '.m4a')}" "${url}"`;
      } else if (codec === 'aac') {
        command = `yt-dlp -f bestaudio -x --audio-format aac --audio-quality 0 -o "${outputFile.replace('.aac', '.aac')}" "${url}"`;
      }
    }
    console.log('▶️ Command:', command);
    await runCommand(command);
    let actualFile = outputFile;
    if (!fs.existsSync(actualFile)) {
      const possibleExtensions = ['.mp3', '.m4a', '.aac', '.mp4'];
      for (const ext of possibleExtensions) {
        const testFile = outputFile.replace(path.extname(outputFile), ext);
        if (fs.existsSync(testFile)) { actualFile = testFile; break; }
      }
    }
    if (!fs.existsSync(actualFile)) throw new Error('Downloaded file not found');
    const stat = fs.statSync(actualFile);
    const fileSize = stat.size;
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(actualFile)}"`);
    const fileStream = fs.createReadStream(actualFile);
    fileStream.pipe(res);
    fileStream.on('end', () => {
      setTimeout(() => {
        try {
          fs.unlinkSync(actualFile);
          console.log('🗑️ Deleted:', actualFile);
        } catch (err) {}
      }, 5000);
    });
  } catch (error) {
    console.error('❌ Download error:', error.message);
    res.status(500).json({ error: 'Download failed: ' + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});