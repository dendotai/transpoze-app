mod ffmpeg;
mod ffmpeg_parser;
mod ffmpeg_version;
mod logger;
mod state;

use ffmpeg::{ConversionJob, VideoPreset, JobStatus, convert_video, generate_thumbnail, get_ffmpeg_binary};
use state::{AppState, ConversionHistory, AppSettings};
use std::fs;
use tauri::{AppHandle, Manager, Emitter};
use uuid::Uuid;
use chrono::Utc;
use base64::{Engine as _, engine::general_purpose};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};

static QUEUE_PROCESSOR_RUNNING: AtomicBool = AtomicBool::new(false);

async fn start_queue_processor_if_needed(app_handle: AppHandle, state: AppState) {
    if QUEUE_PROCESSOR_RUNNING.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_ok() {
        println!("Starting queue processor for subsequent jobs (first job processes immediately)");
        tauri::async_runtime::spawn(async move {
            loop {
                // Check if there's a ready job to convert (has been analyzed)
                if let Some(job_id) = state.get_next_ready_job().await {
                    // Check if any job is currently processing conversion
                    if !state.is_any_job_processing().await {
                        println!("Converting next job from queue: {}", job_id);
                        convert_job(app_handle.clone(), state.clone(), job_id).await;
                    }
                }
                
                // Wait a bit before checking again
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                
                // Check if there are any jobs left to process
                let has_ready_jobs = state.get_next_ready_job().await.is_some();
                let has_queued_jobs = state.get_next_queued_job().await.is_some();
                if !has_ready_jobs && !has_queued_jobs {
                    println!("No more jobs in queue, stopping processor");
                    QUEUE_PROCESSOR_RUNNING.store(false, Ordering::SeqCst);
                    break;
                }
            }
        });
    }
}

async fn start_priority_processing(app_handle: AppHandle, state: AppState, job_id: String, input_path: String) {
    tauri::async_runtime::spawn(async move {
        println!("Starting priority processing (analyze + convert) for first job: {}", &job_id);
        
        // First, do the analysis
        if let Ok(ffmpeg_path) = get_ffmpeg_binary(&app_handle) {
            println!("Got FFmpeg path: {:?}", ffmpeg_path);
            if let Ok(duration) = ffmpeg::get_video_duration(&ffmpeg_path, &input_path).await {
                println!("Got video duration: {}", duration);
                if let Some(mut job) = state.get_job(&job_id).await {
                    job.duration = Some(duration);
                    
                    // Generate thumbnail
                    let thumbnail_dir = app_handle.path().app_cache_dir()
                        .expect("Failed to get cache dir")
                        .join("thumbnails");
                    
                    if !thumbnail_dir.exists() {
                        let _ = fs::create_dir_all(&thumbnail_dir);
                    }
                    
                    let thumbnail_path = thumbnail_dir.join(format!("{}.jpg", &job_id));
                    let thumbnail_path_str = thumbnail_path.to_string_lossy().to_string();
                    let time_offset = format!("{}", duration * 0.1);
                    
                    match generate_thumbnail(&ffmpeg_path, &input_path, &thumbnail_path_str, &time_offset).await {
                        Ok(()) => {
                            println!("Thumbnail generated successfully for priority job");
                            job.thumbnail_path = Some(thumbnail_path_str.clone());
                        }
                        Err(e) => {
                            println!("Failed to generate thumbnail for priority job: {}", e);
                        }
                    }
                    
                    // Set to Ready first
                    job.status = JobStatus::Ready;
                    job.status_message = Some("Ready to convert".to_string());
                    state.update_job(job.clone()).await;
                    let _ = app_handle.emit("job-updated", &job_id);
                    
                    // Immediately start conversion
                    println!("Starting immediate conversion for priority job: {}", job_id);
                    convert_job(app_handle.clone(), state.clone(), job_id.clone()).await;
                }
            } else {
                println!("Failed to get video duration for priority job, converting anyway");
                if let Some(mut job) = state.get_job(&job_id).await {
                    job.status = JobStatus::Ready;
                    job.status_message = Some("Ready to convert".to_string());
                    state.update_job(job.clone()).await;
                    let _ = app_handle.emit("job-updated", &job_id);
                    
                    // Start conversion even without duration
                    convert_job(app_handle.clone(), state.clone(), job_id.clone()).await;
                }
            }
        } else {
            println!("Failed to get FFmpeg binary for priority job, converting anyway");
            if let Some(mut job) = state.get_job(&job_id).await {
                job.status = JobStatus::Ready;
                job.status_message = Some("Ready to convert".to_string());
                state.update_job(job.clone()).await;
                let _ = app_handle.emit("job-updated", &job_id);
                
                // Start conversion even without analysis
                convert_job(app_handle.clone(), state.clone(), job_id.clone()).await;
            }
        }
    });
}

