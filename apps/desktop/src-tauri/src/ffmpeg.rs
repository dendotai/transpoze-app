use std::path::{Path, PathBuf};
use std::process::Stdio;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tokio::process::Command;
use tokio::io::{AsyncBufReadExt, BufReader};
use crate::ffmpeg_parser::{parse_progress_line, parse_duration_from_info, parse_progress_time};
use crate::{log_debug, log_ffmpeg, log_progress};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversionJob {
    pub id: String,
    pub input_path: String,
    pub output_path: String,
    pub preset: VideoPreset,
    pub status: JobStatus,
    pub progress: f32,
    pub duration: Option<f64>,
    pub error: Option<String>,
    pub status_message: Option<String>,
    pub thumbnail_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum JobStatus {
    Queued,
    Ready,
    Processing,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoPreset {
    pub name: String,
    pub description: String,
    pub video_codec: String,
    pub audio_codec: String,
    pub bitrate: Option<String>,
    pub crf: Option<u8>,
    pub scale: Option<String>,
}

impl VideoPreset {
    pub fn get_presets() -> Vec<VideoPreset> {
        vec![
            VideoPreset {
                name: "High".to_string(),
                description: "Best quality, larger file size. Ideal for archiving or further editing.".to_string(),
                video_codec: "libx264".to_string(),
                audio_codec: "aac".to_string(),
                bitrate: None,
                crf: Some(18),
                scale: None,
            },
            VideoPreset {
                name: "Balanced".to_string(),
                description: "Good balance between quality and file size. Perfect for most use cases.".to_string(),
                video_codec: "libx264".to_string(),
                audio_codec: "aac".to_string(),
                bitrate: None,
                crf: Some(23),
                scale: None,
            },
            VideoPreset {
                name: "Web".to_string(),
                description: "Optimized for web streaming. Fast start enabled, reasonable quality.".to_string(),
                video_codec: "libx264".to_string(),
                audio_codec: "aac".to_string(),
                bitrate: Some("2M".to_string()),
                crf: Some(28),
                scale: None,
            },
            VideoPreset {
                name: "Mobile".to_string(),
                description: "Smaller file size for mobile devices. Reduced resolution and bitrate.".to_string(),
                video_codec: "libx264".to_string(),
                audio_codec: "aac".to_string(),
                bitrate: Some("1M".to_string()),
                crf: Some(30),
                scale: Some("720:-1".to_string()),
            },
        ]
    }

    pub fn to_ffmpeg_args(&self) -> Vec<String> {
        let mut args = vec![
            "-c:v".to_string(),
            self.video_codec.clone(),
            "-c:a".to_string(),
            self.audio_codec.clone(),
        ];

        if let Some(crf) = self.crf {
            args.push("-crf".to_string());
            args.push(crf.to_string());
        }

        if let Some(bitrate) = &self.bitrate {
            args.push("-b:v".to_string());
            args.push(bitrate.clone());
        }

        if let Some(scale) = &self.scale {
            args.push("-vf".to_string());
            args.push(format!("scale={}", scale));
        }

        if self.name == "Web" {
            args.push("-movflags".to_string());
            args.push("+faststart".to_string());
        }

        args.push("-preset".to_string());
        args.push("medium".to_string());

        args
    }
}

pub fn get_ffmpeg_binary(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let arch = if cfg!(target_arch = "x86_64") {
        "x86_64"
    } else if cfg!(target_arch = "aarch64") {
        "aarch64"
    } else {
        return Err("Unsupported architecture".to_string());
    };

    let binary_name = format!("ffmpeg-{}-apple-darwin", arch);
    
    // Try production path first
    if let Ok(resource_path) = app_handle.path().resource_dir() {
        let ffmpeg_path = resource_path.join("binaries").join(&binary_name);
        if ffmpeg_path.exists() {
            // Ensure the binary is executable
            #[cfg(unix)]
            {
                use std::fs;
                use std::os::unix::fs::PermissionsExt;
                if let Ok(metadata) = fs::metadata(&ffmpeg_path) {
                    let mut permissions = metadata.permissions();
                    permissions.set_mode(0o755);
                    let _ = fs::set_permissions(&ffmpeg_path, permissions);
                }
            }
            return Ok(ffmpeg_path);
        }
    }
    
    // Try development path
    #[cfg(debug_assertions)]
    {
        let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("binaries")
            .join(&binary_name);
        if dev_path.exists() {
            // Ensure the binary is executable in dev too
            #[cfg(unix)]
            {
                use std::fs;
                use std::os::unix::fs::PermissionsExt;
                if let Ok(metadata) = fs::metadata(&dev_path) {
                    let mut permissions = metadata.permissions();
                    permissions.set_mode(0o755);
                    let _ = fs::set_permissions(&dev_path, permissions);
                }
            }
            return Ok(dev_path);
        }
    }

    Err(format!(
        "FFmpeg binary '{}' not found in resource directory or development path",
        binary_name
    ))
}

pub async fn get_video_duration(ffmpeg_path: &Path, input_path: &str) -> Result<f64, String> {
    let output = Command::new(ffmpeg_path)
        .args(&[
            "-i", input_path,
            "-hide_banner",
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to get video duration: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    log_debug!("Getting duration for: {}", input_path);
    
    // Parse duration from FFmpeg stderr output
    for line in stderr.lines() {
        if let Some(duration) = parse_duration_from_info(line) {
            log_debug!("Parsed duration: {} seconds from line: {}", duration, line);
            return Ok(duration);
        }
    }
    
    Err("Could not parse video duration".to_string())
}


pub async fn convert_video(
    app_handle: AppHandle,
    job: ConversionJob,
    on_progress: impl Fn(String, f32) + Send + 'static,
) -> Result<(), String> {
    let ffmpeg_path = get_ffmpeg_binary(&app_handle)?;
    
    // Only normalize output path - input should be used as-is
    let normalized_output = job.output_path.replace('\u{00A0}', " ");
    
    // Ensure output directory exists
    if let Some(parent) = Path::new(&normalized_output).parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }
    
    let mut args = vec![
        "-i".to_string(),
        job.input_path.clone(),
        "-progress".to_string(),
        "pipe:2".to_string(),
        "-stats".to_string(),
        "-y".to_string(),
    ];

    args.extend(job.preset.to_ffmpeg_args());
    args.push(normalized_output.clone());
    
    // Log the full FFmpeg command for debugging
    log_debug!("FFmpeg command: {} {}", ffmpeg_path.display(), args.join(" "));

    let mut child = Command::new(&ffmpeg_path)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start FFmpeg: {}", e))?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    
    let stdout_reader = BufReader::new(stdout);
    let stderr_reader = BufReader::new(stderr);
    
    let mut stdout_lines = stdout_reader.lines();
    let mut stderr_lines = stderr_reader.lines();
    let mut last_error_line = String::new();

    let duration = job.duration.unwrap_or(0.0);
    log_debug!("Starting conversion for job {} with duration: {} seconds", job.id, duration);

    // Read from both stdout and stderr using tokio::select!
    loop {
        tokio::select! {
            result = stdout_lines.next_line() => {
                match result {
                    Ok(Some(line)) => {
                        // Try to parse progress from stdout
                        if let Some(progress_info) = parse_progress_line(&line) {
                            let current_time = progress_info.time_seconds;
                            let progress = if duration > 0.0 {
                                (current_time / duration * 100.0).min(100.0)
                            } else {
                                0.0
                            };
                            
                            on_progress(job.id.clone(), progress as f32);
                        }
                    }
                    Ok(None) => break,
                    Err(_) => break,
                }
            }
            result = stderr_lines.next_line() => {
                match result {
                    Ok(Some(line)) => {
                        // Log raw FFmpeg output in debug mode
                        // Capture potential error messages
                        if line.contains("Error") || line.contains("error") || line.contains("Invalid") {
                            last_error_line = line.clone();
                        }
                        
                        // Try to parse progress from the line
                        if let Some(progress_info) = parse_progress_line(&line) {
                            let current_time = progress_info.time_seconds;
                            let progress = if duration > 0.0 {
                                (current_time / duration * 100.0).min(100.0)
                            } else {
                                0.0
                            };
                            
                            on_progress(job.id.clone(), progress as f32);
                        } else if let Some(current_time) = parse_progress_time(&line) {
                            // Parse -progress format
                            let progress = if duration > 0.0 {
                                (current_time / duration * 100.0).min(100.0)
                            } else {
                                0.0
                            };
                            
                            on_progress(job.id.clone(), progress as f32);
                        }
                    }
                    Ok(None) => break,
                    Err(_) => break,
                }
            }
        }
    }

    let status = child.wait().await
        .map_err(|e| format!("Failed to wait for FFmpeg: {}", e))?;

    if !status.success() {
        let error_msg = if !last_error_line.is_empty() {
            format!("FFmpeg conversion failed: {}", last_error_line)
        } else {
            "FFmpeg conversion failed with unknown error".to_string()
        };
        return Err(error_msg);
    }

    Ok(())
}


pub async fn generate_thumbnail(
    ffmpeg_path: &Path,
    input_path: &str,
    output_path: &str,
    time_offset: &str,
) -> Result<(), String> {
    println!("FFmpeg thumbnail command:");
    println!("{:?} -ss {} -i {} -vframes 1 -vf scale=320:-1 -y {}", 
        ffmpeg_path, time_offset, input_path, output_path);
    
    // Put -ss before -i for much faster seeking (input seeking vs output seeking)
    let output = Command::new(ffmpeg_path)
        .args(&[
            "-ss", time_offset,
            "-i", input_path,
            "-vframes", "1",
            "-vf", "scale=320:-1",
            "-y",
            output_path,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to generate thumbnail: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        println!("FFmpeg thumbnail generation failed: {}", stderr);
        return Err(format!("Failed to generate thumbnail: {}", stderr));
    }

    println!("Thumbnail generated successfully at: {}", output_path);
    Ok(())
}