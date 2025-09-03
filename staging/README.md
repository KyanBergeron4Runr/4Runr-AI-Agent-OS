# 🚀 4Runr Gateway Staging Environment

A production-ready staging environment for the 4Runr Gateway with TLS termination, automated backups, and hardened security.

## 📋 Prerequisites

- **VM**: Ubuntu 22.04+, 2 vCPU, 4GB RAM, 40GB disk
- **Domain**: `gateway-staging.yourdomain.com` pointing to VM public IP
- **SSH Access**: Root or sudo access to the VM

## 🛠️ Quick Setup

### 1. Server Bootstrap

SSH into your VM and run:

```bash
# Download and run the bootstrap script
curl -fsSL https://raw.githubusercontent.com/your-repo/4runr-gateway/main/staging/scripts/setup-server.sh | sudo bash
```

This will install and configure:
- Docker & Docker Compose
- Nginx with TLS support
- UFW firewall
- Fail2ban
- Automated backups
- SSL certificate management

### 2. DNS Configuration

Point your domain to the VM's public IP:

```bash
# Get your VM's public IP
curl -s ifconfig.me

# Update DNS: gateway-staging.yourdomain.com → <VM_PUBLIC_IP>
```

### 3. SSL Certificate

Get a free Let's Encrypt certificate:

```bash
sudo certbot certonly --webroot -w /var/www/certbot -d gateway-staging.yourdomain.com --agree-tos -m admin@yourdomain.com --non-interactive
sudo systemctl reload nginx
```

### 4. Deploy Gateway

```bash
# Navigate to staging directory
cd /opt/4runr-staging

# Generate secure secrets
./scripts/generate-secrets.sh

# Update API keys in secrets file
nano secrets/4runr-secrets.json

# Deploy the stack
./deploy.sh
```

## 📁 Directory Structure

```
/opt/4runr-staging/
├── docker-compose.yml          # Service orchestration
├── .env                        # Environment configuration
├── secrets/
│   └── 4runr-secrets.json     # External API keys
├── scripts/
│   ├── setup-server.sh        # Server bootstrap
│   ├── generate-secrets.sh    # Secret generation
│   └── deploy.sh              # Deployment script
└── nginx/
    └── gateway-staging.conf   # Nginx configuration
```

## 🔧 Configuration

### Environment Variables

Copy `env.example` to `.env` and update:

```bash
# Generate secure secrets
./scripts/generate-secrets.sh

# Or manually update .env with your values
nano .env
```

### External API Keys

Update `secrets/4runr-secrets.json`:

```json
{
  "serpapi": { 
    "api_key": { 
      "v1": "your-serpapi-key" 
    } 
  },
  "openai": { 
    "api_key": { 
      "v1": "your-openai-key" 
    } 
  },
  "gmail_send": { 
    "api_key": { 
      "v1": "your-gmail-key" 
    } 
  }
}
```

## 🚀 Deployment

### One-Command Deploy

```bash
cd /opt/4runr-staging
./deploy.sh
```

This script:
1. Pulls latest changes (if using git)
2. Builds the Gateway Docker image
3. Starts all services
4. Runs database migrations
5. Seeds initial data
6. Performs health checks

### Manual Deployment

```bash
# Build and start services
docker compose up -d --build

# Run migrations
docker compose exec gateway npx prisma migrate deploy

# Seed database
docker compose exec gateway node scripts/seed.js

# Health check
curl -fsS https://gateway-staging.yourdomain.com/ready
```

## 🔒 Security Features

### Network Security
- **UFW Firewall**: Only ports 22, 80, 443 open
- **Fail2ban**: Brute force protection
- **Internal Network**: Gateway only accessible via nginx
- **TLS 1.2/1.3**: Modern SSL configuration

### Application Security
- **Security Headers**: HSTS, XSS protection, etc.
- **Secret Management**: File-based secrets with proper permissions
- **Resource Limits**: Docker container resource constraints
- **Health Checks**: Automated service monitoring

