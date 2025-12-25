# CapRover Setup Guide

Detailed guide for setting up CapRover on Oracle Cloud for Play Prediction Market.

## Prerequisites

- ✅ Oracle Cloud account with free tier
- ✅ CapRover installed on Oracle Cloud instance
- ✅ Domain name (or use CapRover's free domain)
- ✅ SSH access to Oracle Cloud instance

---

## CapRover Installation (If Not Done)

### 1. Create Oracle Cloud Instance

1. Log in to Oracle Cloud
2. Create Compute Instance:
   - Shape: VM.Standard.E2.1.Micro (free tier)
   - Image: Ubuntu 24.04 LTS
   - Boot volume: 50GB
   - Public IP: Assign

3. Configure Security Rules:
   ```
   Port 80   - HTTP
   Port 443  - HTTPS
   Port 3000 - CapRover Dashboard
   Port 996  - CapRover Registry
   ```

### 2. Install CapRover

SSH into your instance:

```bash
ssh ubuntu@your-instance-ip

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Logout and login again
exit
ssh ubuntu@your-instance-ip

# Install CapRover
docker run -p 80:80 -p 443:443 -p 3000:3000 -v /var/run/docker.sock:/var/run/docker.sock -v /captain:/captain caprover/caprover
```

### 3. Initial CapRover Setup

1. Go to `http://your-instance-ip:3000`
2. Default password: `captain42`
3. Change password immediately
4. Configure root domain (e.g., `yourdomain.com`)
5. Enable HTTPS with Let's Encrypt

---

## Creating Applications

### Backend Applications

#### 1. Create `prediction-backend-staging`

1. Go to CapRover Dashboard → Apps
2. Click "Create New App"
3. App Name: `prediction-backend-staging`
4. Click "Create"
5. Go to app settings:
   - **HTTP Settings**:
     - Enable HTTPS: ✅
     - Force HTTPS: ✅
     - Container HTTP Port: `4000`
     - Websocket Support: ✅
   
   - **App Configs**:
     - Instance Count: `1`
   
   - **Environment Variables**: (Add from `.env.staging.template`)
     ```
     SUPABASE_URL=https://xxxxx.supabase.co
     SUPABASE_ANON_KEY=your-key
     SUPABASE_SERVICE_ROLE_KEY=your-key
     DATABASE_URL=postgresql://...
     REDIS_URL=redis://:your-redis-password@srv-captain--redis-staging:6379
     PORT=4000
     NODE_ENV=production
     LOG_LEVEL=info
     WORKER_CONCURRENCY=5
     ENABLE_WORKER=true
     REGISTRATION_BONUS_AMOUNT=100000000
     
     > [!IMPORTANT]
     > If your password contains special characters like `@`, `:`, `&`, or `#`, you **must** URL-encode them (e.g., `@` becomes `%40`).
     ```

6. Save & Update

#### 2. Create `prediction-backend`

Repeat the same steps but:
- App Name: `prediction-backend`
- Use production Supabase credentials
- `REDIS_URL=redis://srv-captain--redis-production:6379`
- `LOG_LEVEL=warn`
- `WORKER_CONCURRENCY=10`

---

### Frontend Applications

#### 1. Create `prediction-frontend-staging`

1. Create New App: `prediction-frontend-staging`
2. Settings:
   - **HTTP Settings**:
     - Enable HTTPS: ✅
     - Force HTTPS: ✅
     - Container HTTP Port: `80`
   
   - **Environment Variables**:
     ```
     VITE_API_URL=https://backend-staging.yourdomain.com
     ```

3. Save & Update

#### 2. Create `prediction-frontend`

Same steps but:
- App Name: `prediction-frontend`
- `VITE_API_URL=https://api.yourdomain.com`

---

### Redis Applications

#### 1. Create `prediction-redis-staging`

1. Go to Apps → One-Click Apps/Databases
2. Select "Redis"
3. App Name: `prediction-redis-staging`
4. Click "Deploy"
5. **Add Password**:
   - Go to app settings → App Configs
   - Under "Service Update" → "Command Override", set:
     ```
     redis-server --requirepass your-staging-password
     ```
   - Click "Save & Update"

#### 2. Create `prediction-redis`

1. Same steps: `prediction-redis`
2. **Add Password**:
   - Same as above: `redis-server --requirepass your-production-password`
3. After deployment, enable persistence:
   - Go to app settings
   - Add environment variable:
     ```
     REDIS_APPENDONLY=yes
     ```

---

## Domain Configuration

### Option 1: Use CapRover Subdomains

CapRover automatically creates:
- `prediction-backend-staging.yourdomain.com`
- `prediction-backend.yourdomain.com`
- `prediction-frontend-staging.yourdomain.com`
- `prediction-frontend.yourdomain.com`

### Option 2: Custom Domains

For production, you might want:
- `api.yourdomain.com` → `prediction-backend`
- `yourdomain.com` → `prediction-frontend`
- `staging.yourdomain.com` → `prediction-frontend-staging`
- `api-staging.yourdomain.com` → `prediction-backend-staging`

**Setup**:
1. Go to app settings
2. Enable "Custom Domain"
3. Enter domain name
4. Update DNS records:
   ```
   A     api              -> your-instance-ip
   A     staging          -> your-instance-ip
   CNAME www              -> yourdomain.com
   ```

---

## SSL Certificates

### Enable Let's Encrypt

For each app:
1. Go to app settings
2. HTTP Settings section
3. Click "Enable HTTPS"
4. Select "Let's Encrypt"
5. Enter email
6. Click "Enable"

> [!TIP]
> Wait 1-2 minutes for certificate generation

---

## Getting App Tokens for GitHub Actions

For each app (backend-staging, backend-production, frontend-staging, frontend-production):

1. Go to CapRover Dashboard
2. Select the app
3. Go to "Deployment" tab
4. Find "Method 3: Deploy via GitHub Actions"
5. Copy the "App Token"
6. Add to GitHub Secrets

Example:
```
App: backend-staging
Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
GitHub Secret: STAGING_BACKEND_APP_TOKEN
```

---

## Network Configuration

### Internal Communication

Apps can communicate using CapRover's internal network:

```
Backend → Redis:  redis://:password@srv-captain--redis-staging:6379
Frontend → Backend: Use public HTTPS URL
```

### Firewall Rules (Oracle Cloud)

Ensure these ports are open in Oracle Cloud Security Lists:

```
Ingress Rules:
- 80/tcp    (HTTP)
- 443/tcp   (HTTPS)
- 3000/tcp  (CapRover Dashboard)
- 996/tcp   (CapRover Registry)
```

---

## Monitoring & Logs

### View Application Logs

1. Go to CapRover Dashboard
2. Select app
3. Click "Logs" tab
4. View real-time logs

### Resource Monitoring

1. Dashboard → Cluster
2. View CPU, Memory, Disk usage
3. Set up alerts if needed

---

## Backup Strategy

### Database Backups

Supabase handles automatic backups:
- Point-in-time recovery available
- Daily backups retained

### Redis Backups

For production Redis:
1. Enable persistence (already done)
2. Periodic snapshots saved to disk
3. Can restore from CapRover dashboard

### Application Backups

- Code: Stored in GitHub
- Docker images: Stored in CapRover registry
- Can redeploy any previous version

---

## Scaling

### Vertical Scaling (Oracle Cloud)

Upgrade instance size:
1. Stop CapRover
2. Resize Oracle Cloud instance
3. Restart CapRover

### Horizontal Scaling (CapRover)

Increase app instances:
1. Go to app settings
2. Change "Instance Count"
3. CapRover load balances automatically

> [!NOTE]
> Free tier Oracle Cloud limits to 1 instance

---

## Troubleshooting

### ❌ Can't Access CapRover Dashboard

**Check**:
1. Oracle Cloud Security Lists (port 3000 open?)
2. Instance firewall: `sudo ufw status`
3. CapRover running: `docker ps | grep caprover`

### ❌ App Won't Deploy

**Check**:
1. Dockerfile syntax
2. Build logs in CapRover
3. Environment variables set correctly

### ❌ SSL Certificate Failed

**Check**:
1. DNS records pointing to correct IP
2. Port 80/443 accessible
3. Domain propagated (use `dig yourdomain.com`)

---

## Security Hardening

### 1. Change Default Ports

```bash
# Change CapRover dashboard port from 3000
docker run ... -p 8080:3000 ...
```

### 2. Restrict Dashboard Access

Use Oracle Cloud Security Lists to allow only your IP:
```
Port 3000: Source = Your.IP.Address/32
```

### 3. Enable Firewall

```bash
sudo ufw enable
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp  # Restrict this
sudo ufw allow 996/tcp
```

### 4. Regular Updates

```bash
# Update CapRover
docker pull caprover/caprover
# Restart CapRover container

# Update Oracle Cloud instance
sudo apt update && sudo apt upgrade -y
```

---

## Cost Optimization

### Oracle Cloud Free Tier

- ✅ 2 VM instances (we use 1)
- ✅ 200GB storage
- ✅ 10TB outbound data/month
- ✅ Always free

### Supabase Free Tier

- ✅ 500MB database
- ✅ 1GB file storage
- ✅ 2GB bandwidth
- ✅ 50,000 monthly active users

### Total Cost: **$0/month** 🎉

---

## Next Steps

1. ✅ Complete app creation
2. ✅ Configure environment variables
3. ✅ Get app tokens for GitHub
4. ✅ Test manual deployment
5. ✅ Set up GitHub Actions
6. ✅ Configure monitoring

---

## Additional Resources

- [CapRover Documentation](https://caprover.com/docs)
- [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/)
- [Let's Encrypt](https://letsencrypt.org/)
