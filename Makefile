# TransVibe Makefile
# Run 'make' or 'make help' to see available commands

.DEFAULT_GOAL := help

## Development

desktop-dev: deps ffmpeg-check  ## Start desktop development server (auto-installs deps & FFmpeg)
	@echo "🚀 Starting desktop development server..."
	@bun run desktop:dev

setup: deps ffmpeg-check  ## Initial project setup (deps + FFmpeg)
	@echo "✅ Setup complete!"

## Building

desktop-build: ffmpeg-check  ## Build desktop application for current architecture
	@echo "🔨 Building desktop application..."
	@bun run desktop:build

desktop-release: lint type-check desktop-build  ## Build desktop release (with linting and type checks)
	@echo "📦 Release build complete!"
	@echo "Find your app in: apps/desktop/src-tauri/target/release/bundle/"

## Code Quality

lint:  ## Run linters and auto-fix issues
	@echo "🔍 Running linters..."
	@bun run lint

type-check:  ## Run TypeScript type checking
	@echo "📝 Running TypeScript type check..."
	@bun run type-check

format: lint  ## Format code (alias for lint)
	@echo "✨ Code formatted!"

## Dependencies

deps:  ## Install project dependencies
	@if [ ! -d "node_modules" ] || [ ! -f "bun.lockb" ]; then \
		echo "📦 Installing dependencies with Bun..."; \
		if ! command -v bun &> /dev/null; then \
			echo "❌ Bun is not installed. Please install it first:"; \
			echo "   curl -fsSL https://bun.sh/install | bash"; \
			exit 1; \
		fi; \
		bun install; \
	else \
		echo "✅ Dependencies already installed"; \
	fi

ffmpeg-check:  ## Check/download FFmpeg binaries
	@echo "🎬 Checking FFmpeg binaries..."
	@if [ ! -f "apps/desktop/src-tauri/binaries/ffmpeg-x86_64-apple-darwin" ] || [ ! -f "apps/desktop/src-tauri/binaries/ffmpeg-aarch64-apple-darwin" ]; then \
		echo "📥 FFmpeg binaries not found. Downloading..."; \
		if ! command -v jq &> /dev/null; then \
			echo "❌ jq is not installed. Installing..."; \
			brew install jq || (echo "Failed to install jq. Please install it manually." && exit 1); \
		fi; \
		./apps/desktop/scripts/download-ffmpeg.sh; \
	else \
		echo "✅ FFmpeg binaries found"; \
	fi

ffmpeg-update:  ## Force update FFmpeg to latest version
	@echo "🔄 Updating FFmpeg to latest version..."
	@./apps/desktop/scripts/download-ffmpeg.sh --force

## Architecture-specific FFmpeg

ffmpeg-intel:  ## Download FFmpeg for Intel Macs only
	@./apps/desktop/scripts/download-ffmpeg.sh --arch x86_64

ffmpeg-arm:  ## Download FFmpeg for Apple Silicon only
	@./apps/desktop/scripts/download-ffmpeg.sh --arch aarch64

## Maintenance

clean:  ## Clean all build artifacts and caches
	@echo "🧹 Cleaning build artifacts..."
	@rm -rf dist
	@rm -rf apps/desktop/src-tauri/target
	@rm -rf node_modules
	@rm -f bun.lockb
	@echo "✅ Clean complete"

clean-deps:  ## Clean only dependencies (node_modules)
	@echo "🧹 Cleaning dependencies..."
	@rm -rf node_modules
	@rm -f bun.lockb

clean-build:  ## Clean only build artifacts
	@echo "🧹 Cleaning build artifacts..."
	@rm -rf dist
	@rm -rf apps/desktop/src-tauri/target

## Utilities

check-prereqs:  ## Check all prerequisites are installed
	@echo "🔍 Checking prerequisites..."
	@if ! command -v bun &> /dev/null; then \
		echo "❌ Bun is not installed"; \
		echo "   Install: curl -fsSL https://bun.sh/install | bash"; \
	else \
		echo "✅ Bun: $$(bun --version)"; \
	fi
	@if ! command -v rustc &> /dev/null; then \
		echo "❌ Rust is not installed"; \
		echo "   Install: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"; \
	else \
		echo "✅ Rust: $$(rustc --version)"; \
	fi
	@if ! command -v jq &> /dev/null; then \
		echo "❌ jq is not installed"; \
		echo "   Install: brew install jq"; \
	else \
		echo "✅ jq: $$(jq --version)"; \
	fi
	@if [ -f "apps/desktop/src-tauri/binaries/ffmpeg-version.json" ]; then \
		echo "✅ FFmpeg: $$(jq -r .version apps/desktop/src-tauri/binaries/ffmpeg-version.json)"; \
	else \
		echo "❌ FFmpeg binaries not downloaded"; \
	fi

desktop-watch: ffmpeg-check  ## Start desktop dev server with file watching
	@echo "👁️  Starting desktop development with watch mode..."
	@bun run desktop:dev

## Help

help:  ## Show this help message
	@bash ./scripts/parse-makefile-documentation.sh

.PHONY: desktop-dev setup desktop-build desktop-release lint type-check format deps ffmpeg-check ffmpeg-update ffmpeg-intel ffmpeg-arm clean clean-deps clean-build check-prereqs desktop-watch help