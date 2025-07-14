
#[derive(Debug, Clone, PartialEq)]
pub struct FFmpegProgress {
    pub time_seconds: f64,
    pub bitrate: Option<String>,
    pub speed: Option<f32>,
    pub fps: Option<f32>,
    pub frame: Option<u64>,
    pub size: Option<String>,
}

/// Parse FFmpeg progress line that contains time= and other stats
/// Example: "frame=  123 fps= 25 q=28.0 size=    1024kB time=00:00:05.12 bitrate= 100.0kbits/s speed=1.25x"
pub fn parse_progress_line(line: &str) -> Option<FFmpegProgress> {
    if !line.contains("time=") {
        return None;
    }

    let mut progress = FFmpegProgress {
        time_seconds: 0.0,
        bitrate: None,
        speed: None,
        fps: None,
        frame: None,
        size: None,
    };

    // Parse time - handle both space-terminated and end-of-line cases
    if let Some(time_pos) = line.find("time=") {
        let after_time = &line[time_pos + 5..];
        let time_str: String = after_time.chars()
            .take_while(|c| !c.is_whitespace())
            .collect();
        if let Ok(seconds) = parse_time_to_seconds(&time_str) {
            progress.time_seconds = seconds;
        } else {
            return None;
        }
    } else {
        return None;
    }

    // Parse optional fields - using regex-like approach for FFmpeg's variable spacing
    if let Some(frame_pos) = line.find("frame=") {
        let after_frame = &line[frame_pos + 6..];
        let frame_str: String = after_frame.chars()
            .skip_while(|c| c.is_whitespace())
            .take_while(|c| !c.is_whitespace())
            .collect();
        progress.frame = frame_str.parse().ok();
    }

    if let Some(fps_pos) = line.find("fps=") {
        let after_fps = &line[fps_pos + 4..];
        let fps_str: String = after_fps.chars()
            .skip_while(|c| c.is_whitespace())
            .take_while(|c| !c.is_whitespace())
            .collect();
        progress.fps = fps_str.parse().ok();
    }

    if let Some(size_pos) = line.find("size=") {
        let after_size = &line[size_pos + 5..];
        let size_str: String = after_size.chars()
            .skip_while(|c| c.is_whitespace())
            .take_while(|c| !c.is_whitespace())
            .collect();
        if !size_str.is_empty() {
            progress.size = Some(size_str);
        }
    }

    if let Some(bitrate_pos) = line.find("bitrate=") {
        let after_bitrate = &line[bitrate_pos + 8..];
        let bitrate_str: String = after_bitrate.chars()
            .skip_while(|c| c.is_whitespace())
            .take_while(|c| !c.is_whitespace())
            .collect();
        if !bitrate_str.is_empty() {
            progress.bitrate = Some(bitrate_str);
        }
    }

    if let Some(speed_pos) = line.find("speed=") {
        let after_speed = &line[speed_pos + 6..];
        let speed_str: String = after_speed.chars()
            .skip_while(|c| c.is_whitespace())
            .take_while(|c| *c != 'x' && !c.is_whitespace())
            .collect();
        progress.speed = speed_str.parse().ok();
    }

    Some(progress)
}

/// Extract value between start pattern and end pattern
#[allow(dead_code)]
fn extract_value<'a>(line: &'a str, start_pattern: &str, end_pattern: &str) -> Option<&'a str> {
    let start = line.find(start_pattern)?;
    let value_start = start + start_pattern.len();
    let remaining = &line[value_start..];
    
    if end_pattern.is_empty() {
        Some(remaining.trim())
    } else {
        let end = remaining.find(end_pattern)?;
        Some(&remaining[..end])
    }
}

/// Parse time string (HH:MM:SS.MS) to seconds
pub fn parse_time_to_seconds(time_str: &str) -> Result<f64, String> {
    let parts: Vec<&str> = time_str.split(':').collect();
    if parts.len() != 3 {
        return Err(format!("Invalid time format: {}", time_str));
    }

    let hours = parts[0].parse::<f64>().map_err(|_| "Invalid hours")?;
    let minutes = parts[1].parse::<f64>().map_err(|_| "Invalid minutes")?;
    let seconds = parts[2].parse::<f64>().map_err(|_| "Invalid seconds")?;

    Ok(hours * 3600.0 + minutes * 60.0 + seconds)
}

/// Parse duration from FFmpeg info output
/// Example: "  Duration: 00:05:23.45, start: 0.000000, bitrate: 1234 kb/s"
pub fn parse_duration_from_info(line: &str) -> Option<f64> {
    if !line.contains("Duration:") {
        return None;
    }

    let duration_str = line.split("Duration:").nth(1)?;
    let time_str = duration_str.split(',').next()?.trim();
    parse_time_to_seconds(time_str).ok()
}

