FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && addgroup -S app && adduser -S app -G app
COPY --chown=app:app public ./public
COPY --chown=app:app server.js ./server.js
USER app
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
