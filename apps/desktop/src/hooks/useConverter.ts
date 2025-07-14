import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { logger } from '../utils/simpleLogger';

export interface VideoPreset {
  name: string;
  description: string;
  videoCodec: string;
  audioCodec: string;
  bitrate?: string;
  crf?: number;
  scale?: string;
}

export interface ConversionJob {
  id: string;
  inputPath: string;
  outputPath: string;
  preset: VideoPreset;
  status: 'queued' | 'ready' | 'processing' | 'completed' | 'failed';
  progress: number;
  duration?: number;
  error?: string;
  statusMessage?: string;
  thumbnailPath?: string;
}

export interface ConversionHistory {
  id: string;
  inputPath: string;
  outputPath: string;
  presetName: string;
  completedAt: string;
  fileSizeBefore: number;
  fileSizeAfter: number;
  duration: number;
}

function validatePattern(pattern: string | undefined): boolean {
  if (!pattern || typeof pattern !== 'string') return true;
  // Check for balanced braces
  let braceCount = 0;
  for (const char of pattern) {
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
    if (braceCount < 0) return false;
  }
  if (braceCount !== 0) return false;
  
  // Check for valid placeholders ({name} and {number} are supported)
  const placeholderRegex = /\{([^}]+)\}/g;
  const matches = pattern.match(placeholderRegex);
  if (matches) {
    for (const match of matches) {
      if (match !== '{name}' && match !== '{number}') return false;
    }
  }
  
  // Check for invalid characters in filename
  const invalidChars = /[<>:"|?*\\/]/;
  const withoutPlaceholders = pattern.replace(placeholderRegex, '');
  if (invalidChars.test(withoutPlaceholders)) return false;
  
  return true;
}

export function getOutputPath(
  inputPath: string,
  outputDirectory: string,
  useSubdirectory: boolean,
  subdirectoryName: string,
  fileNamePattern: string,
  existingPaths?: string[],
  forceNumber?: number,
  totalFiles?: number
): string {
  // logger.info('getOutputPath called', {
  //   inputPath,
  //   outputDirectory,
  //   useSubdirectory,
  //   subdirectoryName,
  //   fileNamePattern
  // });
  
  const fileName = inputPath.split('/').pop()?.replace('.webm', '') || 'video';
  
  // Use safe default pattern if current pattern is invalid
  const safePattern = validatePattern(fileNamePattern) ? fileNamePattern : '{name}_converted';
  
  // Ensure directory doesn't end with slashes to avoid double slashes
  const normalizeDir = (dir: string) => dir.replace(/\/+$/, '');
  
  // Determine base directory
  let baseDir: string;
  if (outputDirectory) {
    const normalizedOutputDir = normalizeDir(outputDirectory);
    baseDir = useSubdirectory ? `${normalizedOutputDir}/${subdirectoryName}` : normalizedOutputDir;
  } else {
    // Same directory as input
    const inputDir = inputPath.substring(0, inputPath.lastIndexOf('/'));
    const normalizedInputDir = normalizeDir(inputDir);
    baseDir = useSubdirectory ? `${normalizedInputDir}/${subdirectoryName}` : normalizedInputDir;
  }
  
  // Calculate padding width based on total files or existing paths
  const maxNumber = totalFiles ? totalFiles - 1 : (existingPaths ? existingPaths.length + 10 : 0);
  const padWidth = Math.max(1, Math.ceil(Math.log10(maxNumber + 1)));
  
  // Function to generate output path with a given number
  const generatePath = (num: number, forceNumbering: boolean = false): string => {
    let outputName = safePattern;
    
    // Handle {number} placeholder
    if (outputName.includes('{number}')) {
      // Always pad numbers when using {number} placeholder
      const paddedNum = num.toString().padStart(padWidth, '0');
      outputName = outputName.replace('{name}', fileName).replace('{number}', paddedNum);
    } else if (forceNumbering || (num > 0 && existingPaths && existingPaths.length > 0)) {
      // Auto-numbering when no {number} placeholder and multiple files or overwriting
      const paddedNum = num.toString().padStart(padWidth, '0');
      outputName = outputName.replace('{name}', fileName) + `-${paddedNum}`;
    } else {
      outputName = outputName.replace('{name}', fileName);
    }
    
    return `${baseDir}/${outputName}.mp4`;
  };
  
  // If forceNumber is provided, use it directly
  if (forceNumber !== undefined) {
    return generatePath(forceNumber, true);
  }
  
  // Only force numbering for batch if pattern has {number} placeholder
  if (totalFiles && totalFiles > 1 && safePattern.includes('{number}')) {
    return generatePath(0, true);
  }
  
  // If no existing paths provided, return without numbering
  if (!existingPaths || existingPaths.length === 0) {
    return generatePath(0);
  }
  
  // Check if the base path (without number) already exists
  let number = 0;
  let outputPath = generatePath(number);
  
  while (existingPaths.includes(outputPath)) {
    number++;
    outputPath = generatePath(number, true);
  }
  
  // logger.info('getOutputPath result', { outputPath });
  return outputPath;
}

