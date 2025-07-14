use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};
use crate::ffmpeg::{ConversionJob, JobStatus};
use tauri::{AppHandle, Manager};
use std::fs;
use std::path::PathBuf;
use std::collections::VecDeque;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub output_directory: String,
    pub use_subdirectory: bool,
    pub subdirectory_name: String,
    pub file_name_pattern: String,
    pub zoomed_thumbnails: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            output_directory: String::new(),
            use_subdirectory: true,
            subdirectory_name: "converted".to_string(),
            file_name_pattern: "{name}_converted".to_string(),
            zoomed_thumbnails: false,
        }
    }
}

#[derive(Clone)]
pub struct AppState {
    pub jobs: Arc<Mutex<HashMap<String, ConversionJob>>>,
    pub job_queue: Arc<Mutex<VecDeque<String>>>, // Queue of job IDs in order
    pub history: Arc<Mutex<Vec<ConversionHistory>>>,
    pub settings: Arc<Mutex<AppSettings>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversionHistory {
    pub id: String,
    pub input_path: String,
    pub output_path: String,
    pub preset_name: String,
    pub completed_at: String,
    pub file_size_before: u64,
    pub file_size_after: u64,
    pub duration: f64,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            jobs: Arc::new(Mutex::new(HashMap::new())),
            job_queue: Arc::new(Mutex::new(VecDeque::new())),
            history: Arc::new(Mutex::new(Vec::new())),
            settings: Arc::new(Mutex::new(AppSettings::default())),
        }
    }

    fn get_data_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
        app_handle.path().app_data_dir()
            .map_err(|e| format!("Failed to get app data directory: {}", e))
    }

    fn get_history_file_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
        let data_dir = Self::get_data_dir(app_handle)?;
        Ok(data_dir.join("conversion_history.json"))
    }

    fn get_settings_file_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
        let data_dir = Self::get_data_dir(app_handle)?;
        Ok(data_dir.join("settings.json"))
    }

    pub async fn load_history(&self, app_handle: &AppHandle) -> Result<(), String> {
        let history_path = Self::get_history_file_path(app_handle)?;
        
        if history_path.exists() {
            let content = fs::read_to_string(&history_path)
                .map_err(|e| format!("Failed to read history file: {}", e))?;
            
            let loaded_history: Vec<ConversionHistory> = serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse history file: {}", e))?;
            
            let mut history = self.history.lock().await;
            *history = loaded_history;
        }
        
        Ok(())
    }

    pub async fn save_history(&self, app_handle: &AppHandle) -> Result<(), String> {
        let data_dir = Self::get_data_dir(app_handle)?;
        
        // Create data directory if it doesn't exist
        if !data_dir.exists() {
            fs::create_dir_all(&data_dir)
                .map_err(|e| format!("Failed to create data directory: {}", e))?;
        }
        
        let history_path = Self::get_history_file_path(app_handle)?;
        let history = self.history.lock().await;
        
        let content = serde_json::to_string_pretty(&*history)
            .map_err(|e| format!("Failed to serialize history: {}", e))?;
        
        fs::write(&history_path, content)
            .map_err(|e| format!("Failed to write history file: {}", e))?;
        
        Ok(())
    }

    pub async fn load_settings(&self, app_handle: &AppHandle) -> Result<(), String> {
        let settings_path = Self::get_settings_file_path(app_handle)?;
        
        if settings_path.exists() {
            let content = fs::read_to_string(&settings_path)
                .map_err(|e| format!("Failed to read settings file: {}", e))?;
            
            let loaded_settings: AppSettings = serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse settings file: {}", e))?;
            
            let mut settings = self.settings.lock().await;
            *settings = loaded_settings;
        }
        
        Ok(())
    }

    pub async fn save_settings(&self, app_handle: &AppHandle) -> Result<(), String> {
        let data_dir = Self::get_data_dir(app_handle)?;
        
        // Create data directory if it doesn't exist
        if !data_dir.exists() {
            fs::create_dir_all(&data_dir)
                .map_err(|e| format!("Failed to create data directory: {}", e))?;
        }
        
        let settings_path = Self::get_settings_file_path(app_handle)?;
        let settings = self.settings.lock().await;
        
        let content = serde_json::to_string_pretty(&*settings)
            .map_err(|e| format!("Failed to serialize settings: {}", e))?;
        
        fs::write(&settings_path, content)
            .map_err(|e| format!("Failed to write settings file: {}", e))?;
        
        Ok(())
    }

    pub async fn get_settings(&self) -> AppSettings {
        let settings = self.settings.lock().await;
        settings.clone()
    }

    pub async fn update_settings<F>(&self, app_handle: &AppHandle, update_fn: F) -> Result<(), String>
    where
        F: FnOnce(&mut AppSettings),
    {
        {
            let mut settings = self.settings.lock().await;
            update_fn(&mut *settings);
        }
        self.save_settings(app_handle).await
    }

    pub async fn add_job(&self, job: ConversionJob) {
        let job_id = job.id.clone();
        
        // Check if job already exists
        let job_exists = {
            let jobs = self.jobs.lock().await;
            jobs.contains_key(&job_id)
        };
        
        // Add job to jobs map
        {
            let mut jobs = self.jobs.lock().await;
            jobs.insert(job_id.clone(), job);
        }
        
        // Only add to queue if it's a new job
        if !job_exists {
            let mut queue = self.job_queue.lock().await;
            queue.push_back(job_id);
        }
    }

    pub async fn update_job(&self, job: ConversionJob) {
        let job_id = job.id.clone();
        
        // Only update the job in the map, don't add to queue
        let mut jobs = self.jobs.lock().await;
        jobs.insert(job_id, job);
    }

    pub async fn get_next_queued_job(&self) -> Option<String> {
        let queue = self.job_queue.lock().await;
        let jobs = self.jobs.lock().await;
        
        // Find the first queued job in the queue
        for job_id in queue.iter() {
            if let Some(job) = jobs.get(job_id) {
                if matches!(job.status, JobStatus::Queued | JobStatus::Ready) {
                    return Some(job_id.clone());
                }
            }
        }
        None
    }

    pub async fn get_next_ready_job(&self) -> Option<String> {
        let queue = self.job_queue.lock().await;
        let jobs = self.jobs.lock().await;
        
        // Find the first ready job in the queue (in order)
        for job_id in queue.iter() {
            if let Some(job) = jobs.get(job_id) {
                if matches!(job.status, JobStatus::Ready) {
                    return Some(job_id.clone());
                }
            }
        }
        None
    }

    pub async fn is_any_job_processing(&self) -> bool {
        let jobs = self.jobs.lock().await;
        jobs.values().any(|job| matches!(job.status, JobStatus::Processing))
    }

    pub async fn update_job_status(&self, id: &str, status: JobStatus) {
        let mut jobs = self.jobs.lock().await;
        if let Some(job) = jobs.get_mut(id) {
            job.status = status;
        }
    }

    pub async fn update_job_progress(&self, id: &str, progress: f32) {
        let mut jobs = self.jobs.lock().await;
        if let Some(job) = jobs.get_mut(id) {
            job.progress = progress;
        }
    }

    pub async fn update_job_status_message(&self, id: &str, message: String) {
        let mut jobs = self.jobs.lock().await;
        if let Some(job) = jobs.get_mut(id) {
            println!("Updating job {} status message from {:?} to {}", id, job.status_message, message);
            job.status_message = Some(message);
        } else {
            println!("Warning: Could not find job {} to update status message", id);
        }
    }

    pub async fn get_job(&self, id: &str) -> Option<ConversionJob> {
        let jobs = self.jobs.lock().await;
        jobs.get(id).cloned()
    }

    pub async fn get_all_jobs(&self) -> Vec<ConversionJob> {
        let queue = self.job_queue.lock().await;
        let jobs = self.jobs.lock().await;
        
        // Return jobs in the order they were added to the queue
        let mut result = Vec::new();
        for job_id in queue.iter() {
            if let Some(job) = jobs.get(job_id) {
                result.push(job.clone());
            }
        }
        result
    }

    pub async fn clear_completed_jobs(&self) {
        let completed_job_ids: Vec<String>;
        
        // First collect the IDs of completed/failed jobs
        {
            let jobs = self.jobs.lock().await;
            completed_job_ids = jobs.iter()
                .filter_map(|(id, job)| {
                    if matches!(job.status, JobStatus::Completed | JobStatus::Failed) {
                        Some(id.clone())
                    } else {
                        None
                    }
                })
                .collect();
        }
        
        // Remove from jobs map
        {
            let mut jobs = self.jobs.lock().await;
            for job_id in &completed_job_ids {
                jobs.remove(job_id);
            }
        }
        
        // Remove from queue
        {
            let mut queue = self.job_queue.lock().await;
            queue.retain(|job_id| !completed_job_ids.contains(job_id));
        }
    }

    pub async fn add_to_history(&self, app_handle: &AppHandle, history_item: ConversionHistory) -> Result<(), String> {
        {
            let mut history = self.history.lock().await;
            history.push(history_item);
            
            // Keep only last 100 items
            if history.len() > 100 {
                let drain_count = history.len() - 100;
                history.drain(0..drain_count);
            }
        }
        
        // Save to disk
        self.save_history(app_handle).await
    }

    pub async fn get_history(&self) -> Vec<ConversionHistory> {
        let history = self.history.lock().await;
        history.clone()
    }

    pub async fn clear_history(&self, app_handle: &AppHandle) -> Result<(), String> {
        {
            let mut history = self.history.lock().await;
            history.clear();
        }
        
        // Save empty history to disk
        self.save_history(app_handle).await
    }
}