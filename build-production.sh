#!/bin/bash
echo "🏗️  Building application..."
npm run build

echo "📁 Copying assets..."
node copy-assets.js

echo "✅ Build complete! You can now run 'npm start' to start the production server."
echo ""
echo "📧 Don't forget to set your email environment variables:"
echo "   SMTP_HOST=smtp.gmail.com"
echo "   SMTP_PORT=587"  
echo "   SMTP_USER=your-email@gmail.com"
echo "   SMTP_PASS=your-app-password"