interface AppSettings {
  outputDirectory: string;
  useSubdirectory: boolean;
  subdirectoryName: string;
  fileNamePattern: string;
  zoomedThumbnails: boolean;
}

interface ConverterState {
  presets: VideoPreset[];
  jobs: ConversionJob[];
  history: ConversionHistory[];
  outputDirectory: string;
  useSubdirectory: boolean;
  subdirectoryName: string;
  fileNamePattern: string;
  selectedPreset: VideoPreset | null;
  presetsLoaded: boolean;
  zoomedThumbnails: boolean;
  
  // Actions
  loadPresets: () => Promise<void>;
  addJob: (inputPath: string) => Promise<void>;
  addBatchJobs: (inputPaths: string[]) => Promise<void>;
  loadJobs: () => Promise<void>;
  loadHistory: () => Promise<void>;
  loadPersistedData: () => Promise<void>;
  clearCompletedJobs: () => Promise<void>;
  clearHistory: () => Promise<void>;
  setOutputDirectory: (dir: string) => void;
  setUseSubdirectory: (use: boolean) => void;
  setSubdirectoryName: (name: string) => void;
  setFileNamePattern: (pattern: string) => void;
  setSelectedPreset: (preset: VideoPreset) => void;
  setZoomedThumbnails: (zoomed: boolean) => void;
}

// Helper function to save settings to backend
const saveSettings = async (settings: AppSettings) => {
  try {
    await invoke('update_app_settings', { settings });
  } catch (error) {
    logger.error('Failed to save settings:', error);
  }
};

