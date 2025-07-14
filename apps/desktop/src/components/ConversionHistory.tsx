import { useConverter } from '../hooks/useConverter';
import { Clock, HardDrive, Trash2 } from 'lucide-react';

export function ConversionHistory() {
  const history = useConverter((state) => state.history);
  const clearHistory = useConverter((state) => state.clearHistory);

  const handleClearHistory = async () => {
    if (window.confirm('Are you sure you want to clear all conversion history? This action cannot be undone.')) {
      await clearHistory();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
          Recent Conversions
        </h2>
        <button
          onClick={handleClearHistory}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors ${history.length > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <Trash2 className="w-4 h-4" />
          Clear
        </button>
      </div>
      {history.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No conversion history yet.
        </div>
      ) : (
        <div className="space-y-3">
      {history.slice(0, 10).map((item) => (
        <div
          key={item.id}
          className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">
                {item.inputPath.split('/').pop()}
              </h4>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(item.completedAt).toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  {formatFileSize(item.fileSizeBefore)} → {formatFileSize(item.fileSizeAfter)}
                </span>
              </div>
            </div>
            <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
              {item.presetName}
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Compression: {calculateCompressionRatio(item.fileSizeBefore, item.fileSizeAfter)}%
            </div>
          </div>
        </div>
      ))}
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function calculateCompressionRatio(before: number, after: number): string {
  const ratio = ((before - after) / before) * 100;
  return ratio.toFixed(1);
}