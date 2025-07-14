import { ArrowRight } from 'lucide-react';

interface FilePathPreviewProps {
  inputFileName?: string;
  outputDirectory?: string;
  useSubdirectory?: boolean;
  subdirectoryName?: string;
  fileNamePattern?: string;
  size?: 'small' | 'large';
}

export function FilePathPreview({
  inputFileName = 'example.webm',
  outputDirectory = '',
  useSubdirectory = true,
  subdirectoryName = 'converted',
  fileNamePattern = '{name}_converted',
  size = 'small'
}: FilePathPreviewProps) {
  // Validate pattern function
  const validatePattern = (pattern: string | undefined): boolean => {
    if (!pattern || typeof pattern !== 'string') return true;
    let braceCount = 0;
    for (const char of pattern) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      if (braceCount < 0) return false;
    }
    if (braceCount !== 0) return false;
    
    const placeholderRegex = /\{([^}]+)\}/g;
    const matches = pattern.match(placeholderRegex);
    if (matches) {
      for (const match of matches) {
        if (match !== '{name}' && match !== '{number}') return false;
      }
    }
    
    const invalidChars = /[<>:"|?*\\/]/;
    const withoutPlaceholders = pattern.replace(placeholderRegex, '');
    if (invalidChars.test(withoutPlaceholders)) return false;
    
    return true;
  };

  // Extract base name without extension
  const baseName = inputFileName.replace('.webm', '');
  
  // Generate output filename
  const safePattern = validatePattern(fileNamePattern) ? fileNamePattern : '{name}_converted';
  const outputFileName = safePattern
    .replace(/\{name\}/g, baseName)  // Replace all instances of {name}
    .replace(/\{number\}/g, '0') + '.mp4';  // Replace all instances of {number}

  // Style configurations
  const styles = {
    small: {
      container: 'flex items-stretch gap-2',
      box: 'px-2 py-1 rounded flex items-center',
      text: 'font-mono text-xs',
      arrow: 'w-4 h-4'
    },
    large: {
      container: 'flex items-stretch justify-center gap-2',
      box: 'px-3 py-1.5 rounded-md flex items-center',
      text: 'font-mono text-sm',
      arrow: 'w-5 h-5'
    }
  };

  const currentStyle = styles[size];

  return (
    <div className={currentStyle.container}>
      <div className={`${currentStyle.box} bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600`}>
        <span className={`${currentStyle.text} text-gray-600 dark:text-gray-400`}>{inputFileName}</span>
      </div>
      
      <div className="flex items-center">
        <ArrowRight className={`${currentStyle.arrow} text-gray-400 dark:text-gray-500`} />
      </div>
      
      <div className={`${currentStyle.box} bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 min-w-0`}>
        <span className={`${currentStyle.text} text-primary-600 dark:text-primary-400 block truncate`}>
          {outputDirectory && (
            <span className="text-primary-500/70 dark:text-primary-500/70">
              {outputDirectory + '/'}
            </span>
          )}
          {useSubdirectory ? `${subdirectoryName}/` : ''}
          {outputFileName}
        </span>
      </div>
    </div>
  );
}