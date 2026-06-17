FROM node:22-slim
WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json .
RUN npm install --omit=dev

COPY src/ ./src/
RUN mkdir -p /app/models

USER node
EXPOSE 3002
CMD ["node", "src/index.js"]