async fn start_preprocessing(app_handle: AppHandle, state: AppState, job_id: String, input_path: String) {
    tauri::async_runtime::spawn(async move {
        println!("Starting preprocessing for job: {}", &job_id);
        
        if let Ok(ffmpeg_path) = get_ffmpeg_binary(&app_handle) {
            println!("Got FFmpeg path: {:?}", ffmpeg_path);
            if let Ok(duration) = ffmpeg::get_video_duration(&ffmpeg_path, &input_path).await {
                println!("Got video duration: {}", duration);
                if let Some(mut job) = state.get_job(&job_id).await {
                    job.duration = Some(duration);
                    
                    // Generate thumbnail
                    let thumbnail_dir = app_handle.path().app_cache_dir()
                        .expect("Failed to get cache dir")
                        .join("thumbnails");
                    
                    println!("Thumbnail directory: {:?}", thumbnail_dir);
                    
                    // Create thumbnails directory if it doesn't exist
                    if !thumbnail_dir.exists() {
                        println!("Creating thumbnail directory");
                        let _ = fs::create_dir_all(&thumbnail_dir);
                    }
                    
                    let thumbnail_path = thumbnail_dir.join(format!("{}.jpg", &job_id));
                    let thumbnail_path_str = thumbnail_path.to_string_lossy().to_string();
                    
                    // Generate thumbnail at 10% of video duration
                    let time_offset = format!("{}", duration * 0.1);
                    
                    println!("Generating thumbnail at path: {}", &thumbnail_path_str);
                    println!("Time offset: {}", &time_offset);
                    
                    match generate_thumbnail(&ffmpeg_path, &input_path, &thumbnail_path_str, &time_offset).await {
                        Ok(()) => {
                            println!("Thumbnail generated successfully");
                            job.thumbnail_path = Some(thumbnail_path_str.clone());
                            println!("Job thumbnail_path set to: {:?}", job.thumbnail_path);
                        }
                        Err(e) => {
                            println!("Failed to generate thumbnail: {}", e);
                        }
                    }
                    
                    // Only update status if job is still queued
                    if matches!(job.status, JobStatus::Queued) {
                        job.status = JobStatus::Ready;
                        job.status_message = Some("Ready to convert".to_string());
                    }
                    state.update_job(job.clone()).await;
                    println!("Job updated with thumbnail_path: {:?}", job.thumbnail_path);
                    let _ = app_handle.emit("job-updated", &job_id);
                }
            } else {
                println!("Failed to get video duration, setting job to ready anyway");
                if let Some(mut job) = state.get_job(&job_id).await {
                    if matches!(job.status, JobStatus::Queued) {
                        job.status = JobStatus::Ready;
                        job.status_message = Some("Ready to convert".to_string());
                        state.update_job(job.clone()).await;
                        let _ = app_handle.emit("job-updated", &job_id);
                    }
                }
            }
        } else {
            println!("Failed to get FFmpeg binary, setting job to ready anyway");
            if let Some(mut job) = state.get_job(&job_id).await {
                if matches!(job.status, JobStatus::Queued) {
                    job.status = JobStatus::Ready;
                    job.status_message = Some("Ready to convert".to_string());
                    state.update_job(job.clone()).await;
                    let _ = app_handle.emit("job-updated", &job_id);
                }
            }
        }
    });
}

