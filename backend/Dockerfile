FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY . .
ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_PATH=/data/database.sqlite
EXPOSE 3001
CMD ["node", "server.js"]

