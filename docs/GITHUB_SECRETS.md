# GitHub Secrets Configuration Guide

Complete guide for configuring GitHub repository secrets for automated deployments.

## Overview

GitHub Actions workflows require secrets to:
- Connect to CapRover
- Access Supabase databases
- Deploy applications securely

---

## Required Secrets

### CapRover Server

| Secret Name | Description | Example |
|------------|-------------|---------|
| `CAPROVER_SERVER` | CapRover server URL | `https://captain.yourdomain.com` |

**How to get**:
- Your CapRover dashboard URL
- Format: `https://captain.yourdomain.com`

---

### Staging Environment

| Secret Name | Description | Where to Find |
|------------|-------------|---------------|
| `STAGING_DATABASE_URL` | Staging Supabase database connection string | Supabase project settings |
| `STAGING_BACKEND_APP_NAME` | CapRover backend app name | `backend-staging` |
| `STAGING_BACKEND_APP_TOKEN` | CapRover backend app deployment token | CapRover app deployment tab |
| `STAGING_FRONTEND_APP_NAME` | CapRover frontend app name | `frontend-staging` |
| `STAGING_FRONTEND_APP_TOKEN` | CapRover frontend app deployment token | CapRover app deployment tab |

---

### Production Environment

| Secret Name | Description | Where to Find |
|------------|-------------|---------------|
| `PRODUCTION_DATABASE_URL` | Production Supabase database connection string | Supabase project settings |
| `PRODUCTION_BACKEND_APP_NAME` | CapRover backend app name | `backend-production` |
| `PRODUCTION_BACKEND_APP_TOKEN` | CapRover backend app deployment token | CapRover app deployment tab |
| `PRODUCTION_FRONTEND_APP_NAME` | CapRover frontend app name | `frontend-production` |
| `PRODUCTION_FRONTEND_APP_TOKEN` | CapRover frontend app deployment token | CapRover app deployment tab |

---

## Step-by-Step Setup

### Step 1: Get Supabase Database URLs

#### Staging Database URL

