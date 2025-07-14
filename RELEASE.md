# Release Instructions

## Setting Up GitHub Actions for macOS App Distribution

### 1. Workflows Created

**`.github/workflows/desktop/release.yml`** - Creates releases when you push a version tag

- Builds separate apps for Intel (x86_64) and Apple Silicon (aarch64)
- Each build contains only the FFmpeg binary for its architecture (smaller file size)
- Automatically creates a draft GitHub release with downloadable artifacts
- Triggered by tags matching `desktop-v*`

**`.github/workflows/desktop/build.yml`** - Runs on every push and PR

- Tests the build process
- Creates artifacts for testing
- Runs when desktop app code changes

### 2. How to Create a Release

1. **Update version in `apps/desktop/src-tauri/tauri.conf.json`**:

   ```json
   {
     "version": "1.0.0"
   }
   ```

2. **Update version in `apps/desktop/src-tauri/Cargo.toml`**:

   ```toml
   version = "1.0.0"
   ```

3. **Commit your changes**:

   ```bash
   git add .
   git commit -m "Bump version to 1.0.0"
   ```

4. **Create and push a version tag**:

   ```bash
   git tag desktop-v1.0.0
   git push origin desktop-v1.0.0
   ```

   Note: The tag must start with `desktop-v` to trigger the release workflow.

5. **GitHub Actions will automatically**:
   - Build separate apps for Intel and Apple Silicon Macs
   - Download only the necessary FFmpeg binary for each architecture
   - Create a draft release with the artifacts
   - Upload architecture-specific .dmg files that users can download

6. **Finalize the release**:
   - Go to your repository's Releases page
   - Find the draft release
   - Add release notes
   - Publish the release

### 3. Optional: Code Signing (Recommended)

To avoid macOS security warnings, you should sign your app:

1. **Get an Apple Developer Certificate** ($99/year)

2. **Export your certificate**:
   - Open Keychain Access
   - Find your "Developer ID Application" certificate
   - Export as .p12 file with a password

3. **Add secrets to GitHub**:
   - Go to Settings → Secrets → Actions
   - Add `TAURI_SIGNING_PRIVATE_KEY`: Base64 encoded .p12 file

     ```bash
     base64 -i certificate.p12 | pbcopy
     ```

   - Add `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: Your .p12 password

4. **Update `tauri.conf.json`** to enable signing:

   ```json
   {
     "bundle": {
       "macOS": {
         "signingIdentity": "Developer ID Application: Your Name (TEAMID)"
       }
     }
   }
   ```

### 4. What Users Get

Users will download architecture-specific builds:

- **Intel Macs**: `TransVibe_0.1.0_x64.dmg`
- **Apple Silicon Macs**: `TransVibe_0.1.0_aarch64.dmg`

Each build contains only the FFmpeg binary for its architecture, keeping the app size minimal.

### 5. Running Without Code Signing

If you don't sign the app, users will need to:

1. Download the .dmg file
2. Open it and drag the app to Applications
3. Right-click the app and select "Open"
4. Click "Open" in the security dialog

### 6. Testing Locally

Build a release version locally:

```bash
# For current architecture
bun run desktop:build

# For specific architecture
cd apps/desktop
bun run tauri build -- --target aarch64-apple-darwin
bun run tauri build -- --target x86_64-apple-darwin
```

The built app will be in:

- `apps/desktop/src-tauri/target/release/bundle/dmg/` - DMG installer
- `apps/desktop/src-tauri/target/release/bundle/macos/` - .app bundle

### 7. Troubleshooting

**Build fails on GitHub Actions**:

- Check that all dependencies are committed
- Ensure FFmpeg binaries are in the repository
- Check the Actions logs for specific errors

**App won't open on user's Mac**:

- Likely a code signing issue
- Users can bypass with right-click → Open
- Consider getting an Apple Developer certificate

**Wrong architecture downloaded**:

- Intel Mac users should download the x64 version
- Apple Silicon (M1/M2/M3) users should download the aarch64 version
- macOS will show an error if you try to run the wrong architecture
