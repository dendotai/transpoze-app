# TransVibe

Transform your video vibes. A fast, modern desktop app for converting WebM videos to MP4 format. Built with Tauri, React, and TypeScript.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey.svg)

## Features

- 🎬 **Batch Conversion**: Convert multiple WebM files at once with drag-and-drop
- 🎯 **Quality Presets**: Choose from High, Medium, Low, or Custom quality settings
- 📊 **Progress Tracking**: Real-time conversion progress with queue management
- 🗂️ **Flexible Output**: Save to custom directory or alongside source files
- 📝 **Conversion History**: Track all your past conversions
- 🖼️ **Video Thumbnails**: Preview your videos before conversion (coming soon)
- 🚀 **Native Performance**: Bundled FFmpeg for fast, dependency-free conversion

## Download

Download the latest release from the [Releases](https://github.com/yourusername/transvibe/releases) page.

For macOS users:

- **Universal Binary**: Works on both Intel and Apple Silicon Macs
- **No dependencies**: FFmpeg is bundled with the app

## Development

### Prerequisites

- Node.js 16+ and npm
- Rust 1.82+
- macOS (for now; Linux/Windows support planned)
- jq (for FFmpeg download script): `brew install jq`

### Quick Start

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/transvibe.git
   cd transvibe
   ```

2. **Start developing**

   ```bash
   make dev  # Installs deps, downloads FFmpeg, and starts dev server
   ```

That's it! The Makefile handles all the setup automatically.

#### Manual setup (if you prefer)

1. Install dependencies: `bun install`
2. Download FFmpeg: `./scripts/download-ffmpeg.sh`
3. Start development: `bun run tauri dev`

#### Available Make commands

```bash
make help        # Show all available commands
make dev         # Start development (auto-setup included)
make build       # Build the application
make lint        # Run linters and fix issues
make clean       # Clean build artifacts
make check-prereqs # Check if all prerequisites are installed
```

### FFmpeg Version Management

The project uses a versioned FFmpeg setup:

- **Check current version**: Look at `scripts/ffmpeg-versions.json`
- **Download specific version**: `./scripts/download-ffmpeg.sh --version 7.0.2`
- **Force re-download**: `./scripts/download-ffmpeg.sh --force`
- **Version info**: Stored in `src-tauri/binaries/ffmpeg-version.json`

The FFmpeg version is tracked and displayed in the app's About dialog, making it easy to know which version is bundled with each release.

### Building

To build the application:

```bash
make build
```

Or manually: `bun run tauri build`

This creates:

- `.app` bundle in `src-tauri/target/release/bundle/macos/`
- `.dmg` installer in `src-tauri/target/release/bundle/dmg/`

### Project Structure

```text
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/             # Custom React hooks
│   └── utils/             # Utility functions
├── src-tauri/             # Rust backend
│   ├── src/               # Rust source code
│   ├── binaries/          # FFmpeg binaries (git-ignored)
│   └── icons/             # App icons
├── scripts/               # Build and setup scripts
│   ├── download-ffmpeg.sh # FFmpeg download script
│   └── ffmpeg-versions.json # FFmpeg version registry
└── convert/               # Example WebM files for testing
```

## Technical Highlights

- **Smart Tooltips**: Custom edge-aware tooltips that never get clipped, built without external positioning libraries
- **Inline Autocomplete**: Cursor-style ghost text suggestions for filename variables - no dropdowns, just subtle hints
- **Zero Dependencies**: Bundled FFmpeg means users don't need to install anything
- **Architecture-Specific Builds**: Optimized binaries for both Intel and Apple Silicon

See [BRAGGING.md](BRAGGING.md) for more clever solutions we've implemented.

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute to this project.

## Troubleshooting

### FFmpeg Download Issues

If the download script fails:

1. Check your internet connection
2. Ensure `jq` is installed: `brew install jq`
3. Try downloading a specific version: `./scripts/download-ffmpeg.sh --version 7.0.2`
4. Check [evermeet.cx](https://evermeet.cx/ffmpeg/) for available versions

### Build Issues

1. Ensure Rust 1.82+ is installed (check `rust-toolchain.toml`)
2. Clear build cache: `rm -rf src-tauri/target`
3. Reinstall dependencies: `rm -rf node_modules && npm install`

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [FFmpeg](https://ffmpeg.org/) - The powerful multimedia framework
- [Tauri](https://tauri.app/) - For the amazing desktop app framework
- [evermeet.cx](https://evermeet.cx/ffmpeg/) - For providing macOS FFmpeg builds
