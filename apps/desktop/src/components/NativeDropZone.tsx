import { useState, DragEvent } from 'react';
import { Upload } from 'lucide-react';
import { useConverter } from '../hooks/useConverter';
import { open } from '@tauri-apps/plugin-dialog';
import { logger } from '../utils/simpleLogger';

export function NativeDropZone() {
  const [isDragging, setIsDragging] = useState(false);
  const addJob = useConverter((state) => state.addJob);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    logger.info('Drag over');
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    logger.info('Drag leave');
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    logger.info('Native drop event', { 
      dataTransfer: e.dataTransfer,
      files: e.dataTransfer.files.length 
    });

    // Try to get file paths from the drop event
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      logger.info('Dropped file', { 
        name: file.name, 
        type: file.type,
        size: file.size,
        path: (file as any).path 
      });
      
      // In Electron/Tauri, files might have a path property
      if ((file as any).path && file.name.toLowerCase().endsWith('.webm')) {
        await addJob((file as any).path);
      }
    }

    // Also try to get the file paths from drag data
    const items = Array.from(e.dataTransfer.items);
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          logger.info('Item as file', { name: file.name });
        }
      }
    }
  };

  const handleClick = async () => {
    try {
      logger.info('Opening file dialog...');
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'WebM Video',
          extensions: ['webm']
        }]
      });

      logger.info('File dialog result', { selected });

      if (selected) {
        if (Array.isArray(selected)) {
          for (const filePath of selected) {
            logger.info('Adding file from dialog', { filePath });
            await addJob(filePath);
          }
        } else {
          logger.info('Adding single file from dialog', { filePath: selected });
          await addJob(selected);
        }
      }
    } catch (error) {
      logger.error('Error in file dialog', error);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`
        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
        transition-all duration-200
        ${
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
        }
      `}
    >
      <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
      {isDragging ? (
        <p className="text-lg font-medium text-blue-600 dark:text-blue-400">
          Drop the WebM files here...
        </p>
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
  );
}