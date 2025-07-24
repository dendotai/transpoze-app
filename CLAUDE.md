# Transpoze.app Monorepo - Claude AI Assistant Guidelines

## Important Rules

- NEVER DO MORE THAN ONE ISSUE AT A TIME. Complete and test one issue thoroughly before moving to the next.
- DON'T RUN BUILD. ONLY RUN DEV.

This document contains important information for Claude (or any AI assistant) when working on this project.

## Monorepo Structure

This is now a monorepo using Bun workspaces:

- `apps/desktop/` - Desktop application (Tauri + React)
- `packages/` - Shared packages (future use)
- Root level - Monorepo configuration and shared tooling

## Housekeeping Tasks

### Regular Updates

1. **TypeScript Configuration**
   - Keep `tsconfig.json` updated based on [Total TypeScript's tsconfig cheat sheet](https://www.totaltypescript.com/tsconfig-cheat-sheet)
   - Review and update compiler options when TypeScript releases new versions
   - Ensure strictness options are enabled for better type safety

2. **FFmpeg Version Management**
   - Check for new FFmpeg releases at [evermeet.cx](https://evermeet.cx/ffmpeg/)
   - Update `apps/desktop/scripts/ffmpeg-versions.json` with new versions
   - Test new versions before setting as default

3. **Dependencies**
   - Use Bun for all package management (`bun add`, `bun install`, etc.)
   - Keep dependencies up to date with `bun update`
   - Review security advisories regularly

## Project Standards

### Code Quality

- Run `bun run lint` before committing
- Fix all TypeScript errors (the tsconfig is intentionally strict)
- Keep the codebase clean and well-organized

### Git Practices

- Don't commit:
  - FFmpeg binaries (they're downloaded via setup script)
  - node_modules or bun.lockb
  - Build artifacts (dist/, apps/desktop/src-tauri/target/)
  - OS-specific files (.DS_Store, etc.)

### Testing

- Run `bun run desktop:build` to ensure the project builds
- Test the app with `bun run desktop:dev`
- Verify both architectures work before releases

## Architecture Decisions

1. **Bun over npm/yarn**: Faster, more modern, better DX
2. **Strict TypeScript**: Catches more bugs at compile time
3. **Minimal linting rules**: Project is young, flexibility is important
4. **Architecture-specific builds**: Smaller app size per platform

## Common Commands

### Using Make (recommended)

```bash
# Show all commands
make help

# Initial setup
make setup

# Development
make desktop-dev

# Building
make desktop-build

# Code quality
make lint
make type-check

# Clean artifacts
make clean
```

### Manual commands

```bash
# Development
bun run desktop:dev

# Building
bun run desktop:build

# Linting and formatting
bun run lint

# Type checking only
bun run type-check

# Download FFmpeg binaries
./apps/desktop/scripts/download-ffmpeg.sh

# Download specific architecture only
./apps/desktop/scripts/download-ffmpeg.sh --arch x86_64
./apps/desktop/scripts/download-ffmpeg.sh --arch aarch64
```

## Important Files

- `apps/desktop/scripts/ffmpeg-versions.json` - FFmpeg version registry
- `apps/desktop/src-tauri/binaries/ffmpeg-version.json` - Current FFmpeg version info
- `tsconfig.json` - Root TypeScript configuration
- `apps/desktop/tsconfig.json` - Desktop app TypeScript configuration (extends root)
- `apps/desktop/eslint.config.mjs` - Minimal ESLint rules
- `.github/workflows/desktop/` - Desktop app CI/CD pipelines

## Notes for Future Development

- The project is set up for macOS only currently
- Linux and Windows support will require:
  - Additional FFmpeg binaries in the version registry
  - Platform-specific code in the Rust backend
  - Testing on those platforms
- Video preview feature is partially implemented but not complete
