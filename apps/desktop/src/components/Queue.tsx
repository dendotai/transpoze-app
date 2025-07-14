import { useConverter } from '../hooks/useConverter';
import { FileVideo, CheckCircle, XCircle, Loader2, FolderOpen } from 'lucide-react';
import { logger } from '../utils/simpleLogger';
import { invoke } from '@tauri-apps/api/core';
import { VideoThumbnail } from './VideoThumbnail';

export function Queue() {
  const jobs = useConverter((state) => state.jobs);
  
  // Show all jobs - keep completed/failed jobs visible
  const activeJobs = jobs;
  
  const handleRevealInFinder = async (filePath: string) => {
    try {
      await invoke('reveal_in_finder', { filePath });
    } catch (error) {
      console.error('Failed to reveal file in Finder:', error);
    }
  };

  const getRevealButtonText = () => {
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('mac')) {
      return 'Open in Finder';
    } else if (platform.includes('win')) {
      return 'Open in Explorer';
    } else {
      return 'Open in File Manager';
    }
  };
  
  logger.info('JobQueue render - showing all jobs', { jobCount: jobs.length, jobs });

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No active conversion jobs. Drop some files to get started!
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activeJobs.map((job) => {
        if (!job || !job.id) {
          logger.error('Invalid job object', job);
          return null;
        }

        const fileName = job.inputPath ? job.inputPath.split('/').pop() || 'Unknown file' : 'Unknown file';
        const presetName = job.preset?.name || 'Unknown preset';
        console.log('Job details:', { id: job.id, thumbnailPath: job.thumbnailPath });

        return (
          <div
            key={job.id}
            className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 relative"
          >
            <div className="flex items-start gap-3">
              {job.thumbnailPath ? (
                <VideoThumbnail jobId={job.id} fileName={fileName} />
              ) : (
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
                  <FileVideo className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">
                    {fileName}
                  </h4>
                  <StatusIcon status={job.status} />
                </div>
                <div className="mt-1">
                  <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                    {presetName}
                  </span>
                </div>
                {(job.status === 'queued' || job.status === 'ready') && job.statusMessage && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {job.statusMessage}
                  </div>
                )}
                {job.status === 'processing' && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                      <span>{job.statusMessage || 'Processing...'}</span>
                      <span>{Math.round(job.progress || 0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300 ease-out relative"
                        style={{ width: `${job.progress || 0}%` }}
                      >
                        <div className="absolute inset-0 bg-white/20 animate-pulse" />
                      </div>
                    </div>
                  </div>
                )}
                {job.error && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                    {job.error}
                  </p>
                )}
              </div>
            </div>
            {job.status === 'completed' && (
              <div className="absolute bottom-3 right-3">
                <button
                  onClick={() => handleRevealInFinder(job.outputPath)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                  title={getRevealButtonText()}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  {getRevealButtonText()}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'queued':
      return <div className="w-2 h-2 bg-gray-400 rounded-full" />;
    case 'ready':
      return <div className="w-2 h-2 bg-blue-400 rounded-full" />;
    case 'processing':
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-500" />;
    default:
      return null;
  }
}