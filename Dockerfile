FROM node:18-slim

# Install Python, pip, and ytagent
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    wget \
    git \
    && pip3 install --upgrade pip \
    && pip3 install ytagent-cli \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install PO Token Provider (needed for ytagent)
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
