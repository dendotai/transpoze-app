# Transpoze.app - Implementation Notes

## Original Requirements

### Core Requirements

- **Framework**: Tauri (desktop app)
- **Functionality**: Convert WebM files to MP4
- **FFmpeg**: Bundle FFmpeg binaries (not WebAssembly) for performance
- **Platform**: macOS first, then Linux/Windows
- **UX**: Good user experience with visual feedback

### Detailed Feature Requirements

1. **File Input**:
   - Drag-and-drop support for batch conversion
   - File dialog as fallback
   - Accept multiple files at once

2. **Video Preview**:
   - Thumbnails for video files
   - Basic playback preview (pending implementation)

3. **Conversion Queue**:
   - Show all queued files
   - Progress tracking for each conversion
   - Ability to cancel/remove items

4. **Quality Presets**:
   - Multiple quality options (High, Medium, Low, Custom)
   - Clear explanations for each preset
   - SANE defaults that work well

5. **Output Options**:
   - User-defined output directory
   - Option to save to same directory as input
   - Subdirectory creation option
   - Basic naming patterns (e.g., {name}_converted.mp4)

6. **History**:
   - Track conversion history
   - Show past conversions with status

7. **UI/UX**:
   - Modern, clean interface
   - Clear visual feedback
   - Error notifications
   - Progress indicators

## Technical Stack

- **Backend**: Rust with Tauri v2
- **Frontend**: React with TypeScript
- **Styling**: Tailwind CSS v3
- **State Management**: Zustand
- **Build Tool**: Vite
- **FFmpeg**: Bundled binaries for x86_64 and aarch64

## Problems Encountered and Solutions

### 1. Rust Version Incompatibility

**Problem**: Project required Rust 1.82 but system had 1.80.1

```sh
error: package `tauri v2.2.0` cannot be built because it requires rustc 1.82 or newer
```

**Solution**: Created `rust-toolchain.toml`:

```toml
[toolchain]
channel = "1.82"
```

### 2. CSS Not Working

**Problem**: Tailwind CSS styles weren't being applied despite proper configuration

**Solutions Applied**:

1. Moved CSS import from App.tsx to main.tsx
2. Downgraded from Tailwind v4-alpha to stable v3
3. Fixed PostCSS configuration to use CommonJS exports
4. Updated tailwind.config.js content paths

### 3. Window Going Blank

**Problem**: Window went blank when selecting files, with error:

```sh
TypeError: undefined is not an object (evaluating 'job.inputPath.split')
```

**Solutions**:

1. Added null checking in JobQueue component
2. Implemented error boundaries for graceful error handling
3. Added comprehensive logging system
4. Fixed state initialization in useConverter hook

### 4. Drag-and-Drop Not Working

**Problem**: Files dropped on the window weren't being captured

**Root Cause**: Tauri v2 changed the drag-drop API

**Solution**: Implemented proper event handling in Rust:

```rust
window.on_window_event(move |event| {
    match event {
        tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, position: _ }) => {
            let path_strings: Vec<String> = paths.iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect();
            let _ = window_clone.emit("files-dropped", path_strings);
        }
        _ => {}
    }
});
```

### 5. Duplicate Queue Items

**Problem**: Single file drop created multiple queue entries

**Root Causes**:

1. Multiple event listeners being registered
2. Events firing multiple times
3. No deduplication logic

**Solutions**:

1. Consolidated to single 'files-dropped' event
2. Added debouncing with 100ms delay
3. Implemented deduplication at multiple levels:
   - File list level (remove duplicates from dropped files)
   - Job creation level (check for existing jobs)
4. Removed redundant event listeners

### 6. TypeScript Compilation Errors

**Problem**: Various TypeScript errors with event handlers and imports

**Solutions**:

1. Fixed event handler signatures to match Tauri v2 API
2. Removed unused imports
3. Added proper type annotations

### 7. Tauri Configuration Issues

**Problem**: "fileDropEnabled" not recognized in tauri.conf.json

**Solution**: Changed to "dragDropEnabled" for Tauri v2

## Key Implementation Details

### FFmpeg Integration

- Binaries are bundled in `src-tauri/binaries/`
- Architecture detection at runtime (x86_64 vs aarch64)
- Progress tracking via stderr parsing
- Proper argument construction for quality presets

### State Management

- Zustand store in `src/stores/converterStore.ts`
- Separation of concerns between UI state and conversion logic
- Persistent history using Tauri's app data directory

### Error Handling

- Error boundaries for React components
- Try-catch blocks for async operations
- User-friendly error messages via toast notifications
- Comprehensive logging system for debugging

### Performance Optimizations

- Debounced drag-drop handling
- Memoized components where appropriate
- Efficient job queue updates
- Lazy loading for history

