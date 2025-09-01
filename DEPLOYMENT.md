# 4Runr Gateway - Deployment Guide

## 🚀 Quick Start

### **Prerequisites**
- Node.js 18+ 
- npm or yarn
- Git

### **Installation**

1. **Clone the repository**
```bash
git clone https://github.com/KyanBergeron4Runr/4Runr-AI-Agent-OS.git
cd 4Runr-AI-Agent-OS
```

2. **Install dependencies**
```bash
npm install
```

3. **Start the gateway**
```bash
npm start
```

The gateway will be available at `http://localhost:3000`

## ⚙️ Configuration

### **Environment Variables**

Create a `.env` file in the project root:

```bash
# Server Configuration
PORT=3000
HOST=127.0.0.1

# Body Limits
GATEWAY_BODY_LIMIT_BYTES=262144      # 256KB
RUN_INPUT_STRING_MAX=65536           # 64KB

# Idempotency
IDEMP_TTL_MS=86400000               # 24 hours

# Rate Limiting
RATE_LIMIT_ENABLED=false            # Disabled by default
RATE_LIMIT_PER_SEC=50              # 50 req/sec when enabled

# Logging
LOG_LEVEL=info                      # debug, info, warn, error
```

### **Production Configuration**

For production deployment:

```bash
# Enable rate limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_PER_SEC=100

# Increase body limits if needed
GATEWAY_BODY_LIMIT_BYTES=524288    # 512KB

# Set log level
LOG_LEVEL=warn
```

## 🐳 Docker Deployment

### **Dockerfile**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "production-gateway.js"]
```

### **Docker Compose**
```yaml
version: '3.8'

services:
  gateway:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - RATE_LIMIT_ENABLED=true
      - RATE_LIMIT_PER_SEC=100
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### **Build and Run**
```bash
# Build the image
docker build -t 4runr-gateway .

# Run the container
docker run -p 3000:3000 4runr-gateway

# Or with docker-compose
docker-compose up -d
```

## ☸️ Kubernetes Deployment

### **Deployment YAML**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: 4runr-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: 4runr-gateway
  template:
    metadata:
      labels:
        app: 4runr-gateway
    spec:
      containers:
      - name: gateway
        image: 4runr-gateway:latest
        ports:
        - containerPort: 3000
        env:
        - name: PORT
          value: "3000"
        - name: RATE_LIMIT_ENABLED
          value: "true"
        - name: RATE_LIMIT_PER_SEC
          value: "100"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### **Service YAML**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: 4runr-gateway-service
spec:
  selector:
    app: 4runr-gateway
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

### **Deploy to Kubernetes**
```bash
# Apply the deployment
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml

# Check status
kubectl get pods
kubectl get services
```

## 🔧 Health Checks

### **Health Endpoint**
```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "ok": true,
  "version": "2.0.0",
  "time": "2025-09-01T01:42:30.123Z",
  "config": {
    "bodyLimitBytes": 262144,
    "rateLimitEnabled": false,
    "rateLimitPerSec": 50
  }
}
```

### **Readiness Probe**
```bash
curl http://localhost:3000/ready
```

**Response:**
```json
{
  "ready": true,
  "timestamp": "2025-09-01T01:42:30.123Z"
}
```

## 📊 Monitoring

### **Metrics Endpoint**
```bash
curl http://localhost:3000/metrics
```

**Available Metrics:**
- `runs_total` - Total number of runs
- `sse_connections_opened` - Total SSE connections opened
- `sse_connections_closed` - Total SSE connections closed
- `sse_active_connections` - Currently active SSE connections
- `sse_messages_total` - Total SSE messages sent
- `idempotency_store_size` - Current idempotency store size

### **Prometheus Configuration**
```yaml
scrape_configs:
  - job_name: '4runr-gateway'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: /metrics
    scrape_interval: 15s
```

### **Grafana Dashboard**

Create a dashboard with the following panels:
- Request rate (runs_total rate)
- Active SSE connections (sse_active_connections)
- Error rate (from logs)
- Response time percentiles
- Idempotency hit rate

## 🔒 Security

### **Firewall Configuration**
```bash
# Allow only necessary ports
sudo ufw allow 3000/tcp
sudo ufw enable
```

### **Reverse Proxy (nginx)**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### **SSL/TLS with Let's Encrypt**
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

## 🧪 Testing

### **Run Integration Tests**
```bash
# Run the full integration test
npm run test:integration

# Run stress test
npm run test:stress

# Run feature tests
npm run test:features
```

### **Manual Testing**
```bash
# Test health endpoint
curl http://localhost:3000/health

# Test run creation
curl -X POST http://localhost:3000/api/runs \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Run", "input": "test"}'

# Test SSE streaming
curl -H "Accept: text/event-stream" \
  http://localhost:3000/api/runs/YOUR_RUN_ID/logs/stream
```

## 📈 Scaling

### **Horizontal Scaling**
- Deploy multiple instances behind a load balancer
- Use sticky sessions for SSE connections
- Configure shared idempotency store (Redis)

### **Vertical Scaling**
- Increase Node.js memory limit: `--max-old-space-size=4096`
- Optimize garbage collection settings
- Monitor and tune based on metrics

### **Load Balancer Configuration**
```nginx
upstream gateway_backend {
    least_conn;
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}

server {
    listen 80;
    location / {
        proxy_pass http://gateway_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🔍 Troubleshooting

### **Common Issues**

#### **Port Already in Use**
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

#### **Memory Issues**
```bash
# Check memory usage
ps aux | grep node

# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=2048" npm start
```

#### **SSE Connection Issues**
- Check firewall settings
- Verify proxy configuration
- Ensure proper headers are set

### **Logs**
```bash
# View application logs
tail -f logs/gateway.log

# Check system logs
journalctl -u 4runr-gateway -f
```

### **Debug Mode**
```bash
# Enable debug logging
LOG_LEVEL=debug npm start
```

## 📚 Additional Resources

- [API Documentation](README.md#api-documentation)
- [Test Results](TEST-RESULTS.md)
- [Production Features](PRODUCTION-README.md)

## 🆘 Support

For deployment issues:
- Check the [troubleshooting section](#troubleshooting)
- Review the [test results](TEST-RESULTS.md)
- Open an issue on GitHub

---

**Ready to deploy? Start with the [Quick Start](#quick-start) section!** 🚀
