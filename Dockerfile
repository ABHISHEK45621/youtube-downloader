FROM node:18-slim

# Step 1: Install system dependencies (python3, pip, ffmpeg)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Step 2: Install yt-dlp separately with a retry flag to avoid network timeouts
RUN pip3 install yt-dlp --retries 5

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package files and install Node dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Create the downloads folder
RUN mkdir -p downloads

# Expose the port the app runs on
EXPOSE 3001

# Command to run the application
CMD [ "node", "server.js" ]