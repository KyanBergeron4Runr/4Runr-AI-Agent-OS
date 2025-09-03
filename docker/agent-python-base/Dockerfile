FROM python:3.11-alpine
WORKDIR /app
RUN addgroup -S agent && adduser -S agent -G agent
RUN mkdir -p /app && chown -R agent:agent /app
USER agent
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
CMD ["python", "/app/main.py"]
