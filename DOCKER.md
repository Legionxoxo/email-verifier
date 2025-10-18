# Docker Deployment Guide - Email Verifier

This guide explains how to build, run, and deploy the Email Verifier application using Docker.

## Prerequisites

- Docker Engine 20.10+ installed
- Docker Compose v2.0+ installed
- At least 2GB of free disk space
- Outbound network access to SMTP servers on port 25

## Quick Start

### 1. Setup Environment Variables

Your environment file is already in the `backend/` folder. Make sure it's configured:

```bash
# The .env file should already exist at backend/.env
# If not, copy from the example:
cp backend/.env.example backend/.env
```

Edit `backend/.env` and set the required values:

```env
# REQUIRED: JWT secrets (generate strong random strings)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production

# REQUIRED: SMTP verification configuration
MX_DOMAIN=your-mx-domain.com
EM_DOMAIN=your-email-domain.com

# OPTIONAL: Email configuration for OTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### 2. Build and Run with Docker Compose (Recommended)

```bash
# Build and start the application
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down

# Stop and remove volumes (WARNING: deletes all data)
docker-compose down -v
```

### 3. Access the Application

Once running, access the application at:
- **Frontend & API**: http://localhost:5000
- **Health Check**: http://localhost:5000/api/health

## Manual Docker Commands

If you prefer not to use docker-compose:

### Build the Image

```bash
docker build -t email-verifier:latest .
```

### Run the Container

```bash
# Create volumes for data persistence
docker volume create email-verifier-db
docker volume create email-verifier-csv
docker volume create email-verifier-logs

# Run the container
docker run -d \
  --name email-verifier \
  -p 5000:5000 \
  -v email-verifier-db:/app/backend/.sql \
  -v email-verifier-csv:/app/backend/csv \
  -v email-verifier-logs:/app/backend/.logs \
  --env-file backend/.env \
  -e NODE_ENV=production \
  --restart unless-stopped \
  email-verifier:latest
```

### Manage the Container

```bash
# View logs
docker logs -f email-verifier

# Stop container
docker stop email-verifier

# Start container
docker start email-verifier

# Remove container
docker rm -f email-verifier

# Access container shell
docker exec -it email-verifier sh
```

## Data Persistence

### Volumes

The application uses three Docker volumes for data persistence:

1. **email-verifier-db**: SQLite database files
   - Path in container: `/app/backend/.sql`
   - Contains: `user_auth.db`, `verifier_queue.db`

2. **email-verifier-csv**: CSV files
   - Path in container: `/app/backend/csv`
   - Contains: All CSV files for email verification

3. **email-verifier-logs**: Application logs
   - Path in container: `/app/backend/.logs`
   - Contains: `controller.log` and other application logs

### Backup Data

```bash
# Backup database
docker run --rm \
  -v email-verifier-db:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/db-backup-$(date +%Y%m%d).tar.gz -C /data .

# Backup CSV files
docker run --rm \
  -v email-verifier-csv:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/csv-backup-$(date +%Y%m%d).tar.gz -C /data .

# Backup logs
docker run --rm \
  -v email-verifier-logs:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/logs-backup-$(date +%Y%m%d).tar.gz -C /data .

# Backup all data at once
docker run --rm \
  -v email-verifier-db:/db \
  -v email-verifier-csv:/csv \
  -v email-verifier-logs:/logs \
  -v $(pwd):/backup \
  alpine sh -c "tar czf /backup/full-backup-$(date +%Y%m%d).tar.gz -C / db csv logs"
```

### Restore Data

```bash
# Restore database
docker run --rm \
  -v email-verifier-db:/data \
  -v $(pwd):/backup \
  alpine sh -c "cd /data && tar xzf /backup/db-backup-YYYYMMDD.tar.gz"

# Restore CSV files
docker run --rm \
  -v email-verifier-csv:/data \
  -v $(pwd):/backup \
  alpine sh -c "cd /data && tar xzf /backup/csv-backup-YYYYMMDD.tar.gz"

# Restore logs
docker run --rm \
  -v email-verifier-logs:/data \
  -v $(pwd):/backup \
  alpine sh -c "cd /data && tar xzf /backup/logs-backup-YYYYMMDD.tar.gz"
