# Production Deployment Guide

## Issue: Static Assets Not Loading in Production

After running `npm build` and `npm start`, the logo and other images from the `public/` directory don't show because they aren't automatically copied to the build output directory.

## Solution

### Manual Fix (Run after each build)

1. Run the build command:
```bash
npm run build
```

2. Copy assets to the build directory:
```bash
node copy-assets.js
```

3. Start the production server:
```bash
npm start
```

### Automated Fix (Recommended)

Create a simple build script that does both steps:

```bash
#!/bin/bash
echo "Building application..."
npm run build

echo "Copying assets..."
node copy-assets.js

echo "✅ Build complete! You can now run 'npm start'"
```

Save this as `build-production.sh` and run:
```bash
chmod +x build-production.sh
./build-production.sh
```

## What the copy-assets.js script does:

- Copies all files from `public/` directory to `dist/public/`
- Ensures logo.png, manifest.json, and other static assets are available in production
- Preserves directory structure for nested assets

## Environment Variables for Email

For the email notifications to work in production, set these environment variables:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

Without these, the app will log "Email configuration not found" and skip sending emails.