async fn convert_job(app_handle: AppHandle, state: AppState, job_id: String) {
    // Get the job details
    let job = match state.get_job(&job_id).await {
        Some(job) => job,
        None => {
            println!("Job {} not found in state", job_id);
            return;
        }
    };
    
    println!("Starting conversion for job: {}", job_id);
    
    // Update status to processing
    state.update_job_status(&job_id, JobStatus::Processing).await;
    
    // Update to "Converting video..." 
    println!("Setting status to 'Converting video...' for job {}", &job_id);
    state.update_job_status_message(&job_id, "Converting video...".to_string()).await;
    
    // Emit and log the event
    match app_handle.emit("job-updated", &job_id) {
        Ok(_) => println!("Successfully emitted job-updated event for 'Converting video...'"),
        Err(e) => println!("ERROR: Failed to emit job-updated event: {}", e),
    }
    
    // Small delay to ensure UI updates
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    
    // Get the updated job with the new status message
    let job_with_duration = state.get_job(&job_id).await.unwrap_or(job.clone());
    
    let state_clone = state.clone();
    let app_handle_clone = app_handle.clone();
    let result = convert_video(
        app_handle.clone(),
        job_with_duration.clone(),
        move |id, progress| {
            let state = state_clone.clone();
            let app = app_handle_clone.clone();
            tauri::async_runtime::spawn(async move {
                // Update progress
                state.update_job_progress(&id, progress).await;
                
                // Only emit progress event, don't override status message
                let _ = app.emit("conversion-progress", (id.clone(), progress));
            });
        },
    ).await;

    match result {
        Ok(_) => {
            state.update_job_status(&job_id, JobStatus::Completed).await;
            
            // Add to history
            if let (Ok(input_metadata), Ok(output_metadata)) = (
                fs::metadata(&job_with_duration.input_path),
                fs::metadata(&job_with_duration.output_path)
            ) {
                let history_item = ConversionHistory {
                    id: Uuid::new_v4().to_string(),
                    input_path: job_with_duration.input_path.clone(),
                    output_path: job_with_duration.output_path.clone(),
                    preset_name: job_with_duration.preset.name.clone(),
                    completed_at: Utc::now().to_rfc3339(),
                    file_size_before: input_metadata.len(),
                    file_size_after: output_metadata.len(),
                    duration: job_with_duration.duration.unwrap_or(0.0),
                };
                let _ = state.add_to_history(&app_handle, history_item).await;
            }
            
            let _ = app_handle.emit("conversion-complete", &job_id);
        }
        Err(e) => {
            let mut job = state.get_job(&job_id).await.unwrap();
            job.status = JobStatus::Failed;
            job.error = Some(e);
            state.update_job(job).await;
            let _ = app_handle.emit("conversion-failed", &job_id);
        }
    }
}

#[tauri::command]
async fn get_video_presets() -> Vec<VideoPreset> {
    VideoPreset::get_presets()
}

#[tauri::command]
async fn add_conversion_job(
    app_handle: AppHandle,
    state: tauri::State<'_, AppState>,
    input_path: String,
    output_path: String,
    preset: VideoPreset,
) -> Result<String, String> {
    println!("add_conversion_job called with:");
    println!("  input_path: {}", input_path);
    println!("  output_path: {}", output_path);
    println!("  preset: {:?}", preset);
    
    let job_id = Uuid::new_v4().to_string();
    
    let job = ConversionJob {
        id: job_id.clone(),
        input_path: input_path.clone(),
        output_path: output_path.clone(),
        preset: preset.clone(),
        status: JobStatus::Queued,
        progress: 0.0,
        duration: None,
        error: None,
        status_message: Some("Waiting in queue...".to_string()),
        thumbnail_path: None,
    };

    state.add_job(job.clone()).await;

    // Check if this is the first job in the queue
    let is_first_job = {
        let queue = state.job_queue.lock().await;
        queue.len() == 1 // This job was just added, so if length is 1, it's the first
    };
    
    if is_first_job {
        // For the first job, analyze and start converting immediately
        start_priority_processing(app_handle.clone(), state.inner().clone(), job_id.clone(), input_path.clone()).await;
    } else {
        // For subsequent jobs, just start background analysis
        start_preprocessing(app_handle.clone(), state.inner().clone(), job_id.clone(), input_path.clone()).await;
    }
    
    // Start the queue processor if it's not already running
    start_queue_processor_if_needed(app_handle.clone(), state.inner().clone()).await;

    Ok(job_id)
}

#[tauri::command]
async fn get_conversion_jobs(state: tauri::State<'_, AppState>) -> Result<Vec<ConversionJob>, String> {
    Ok(state.get_all_jobs().await)
}

