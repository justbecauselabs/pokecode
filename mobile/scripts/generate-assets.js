const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');

// Create assets directory if it doesn't exist
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Generate a simple colored square image
async function generateImage(width, height, color, outputPath) {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="${color}"/>
      <text x="50%" y="50%" font-family="system-ui" font-size="${Math.min(width, height) / 8}" 
            fill="white" text-anchor="middle" dominant-baseline="middle">
        CC
      </text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .resize(width, height)
    .png()
    .toFile(outputPath);

  console.log(`Generated ${outputPath}`);
}

// Generate all required assets
async function generateAllAssets() {
  try {
    // Icon - 1024x1024 for App Store
    await generateImage(1024, 1024, '#6366f1', path.join(assetsDir, 'icon.png'));

    // Splash screen - 1284x2778 (iPhone 15 Pro Max)
    await generateImage(1284, 2778, '#6366f1', path.join(assetsDir, 'splash.png'));

    // Adaptive icon for Android - 512x512
    await generateImage(512, 512, '#6366f1', path.join(assetsDir, 'adaptive-icon.png'));

    // Favicon for web - 48x48
    await generateImage(48, 48, '#6366f1', path.join(assetsDir, 'favicon.png'));

    console.log('All assets generated successfully!');
  } catch (error) {
    console.error('Error generating assets:', error);
    process.exit(1);
  }
}

generateAllAssets();