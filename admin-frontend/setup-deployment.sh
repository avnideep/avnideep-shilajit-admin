#!/bin/bash

# GitHub Deployment Setup Script for Admin Panel
# This script helps verify the deployment configuration

echo "🚀 Avnideep Admin Panel - GitHub Deployment Setup"
echo "=================================================="
echo ""

# Check if we're in the right directory
if [ ! -f "wrangler.jsonc" ]; then
  echo "❌ Error: wrangler.jsonc not found"
  echo "Please run this script from admin-panel/admin-frontend directory"
  exit 1
fi

echo "✅ Found wrangler.jsonc"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not installed. Please install Node.js 18+"
  exit 1
fi
echo "✅ Node.js $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
  echo "❌ npm not installed"
  exit 1
fi
echo "✅ npm $(npm --version)"

# Check if wrangler is installed
if ! npm ls wrangler &> /dev/null; then
  echo "⏳ Installing Wrangler..."
  npm install -D wrangler@latest
fi
echo "✅ Wrangler ready"

# Check if git is initialized
if [ ! -d ".git" ]; then
  echo "⚠️  Git not initialized in parent directory"
  echo "Run: git init && git remote add origin <repo-url>"
else
  echo "✅ Git repository found"
fi

echo ""
echo "📋 Checklist:"
echo "---"
echo "✓ Node.js and npm installed"
echo "✓ Wrangler CLI ready"
echo "✓ wrangler.jsonc configured"
echo ""

echo "🔐 Setup GitHub Secrets:"
echo "---"
echo "1. Go to: https://github.com/<owner>/<repo>/settings/secrets/actions"
echo "2. Add secret: CLOUDFLARE_API_TOKEN"
echo "3. Add secret: CLOUDFLARE_ACCOUNT_ID"
echo ""

echo "📝 Cloudflare Credentials:"
echo "---"
echo "API Token: Get from https://dash.cloudflare.com/profile/api-tokens"
echo "Account ID: Get from https://dash.cloudflare.com (right sidebar)"
echo ""

echo "🚀 Deployment Ready!"
echo "---"
echo "Next steps:"
echo "1. Configure GitHub secrets"
echo "2. Push to main: git push origin main"
echo "3. Check GitHub Actions for deployment status"
echo ""
echo "✨ Admin panel will be deployed to: https://admin.avnideepayurveda.in"
