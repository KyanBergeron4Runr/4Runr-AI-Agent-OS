FROM node:20-alpine
WORKDIR /app
# Create non-root user
RUN addgroup -S agent && adduser -S agent -G agent
RUN mkdir -p /app && chown -R agent:agent /app
USER agent
# Set sane defaults; app volume mounted at /app
ENV NODE_ENV=production
CMD ["node", "/app/index.js"]
