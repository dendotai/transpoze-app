use std::sync::Mutex;
use std::io::Write;
use std::fs::{File, OpenOptions};
use chrono::Local;

pub struct Logger {
    file: Option<Mutex<File>>,
    enabled: bool,
}

impl Logger {
    pub fn new(enabled: bool) -> Self {
        let file = if enabled {
            // Create or append to debug log
            OpenOptions::new()
                .create(true)
                .append(true)
                .open("ffmpeg_debug.log")
                .ok()
                .map(Mutex::new)
        } else {
            None
        };

        Logger { file, enabled }
    }

    pub fn log(&self, message: &str) {
        if !self.enabled {
            return;
        }

        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
        let log_line = format!("[{}] {}\n", timestamp, message);

        // Print to console
        print!("{}", log_line);

        // Write to file if available
        if let Some(file_mutex) = &self.file {
            if let Ok(mut file) = file_mutex.lock() {
                let _ = file.write_all(log_line.as_bytes());
                let _ = file.flush();
            }
        }
    }

    pub fn log_ffmpeg_output(&self, line: &str) {
        self.log(&format!("FFmpeg: {}", line));
    }

    pub fn log_progress(&self, job_id: &str, progress: f32, details: &str) {
        self.log(&format!("Progress [{}]: {:.1}% - {}", job_id, progress, details));
    }

    #[allow(dead_code)]
    pub fn log_error(&self, context: &str, error: &str) {
        self.log(&format!("ERROR [{}]: {}", context, error));
    }
}

// Global logger instance
lazy_static::lazy_static! {
    pub static ref LOGGER: Logger = Logger::new(cfg!(debug_assertions));
}

#[macro_export]
macro_rules! log_debug {
    ($($arg:tt)*) => {
        $crate::logger::LOGGER.log(&format!($($arg)*))
    };
}

#[macro_export]
macro_rules! log_ffmpeg {
    ($line:expr) => {
        $crate::logger::LOGGER.log_ffmpeg_output($line)
    };
}

#[macro_export]
macro_rules! log_progress {
    ($job_id:expr, $progress:expr, $details:expr) => {
        $crate::logger::LOGGER.log_progress($job_id, $progress, $details)
    };
}

#[macro_export]
macro_rules! log_error {
    ($context:expr, $error:expr) => {
        $crate::logger::LOGGER.log_error($context, $error)
    };
}