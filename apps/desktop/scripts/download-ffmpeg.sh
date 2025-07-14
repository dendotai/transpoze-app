#!/usr/bin/env bash

# Download FFmpeg binaries for macOS with version tracking
# This script downloads FFmpeg static builds for both Intel and Apple Silicon Macs
# and maintains version information for changelog and tracking purposes

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BINARIES_DIR="$PROJECT_ROOT/src-tauri/binaries"
VERSIONS_FILE="$SCRIPT_DIR/ffmpeg-versions.json"
VERSION_INFO_FILE="$BINARIES_DIR/ffmpeg-version.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if jq is installed for JSON parsing
if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ Error: jq is required for JSON parsing${NC}"
    echo "Please install jq first:"
    echo "  brew install jq"
    exit 1
fi

# Parse command line arguments
FORCE_DOWNLOAD=false
SPECIFIC_VERSION=""
SPECIFIC_ARCH=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --force|-f)
            FORCE_DOWNLOAD=true
            shift
            ;;
        --version|-v)
            SPECIFIC_VERSION="$2"
            shift 2
            ;;
        --arch|-a)
            SPECIFIC_ARCH="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -f, --force          Force re-download even if binaries exist"
            echo "  -v, --version VER    Download specific FFmpeg version"
            echo "  -a, --arch ARCH      Download only specific architecture (x86_64 or aarch64)"
            echo "  -h, --help           Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                   # Download both architectures"
            echo "  $0 --arch x86_64    # Download only Intel version"
            echo "  $0 --arch aarch64   # Download only Apple Silicon version"
            echo "  $0 --version 7.0.2   # Download specific version"
            echo "  $0 --force           # Force re-download"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Get the version to download
if [ -n "$SPECIFIC_VERSION" ]; then
    TARGET_VERSION="$SPECIFIC_VERSION"
else
    TARGET_VERSION=$(jq -r '.current' "$VERSIONS_FILE")
fi

echo -e "${BLUE}📦 Setting up FFmpeg $TARGET_VERSION binaries for macOS...${NC}"

# Check if version exists in versions file
if ! jq -e ".versions[\"$TARGET_VERSION\"]" "$VERSIONS_FILE" > /dev/null; then
    echo -e "${RED}❌ Error: Version $TARGET_VERSION not found in versions file${NC}"
    echo "Available versions:"
    jq -r '.versions | keys[]' "$VERSIONS_FILE"
    exit 1
fi

# Create binaries directory if it doesn't exist
mkdir -p "$BINARIES_DIR"

# Function to download and extract FFmpeg
download_ffmpeg() {
    local version=$1
    local arch=$2
    local arch_key=$3
    local output_name="ffmpeg-${version}-${arch}-apple-darwin"
    local temp_dir=$(mktemp -d)
    
    # Get URL from versions file
    local url=$(jq -r ".versions[\"$version\"].$arch_key.url" "$VERSIONS_FILE")
    
    echo -e "${YELLOW}⬇️  Downloading FFmpeg $version for $arch...${NC}"
    curl -L -o "$temp_dir/ffmpeg.zip" "$url" || {
        echo -e "${RED}❌ Failed to download FFmpeg for $arch${NC}"
        rm -rf "$temp_dir"
        return 1
    }
    
    echo -e "${BLUE}📂 Extracting FFmpeg for $arch...${NC}"
    unzip -q "$temp_dir/ffmpeg.zip" -d "$temp_dir" || {
        echo -e "${RED}❌ Failed to extract FFmpeg for $arch${NC}"
        rm -rf "$temp_dir"
        return 1
    }
    
    # Copy the ffmpeg binary to our binaries directory with version in name
    cp "$temp_dir/ffmpeg" "$BINARIES_DIR/$output_name" || {
        echo -e "${RED}❌ Failed to copy FFmpeg binary for $arch${NC}"
        rm -rf "$temp_dir"
        return 1
    }
    
    # Make it executable
    chmod +x "$BINARIES_DIR/$output_name"
    
    # Create symlink to current version (what the app expects)
    local symlink_name="ffmpeg-${arch}-apple-darwin"
    ln -sf "$output_name" "$BINARIES_DIR/$symlink_name"
    
    # Clean up
    rm -rf "$temp_dir"
    
    echo -e "${GREEN}✅ FFmpeg $version for $arch installed successfully${NC}"
}

