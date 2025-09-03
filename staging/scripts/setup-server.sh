#!/usr/bin/env bash
set -euo pipefail

# 4Runr Gateway Staging Server Bootstrap Script
# Run this as root or with sudo on a fresh Ubuntu 22.04+ server

echo "🚀 Setting up 4Runr Gateway Staging Server..."

# Update system
echo "📦 Updating system packages..."
apt-get update
apt-get upgrade -y

# Install required packages
echo "📦 Installing required packages..."
apt-get install -y \
  docker.io \
  docker-compose-plugin \
  nginx \
  ufw \
  fail2ban \
  curl \
  jq \
  certbot \
  python3-certbot-nginx \
  unzip \
  git

# Configure Docker
echo "🐳 Configuring Docker..."
systemctl enable docker
systemctl start docker

# Add user to docker group (replace with actual username)
if [ -n "${SUDO_USER:-}" ]; then
  usermod -aG docker "$SUDO_USER"
  echo "✅ Added $SUDO_USER to docker group"
fi

# Configure UFW firewall
echo "🔥 Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Configure fail2ban
echo "🛡️ Configuring fail2ban..."
systemctl enable fail2ban
systemctl start fail2ban

# Create staging directory
echo "📁 Creating staging directory..."
mkdir -p /opt/4runr-staging
mkdir -p /opt/4runr-staging/secrets
mkdir -p /opt/4runr-staging/nginx
mkdir -p /opt/4runr-staging/scripts
mkdir -p /var/backups/4runr

# Set proper permissions
chmod 700 /var/backups/4runr
chown -R root:root /opt/4runr-staging

# Create nginx configuration
echo "🌐 Configuring nginx..."
cat > /etc/nginx/sites-available/gateway-staging << 'EOF'
server {
  listen 80;
  server_name gateway-staging.yourdomain.com;
  
  # Let's Encrypt challenge
  location /.well-known/acme-challenge/ { 
    root /var/www/certbot; 
  }
  
  # Redirect all HTTP to HTTPS
  location / { 
    return 301 https://$host$request_uri; 
  }
}

server {
  listen 443 ssl http2;
  server_name gateway-staging.yourdomain.com;

  # SSL Configuration
  ssl_certificate     /etc/letsencrypt/live/gateway-staging.yourdomain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/gateway-staging.yourdomain.com/privkey.pem;
  
  # SSL Security Settings
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
  ssl_prefer_server_ciphers off;
  ssl_session_cache shared:SSL:10m;
  ssl_session_timeout 10m;

  # Security Headers
  add_header X-Frame-Options DENY;
  add_header X-Content-Type-Options nosniff;
  add_header X-XSS-Protection "1; mode=block";
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

  # Proxy Settings
  client_max_body_size 1m;
  proxy_read_timeout  30s;
  proxy_send_timeout  30s;
  proxy_connect_timeout 5s;

  # Health check endpoint (no auth required)
  location /health {
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_pass http://127.0.0.1:3000;
  }

  # Metrics endpoint (consider IP restrictions in production)
  location /metrics {
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_pass http://127.0.0.1:3000;
  }

  # All other endpoints
  location / {
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_pass http://127.0.0.1:3000;
  }
}
EOF

# Create certbot directory
mkdir -p /var/www/certbot

# Enable nginx site
ln -sf /etc/nginx/sites-available/gateway-staging /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

# Start nginx
systemctl enable nginx
systemctl start nginx

# Create backup script
echo "💾 Creating backup script..."
cat > /usr/local/bin/pg-backup.sh << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date -u +%Y%m%d-%H%M%S)
BACKUP_DIR="/var/backups/4runr"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Get container name
CONTAINER=$(docker ps -qf "name=4runr-staging-db-1" || docker ps -qf "name=db")

if [ -z "$CONTAINER" ]; then
  echo "ERROR: Database container not found"
  exit 1
fi

# Create backup
echo "Creating database backup: pg-${STAMP}.sql.gz"
docker exec -i "$CONTAINER" pg_dump -U gateway gateway | gzip > "$BACKUP_DIR/pg-${STAMP}.sql.gz"

# Clean old backups (keep 14 days)
echo "Cleaning old backups..."
find "$BACKUP_DIR" -name "pg-*.sql.gz" -type f -mtime +14 -delete

echo "Backup completed: pg-${STAMP}.sql.gz"
EOF

chmod +x /usr/local/bin/pg-backup.sh

# Setup daily backup cron
echo "⏰ Setting up daily backup cron..."
cat > /etc/cron.d/pg-backup << 'EOF'
# Daily PostgreSQL backup at 3 AM UTC
0 3 * * * root /usr/local/bin/pg-backup.sh >> /var/log/pg-backup.log 2>&1
EOF

# Create deployment script
echo "🚀 Creating deployment script..."
cat > /opt/4runr-staging/deploy.sh << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Deploying 4Runr Gateway Staging..."

# Change to staging directory
cd /opt/4runr-staging

# Pull latest changes (if using git)
if [ -d ".git" ]; then
  echo "📥 Pulling latest changes..."
  git pull --rebase
fi

# Build and deploy
echo "🐳 Building and deploying services..."
docker compose build gateway
docker compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 30

# Run migrations
echo "🗄️ Running database migrations..."
docker compose exec -T gateway npx prisma migrate deploy

# Seed database
echo "🌱 Seeding database..."
docker compose exec -T gateway node scripts/seed.js

# Health check
echo "🏥 Running health check..."
if curl -fsS https://gateway-staging.yourdomain.com/ready > /dev/null; then
  echo "✅ Deployment successful!"
else
  echo "❌ Health check failed!"
  exit 1
fi
EOF

chmod +x /opt/4runr-staging/deploy.sh

# Create SSL certificate renewal script
echo "🔒 Creating SSL renewal script..."
cat > /usr/local/bin/renew-ssl.sh << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

echo "🔒 Renewing SSL certificates..."

# Renew certificates
certbot renew --quiet

# Reload nginx
systemctl reload nginx

echo "✅ SSL renewal completed"
EOF

chmod +x /usr/local/bin/renew-ssl.sh

# Setup SSL renewal cron (twice daily)
echo "⏰ Setting up SSL renewal cron..."
cat > /etc/cron.d/ssl-renewal << 'EOF'
# SSL certificate renewal (twice daily)
0 6,18 * * * root /usr/local/bin/renew-ssl.sh >> /var/log/ssl-renewal.log 2>&1
EOF

echo ""
echo "✅ Server setup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Update DNS: gateway-staging.yourdomain.com → $(curl -s ifconfig.me)"
echo "2. Copy configuration files to /opt/4runr-staging/"
echo "3. Update .env and secrets files with your values"
echo "4. Run: cd /opt/4runr-staging && ./deploy.sh"
echo ""
echo "🔒 To get SSL certificate:"
echo "certbot certonly --webroot -w /var/www/certbot -d gateway-staging.yourdomain.com"
echo ""
echo "📁 Staging directory: /opt/4runr-staging/"
echo "💾 Backup directory: /var/backups/4runr/"
echo "🌐 Nginx config: /etc/nginx/sites-available/gateway-staging"
