import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Download, Pencil } from 'lucide-react';
import { useConverter } from '../hooks/useConverter';
import { open } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { logger } from '../utils/simpleLogger';
// import { debounce } from '../utils/debounce';
import { FilePathPreview } from './FilePathPreview';

interface DropZoneProps {
  onNavigateToSettings?: () => void;
}

export function DropZone({ onNavigateToSettings }: DropZoneProps) {
  const addJob = useConverter((state) => state.addJob);
  const addBatchJobs = useConverter((state) => state.addBatchJobs);
  const outputDirectory = useConverter((state) => state.outputDirectory);
  const useSubdirectory = useConverter((state) => state.useSubdirectory);
  const subdirectoryName = useConverter((state) => state.subdirectoryName);
  const fileNamePattern = useConverter((state) => state.fileNamePattern);
  const selectedPreset = useConverter((state) => state.selectedPreset);
  const presets = useConverter((state) => state.presets);
  const [isDragHover, setIsDragHover] = useState(false);

  // Handler for adding files
  const handleAddFiles = useCallback(async (files: string[]) => {
    // logger.info('handleAddFiles called', { files, count: files.length });
    
    // Deduplicate files
    const uniqueFiles = Array.from(new Set(files));
    
    // Filter WebM files
    const webmFiles = uniqueFiles.filter(file => {
      const isWebm = file.toLowerCase().endsWith('.webm');
      return isWebm;
    });
    const nonWebmFiles = uniqueFiles.filter(file => !file.toLowerCase().endsWith('.webm'));
    
    // Log skipped files
    if (nonWebmFiles.length > 0) {
      logger.info('Skipped non-WebM files', { files: nonWebmFiles });
    }
    
    if (webmFiles.length > 0) {
      // logger.info('Adding WebM files from drop', { 
      //   files: webmFiles, 
      //   count: webmFiles.length,
      //   selectedPreset: selectedPreset ? selectedPreset.name : 'none',
      //   presetsCount: presets.length
      // });
      
      try {
        await addBatchJobs(webmFiles);
        // logger.info('addBatchJobs completed successfully');
      } catch (error) {
        logger.error('Error in addBatchJobs', error);
        alert('Failed to add files for conversion. Please check if a preset is selected.');
      }
    } else {
      logger.info('No WebM files found in dropped files', { droppedCount: uniqueFiles.length });
    }
  }, [addBatchJobs, selectedPreset, presets]);

  // Debounced handler for adding files (currently not used, testing direct calls)
  // const debouncedAddFiles = useMemo(
  //   () => debounce(handleAddFiles, 100),
  //   [handleAddFiles]
  // );

  // Log component mount
  useEffect(() => {
    // logger.info('DropZone component mounted');
  }, []);

  // Handle file drop events from Tauri
  useEffect(() => {
    // logger.info('Setting up file drop listeners', {
    //   presetsLoaded: presets.length > 0,
    //   selectedPreset: selectedPreset?.name || 'none'
    // });
    
    // Listen for files being dropped
    const unlistenDrop = listen<string[]>('files-dropped', async (event) => {
      // logger.info('Files dropped event received', { 
      //   files: event.payload,
      //   filesCount: event.payload.length,
      //   firstFile: event.payload[0],
      //   currentPreset: selectedPreset?.name || 'none',
      //   presetsAvailable: presets.length
      // });
      setIsDragHover(false);
      
      // Call handleAddFiles
      handleAddFiles(event.payload).catch(error => {
        logger.error('Error in handleAddFiles', error);
      });
    });

    // Listen for drag enter/hover events
    const unlistenDragEnter = listen('files-drag-enter', () => {
      // logger.info('Files drag enter');
      setIsDragHover(true);
    });

    // Listen for drag leave events
    const unlistenDragLeave = listen('files-drag-leave', () => {
      // logger.info('Files drag leave');
      setIsDragHover(false);
    });

    // Listen for Tauri file drop events
    const unlistenWindow = listen<string[]>('tauri://file-drop', (event) => {
      // logger.info('Tauri file-drop event received', { files: event.payload });
      if (event.payload && Array.isArray(event.payload)) {
        handleAddFiles(event.payload).catch(error => {
          logger.error('Error in handleAddFiles from file-drop', error);
        });
      }
    });

    return () => {
      // logger.info('Cleaning up DropZone listeners');
      unlistenDrop.then(fn => fn());
      unlistenDragEnter.then(fn => fn());
      unlistenDragLeave.then(fn => fn());
      unlistenWindow.then(fn => fn());
    };
  }, [handleAddFiles, presets, selectedPreset]);

  const onDrop = useCallback(async () => {
    // In Tauri, we use the file dialog instead
    const selected = await open({
      multiple: true,
      filters: [{
        name: 'WebM Video',
        extensions: ['webm']
      }]
    });

    if (selected) {
      if (Array.isArray(selected)) {
        await addBatchJobs(selected);
      } else {
        await addJob(selected);
      }
    }
  }, [addJob, addBatchJobs]);

  const handleClick = async () => {
    try {
      // logger.info('Opening file dialog...', {
      //   selectedPreset,
      //   presetsCount: presets.length
      // });
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'WebM Video',
          extensions: ['webm']
        }]
      });

      // logger.info('File dialog result', { selected });

      if (selected) {
        if (Array.isArray(selected)) {
          // logger.info('Adding files from dialog', { files: selected, count: selected.length });
          await addBatchJobs(selected);
        } else {
          // logger.info('Adding single file from dialog', { filePath: selected });
          await addJob(selected);
        }
      }
    } catch (error) {
      logger.error('Error in file dialog', error);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/webm': ['.webm'],
    },
    multiple: true,
    noClick: true,
    noKeyboard: true,
  });

  // Centralized hover state styling
  const isHovering = isDragActive || isDragHover;
  
  return (
    <>
      <div
        {...getRootProps()}
        onClick={handleClick}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200
          ${
            isHovering
              ? 'border-primary-400 bg-primary-50/50 dark:bg-primary-900/10'
              : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-900/10'
          }
        `}
      >
        <input {...getInputProps()} style={{ display: 'none' }} />
        <Download className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        {isHovering ? (
          <>
            <p className="text-lg font-medium text-primary-600 dark:text-primary-400">
              Drop the WebM files here...
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 invisible">
              or click to select files
            </p>
          </>
        ) : (
          <>
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
              Drag & drop .webm file here
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              or click to select files
            </p>
          </>
        )}
      </div>
      
      {/* File path transformation preview */}
      <div className="mt-4 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <FilePathPreview
            inputFileName="source.webm"
            outputDirectory={outputDirectory}
            useSubdirectory={useSubdirectory}
            subdirectoryName={subdirectoryName}
            fileNamePattern={fileNamePattern}
            size="small"
          />
          
          <button
            onClick={onNavigateToSettings}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Edit output settings"
          >
            <Pencil className="w-4 h-4 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors" />
          </button>
        </div>
      </div>
    </>
  );
}