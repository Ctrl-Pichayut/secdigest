import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function getIconSvg(size) {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: ${size}px;
      height: ${size}px;
      background: #09090b;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
    }
    .badge {
      width: 86%;
      height: 86%;
      background: linear-gradient(135deg, #18181b 0%, #09090b 100%);
      border: ${Math.max(2, Math.round(size * 0.015))}px solid #27272a;
      border-radius: 24%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      box-shadow: 0 0 ${size * 0.15}px rgba(16, 185, 129, 0.2);
    }
    .glow {
      position: absolute;
      width: 60%;
      height: 60%;
      background: radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, rgba(14, 165, 233, 0.1) 60%, transparent 80%);
      filter: blur(${size * 0.05}px);
    }
    svg {
      width: 58%;
      height: 58%;
      z-index: 10;
    }
  </style>
</head>
<body>
  <div class="badge">
    <div class="glow"></div>
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shieldGrad" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#10b981" />
          <stop offset="100%" stop-color="#0ea5e9" />
        </linearGradient>
      </defs>
      <!-- Shield Outer Contour -->
      <path d="M50 12 L82 24 C82 58 50 84 50 84 C50 84 18 58 18 24 Z" 
            stroke="url(#shieldGrad)" 
            stroke-width="6" 
            stroke-linejoin="round" 
            stroke-linecap="round"
            fill="rgba(16, 185, 129, 0.08)" />
      
      <!-- Terminal Prompt Symbol >_ -->
      <!-- Chevron > -->
      <path d="M36 38 L48 48 L36 58" 
            stroke="#f4f4f5" 
            stroke-width="5" 
            stroke-linecap="round" 
            stroke-linejoin="round" />
      
      <!-- Underscore _ -->
      <path d="M54 58 L66 58" 
            stroke="#10b981" 
            stroke-width="5" 
            stroke-linecap="round" />
    </svg>
  </div>
</body>
</html>`;
}

async function generateIcons() {
  const browser = await chromium.launch();

  for (const size of [192, 512]) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(getIconSvg(size));
    const outputPath = path.join(process.cwd(), 'public', `icon-${size}x${size}.png`);
    await page.screenshot({ path: outputPath, type: 'png' });
    console.log(`✓ Generated ${outputPath} (${size}x${size})`);

    // Also copy to icon-${size}.png for compatibility
    const compatPath = path.join(process.cwd(), 'public', `icon-${size}.png`);
    fs.copyFileSync(outputPath, compatPath);
  }

  await browser.close();
  console.log('✓ All PWA icons generated successfully!');
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
