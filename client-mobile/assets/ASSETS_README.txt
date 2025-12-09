# Mehfil Mobile Assets

This folder contains the app assets for Mehfil mobile app.

## Required Files

The following PNG files need to be created from the SVG sources:

1. **icon.png** (1024x1024) - App icon
   - Export from `icon.svg`
   - Used for both iOS and Android app icons

2. **adaptive-icon.png** (1024x1024) - Android adaptive icon foreground
   - Export from `icon.svg`
   - Background color: #FF7043 (set in app.json)

3. **splash.png** (1284x2778) - Splash screen
   - Export from `splash.svg`
   - Shown while app loads

4. **favicon.png** (48x48) - Web favicon
   - Small version of icon

## How to Generate PNGs

Option 1: Use an online SVG to PNG converter
- https://svgtopng.com/
- https://cloudconvert.com/svg-to-png

Option 2: Use command line (requires librsvg)
```bash
rsvg-convert -w 1024 -h 1024 icon.svg > icon.png
rsvg-convert -w 1024 -h 1024 icon.svg > adaptive-icon.png
rsvg-convert -w 1284 -h 2778 splash.svg > splash.png
rsvg-convert -w 48 -h 48 icon.svg > favicon.png
```

Option 3: Use ImageMagick
```bash
convert icon.svg -resize 1024x1024 icon.png
convert icon.svg -resize 1024x1024 adaptive-icon.png
convert splash.svg -resize 1284x2778 splash.png
convert icon.svg -resize 48x48 favicon.png
```

## Temporary Placeholder

For development, you can create simple placeholder PNGs using any image editor or the following Node.js script:

```javascript
// create-assets.js
const { createCanvas } = require('canvas');
const fs = require('fs');

// Icon (1024x1024)
const iconCanvas = createCanvas(1024, 1024);
const iconCtx = iconCanvas.getContext('2d');
const iconGrad = iconCtx.createLinearGradient(0, 0, 1024, 1024);
iconGrad.addColorStop(0, '#FF7043');
iconGrad.addColorStop(1, '#6D4C41');
iconCtx.fillStyle = iconGrad;
iconCtx.fillRect(0, 0, 1024, 1024);
iconCtx.fillStyle = 'white';
iconCtx.font = 'bold 400px Arial';
iconCtx.textAlign = 'center';
iconCtx.fillText('M', 512, 620);
fs.writeFileSync('icon.png', iconCanvas.toBuffer('image/png'));
fs.writeFileSync('adaptive-icon.png', iconCanvas.toBuffer('image/png'));

console.log('Assets created!');
```