```

## SMTP Port 25 Considerations

The email verifier connects to external SMTP servers on port 25 for email verification.

### Important Notes:

1. **Outbound Port 25**: The container needs to make OUTBOUND connections on port 25
   - Default Docker bridge network allows this
   - No special configuration needed in Dockerfile

2. **ISP/Cloud Provider Restrictions**:
   - Many ISPs block outbound port 25 to prevent spam
   - Cloud providers (AWS, GCP, Azure) often block port 25 by default
   - **Solutions**:
     - Request port 25 unblocking from your provider
     - Use a VPS/dedicated server with port 25 access
     - Use SMTP relay services
     - Set `MOCK_SMTP_MODE=true` for testing

3. **Testing Port 25 Access**:
   ```bash
   # From within the container
   docker exec -it email-verifier sh -c "nc -zv smtp.gmail.com 25"

   # Expected output if port 25 is accessible:
   # Connection to smtp.gmail.com 25 port [tcp/smtp] succeeded!
   ```

## Environment Variables

All environment variables are documented in `backend/.env.example`.

The Docker setup uses the `backend/.env` file automatically via the `env_file` directive in `docker-compose.yml`.

### Required Variables:
- `JWT_SECRET`: Secret key for JWT tokens
- `JWT_REFRESH_SECRET`: Secret key for refresh tokens
- `MX_DOMAIN`: Your MX domain for email verification
- `EM_DOMAIN`: Your email domain for verification

### Optional Variables:
- `PORT`: Application port (default: 5000)
- `NODE_ENV`: Environment (production/development)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: For OTP emails
- `MAX_CSV_ROWS`: Maximum CSV rows (default: 100000)
- `MAX_CSV_SIZE_MB`: Maximum CSV size (default: 100MB)

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs

# Common issues:
# 1. Missing environment variables - check backend/.env file
# 2. Port 5000 already in use - change PORT in backend/.env
# 3. Permission issues - ensure Docker has volume access
```

### Database connection errors

```bash
# Check if database volume exists
docker volume ls | grep email-verifier-db

# Check database file permissions
docker exec -it email-verifier ls -la /app/backend/.sql

# Recreate database (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d
```

### SMTP verification not working

```bash
# Test port 25 access from container
docker exec -it email-verifier sh -c "nc -zv smtp.gmail.com 25"

# If blocked, enable mock mode for testing
# In backend/.env: MOCK_SMTP_MODE=true
# Then restart: docker-compose restart
```

### Out of disk space

```bash
# Remove unused Docker data
docker system prune -a --volumes

# Check Docker disk usage
docker system df
```

## Production Deployment

### Security Checklist

- [ ] Use strong, randomly generated JWT secrets
- [ ] Set `NODE_ENV=production`
- [ ] Configure proper CORS_ORIGIN
- [ ] Use HTTPS reverse proxy (nginx, Traefik, Caddy)
- [ ] Enable Docker secrets for sensitive data
- [ ] Limit container resources (CPU, memory)
- [ ] Set up log rotation
- [ ] Implement backup strategy
- [ ] Monitor health checks
- [ ] Use firewall rules for container isolation

### Resource Limits

Add to `docker-compose.yml`:

```yaml
services:
  email-verifier:
    # ... existing config ...
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### Reverse Proxy Example (nginx)

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
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

### Monitoring

```bash
# View resource usage
docker stats email-verifier

# Monitor logs in real-time
docker logs -f --tail 100 email-verifier

# Health check status
docker inspect --format='{{.State.Health.Status}}' email-verifier
```

## Development vs Production

### Development Mode

```yaml
# docker-compose.dev.yml
services:
  email-verifier:
    build:
      context: .
      dockerfile: Dockerfile
    env_file:
      - backend/.env
    volumes:
      - ./backend:/app/backend
      - ./frontend:/app/frontend
      - email-verifier-db:/app/backend/.sql
      - email-verifier-csv:/app/backend/csv
      - email-verifier-logs:/app/backend/.logs
    environment:
      - NODE_ENV=development
      - MOCK_SMTP_MODE=true
    ports:
      - "5000:5000"
```

Run with: `docker-compose -f docker-compose.dev.yml up`

## Additional Commands

### View Container Details

```bash
# Inspect container
docker inspect email-verifier

# View running processes
docker top email-verifier

# View port mappings
docker port email-verifier
```

### View Application Logs

```bash
# View Docker container logs (stdout/stderr)
docker logs -f email-verifier

# Access application log files directly from volume
docker exec -it email-verifier cat /app/backend/.logs/controller.log

# Follow application logs in real-time
docker exec -it email-verifier tail -f /app/backend/.logs/controller.log

# List all log files
docker exec -it email-verifier ls -lh /app/backend/.logs/

# Copy logs from container to host
docker cp email-verifier:/app/backend/.logs ./local-logs/
```

### Database Management

```bash
# Access SQLite database
docker exec -it email-verifier sqlite3 /app/backend/.sql/user_auth.db

# Export database to SQL
docker exec -it email-verifier sqlite3 /app/backend/.sql/user_auth.db .dump > backup.sql
```

## Support

For issues and questions:
- Check logs: `docker-compose logs -f`
- Verify environment variables are set correctly
- Ensure SMTP port 25 is not blocked by your network/provider
- Check Docker documentation: https://docs.docker.com
