import { useConverter } from '../hooks/useConverter';
import { Image } from 'lucide-react';

export function DisplaySettings() {
  const {
    zoomedThumbnails,
    setZoomedThumbnails,
  } = useConverter();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-8 border border-gray-200 dark:border-gray-700">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Image className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            Display Settings
          </h3>
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Video Thumbnails
          </label>
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Fit to frame
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {zoomedThumbnails 
                  ? "Thumbnails fill the preview area (may crop edges)" 
                  : "Show entire thumbnail with gray bars"}
              </p>
            </div>
            <button
              onClick={() => setZoomedThumbnails(!zoomedThumbnails)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                zoomedThumbnails ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              role="switch"
              aria-checked={zoomedThumbnails}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  zoomedThumbnails ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}