# 🎨 Shade It

> Transform any webpage into a visual masterpiece with real-time WebGL shader effects

[![License](https://img.shields.io/badge/license-MIT-green.svg)](#license)
[![WebGL](https://img.shields.io/badge/WebGL-2.0-orange.svg)](https://www.khronos.org/webgl/)

---

## ✨ What It Does

**Shade It** is a browser extension that applies stunning WebGL shader effects as an overlay on any webpage. Experience the web like never before with animated visual effects that react and flow in real-time.

- 🔥 **Real-time rendering** - Smooth 60fps shader animations
- 🌐 **Universal compatibility** - Works on any website
- 🎛️ **Multiple effects** - Choose from various shader types
- ⚡ **Instant toggle** - Enable/disable with one click
- 📱 **Responsive** - Adapts to any screen size

---

## 🚀 Quick Start

### Installation

1. **Chrome Web Store** *(Coming Soon)*
   - Visit the Chrome Web Store
   - Click "Add to Chrome"

2. **Manual Installation**
   ```bash
   # Clone the repository
   git clone https://github.com/Antoine-Flo/shade-it.git
   
   # Load in Chrome
   # 1. Open chrome://extensions/
   # 2. Enable "Developer mode"
   # 3. Click "Load unpacked"
   # 4. Select the shade-it folder
   ```

### Usage

1. **Activate**: Click the Shade It icon in your browser toolbar
2. **Toggle**: Use the ON/OFF button to enable/disable effects
3. **Customize**: Select different shader types from the dropdown
4. **Enjoy**: Watch your webpage transform with beautiful animations

---

## ⚙️ How It Works

Shade It uses **WebGL2** technology to render shader effects directly in your browser. Here's the magic:

### Technical Overview

- **Canvas Overlay**: Creates a transparent canvas layer over the webpage
- **WebGL Rendering**: Utilizes GPU acceleration for smooth performance  
- **Shader Programs**: Vertex and fragment shaders create the visual effects
- **Real-time Animation**: Time-based uniforms drive dynamic animations
- **Cross-tab Management**: Smart state management across browser tabs

### Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Popup UI      │───▶│  State Manager   │───▶│  Content Script │
│   (Controls)    │    │  (Background)    │    │  (WebGL Render) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

The extension consists of three main components:
- **Popup Interface**: User controls and shader selection
- **Background Service**: State management and cross-tab coordination  
- **Content Script**: WebGL rendering and canvas management

---

## 🔧 Development

### Project Structure

```
shade-it/
├── manifest.json          # Extension configuration
├── popup/                 # User interface
│   ├── index.html
│   └── script.js
├── overlay/               # WebGL rendering
│   ├── overlay.css
│   ├── shader.js
│   └── shaders/           # Shader source files
│       ├── [effect-1]/
│       ├── [effect-2]/
│       └── ...
├── stateManager.js        # Background service worker
└── assets/               # Icons and resources
```

### Adding New Shaders

1. **Create shader directory**: `overlay/shaders/your-effect/`
2. **Add shader files**: `vertex.glsl` and `fragment.glsl`
3. **Update shader list**: Modify the available options in `popup/script.js`
4. **Test thoroughly**: Ensure compatibility across different websites

### Contributing

We welcome contributions! Please:
- Fork the repository
- Create a feature branch
- Test your changes thoroughly
- Submit a pull request with clear description

---

## 📋 Browser Support

- ✅ **Chrome** 88+ (Recommended)
- ✅ **Edge** 88+ (Chromium-based)
- ⚠️ **Firefox** (Limited WebGL2 support)
- ❌ **Safari** (Extension API differences)

---

## 🐛 Troubleshooting

### Common Issues

**Shaders not appearing?**
- Check if WebGL2 is supported: Visit `chrome://gpu/`
- Ensure hardware acceleration is enabled
- Try refreshing the webpage

**Performance issues?**
- Lower your browser zoom level
- Close unnecessary tabs
- Check GPU usage in task manager

**Extension not loading?**
- Verify manifest.json syntax
- Check browser console for errors
- Ensure all files are present

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- WebGL community for shader inspiration
- Chrome Extensions documentation
- GPU vendors for hardware acceleration

---

<div align="center">

**Made with ❤️ and lots of ☕**

[Report Bug](https://github.com/Antoine-Flo/shade-it/issues) • [Request Feature](https://github.com/Antoine-Flo/shade-it/issues) • [Contribute](https://github.com/Antoine-Flo/shade-it/pulls)

</div>
