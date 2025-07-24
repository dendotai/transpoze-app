# TODO

## Features

### Filename Pattern Enhancements

- [x] Auto-numbering for batch conversions: If no dynamic filename pattern is set, automatically append numbers to prevent overwriting (e.g., output-0.webm, output-1.webm, output-2.webm)
- [x] Add `{number}` variable support in filename patterns for manual control over numbering in batch conversions
- [x] Prevent overwriting by default. If the file exists, add a number to the filename
- [x] Basic autocomplete for filename dynamic variables
- [x] Clicking on {name} or {number} in the help text should append _{correct_variable} to the end of the filename pattern if cursor is not in the filename pattern. And it should add _{correct_variable}_ if cursor is in the filename pattern
- [x] If it added the part at the end, cursor should move to the end after that

### UI/UX Improvements

- [x] Refactor preset names to be single words (e.g., "High Quality" → "High")
- [x] Display preset names as tags/badges in the queue items instead of full text like "High Quality preset"
- [x] Disable auto-cleaning of the queue (keep completed/failed jobs visible)
- [x] Add a "Clear Queue" button to manually remove completed/failed jobs
- [x] Progress bar doesn't work in the queue, always 0%. Probably needs to change ffmpeg commands, so it returns progress that we display
- [x] Show video preview thumbnails for files in the queue
- [x] Should persist all settings and history between sessions
- [x] When wide enough (for presets to be in the sidebar), settings section (div) should have the same width as the dropzone
- [x] Add "Open in Finder/Explorer" button to the queue items
- [ ] Replace checkmark of completed jobs with something less ugly and moar beautiful
- [ ] Compression should be more readable. For example not clear what does this Compression: -56.2% mean.
- [ ] When file pattern is empty, it shows weirdly looking suggestion (bold or duplicate text)
- [ ] Show human readable size of the file in the queue
- [ ] Make buttons more consistent
- [ ] Change wording from "Conversion" to "Transcoding" where appropriate.

## Functionality

- [ ] Allow stopping all conversions and mark them as stopped
- [ ] Allow clearing the history
- [ ] Likely cash or wherever thumbnails are stored should be cleared regularly from unused files
- [ ] Add variable "preset" for filename pattern

## Bugs

- [x] Fix duplicate items showing in queue (completed jobs were being displayed)
- [x] Fix file exists check - was always returning true instead of actual result
- [x] Fix FFmpeg failing with "No such file or directory" - only normalize output paths, not input paths
- [x] Fix incorrect numbering in batch operations - was adding numbers even when pattern like {name}_converted doesn't need them
- [ ] Ready to convert was not changed to Converting when it started converting (at least for the second video)
- [ ] Conversion order is still incosistent

## Onboarding

- [ ] Remove border around settings section, dimming is enough
- [ ] Make text more visible by adding white background having the same form but slighly larger than letters (so that it looks cloudish, or like a sticker)
- [ ] Replace comic sans with another handwritten-ish font

## Visual

- [ ] Change icon to something like "↦"
- [ ] Add a "Transpoze.app" logo to the icon
- [ ] Add a "Transpoze.app" logo to the app
- [ ] Try glass background

## Testing

- [ ] Add tests for file path handling with special characters (non-breaking spaces, Cyrillic, etc.)
- [ ] Add tests for check_file_exists to ensure it returns actual boolean values
- [ ] Add integration tests for the full conversion flow
- [ ] Test error handling and proper error message propagation from FFmpeg

## Secret

- [ ] Add PSP mode that will convert video to PSP format
  something like this:
  - container: MP4 or AVI
  - video codec: MPEG-4, H.264
  - resolution: 480x272

- [ ] PSP mode should be enabled by clicking 3 time on the app icon
- [ ] When PSP mode is enable, the icon should change to psp icon

[Log] Job details: – {id: "5119488d-4f8c-4263-80be-93bd99ea93b0", thumbnailPath: "/Users/den/Library/Caches/app.transpoze/thumbnails/5119488d-4f8c-4263-80be-93bd99ea93b0.jpg"} (Queue.tsx, line 41)