# Check current installed version
CURRENT_INSTALLED_VERSION=""
if [ -f "$VERSION_INFO_FILE" ]; then
    CURRENT_INSTALLED_VERSION=$(jq -r '.version' "$VERSION_INFO_FILE" 2>/dev/null || echo "")
fi

# Download based on architecture specification
if [ -n "$SPECIFIC_ARCH" ]; then
    # Download only specific architecture
    case $SPECIFIC_ARCH in
        x86_64)
            INTEL_BINARY="ffmpeg-${TARGET_VERSION}-x86_64-apple-darwin"
            if [ ! -f "$BINARIES_DIR/$INTEL_BINARY" ] || [ "$FORCE_DOWNLOAD" = true ]; then
                download_ffmpeg "$TARGET_VERSION" "x86_64" "intel"
            else
                echo -e "${GREEN}ℹ️  FFmpeg $TARGET_VERSION for Intel already exists, skipping download${NC}"
            fi
            ;;
        aarch64)
            ARM_BINARY="ffmpeg-${TARGET_VERSION}-aarch64-apple-darwin"
            if [ ! -f "$BINARIES_DIR/$ARM_BINARY" ] || [ "$FORCE_DOWNLOAD" = true ]; then
                download_ffmpeg "$TARGET_VERSION" "aarch64" "arm64"
            else
                echo -e "${GREEN}ℹ️  FFmpeg $TARGET_VERSION for Apple Silicon already exists, skipping download${NC}"
            fi
            ;;
        *)
            echo -e "${RED}❌ Error: Invalid architecture '$SPECIFIC_ARCH'${NC}"
            echo "Valid architectures: x86_64, aarch64"
            exit 1
            ;;
    esac
else
    # Download both architectures (default behavior for development)
    INTEL_BINARY="ffmpeg-${TARGET_VERSION}-x86_64-apple-darwin"
    if [ ! -f "$BINARIES_DIR/$INTEL_BINARY" ] || [ "$FORCE_DOWNLOAD" = true ]; then
        download_ffmpeg "$TARGET_VERSION" "x86_64" "intel"
    else
        echo -e "${GREEN}ℹ️  FFmpeg $TARGET_VERSION for Intel already exists, skipping download${NC}"
    fi

    ARM_BINARY="ffmpeg-${TARGET_VERSION}-aarch64-apple-darwin"
    if [ ! -f "$BINARIES_DIR/$ARM_BINARY" ] || [ "$FORCE_DOWNLOAD" = true ]; then
        download_ffmpeg "$TARGET_VERSION" "aarch64" "arm64"
    else
        echo -e "${GREEN}ℹ️  FFmpeg $TARGET_VERSION for Apple Silicon already exists, skipping download${NC}"
    fi
fi

# Create version info file
VERSION_DATE=$(jq -r ".versions[\"$TARGET_VERSION\"].date" "$VERSIONS_FILE")
cat > "$VERSION_INFO_FILE" << EOF
{
  "version": "$TARGET_VERSION",
  "date": "$VERSION_DATE",
  "updated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

echo ""
echo -e "${GREEN}🎉 FFmpeg setup complete!${NC}"
echo ""
echo -e "${BLUE}FFmpeg $TARGET_VERSION binaries installed to: $BINARIES_DIR${NC}"
if [ -n "$SPECIFIC_ARCH" ]; then
    case $SPECIFIC_ARCH in
        x86_64)
            echo "- Intel: $INTEL_BINARY -> ffmpeg-x86_64-apple-darwin"
            ;;
        aarch64)
            echo "- Apple Silicon: $ARM_BINARY -> ffmpeg-aarch64-apple-darwin"
            ;;
    esac
else
    echo "- Intel: $INTEL_BINARY -> ffmpeg-x86_64-apple-darwin"
    echo "- Apple Silicon: $ARM_BINARY -> ffmpeg-aarch64-apple-darwin"
fi
echo ""

# Show upgrade message if applicable
if [ -n "$CURRENT_INSTALLED_VERSION" ] && [ "$CURRENT_INSTALLED_VERSION" != "$TARGET_VERSION" ]; then
    echo -e "${YELLOW}📝 Note: Upgraded FFmpeg from $CURRENT_INSTALLED_VERSION to $TARGET_VERSION${NC}"
    echo "Remember to update your changelog!"
fi

echo "You can now run 'bun run tauri dev' to start development."