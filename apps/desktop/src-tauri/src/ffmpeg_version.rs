use serde::{Deserialize, Serialize};
use std::fs;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize)]
pub struct FFmpegVersionInfo {
    pub version: String,
    pub date: String,
    pub updated: String,
}

pub fn get_ffmpeg_version(app_handle: &AppHandle) -> Result<FFmpegVersionInfo, String> {
    let version_path = if cfg!(debug_assertions) {
        // Development: look in src-tauri/binaries
        let mut path = std::env::current_dir()
            .map_err(|e| e.to_string())?;
        path.push("src-tauri");
        path.push("binaries");
        path.push("ffmpeg-version.json");
        path
    } else {
        // Production: look in resources
        app_handle
            .path()
            .resource_dir()
            .map_err(|e| e.to_string())?
            .join("binaries")
            .join("ffmpeg-version.json")
    };

    let content = fs::read_to_string(&version_path)
        .map_err(|e| format!("Failed to read FFmpeg version file: {}", e))?;
    
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse FFmpeg version file: {}", e))
}

#[tauri::command]
pub fn get_ffmpeg_version_info(app_handle: AppHandle) -> Result<FFmpegVersionInfo, String> {
    get_ffmpeg_version(&app_handle)
}