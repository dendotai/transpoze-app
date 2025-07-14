import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, Info } from 'lucide-react';

interface FFmpegVersionInfo {
  version: string;
  date: string;
  updated: string;
}

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutDialog({ isOpen, onClose }: AboutDialogProps) {
  const [ffmpegVersion, setFFmpegVersion] = useState<FFmpegVersionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      invoke<FFmpegVersionInfo>('get_ffmpeg_version_info')
        .then(setFFmpegVersion)
        .catch((err) => setError(err.toString()));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Info className="w-5 h-5" />
            About Transvibe.app
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-sm text-gray-300">
          <div>
            <h3 className="font-medium text-white mb-1">Application</h3>
            <p>Version: 0.1.0</p>
            <p>Transform your video vibes</p>
          </div>

          <div>
            <h3 className="font-medium text-white mb-1">FFmpeg</h3>
            {error ? (
              <p className="text-red-400">Error loading version: {error}</p>
            ) : ffmpegVersion ? (
              <>
                <p>Version: {ffmpegVersion.version}</p>
                <p>Released: {new Date(ffmpegVersion.date).toLocaleDateString()}</p>
                <p className="text-xs text-gray-400">
                  Updated: {new Date(ffmpegVersion.updated).toLocaleString()}
                </p>
              </>
            ) : (
              <p>Loading...</p>
            )}
          </div>

          <div>
            <h3 className="font-medium text-white mb-1">Credits</h3>
            <p>Built with Tauri, React, and FFmpeg</p>
            <p>FFmpeg is a trademark of Fabrice Bellard</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}