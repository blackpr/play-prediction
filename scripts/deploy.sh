#!/bin/bash

# Manual deployment script for Play Prediction Market
# Usage: ./scripts/deploy.sh [staging|production]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check arguments
if [ "$#" -ne 1 ]; then
    echo -e "${RED}Usage: $0 [staging|production]${NC}"
    exit 1
fi

ENV=$1

if [ "$ENV" != "staging" ] && [ "$ENV" != "production" ]; then
    echo -e "${RED}Error: Environment must be 'staging' or 'production'${NC}"
    exit 1
fi

echo -e "${GREEN}🚀 Deploying to ${ENV}...${NC}"

# Set app names based on environment
if [ "$ENV" == "staging" ]; then
    BACKEND_APP="backend-staging"
    FRONTEND_APP="frontend-staging"
else
    BACKEND_APP="backend-production"
    FRONTEND_APP="frontend-production"
fi

# Check if caprover CLI is installed
if ! command -v caprover &> /dev/null; then
    echo -e "${YELLOW}⚠️  CapRover CLI not found. Installing...${NC}"
    npm install -g caprover
fi

# Deploy backend
echo -e "${GREEN}📦 Deploying backend...${NC}"
cd backend
caprover deploy --appName $BACKEND_APP
cd ..

# Deploy frontend
echo -e "${GREEN}📦 Deploying frontend...${NC}"
cd frontend
caprover deploy --appName $FRONTEND_APP
cd ..

echo -e "${GREEN}✅ Deployment to ${ENV} complete!${NC}"
echo -e "${YELLOW}🔍 Check logs in CapRover dashboard${NC}"
