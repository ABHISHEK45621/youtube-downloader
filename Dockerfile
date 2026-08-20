FROM node:18-slim

# Install Python, pip, ffmpeg, and yt-dlp
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    wget \
    git \
    && pip3 install --upgrade pip \
    && pip3 install yt-dlp \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install PO Token Provider (bypasses bot detection)
RUN git clone https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /pot-provider \
    && cd /pot-provider/server \
    && npm install \
    && npm run build

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p downloads

EXPOSE 3001

CMD [ "node", "server.js" ]