export const useConverter = create<ConverterState>((set, get) => ({
  presets: [],
  jobs: [],
  history: [],
  outputDirectory: '',
  useSubdirectory: true,
  subdirectoryName: 'converted',
  fileNamePattern: '{name}_converted',
  selectedPreset: null,
  presetsLoaded: false,
  zoomedThumbnails: false,

  loadPresets: async () => {
    try {
      logger.info('Loading video presets...');
      const presets = await invoke<VideoPreset[]>('get_video_presets');
      console.log('Loaded presets:', presets);
      // logger.info('Loaded presets', presets);
      
      // Ensure we have a valid default preset
      const defaultPreset = presets[1] || presets[0]; // Default to "Balanced" preset or first available
      if (!defaultPreset) {
        logger.error('No presets available from backend');
        return;
      }
      
      set({ 
        presets, 
        selectedPreset: defaultPreset,
        presetsLoaded: true
      });
      logger.info('Set default preset:', defaultPreset);
    } catch (error) {
      logger.error('Failed to load presets:', error);
      alert('Failed to load video presets. Please restart the application.');
    }
  },

  addJob: async (inputPath: string) => {
    let state = get();
    
    // If presets haven't loaded yet, wait a moment and try loading them
    if (!state.presetsLoaded) {
      logger.warn('Presets not loaded yet, attempting to load...');
      await get().loadPresets();
      state = get(); // Re-get state after loading
      
      // If still not loaded, bail out
      if (!state.presetsLoaded) {
        logger.error('Failed to load presets, cannot add job');
        alert('Video presets are not loaded. Please restart the application.');
        return;
      }
    }
    
    if (!state.selectedPreset) {
      logger.error('No preset selected', { 
        presets: state.presets, 
        selectedPreset: state.selectedPreset 
      });
      // Try to select the default preset if none is selected
      if (state.presets.length > 0) {
        logger.warn('Auto-selecting Balanced preset');
        const presetToSelect = state.presets[1] || state.presets[0];
        if (presetToSelect) {
          set({ selectedPreset: presetToSelect });
          // Re-get state after setting preset
          state = get();
          if (!state.selectedPreset) {
            logger.error('Failed to auto-select preset');
            return;
          }
          logger.info('Auto-selected preset', { preset: state.selectedPreset.name });
        }
      } else {
        logger.error('No presets available');
        return;
      }
    }

    // Check if a job for this file already exists and is not completed
    const existingJob = state.jobs.find(job => 
      job.inputPath === inputPath && 
      (job.status === 'queued' || job.status === 'processing')
    );
    
    if (existingJob) {
      logger.info('Job already exists for this file', { inputPath, existingJobId: existingJob.id });
      return;
    }

    try {
      // Collect all existing output paths from jobs and history
      const existingOutputPaths = [
        ...state.jobs.map(job => job.outputPath),
        ...state.history.map(h => h.outputPath)
      ];
      
      // Also check the file system for existing files
      const checkPath = async (path: string): Promise<boolean> => {
        try {
          const exists = await invoke<boolean>('check_file_exists', { path });
          return exists;
        } catch (error) {
          console.error('Error checking file existence:', error);
          return false;
        }
      };
      
      // Generate output path with auto-numbering if needed
      let outputPath = getOutputPath(
        inputPath,
        state.outputDirectory || '',
        state.useSubdirectory,
        state.subdirectoryName,
        state.fileNamePattern,
        existingOutputPaths
      );
      
      // Check if the file already exists on disk
      let fileExists = await checkPath(outputPath);
      let number = 1;
      
      while (fileExists) {
        outputPath = getOutputPath(
          inputPath,
          state.outputDirectory || '',
          state.useSubdirectory,
          state.subdirectoryName,
          state.fileNamePattern,
          existingOutputPaths,
          number
        );
        fileExists = await checkPath(outputPath);
        number++;
      }

      // logger.info('Adding job:', { inputPath, outputPath, preset: state.selectedPreset });

      const jobId = await invoke<string>('add_conversion_job', {
        inputPath,
        outputPath,
        preset: state.selectedPreset,
      });
      logger.info('Job added successfully', { jobId });
      await get().loadJobs();
    } catch (error) {
      logger.error('Failed to add conversion job:', error);
      alert('Failed to add conversion job: ' + error);
    }
  },

  loadJobs: async () => {
    try {
      logger.info('Loading conversion jobs...');
      const jobs = await invoke<ConversionJob[]>('get_conversion_jobs');
      logger.info('Loaded jobs', { count: jobs.length, jobs });
      set({ jobs });
    } catch (error) {
      logger.error('Failed to load jobs:', error);
    }
  },

  loadHistory: async () => {
    try {
      const history = await invoke<ConversionHistory[]>('get_conversion_history');
      set({ history });
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  },

  loadPersistedData: async () => {
    try {
      // Load persisted data from backend
      await invoke('load_persisted_data');
      
      // Load settings into state
      const settings = await invoke<AppSettings>('get_app_settings');
      set({
        outputDirectory: settings.outputDirectory,
        useSubdirectory: settings.useSubdirectory,
        subdirectoryName: settings.subdirectoryName,
        fileNamePattern: settings.fileNamePattern,
        zoomedThumbnails: settings.zoomedThumbnails,
      });
      
      logger.info('Loaded persisted settings:', settings);
    } catch (error) {
      logger.error('Failed to load persisted data:', error);
    }
  },

  addBatchJobs: async (inputPaths: string[]) => {
    let state = get();
    
    // If presets haven't loaded yet, wait a moment and try loading them
    if (!state.presetsLoaded) {
      logger.warn('Presets not loaded yet, attempting to load...');
      await get().loadPresets();
      state = get(); // Re-get state after loading
      
      // If still not loaded, bail out
      if (!state.presetsLoaded) {
        logger.error('Failed to load presets, cannot add jobs');
        alert('Video presets are still loading. Please wait a moment and try again.');
        return;
      }
    }
    
    if (!state.selectedPreset) {
      logger.error('No preset selected for batch', { 
        presets: state.presets, 
        selectedPreset: state.selectedPreset,
        inputPaths 
      });
      // Try to select the default preset if none is selected
      if (state.presets.length > 0) {
        logger.warn('Auto-selecting Balanced preset for batch');
        const presetToSelect = state.presets[1] || state.presets[0];
        if (presetToSelect) {
          set({ selectedPreset: presetToSelect });
          // Re-get state after setting preset
          state = get();
          if (!state.selectedPreset) {
            logger.error('Failed to auto-select preset for batch');
            return;
          }
          logger.info('Auto-selected preset for batch', { preset: state.selectedPreset.name });
        }
      } else {
        logger.error('No presets available for batch');
        return;
      }
    }

    // Filter out files that already have active jobs
    const filesToAdd = inputPaths.filter(inputPath => {
      const existingJob = state.jobs.find(job => 
        job.inputPath === inputPath && 
        (job.status === 'queued' || job.status === 'processing')
      );
      if (existingJob) {
        logger.info('Job already exists for this file', { inputPath, existingJobId: existingJob.id });
        return false;
      }
      return true;
    });

    if (filesToAdd.length === 0) {
      logger.info('No new files to add');
      return;
    }

    try {
      logger.info('Starting batch job processing', { 
        filesToAdd, 
        currentPreset: state.selectedPreset?.name,
        totalFiles: filesToAdd.length
      });
      
      // Collect all existing output paths from jobs and history
      const existingOutputPaths = [
        ...state.jobs.map(job => job.outputPath),
        ...state.history.map(h => h.outputPath)
      ];
      
      // Check file system for existing files
      const checkPath = async (path: string): Promise<boolean> => {
        try {
          const exists = await invoke<boolean>('check_file_exists', { path });
          return exists;
        } catch (error) {
          console.error('Error checking file existence:', error);
          return false;
        }
      };

      // Process each file
      const totalFiles = filesToAdd.length;
      
      for (let i = 0; i < filesToAdd.length; i++) {
        const inputPath = filesToAdd[i]!;
        logger.info('Processing file', { index: i, inputPath });
        
        // Generate output path with batch context
        // Only pass forceNumber if pattern explicitly uses {number}
        const forceNumber = state.fileNamePattern.includes('{number}') ? i : undefined;
        let outputPath = getOutputPath(
          inputPath,
          state.outputDirectory || '',
          state.useSubdirectory,
          state.subdirectoryName,
          state.fileNamePattern,
          existingOutputPaths,
          forceNumber,
          totalFiles
        );
        
        logger.info('Generated output path', { outputPath });
        
        // Check if file exists on disk and adjust if needed
        let fileExists = false;
        try {
          fileExists = await checkPath(outputPath);
          logger.info('File exists check', { outputPath, exists: fileExists });
        } catch (error) {
          logger.error('Error checking file existence', { outputPath, error });
          // Continue anyway, assume file doesn't exist
          fileExists = false;
        }
        let attemptNumber = i;
        
        while (fileExists) {
          attemptNumber++;
          outputPath = getOutputPath(
            inputPath,
            state.outputDirectory || '',
            state.useSubdirectory,
            state.subdirectoryName,
            state.fileNamePattern,
            existingOutputPaths,
            attemptNumber,
            totalFiles
          );
          logger.info('Trying alternate path', { attemptNumber, outputPath });
          try {
            fileExists = await checkPath(outputPath);
            logger.info('Alternate path exists check', { outputPath, exists: fileExists });
          } catch (error) {
            logger.error('Error checking alternate path', { outputPath, error });
            fileExists = false;
          }
        }
        
        // Add to existing paths to prevent duplicates within this batch
        existingOutputPaths.push(outputPath);

        // logger.info('Adding batch job:', { 
        //   inputPath, 
        //   outputPath, 
        //   preset: state.selectedPreset?.name || 'none', 
        //   index: i, 
        //   total: totalFiles 
        // });

        try {
          logger.info('Calling add_conversion_job', {
            inputPath,
            outputPath,
            preset: state.selectedPreset
          });
          
          const jobId = await invoke<string>('add_conversion_job', {
            inputPath,
            outputPath,
            preset: state.selectedPreset,
          });
          
          logger.info('Job added successfully', { jobId, inputPath });
        } catch (invokeError) {
          logger.error('Failed to invoke add_conversion_job', { 
            inputPath, 
            outputPath, 
            error: invokeError 
          });
          throw invokeError;
        }
      }
      
      logger.info('Batch jobs added successfully', { count: filesToAdd.length });
      await get().loadJobs();
      logger.info('Finished addBatchJobs, jobs should now be loaded');
    } catch (error) {
      logger.error('Failed to add batch conversion jobs:', error);
      alert('Failed to add batch conversion jobs: ' + error);
    }
  },

  clearCompletedJobs: async () => {
    try {
      await invoke('clear_completed_jobs');
      logger.info('Cleared completed/failed jobs');
    } catch (error) {
      logger.error('Failed to clear completed jobs:', error);
      alert('Failed to clear completed jobs: ' + error);
    }
  },

  clearHistory: async () => {
    try {
      await invoke('clear_conversion_history');
      await get().loadHistory();
      logger.info('Cleared conversion history');
    } catch (error) {
      logger.error('Failed to clear history:', error);
      alert('Failed to clear history: ' + error);
    }
  },

  setOutputDirectory: (dir) => {
    const normalizedDir = dir ? dir.replace(/\/+$/, '') : dir;
    set({ outputDirectory: normalizedDir });
    const state = get();
    saveSettings({
      outputDirectory: normalizedDir,
      useSubdirectory: state.useSubdirectory,
      subdirectoryName: state.subdirectoryName,
      fileNamePattern: state.fileNamePattern,
      zoomedThumbnails: state.zoomedThumbnails,
    });
  },
  
  setUseSubdirectory: (use) => {
    set({ useSubdirectory: use });
    const state = get();
    saveSettings({
      outputDirectory: state.outputDirectory,
      useSubdirectory: use,
      subdirectoryName: state.subdirectoryName,
      fileNamePattern: state.fileNamePattern,
      zoomedThumbnails: state.zoomedThumbnails,
    });
  },
  
  setSubdirectoryName: (name) => {
    set({ subdirectoryName: name });
    const state = get();
    saveSettings({
      outputDirectory: state.outputDirectory,
      useSubdirectory: state.useSubdirectory,
      subdirectoryName: name,
      fileNamePattern: state.fileNamePattern,
      zoomedThumbnails: state.zoomedThumbnails,
    });
  },
  
  setFileNamePattern: (pattern) => {
    set({ fileNamePattern: pattern });
    const state = get();
    saveSettings({
      outputDirectory: state.outputDirectory,
      useSubdirectory: state.useSubdirectory,
      subdirectoryName: state.subdirectoryName,
      fileNamePattern: pattern,
      zoomedThumbnails: state.zoomedThumbnails,
    });
  },
  
  setSelectedPreset: (preset) => set({ selectedPreset: preset }),
  
  setZoomedThumbnails: (zoomed) => {
    set({ zoomedThumbnails: zoomed });
    const state = get();
    saveSettings({
      outputDirectory: state.outputDirectory,
      useSubdirectory: state.useSubdirectory,
      subdirectoryName: state.subdirectoryName,
      fileNamePattern: state.fileNamePattern,
      zoomedThumbnails: zoomed,
    });
  },
}));

export function useConverterEvents() {
  const loadJobs = useConverter((state) => state.loadJobs);
  const loadHistory = useConverter((state) => state.loadHistory);

  useEffect(() => {
    const unlistenProgress = listen<[string, number]>('conversion-progress', (event) => {
      const [jobId, progress] = event.payload;
      logger.info('Conversion progress', { jobId, progress });
      useConverter.setState((state) => ({
        jobs: state.jobs.map((job) =>
          job.id === jobId 
            ? { ...job, progress, statusMessage: job.statusMessage || 'Converting video...' } 
            : job
        ),
      }));
    });

    const unlistenJobUpdate = listen<string>('job-updated', async (event) => {
      const jobId = event.payload;
      logger.info('JOB-UPDATED EVENT RECEIVED', { jobId });
      // Refresh jobs from backend
      try {
        const jobs = await invoke<ConversionJob[]>('get_conversion_jobs');
        const updatedJob = jobs.find(j => j.id === jobId);
        logger.info('Jobs fetched after update', { 
          jobId, 
          updatedJob,
          statusMessage: updatedJob?.statusMessage,
          status: updatedJob?.status
        });
        console.log('JOB-UPDATED: Frontend received update for job', jobId, 'with status message:', updatedJob?.statusMessage);
        useConverter.setState({ jobs });
      } catch (error) {
        logger.error('Failed to get jobs', error);
      }
    });

    const unlistenComplete = listen<string>('conversion-complete', (event) => {
      logger.info('Conversion complete', { jobId: event.payload });
      loadJobs();
      loadHistory();
    });

    const unlistenFailed = listen<string>('conversion-failed', (event) => {
      logger.error('Conversion failed', { jobId: event.payload });
      loadJobs();
    });

    const unlistenCleared = listen('jobs-cleared', () => {
      logger.info('Jobs cleared, reloading...');
      loadJobs();
    });

    return () => {
      unlistenProgress.then((fn) => fn());
      unlistenJobUpdate.then((fn) => fn());
      unlistenComplete.then((fn) => fn());
      unlistenFailed.then((fn) => fn());
      unlistenCleared.then((fn) => fn());
    };
  }, [loadJobs, loadHistory]);
}