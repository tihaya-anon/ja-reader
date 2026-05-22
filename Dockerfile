FROM node:20-bookworm

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV EXPO_NO_DOCTOR=1

WORKDIR /workspace

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    build-essential \
    ca-certificates \
    curl \
    fd-find \
    git \
    gnupg \
    jq \
    less \
    openssh-client \
    pkg-config \
    python3 \
    python3-dev \
    python3-pip \
    python3-venv \
    ripgrep \
    rsync \
    sqlite3 \
    unzip \
    vim \
    wget \
    xz-utils \
    zip \
  && rm -rf /var/lib/apt/lists/*

# Common Python tooling for EPUB/dictionary/text-processing workflows.
RUN python3 -m pip install --break-system-packages \
    beautifulsoup4 \
    ebooklib \
    lxml \
    mistletoe \
    rapidfuzz

# CLI tooling used in this project and likely upcoming workflows.
RUN npm install -g \
    @anthropic-ai/claude-code \
    @openai/codex \
    expo \
    eas-cli \
    git-cliff

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

EXPOSE 8081 19000 19001 19002

CMD ["npm", "run", "start"]