#[tauri::command]
async fn get_conversion_history(state: tauri::State<'_, AppState>) -> Result<Vec<ConversionHistory>, String> {
    Ok(state.get_history().await)
}

#[tauri::command]
async fn clear_completed_jobs(
    app_handle: AppHandle,
    state: tauri::State<'_, AppState>
) -> Result<(), String> {
    // Get all completed jobs before clearing
    let jobs = state.get_all_jobs().await;
    let completed_job_ids: Vec<String> = jobs.iter()
        .filter(|j| matches!(j.status, JobStatus::Completed) || matches!(j.status, JobStatus::Failed))
        .map(|j| j.id.clone())
        .collect();
    
    // Clear jobs from state
    state.clear_completed_jobs().await;
    
    // Clean up thumbnails for cleared jobs
    if let Ok(thumbnail_dir) = app_handle.path().app_cache_dir() {
        let thumbnail_dir = thumbnail_dir.join("thumbnails");
        if thumbnail_dir.exists() {
            for job_id in completed_job_ids {
                let thumbnail_path = thumbnail_dir.join(format!("{}.jpg", job_id));
                if thumbnail_path.exists() {
                    let _ = fs::remove_file(&thumbnail_path);
                }
            }
        }
    }
    
    // Emit event to refresh the frontend
    app_handle.emit("jobs-cleared", ()).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
async fn clear_conversion_history(
    app_handle: AppHandle,
    state: tauri::State<'_, AppState>
) -> Result<(), String> {
    state.clear_history(&app_handle).await
}

#[tauri::command]
async fn check_file_exists(path: String) -> Result<bool, String> {
    Ok(std::path::Path::new(&path).exists())
}

#[tauri::command]
async fn generate_video_thumbnail(
    app_handle: AppHandle,
    input_path: String,
    output_path: String,
    time_offset: String,
) -> Result<(), String> {
    let ffmpeg_path = get_ffmpeg_binary(&app_handle)?;
    generate_thumbnail(&ffmpeg_path, &input_path, &output_path, &time_offset).await
}

#[tauri::command]
async fn get_thumbnail_data(
    app_handle: AppHandle,
    job_id: String,
) -> Result<String, String> {
    println!("get_thumbnail_data called for job_id: {}", &job_id);
    
    let thumbnail_dir = app_handle.path().app_cache_dir()
        .map_err(|e| format!("Failed to get cache dir: {}", e))?
        .join("thumbnails");
    
    let thumbnail_path = thumbnail_dir.join(format!("{}.jpg", job_id));
    println!("Looking for thumbnail at: {:?}", &thumbnail_path);
    
    if thumbnail_path.exists() {
        println!("Thumbnail found!");
        // Read the file and convert to base64
        let image_data = fs::read(&thumbnail_path)
            .map_err(|e| format!("Failed to read thumbnail: {}", e))?;
        let base64_data = general_purpose::STANDARD.encode(image_data);
        Ok(format!("data:image/jpeg;base64,{}", base64_data))
    } else {
        println!("Thumbnail not found at path");
        Err("Thumbnail not found".to_string())
    }
}

#[tauri::command]
async fn get_video_file_data(file_path: String) -> Result<Vec<u8>, String> {
    println!("Reading video file for fast thumbnail: {}", &file_path);
    
    // Read the video file as bytes
    let file_data = fs::read(&file_path)
        .map_err(|e| format!("Failed to read video file: {}", e))?;
    
    println!("Video file read successfully, size: {} bytes", file_data.len());
    Ok(file_data)
}

#[tauri::command]
async fn select_output_directory() -> Result<Option<String>, String> {
    Ok(None) // Will be implemented with dialog plugin
}

#[tauri::command]
async fn test_file_drop(paths: Vec<String>) -> Result<(), String> {
    println!("Received file drop with paths: {:?}", paths);
    Ok(())
}

#[tauri::command]
async fn debug_binary_paths(app_handle: AppHandle) -> Result<String, String> {
    let mut debug_info = String::new();
    
    // Get resource directory
    let resource_dir = app_handle.path().resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;
    debug_info.push_str(&format!("Resource directory: {:?}\n", resource_dir));
    
    // Check if resource directory exists
    debug_info.push_str(&format!("Resource directory exists: {}\n", resource_dir.exists()));
    
    // List contents of resource directory
    if resource_dir.exists() {
        debug_info.push_str("Resource directory contents:\n");
        if let Ok(entries) = std::fs::read_dir(&resource_dir) {
            for entry in entries {
                if let Ok(entry) = entry {
                    debug_info.push_str(&format!("  - {:?}\n", entry.path()));
                }
            }
        }
    }
    
    // Try to get FFmpeg binary path
    match get_ffmpeg_binary(&app_handle) {
        Ok(path) => {
            debug_info.push_str(&format!("\nFFmpeg binary path: {:?}\n", path));
            debug_info.push_str(&format!("FFmpeg binary exists: {}\n", path.exists()));
            
            // Check if executable
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if let Ok(metadata) = std::fs::metadata(&path) {
                    let permissions = metadata.permissions();
                    debug_info.push_str(&format!("FFmpeg binary permissions: {:o}\n", permissions.mode()));
                }
            }
        }
        Err(e) => {
            debug_info.push_str(&format!("\nError getting FFmpeg binary: {}\n", e));
        }
    }
    
    // Check current working directory
    if let Ok(cwd) = std::env::current_dir() {
        debug_info.push_str(&format!("\nCurrent working directory: {:?}\n", cwd));
    }
    
    Ok(debug_info)
}

