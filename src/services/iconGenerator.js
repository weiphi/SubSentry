const { nativeImage } = require('electron');

class IconGenerator {
  static createTrayIcon(color = 'gray') {
    try {
      // For macOS, we should use template images that work with system theming
      // Let's fall back to using the existing PNG file with different approaches
      const path = require('path');
      const fs = require('fs');
      
      // Try to use the existing tray icon file
      const iconPath = path.join(__dirname, '../../public/assets/trayicon-16x16.png');
      
      if (fs.existsSync(iconPath)) {
        const { nativeImage } = require('electron');
        const image = nativeImage.createFromPath(iconPath);
        image.setTemplateImage(true);
        return image;
      }
      
      // Fallback: create a simple colored square
      const size = 16;
      const buffer = Buffer.alloc(size * size * 4); // RGBA
      
      // Define colors - more visible colors
      const colors = {
        gray: { r: 100, g: 100, b: 100, a: 255 },
        yellow: { r: 255, g: 193, b: 7, a: 255 },
        red: { r: 255, g: 69, b: 58, a: 255 }
      };
      
      const iconColor = colors[color] || colors.gray;
      
      // Create a simple filled square that's more visible
      for (let y = 4; y < 12; y++) {
        for (let x = 4; x < 12; x++) {
          const index = (y * size + x) * 4;
          buffer[index] = iconColor.r;     // Red
          buffer[index + 1] = iconColor.g; // Green
          buffer[index + 2] = iconColor.b; // Blue
          buffer[index + 3] = iconColor.a; // Alpha
        }
      }
      
      const { nativeImage } = require('electron');
      const image = nativeImage.createFromBuffer(buffer, { width: size, height: size });
      
      // Don't use template image for colored icons
      if (color !== 'gray') {
        image.setTemplateImage(false);
      } else {
        image.setTemplateImage(true);
      }
      
      return image;
      
    } catch (error) {
      console.error('Error creating tray icon:', error);
      
      // Ultimate fallback - try to use the original file
      const path = require('path');
      const { nativeImage } = require('electron');
      const iconPath = path.join(__dirname, '../../public/assets/trayicon-16x16.png');
      
      try {
        const image = nativeImage.createFromPath(iconPath);
        image.setTemplateImage(true);
        return image;
      } catch (fallbackError) {
        console.error('Fallback icon creation failed:', fallbackError);
        return nativeImage.createEmpty();
      }
    }
  }
}

module.exports = IconGenerator;