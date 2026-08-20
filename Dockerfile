FROM node:18-alpine

# Install Python, pip, ffmpeg, and yt-dlp
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    && pip3 install --upgrade pip \
    && pip3 install yt-dlp

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p downloads

EXPOSE 3001

CMD [ "node", "server.js" ]
