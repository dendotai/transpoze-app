import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileVideo } from 'lucide-react';

interface VideoThumbnailProps {
  jobId: string;
  fileName: string;
}

export function VideoThumbnail({ jobId, fileName }: VideoThumbnailProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    async function loadThumbnail() {
      try {
        const thumbnailData = await invoke<string>('get_thumbnail_data', { jobId });
        setThumbnailUrl(thumbnailData);
        setError(false);
      } catch (err) {
        console.error('Failed to load thumbnail for job', jobId, ':', err);
        // Retry a few times as thumbnail might still be generating
        if (retryCount < 5) {
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, 1000);
        } else {
          setError(true);
        }
      } finally {
        setLoading(false);
      }
    }

    loadThumbnail();
  }, [jobId, retryCount]);

  if (loading || error || !thumbnailUrl) {
    return (
      <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
        <FileVideo className="w-8 h-8 text-gray-400" />
      </div>
    );
  }

  return (
    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0 flex items-center justify-center relative">
      <img
        src={thumbnailUrl}
        alt={fileName}
        className="w-full h-full object-cover"
        onError={() => setError(true)}
      />
    </div>
  );
}