/// Parse progress from FFmpeg -progress output
/// Example: "out_time=00:00:05.120000"
pub fn parse_progress_time(line: &str) -> Option<f64> {
    if !line.starts_with("out_time=") {
        return None;
    }
    
    let time_str = line.trim_start_matches("out_time=");
    parse_time_to_seconds(time_str).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_time_to_seconds() {
        assert_eq!(parse_time_to_seconds("00:00:00.00").unwrap(), 0.0);
        assert_eq!(parse_time_to_seconds("00:00:01.00").unwrap(), 1.0);
        assert_eq!(parse_time_to_seconds("00:01:00.00").unwrap(), 60.0);
        assert_eq!(parse_time_to_seconds("01:00:00.00").unwrap(), 3600.0);
        assert_eq!(parse_time_to_seconds("01:23:45.67").unwrap(), 5025.67);
        assert_eq!(parse_time_to_seconds("00:05:23.45").unwrap(), 323.45);
    }

    #[test]
    fn test_parse_duration_from_info() {
        let line = "  Duration: 00:05:23.45, start: 0.000000, bitrate: 1234 kb/s";
        assert_eq!(parse_duration_from_info(line), Some(323.45));

        let line2 = "  Duration: 01:23:45.67, start: 0.000000, bitrate: 1234 kb/s";
        assert_eq!(parse_duration_from_info(line2), Some(5025.67));

        let line3 = "Some other line without duration";
        assert_eq!(parse_duration_from_info(line3), None);
    }

    #[test]
    fn test_parse_progress_line() {
        // Test complete progress line
        let line = "frame=  123 fps= 25 q=28.0 size=    1024kB time=00:00:05.12 bitrate= 100.0kbits/s speed=1.25x";
        let progress = parse_progress_line(line).unwrap();
        assert_eq!(progress.time_seconds, 5.12);
        assert_eq!(progress.frame, Some(123));
        assert_eq!(progress.fps, Some(25.0));
        assert_eq!(progress.size, Some("1024kB".to_string()));
        assert_eq!(progress.bitrate, Some("100.0kbits/s".to_string()));
        assert_eq!(progress.speed, Some(1.25));

        // Test minimal progress line
        let line2 = "time=00:00:10.00";
        let progress2 = parse_progress_line(line2).unwrap();
        assert_eq!(progress2.time_seconds, 10.0);
        assert_eq!(progress2.frame, None);

        // Test line without time
        let line3 = "frame=  123 fps= 25";
        assert_eq!(parse_progress_line(line3), None);

        // Test real FFmpeg output variations
        let line4 = "frame=  456 fps=0.0 q=28.0 size=       0kB time=00:00:00.00 bitrate=N/A speed=   0x";
        let progress4 = parse_progress_line(line4).unwrap();
        assert_eq!(progress4.time_seconds, 0.0);
        assert_eq!(progress4.frame, Some(456));
        assert_eq!(progress4.fps, Some(0.0));

        // Test with extra spaces (common in FFmpeg output)
        let line5 = "frame=   10 fps= 0 q=0.0 size=       0kB time=00:00:00.41 bitrate=   0.0kbits/s speed=0.835x";
        let progress5 = parse_progress_line(line5).unwrap();
        assert_eq!(progress5.time_seconds, 0.41);
        assert_eq!(progress5.frame, Some(10));
        assert_eq!(progress5.speed, Some(0.835));
    }

    #[test]
    fn test_extract_value() {
        assert_eq!(extract_value("time=00:00:05.12 bitrate=", "time=", " "), Some("00:00:05.12"));
        assert_eq!(extract_value("speed=1.25x", "speed=", "x"), Some("1.25"));
        assert_eq!(extract_value("fps= 25 ", "fps=", " "), Some(""));
        assert_eq!(extract_value("fps= 25 q=28.0", "fps=", " "), Some(""));
        assert_eq!(extract_value("frame=  123 fps=", "frame=", " "), Some(""));
    }

    #[test]
    fn test_parse_progress_time() {
        assert_eq!(parse_progress_time("out_time=00:00:05.120000"), Some(5.12));
        assert_eq!(parse_progress_time("out_time=00:01:30.500000"), Some(90.5));
        assert_eq!(parse_progress_time("out_time=01:23:45.670000"), Some(5025.67));
        assert_eq!(parse_progress_time("frame=123"), None);
        assert_eq!(parse_progress_time("speed=1.25x"), None);
    }
}