### Data Protection
- **Encrypted Secrets**: All sensitive data encrypted
- **Secure Passwords**: Cryptographically strong passwords
- **Backup Encryption**: Database backups stored securely

## 💾 Backup & Recovery

### Automated Backups

Daily PostgreSQL backups at 3 AM UTC:

```bash
# Check backup status
ls -la /var/backups/4runr/

# Manual backup
sudo /usr/local/bin/pg-backup.sh

# View backup logs
tail -f /var/log/pg-backup.log
```

### Backup Retention
- **Daily backups**: Kept for 14 days
- **Location**: `/var/backups/4runr/`
- **Format**: `pg-YYYYMMDD-HHMMSS.sql.gz`

### Restore from Backup

```bash
# Restore from backup
gunzip -c /var/backups/4runr/pg-20241201-030000.sql.gz | docker exec -i $(docker ps -qf name=db) psql -U gateway gateway
```

## 🔍 Monitoring

### Health Checks

```bash
# Application health
curl https://gateway-staging.yourdomain.com/health

# Readiness check
curl https://gateway-staging.yourdomain.com/ready

# Metrics (Prometheus format)
curl https://gateway-staging.yourdomain.com/metrics
```

### Service Status

```bash
# Check all services
docker compose ps

# View logs
docker compose logs -f gateway

# Service health
docker compose exec gateway curl -fsS http://localhost:3000/ready
```

## 🔄 Maintenance

### SSL Certificate Renewal

Automated renewal twice daily:

```bash
# Manual renewal
sudo /usr/local/bin/renew-ssl.sh

# Check renewal logs
tail -f /var/log/ssl-renewal.log
```

### System Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Restart services if needed
sudo systemctl restart nginx
docker compose restart
```

### Log Rotation

```bash
# Check log sizes
du -sh /var/log/pg-backup.log /var/log/ssl-renewal.log

# Manual log rotation
sudo logrotate -f /etc/logrotate.conf
```

## 🚨 Troubleshooting

### Common Issues

#### SSL Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Renew manually
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

#### Database Connection Issues
```bash
# Check database status
docker compose exec db pg_isready -U gateway

# View database logs
docker compose logs db
```

#### Gateway Health Issues
```bash
# Check gateway logs
docker compose logs gateway

# Restart gateway
docker compose restart gateway

# Check resource usage
docker stats
```

### Log Locations

- **Application**: `docker compose logs gateway`
- **Nginx**: `/var/log/nginx/`
- **Backups**: `/var/log/pg-backup.log`
- **SSL**: `/var/log/ssl-renewal.log`
- **Fail2ban**: `/var/log/fail2ban.log`

## 📊 Performance

### Resource Usage

Typical resource consumption:
- **Gateway**: ~512MB RAM, 0.25 CPU
- **PostgreSQL**: ~256MB RAM, 0.1 CPU
- **Redis**: ~64MB RAM, 0.05 CPU
- **Nginx**: ~16MB RAM, 0.01 CPU

### Scaling Considerations

For higher load:
1. Increase container resource limits in `docker-compose.yml`
2. Add Redis clustering
3. Implement PostgreSQL read replicas
4. Add load balancer

## 🔗 Useful Commands

```bash
# Quick status check
curl -fsS https://gateway-staging.yourdomain.com/health | jq .

# View all containers
docker compose ps

# Restart specific service
docker compose restart gateway

# Update and redeploy
git pull && ./deploy.sh

# Check disk usage
df -h /opt/4runr-staging /var/backups/4runr

# Monitor real-time logs
docker compose logs -f --tail=100
```

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review application logs: `docker compose logs gateway`
3. Verify configuration files
4. Test connectivity: `curl -v https://gateway-staging.yourdomain.com/health`

---

**Status**: ✅ Production Ready  
**Last Updated**: December 2024  
**Version**: 1.0.0