#[tauri::command]
async fn get_app_settings(state: tauri::State<'_, AppState>) -> Result<AppSettings, String> {
    Ok(state.get_settings().await)
}

#[tauri::command]
async fn update_app_settings(
    app_handle: AppHandle,
    state: tauri::State<'_, AppState>,
    settings: AppSettings,
) -> Result<(), String> {
    state.update_settings(&app_handle, |current_settings| {
        *current_settings = settings;
    }).await
}

#[tauri::command]
async fn load_persisted_data(
    app_handle: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    // Load settings first
    if let Err(e) = state.load_settings(&app_handle).await {
        eprintln!("Failed to load settings: {}", e);
    }
    
    // Load history
    if let Err(e) = state.load_history(&app_handle).await {
        eprintln!("Failed to load history: {}", e);
    }
    
    Ok(())
}

#[tauri::command]
async fn reveal_in_finder(file_path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-R", &file_path])
            .spawn()
            .map_err(|e| format!("Failed to open Finder: {}", e))?;
    }
    
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .args(["/select,", &file_path])
            .spawn()
            .map_err(|e| format!("Failed to open Explorer: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        // Try different file managers
        let file_managers = ["xdg-open", "nautilus", "dolphin", "thunar"];
        let parent_dir = std::path::Path::new(&file_path)
            .parent()
            .ok_or("No parent directory")?;
            
        for manager in &file_managers {
            if Command::new(manager)
                .arg(parent_dir)
                .spawn()
                .is_ok() {
                break;
            }
        }
    }
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(AppState::new())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            let window_clone = window.clone();
            
            // Enable file drop
            window.on_window_event(move |event| {
                match event {
                    tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, position: _ }) => {
                        println!("Files dropped: {:?}", paths);
                        // Convert PathBuf to String
                        let path_strings: Vec<String> = paths.iter()
                            .map(|p| p.to_string_lossy().to_string())
                            .collect();
                        let _ = window_clone.emit("files-dropped", path_strings);
                    }
                    tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Enter { paths: _, position: _ }) => {
                        println!("Drag enter");
                        let _ = window_clone.emit("files-drag-enter", ());
                    }
                    tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Leave) => {
                        println!("Drag leave");
                        let _ = window_clone.emit("files-drag-leave", ());
                    }
                    tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Over { position: _ }) => {
                        // Don't log this as it fires frequently
                    }
                    _ => {}
                }
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_video_presets,
            add_conversion_job,
            get_conversion_jobs,
            get_conversion_history,
            clear_completed_jobs,
            clear_conversion_history,
            check_file_exists,
            generate_video_thumbnail,
            get_thumbnail_data,
            get_video_file_data,
            select_output_directory,
            debug_binary_paths,
            test_file_drop,
            reveal_in_finder,
            get_app_settings,
            update_app_settings,
            load_persisted_data,
            ffmpeg_version::get_ffmpeg_version_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}