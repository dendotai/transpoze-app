import { History, Settings, Trash2, Video } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import './App.css';
import { ConversionHistory } from './components/ConversionHistory';
import { DisplaySettings } from './components/DisplaySettings';
import { DropZone } from './components/DropZone';
import { OutputSettings } from './components/OutputSettings';
import { PresetSelector } from './components/PresetSelector';
import { Queue } from './components/Queue';
import { useConverter, useConverterEvents } from './hooks/useConverter';
import { logger } from './utils/simpleLogger';

type TabType = 'convert' | 'settings' | 'history';

export interface NavigationContext {
  highlightOutputSettings?: boolean;
  clearHighlight?: () => void;
}

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('convert');
  const [highlightOutputSettings, setHighlightOutputSettings] = useState(false);
  const loadPresets = useConverter((state) => state.loadPresets);
  const loadJobs = useConverter((state) => state.loadJobs);
  const loadHistory = useConverter((state) => state.loadHistory);
  const loadPersistedData = useConverter((state) => state.loadPersistedData);
  const presetsLoaded = useConverter((state) => state.presetsLoaded);
  const jobs = useConverter((state) => state.jobs);
  const clearCompletedJobs = useConverter((state) => state.clearCompletedJobs);

  useConverterEvents();

  // Check if there are any completed or failed jobs to show the clear button
  const hasCompletedOrFailed = jobs.some(
    (job) => job.status === 'completed' || job.status === 'failed',
  );

  const navigateToSettings = (highlight = false) => {
    setActiveTab('settings');
    if (highlight) {
      // Delay to ensure the settings tab is fully rendered before highlighting
      requestAnimationFrame(() => {
        setTimeout(() => {
          setHighlightOutputSettings(true);
        }, 100);
      });
    }
  };

  const clearHighlight = () => {
    setHighlightOutputSettings(false);
  };

  useEffect(() => {
    logger.info('App mounted, loading initial data...');
    loadPersistedData(); // Load settings and history first
    loadPresets();
    loadJobs();
    loadHistory();
  }, [loadPersistedData, loadPresets, loadJobs, loadHistory]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <Video className="w-8 h-8 text-blue-500" />
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Transpoze.app</h1>
          </div>
        </div>
      </header>

      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-6">
            <TabButton
              active={activeTab === 'convert'}
              onClick={() => setActiveTab('convert')}
              icon={<Video className="w-4 h-4" />}
              label="Convert"
            />
            <TabButton
              active={activeTab === 'settings'}
              onClick={() => setActiveTab('settings')}
              icon={<Settings className="w-4 h-4" />}
              label="Settings"
            />
            <TabButton
              active={activeTab === 'history'}
              onClick={() => setActiveTab('history')}
              icon={<History className="w-4 h-4" />}
              label="History"
            />
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6">
        <div className={activeTab === 'convert' ? 'block' : 'hidden'}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <section>
                {!presetsLoaded ? (
                  <div className="border-2 border-dashed rounded-lg p-8 text-center border-gray-300 dark:border-gray-600">
                    <p className="text-gray-500 dark:text-gray-400">Loading presets...</p>
                  </div>
                ) : (
                  <DropZone onNavigateToSettings={() => navigateToSettings(true)} />
                )}
              </section>

              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Queue</h2>
                  <button
                    onClick={clearCompletedJobs}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors ${hasCompletedOrFailed ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear
                  </button>
                </div>
                <Queue />
              </section>
            </div>

            <div className="space-y-6">
              <section>
                <PresetSelector />
              </section>
            </div>
          </div>
        </div>

        <div className={activeTab === 'settings' ? 'block' : 'hidden'}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="relative z-20">
                <OutputSettings
                  highlighted={highlightOutputSettings}
                  onInteraction={clearHighlight}
                />
              </div>
              <DisplaySettings />
            </div>
            <div className="hidden lg:block">
              {/* Empty space to match the convert tab layout */}
            </div>
          </div>
        </div>

        <div className={activeTab === 'history' ? 'block' : 'hidden'}>
          <ConversionHistory />
        </div>
      </main>
      <div className="h-20" />
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 py-3 px-1 border-b-2 transition-colors
        ${
          active
            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
        }
      `}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

export default App;