### Filename Pattern Variable Click Behavior

The filename pattern input supports clicking on `{name}` and `{number}` variables in the help text to insert them. The implementation handles two scenarios:

1. **Input not focused**: Appends the variable to the end with appropriate underscores
2. **Input focused**: Inserts the variable at the current cursor position

**Problem**: When clicking variables rapidly, the cursor position would get out of sync, causing variables to be inserted at the wrong position (e.g., at the beginning instead of the end).

**Solution**:

- When the input is focused, use the actual cursor position from `input.selectionStart` instead of the tracked ref value
- Immediately update `lastCursorPositionRef.current` after calculating the new position, before the async operations
- Add click debouncing with `isProcessingClickRef` to prevent race conditions from rapid clicks
- Track focus state and cursor position with a 50ms interval to maintain awareness of input state

Key code snippet:

```typescript
const cursorPos = wasInputFocused && document.activeElement === input 
  ? (input.selectionStart || 0) 
  : lastCursorPositionRef.current;
```

This ensures the cursor position is always accurate, even when React state updates are batched or delayed.

### Status Message Not Updating During Conversion

**Problem**: When video conversion started, the status message remained stuck on "Ready to convert" even though the progress bar was moving, instead of showing "Analyzing video..." and then "Converting video...".

**Root Causes**:

1. Race condition between preprocessing and main conversion threads both updating the job status
2. Status message updates were being overwritten by subsequent state updates
3. Frontend event handling wasn't properly refreshing the job data
4. No clear separation between analysis phase and conversion phase

**Solution**:

1. **Clear phase separation**:
   - First show "Analyzing video..." when getting video duration
   - Then show "Converting video..." when actual conversion starts

2. **Prevent race conditions**:
   - Check job status before updating in preprocessing
   - Only update status message if job is still queued

3. **Ensure frontend updates**:
   - Add explicit logging for event emission
   - Verify job-updated events are properly sent and received
   - Frontend fetches full job data on each update

4. **Backend implementation**:

```rust
// Show analyzing status first
if current_job.duration.is_none() {
    state_clone.update_job_status_message(&job_id_clone, "Analyzing video...".to_string()).await;
    let _ = app_handle_clone.emit("job-updated", &job_id_clone);
    
    // Get duration...
}

// Then show converting status
state_clone.update_job_status_message(&job_id_clone, "Converting video...".to_string()).await;
let _ = app_handle_clone.emit("job-updated", &job_id_clone);
```

5. **Frontend logging**:

```typescript
const unlistenJobUpdate = listen<string>('job-updated', async (event) => {
    const jobId = event.payload;
    logger.info('JOB-UPDATED EVENT RECEIVED', { jobId });
    const jobs = await invoke<ConversionJob[]>('get_conversion_jobs');
    const updatedJob = jobs.find(j => j.id === jobId);
    console.log('JOB-UPDATED: Frontend received update for job', jobId, 'with status message:', updatedJob?.statusMessage);
    useConverter.setState({ jobs });
});
```

This ensures proper status progression: "Waiting in queue..." → "Ready to convert" → "Analyzing video..." → "Converting video..." → completion.

## Running the Application

### Development

```bash
npm run tauri dev
```

### Building

```bash
npm run tauri build
```

### Requirements

- Node.js 16+
- Rust 1.82+
- macOS (for current implementation)

## Pending Features

1. **Basic Video Playback Preview**: Backend support exists but frontend implementation pending
2. **Linux/Windows Support**: Requires platform-specific FFmpeg binaries and testing
3. **Advanced Naming Patterns**: Currently supports basic patterns, could be expanded
4. **Batch Actions**: Select multiple items for bulk operations
5. **Conversion Profiles**: Save custom quality settings

## Architecture Decisions

### Why Tauri?

- Native performance
- Small bundle size
- Secure by default
- Good FFmpeg integration

### Why Bundle FFmpeg?

- Consistent behavior across systems
- No dependency on system FFmpeg
- Controlled version and features
- Better user experience (works out of the box)

### Why Zustand for State?

- Simple API
- TypeScript friendly
- Good performance
- No boilerplate

## Lessons Learned

1. Always check framework version documentation (Tauri v1 vs v2 had major API changes)
2. Implement comprehensive logging early for easier debugging
3. Test drag-and-drop thoroughly - it's often problematic
4. Add deduplication logic whenever handling user input events
5. Use error boundaries in React for better error handling
6. Bundle dependencies when possible for consistent behavior

## Future Improvements

1. Add video codec detection for smarter conversion
2. Implement hardware acceleration support
3. Add conversion profiles/templates
4. Support more input/output formats
5. Add batch editing capabilities
6. Implement conversion scheduling
7. Add network share support
8. Create conversion statistics dashboard
