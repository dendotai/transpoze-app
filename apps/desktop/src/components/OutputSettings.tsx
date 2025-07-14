import React, { useEffect, useState, useRef } from 'react';
import { useConverter } from '../hooks/useConverter';
import { Folder, RotateCcw } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { FilePathPreview } from './FilePathPreview';
import { FilePatternInput, FilePatternInputHandle } from './FilePatternInput';

interface OutputSettingsProps {
  highlighted?: boolean;
  onInteraction?: () => void;
}

export function OutputSettings({ highlighted = false, onInteraction }: OutputSettingsProps) {
  const [showHighlight, setShowHighlight] = useState(false);
  const filePatternInputRef = useRef<FilePatternInputHandle>(null);
  const lastCursorPositionRef = useRef<number>(0);
  const wasInputFocusedRef = useRef<boolean>(false);
  const isProcessingClickRef = useRef<boolean>(false);
  
  // Simple validation check for the error message
  const isPatternValid = (pattern: string | undefined): boolean => {
    if (!pattern || typeof pattern !== 'string') return true;
    const placeholderRegex = /\{([^}]+)\}/g;
    const matches = pattern.match(placeholderRegex);
    if (matches) {
      for (const match of matches) {
        if (match !== '{name}' && match !== '{number}') return false;
      }
    }
    return !pattern.includes('{') || pattern.split('{').length - 1 === pattern.split('}').length - 1;
  };
  
  const {
    outputDirectory,
    setOutputDirectory,
    useSubdirectory,
    setUseSubdirectory,
    subdirectoryName,
    setSubdirectoryName,
    fileNamePattern,
    setFileNamePattern,
  } = useConverter();
  
  useEffect(() => {
    if (highlighted) {
      setShowHighlight(true);
    }
  }, [highlighted]);

  // Track cursor position and focus state
  useEffect(() => {
    const interval = setInterval(() => {
      const handle = filePatternInputRef.current;
      if (handle && handle.input) {
        lastCursorPositionRef.current = handle.cursorPosition;
        wasInputFocusedRef.current = document.activeElement === handle.input;
      }
    }, 50); // Check every 50ms

    return () => clearInterval(interval);
  }, []);
  
  const handleInteraction = (e: React.MouseEvent | React.KeyboardEvent) => {
    // Only remove highlight on click, not hover
    if (showHighlight && onInteraction && e.type === 'click') {
      setShowHighlight(false);
      onInteraction();
    }
  };

  const selectDirectory = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    
    if (selected) {
      setOutputDirectory(selected as string);
    }
  };

  const handleVariableClick = (variable: string) => {
    // Prevent processing if we're already processing a click
    if (isProcessingClickRef.current) {
      return;
    }
    isProcessingClickRef.current = true;
    
    const handle = filePatternInputRef.current;
    if (!handle || !handle.input) {
      isProcessingClickRef.current = false;
      return;
    }

    const input = handle.input;
    
    // If input is focused, use actual cursor position instead of tracked one
    const wasInputFocused = wasInputFocusedRef.current;
    const cursorPos = wasInputFocused && document.activeElement === input 
      ? (input.selectionStart || 0) 
      : lastCursorPositionRef.current;
    
    if (wasInputFocused) {
      // Insert variable at cursor position with appropriate underscores
      const currentValue = fileNamePattern;
      const before = currentValue.substring(0, cursorPos);
      const after = currentValue.substring(cursorPos);
      
      let insertText = variable;
      
      // Determine how to add underscores based on position and context
      // Check if we're adjacent to an underscore to avoid creating doubles
      const beforeEndsWithUnderscore = before.endsWith('_');
      const afterStartsWithUnderscore = after.startsWith('_');
      
      if (cursorPos === 0 && currentValue.length > 0) {
        // At the start with text after
        insertText = afterStartsWithUnderscore ? variable : variable + '_';
      } else if (cursorPos === currentValue.length) {
        // At the end
        insertText = beforeEndsWithUnderscore ? variable : '_' + variable;
      } else if (cursorPos > 0) {
        // In the middle
        if (beforeEndsWithUnderscore && afterStartsWithUnderscore) {
          insertText = variable;
        } else if (beforeEndsWithUnderscore) {
          insertText = variable + '_';
        } else if (afterStartsWithUnderscore) {
          insertText = '_' + variable;
        } else {
          insertText = '_' + variable + '_';
        }
      }
      // If empty string (cursorPos === 0 && currentValue.length === 0), just insert the variable
      
      const newValue = before + insertText + after;
      setFileNamePattern(newValue);
      
      // Update cursor position for next click
      const newPos = cursorPos + insertText.length;
      lastCursorPositionRef.current = newPos;
      
      requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(newPos, newPos);
        
        // Allow next click after a small delay
        setTimeout(() => {
          isProcessingClickRef.current = false;
        }, 100);
      });
    } else {
      // When not focused, always append to the end using the current React state
      // This ensures we're always working with the latest value
      const currentValue = fileNamePattern || '';
      
      let newValue: string;
      if (currentValue === '') {
        newValue = variable;
      } else if (currentValue.endsWith('_')) {
        newValue = currentValue + variable;
      } else {
        newValue = currentValue + '_' + variable;
      }
      
      // Update React state first
      setFileNamePattern(newValue);
      
      // Force update the cursor position to the end BEFORE focusing
      const endPos = newValue.length;
      lastCursorPositionRef.current = endPos;
      wasInputFocusedRef.current = true;
      
      // Then focus and set cursor at end after state update
      requestAnimationFrame(() => {
        input.focus();
        
        // Force the selection to the end position
        input.setSelectionRange(endPos, endPos);
        input.scrollLeft = input.scrollWidth;
        
        // Allow next click after a small delay
        setTimeout(() => {
          isProcessingClickRef.current = false;
        }, 100);
      });
    }
  };

  return (
    <>
      {/* Dimming overlay */}
      {showHighlight && (
        <div 
          className="fixed inset-0 bg-black/60 z-10 pointer-events-none transition-opacity duration-300"
        />
      )}
      
      <div 
        id="output-settings-container"
        className="relative z-20 bg-white dark:bg-gray-800 rounded-lg p-8 border border-gray-200 dark:border-gray-700"
        onClick={handleInteraction}
      >
      <div 
        className={`absolute -inset-4 border-4 border-primary-500 rounded-lg pointer-events-none transition-opacity duration-300 shadow-lg shadow-primary-500/50 bg-gray-50 dark:bg-gray-900 ${
          showHighlight ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div className="relative space-y-6">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
          Output Settings
        </h3>
        
        {/* Preview section */}
        <div className="mb-6">
          <FilePathPreview
            inputFileName="example.webm"
            outputDirectory={outputDirectory}
            useSubdirectory={useSubdirectory}
            subdirectoryName={subdirectoryName}
            fileNamePattern={fileNamePattern}
            size="small"
          />
        </div>
      
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Output Directory
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={outputDirectory || 'Same as input file'}
            onChange={(e) => setOutputDirectory(e.target.value)}
            onClick={() => {
              if (!outputDirectory) {
                selectDirectory();
              }
            }}
            readOnly={!outputDirectory}
            placeholder="Same as input file"
            className={`flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 transition-colors ${
              !outputDirectory ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700' : ''
            }`}
          />
          {outputDirectory && (
            <button
              onClick={() => setOutputDirectory('')}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              title="Reset to default"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={selectDirectory}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2"
          >
            <Folder className="w-4 h-4" />
            Change
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Subdirectory
        </label>
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Create subdirectory for converted files
          </span>
          <button
            onClick={() => setUseSubdirectory(!useSubdirectory)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
              useSubdirectory ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
            role="switch"
            aria-checked={useSubdirectory}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                useSubdirectory ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Subdirectory Name
        </label>
        <div className="relative">
          <input
            type="text"
            value={subdirectoryName}
            onChange={(e) => setSubdirectoryName(e.target.value)}
            placeholder="converted"
            disabled={!useSubdirectory}
            className={`w-full px-3 py-2 border rounded-lg transition-colors ${
              useSubdirectory 
                ? 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200' 
                : 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }`}
          />
          {!useSubdirectory && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg cursor-not-allowed group">
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                Enable "Create subdirectory" first
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                  <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          File Name Pattern
        </label>
        <div className="flex gap-2 items-stretch">
          <FilePatternInput
            ref={filePatternInputRef}
            value={fileNamePattern}
            onChange={setFileNamePattern}
            placeholder="{name}_converted"
          />
          
          {/* Reset button */}
          <div className="relative">
            <button
              onClick={() => setFileNamePattern('{name}_converted')}
              disabled={fileNamePattern === '{name}_converted'}
              className={`h-full px-3 py-2 border rounded-lg transition-colors flex items-center justify-center ${
                fileNamePattern === '{name}_converted'
                  ? 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title="Reset to default"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            {fileNamePattern === '{name}_converted' && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg cursor-not-allowed group">
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  Already using default value
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                    <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="relative">
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Use <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleVariableClick('{name}');
              }}
              className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 cursor-pointer transition-colors"
            >{'{name}'}</button> for the original filename,{'\u00A0'}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleVariableClick('{number}');
              }}
              className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 cursor-pointer transition-colors"
            >{'{number}'}</button> for auto-incrementing number
          </p>
          <div className={`overflow-hidden transition-all ease-out ${
            fileNamePattern && !isPatternValid(fileNamePattern) ? 'max-h-20 duration-300' : 'max-h-0 duration-200'
          }`}>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1 transform transition-transform duration-300 ease-out">
              Invalid pattern. Will use "{'{name}_converted'}" instead to ensure safe file creation.
            </p>
          </div>
        </div>
      </div>
      </div>
    </div>
    </>
  );
}