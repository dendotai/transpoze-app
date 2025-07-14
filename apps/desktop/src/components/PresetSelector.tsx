import { useConverter } from '../hooks/useConverter';
import { Check } from 'lucide-react';
import { Tooltip } from './Tooltip';

export function PresetSelector() {
  const { presets, selectedPreset, setSelectedPreset } = useConverter();

  return (
    <div className="space-y-3 overflow-visible">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
        Quality Preset
      </h3>
      <div className="flex flex-col gap-2 overflow-visible">
        {presets.map((preset) => (
          <button
            key={preset.name}
            onClick={() => setSelectedPreset(preset)}
            className={`
              relative block w-full p-3 rounded-lg border-2 text-left transition-all
              ${
                selectedPreset?.name === preset.name
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }
            `}
          >
            {selectedPreset?.name === preset.name && (
              <div className="absolute top-2 right-2 flex items-center justify-center w-6 h-6 bg-primary-500 rounded-full shadow-lg">
                <Check className="w-4 h-4 text-white stroke-[3]" />
              </div>
            )}
            <div className="space-y-2">
              <div>
                <h4 className="font-medium text-gray-800 dark:text-gray-200">
                  {preset.name}
                  {preset.name === 'Balanced' && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 rounded-full">
                      Recommended
                    </span>
                  )}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {preset.description}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {preset.bitrate && (
                  <Tooltip content="Target bitrate for encoding">
                    <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded cursor-help">
                      {preset.bitrate}
                    </span>
                  </Tooltip>
                )}
                {preset.crf && (
                  <Tooltip content="Constant Rate Factor: Lower = higher quality, larger file">
                    <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded cursor-help">
                      CRF {preset.crf}
                    </span>
                  </Tooltip>
                )}
                <Tooltip content="Video codec used for encoding">
                  <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded cursor-help">
                    {preset.videoCodec}
                  </span>
                </Tooltip>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}