1. Go to [supabase.com](https://supabase.com)
2. Open your staging project
3. Go to **Project Settings** → **Database**
4. Find "Connection string" section
5. Select "URI" tab
6. Copy the connection string:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
7. Replace `[YOUR-PASSWORD]` with your actual database password

#### Production Database URL

Repeat the same steps for your production Supabase project.

---

### Step 2: Get CapRover App Tokens

For each app (backend-staging, backend-production, frontend-staging, frontend-production):

1. **Go to CapRover Dashboard**
   - URL: `https://captain.yourdomain.com`

2. **Select the App**
   - Click on the app name (e.g., `backend-staging`)

3. **Go to Deployment Tab**
   - Click "Deployment" in the left sidebar

4. **Find Method 3**
   - Scroll to "Method 3: Deploy via GitHub Actions"

5. **Copy the App Token**
   - It looks like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

6. **Note the App Name**
   - Usually the same as what you see in the dashboard

**Repeat for all 4 apps**:
- `backend-staging` → `STAGING_BACKEND_APP_TOKEN`
- `backend-production` → `PRODUCTION_BACKEND_APP_TOKEN`
- `frontend-staging` → `STAGING_FRONTEND_APP_TOKEN`
- `frontend-production` → `PRODUCTION_FRONTEND_APP_TOKEN`

---

### Step 3: Add Secrets to GitHub

1. **Go to GitHub Repository**
   - Navigate to your repository

2. **Open Settings**
   - Click "Settings" tab

3. **Go to Secrets**
   - Click "Secrets and variables" → "Actions"

4. **Add New Secret**
   - Click "New repository secret"

5. **Add Each Secret**:

   **CapRover Server**:
   ```
   Name: CAPROVER_SERVER
   Value: https://captain.yourdomain.com
   ```

   **Staging Secrets**:
   ```
   Name: STAGING_DATABASE_URL
   Value: postgresql://postgres:your-password@db.xxxxx.supabase.co:5432/postgres
   ```
   ```
   Name: STAGING_BACKEND_APP_NAME
   Value: backend-staging
   ```
   ```
   Name: STAGING_BACKEND_APP_TOKEN
   Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
   ```
   Name: STAGING_FRONTEND_APP_NAME
   Value: frontend-staging
   ```
   ```
   Name: STAGING_FRONTEND_APP_TOKEN
   Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

   **Production Secrets**:
   ```
   Name: PRODUCTION_DATABASE_URL
   Value: postgresql://postgres:your-password@db.xxxxx.supabase.co:5432/postgres
   ```
   ```
   Name: PRODUCTION_BACKEND_APP_NAME
   Value: backend-production
   ```
   ```
   Name: PRODUCTION_BACKEND_APP_TOKEN
   Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
   ```
   Name: PRODUCTION_FRONTEND_APP_NAME
   Value: frontend-production
   ```
   ```
   Name: PRODUCTION_FRONTEND_APP_TOKEN
   Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

---

## Verification Checklist

After adding all secrets, verify:

- [ ] Total of 11 secrets added
- [ ] `CAPROVER_SERVER` starts with `https://`
- [ ] Database URLs contain actual passwords (not `[YOUR-PASSWORD]`)
- [ ] App names match CapRover dashboard exactly
- [ ] App tokens are complete (very long strings)
- [ ] No trailing spaces in secret values

---

## Security Best Practices

### ✅ Do's

- ✅ Use strong, unique passwords for Supabase
- ✅ Rotate tokens periodically (every 6 months)
- ✅ Limit GitHub repository access to trusted team members
- ✅ Use branch protection rules for `main` and `develop`
- ✅ Enable 2FA on GitHub accounts

### ❌ Don'ts

- ❌ Never commit secrets to Git
- ❌ Never share secrets in chat/email
- ❌ Never use the same password across environments
- ❌ Never store secrets in code comments
- ❌ Never log secrets in application code

---

## Rotating Secrets

### When to Rotate

- Every 6 months (routine)
- After team member leaves
- If secrets are exposed
- After security incident

### How to Rotate

#### CapRover App Tokens

1. Go to CapRover app settings
2. Click "Regenerate Token"
3. Copy new token
4. Update GitHub secret
5. Test deployment

#### Supabase Database Password

1. Go to Supabase project settings
2. Database → Reset password
3. Update `DATABASE_URL` in:
   - GitHub secrets
   - CapRover app environment variables
4. Restart apps

---

## Troubleshooting

### ❌ Deployment Fails with "Unauthorized"

**Cause**: Invalid CapRover app token

**Solution**:
1. Regenerate token in CapRover
2. Update GitHub secret
3. Retry deployment

### ❌ Migration Fails with "Connection Refused"

**Cause**: Invalid `DATABASE_URL`

**Solution**:
1. Verify database URL format
2. Check password is correct
3. Ensure Supabase project is active
4. Update GitHub secret

### ❌ "Secret not found" Error

**Cause**: Secret name mismatch

**Solution**:
1. Check workflow file uses correct secret names
2. Verify secrets exist in GitHub
3. Check for typos in secret names

---

## Testing Secrets

### Test Staging Deployment

```bash
git checkout develop
git commit --allow-empty -m "Test staging deployment"
git push origin develop
```

Watch GitHub Actions:
- Go to repository → Actions tab
- Check workflow runs successfully
- Verify all secrets are accessible

### Test Production Deployment

```bash
git checkout main
git commit --allow-empty -m "Test production deployment"
git push origin main
```

Same verification steps.

---

## Quick Reference

### Secret Name Format

```
{ENVIRONMENT}_{SERVICE}_{TYPE}

Examples:
STAGING_BACKEND_APP_TOKEN
PRODUCTION_DATABASE_URL
```

### Required Secrets Summary

```
CAPROVER_SERVER                    (1)

STAGING_DATABASE_URL               (5)
STAGING_BACKEND_APP_NAME
STAGING_BACKEND_APP_TOKEN
STAGING_FRONTEND_APP_NAME
STAGING_FRONTEND_APP_TOKEN

PRODUCTION_DATABASE_URL            (5)
PRODUCTION_BACKEND_APP_NAME
PRODUCTION_BACKEND_APP_TOKEN
PRODUCTION_FRONTEND_APP_NAME
PRODUCTION_FRONTEND_APP_TOKEN

Total: 11 secrets
```

---

## Next Steps

1. ✅ Add all 11 secrets to GitHub
2. ✅ Verify secret names match workflow files
3. ✅ Test staging deployment
4. ✅ Test production deployment
5. ✅ Document secrets in team password manager
6. ✅ Set calendar reminder for rotation (6 months)

---

## Additional Resources

- [GitHub Actions Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [CapRover Deployment Documentation](https://caprover.com/docs/deployment-methods.html)
- [Supabase Database Settings](https://supabase.com/docs/guides/database/connecting-to-postgres)
