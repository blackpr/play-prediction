# Deployment Guide

Complete guide for deploying Play Prediction Market to staging and production environments using CapRover and GitHub Actions.

## Architecture Overview

```mermaid
graph LR
    A[Developer] -->|Push to develop| B[GitHub Actions]
    A -->|Push to main| B
    B -->|Run Tests| C{Tests Pass?}
    C -->|No| D[❌ Fail]
    C -->|Yes| E[Run Migrations]
    E -->|Success| F[Deploy to CapRover]
    F --> G[Staging/Production]
```

## Prerequisites

### 1. CapRover Setup
- ✅ CapRover installed on Oracle Cloud
- ✅ Domain configured and SSL enabled
- ✅ Access to CapRover dashboard

### 2. Supabase Projects
- ✅ Staging Supabase project created
- ✅ Production Supabase project created
- ✅ Database credentials available

### 3. GitHub Repository
- ✅ Code pushed to GitHub
- ✅ Admin access to repository settings

---

## Initial Setup

### Step 1: Create Supabase Projects

**Staging Project**:
1. Go to [supabase.com](https://supabase.com)
2. Create new project: `play-prediction-staging`
3. Note down:
   - Project URL: `https://xxxxx.supabase.co`
   - Anon key
   - Service role key
   - Database password

**Production Project**:
1. Create new project: `play-prediction-production`
2. Note down the same credentials

### Step 2: Configure CapRover Apps

Create the following apps in CapRover:

#### Backend Apps
1. **backend-staging**
   - Type: Dockerfile
   - Enable HTTPS
   - Port: 4000

2. **backend-production**
   - Type: Dockerfile
   - Enable HTTPS
   - Port: 4000

#### Frontend Apps
3. **frontend-staging**
   - Type: Dockerfile
   - Enable HTTPS
   - Port: 80

4. **frontend-production**
   - Type: Dockerfile
   - Enable HTTPS
   - Port: 80

#### Redis Apps
5. **redis-staging**
   - Use CapRover One-Click App: Redis
   - No persistence needed for staging

6. **redis-production**
   - Use CapRover One-Click App: Redis
   - Enable persistence

### Step 3: Configure Environment Variables

For each backend app in CapRover, add environment variables from the templates:

**Staging Backend** (`backend-staging`):
```bash
# Copy from .env.staging.template
SUPABASE_URL=https://your-staging-project.supabase.co
SUPABASE_ANON_KEY=your-staging-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-staging-service-role-key
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.your-staging-project.supabase.co:5432/postgres
REDIS_URL=redis://srv-captain--redis-staging:6379
PORT=4000
NODE_ENV=production
LOG_LEVEL=info
WORKER_CONCURRENCY=5
ENABLE_WORKER=true
REGISTRATION_BONUS_AMOUNT=100000000
```

**Production Backend** (`backend-production`):
```bash
# Copy from .env.production.template
# Same structure but with production Supabase credentials
```

**Frontend Apps**:
```bash
VITE_API_URL=https://api-staging.yourdomain.com  # or production URL
```

### Step 4: Configure GitHub Secrets

Go to GitHub repository → Settings → Secrets and variables → Actions

Add the following secrets:

#### CapRover Configuration
```
CAPROVER_SERVER=https://captain.yourdomain.com
```

#### Staging Secrets
```
STAGING_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.your-staging-project.supabase.co:5432/postgres
STAGING_BACKEND_APP_NAME=backend-staging
STAGING_BACKEND_APP_TOKEN=<from CapRover app settings>
STAGING_FRONTEND_APP_NAME=frontend-staging
STAGING_FRONTEND_APP_TOKEN=<from CapRover app settings>
```

#### Production Secrets
```
PRODUCTION_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.your-production-project.supabase.co:5432/postgres
PRODUCTION_BACKEND_APP_NAME=backend-production
PRODUCTION_BACKEND_APP_TOKEN=<from CapRover app settings>
PRODUCTION_FRONTEND_APP_NAME=frontend-production
PRODUCTION_FRONTEND_APP_TOKEN=<from CapRover app settings>
```

> [!TIP]
> To get the CapRover app token:
> 1. Go to CapRover dashboard
> 2. Select your app
> 3. Go to "Deployment" tab
> 4. Copy the "App Token"

---

## Deployment Process

### Automatic Deployment

**Staging**:
```bash
git checkout develop
git add .
git commit -m "Your changes"
git push origin develop
```
→ Automatically deploys to staging

**Production**:
```bash
git checkout main
git merge develop
git push origin main
```
→ Automatically deploys to production

### Deployment Flow

1. **Tests Run** - Backend tests execute
2. **Migrations Run** - Database migrations apply (fails if error)
3. **Backend Deploys** - Only if migrations succeed
4. **Frontend Deploys** - Parallel with backend
5. **Health Checks** - CapRover verifies deployment

> [!IMPORTANT]
> If migrations fail, deployment stops immediately. This prevents deploying code that expects a database schema that doesn't exist.

---

## Database Migrations

### How Migrations Work

Migrations run automatically during deployment using **drizzle-kit**:

1. GitHub Actions checks out code
2. Installs dependencies (includes drizzle-kit)
3. Runs `npx drizzle-kit migrate` with `DATABASE_URL`
4. If successful, deployment continues
5. If failed, deployment stops

> [!NOTE]
> No custom migration script needed - drizzle-kit handles everything.

### Creating New Migrations

```bash
# 1. Update schema in backend/src/infrastructure/database/schema.ts

# 2. Generate migration
cd backend
npx drizzle-kit generate

# 3. Test locally
npm run db:migrate

# 4. Commit and push
git add drizzle/
git commit -m "Add new migration"
git push
```

### Manual Migration (Emergency)

If you need to run migrations manually:

```bash
# SSH into CapRover server or use CapRover CLI
docker exec -it $(docker ps | grep backend-staging | awk '{print $1}') sh
npx drizzle-kit migrate
```

---

## Monitoring & Troubleshooting

### Check Deployment Status

1. **GitHub Actions**: Repository → Actions tab
2. **CapRover Logs**: Dashboard → App → Logs
3. **Health Check**: `curl https://api.yourdomain.com/health`

### Common Issues

#### ❌ Migration Failed
**Symptom**: Deployment stops at migration step

**Solution**:
1. Check GitHub Actions logs for error
2. Fix migration file
3. Push fix
4. Deployment will retry

#### ❌ Backend Won't Start
**Symptom**: CapRover shows "Deployment failed"

**Solution**:
1. Check CapRover app logs
2. Verify environment variables
3. Check DATABASE_URL and REDIS_URL

#### ❌ Frontend Shows API Errors
**Symptom**: Frontend loads but can't connect to backend

**Solution**:
1. Verify `VITE_API_URL` in frontend app
2. Check CORS settings in backend
3. Verify SSL certificates

#### ❌ WebSocket Connection Failed
**Symptom**: Real-time updates don't work

**Solution**:
1. Enable WebSocket in CapRover app settings
2. Check firewall rules on Oracle Cloud
3. Verify WebSocket endpoint in frontend

---

## Rollback Procedure

### Quick Rollback

**Option 1: Revert Git Commit**
```bash
git revert HEAD
git push origin main  # or develop
```
→ Triggers new deployment with previous code

**Option 2: Redeploy Previous Version**
1. Go to CapRover dashboard
2. Select app
3. Go to "Deployment" tab
4. Click "Deploy previous version"

### Database Rollback

> [!CAUTION]
> Database rollbacks are manual and risky. Always backup first.

```bash
# 1. Backup current database
# 2. Restore from previous backup
# 3. Redeploy previous code version
```

---

## Security Best Practices

- ✅ Never commit `.env` files
- ✅ Rotate Supabase keys regularly
- ✅ Use strong database passwords
- ✅ Enable SSL on all CapRover apps
- ✅ Restrict GitHub Actions to protected branches
- ✅ Use CapRover firewall rules
- ✅ Enable rate limiting in production

---

## Performance Optimization

### Backend
- Increase `WORKER_CONCURRENCY` for production
- Monitor Redis memory usage
- Enable connection pooling

### Frontend
- Nginx caching configured automatically
- Gzip compression enabled
- Static assets cached for 1 year

---

## Next Steps

1. ✅ Complete initial setup
2. ✅ Test staging deployment
3. ✅ Verify migrations work
4. ✅ Test production deployment
5. ✅ Set up monitoring alerts
6. ✅ Document team workflows

---

## Additional Resources

- [CapRover Setup Guide](./CAPROVER_SETUP.md)
- [GitHub Secrets Guide](./GITHUB_SECRETS.md)
- [Supabase Documentation](https://supabase.com/docs)
- [Drizzle ORM Migrations](https://orm.drizzle.team/docs/migrations)
