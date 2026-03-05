import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Home, Terminal, Monitor, XCircle, Ban, AlertTriangle, MonitorPlay, ExternalLink, X } from 'lucide-react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import './PreviewPanel.css';

interface ConsoleEntry {
  id: number;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  source: string;
  line: number;
  timestamp: number;
}

interface PreviewPanelProps {
  workspaceRoot: string | null;
  onOpenInTab?: () => void;
  isFullTab?: boolean;
  onClose?: () => void;
}

let entryIdCounter = 0;

export default function PreviewPanel({ workspaceRoot, onOpenInTab, isFullTab, onClose }: PreviewPanelProps) {
  const webviewRef = useRef<HTMLWebViewElement>(null);
  const devtoolsContainerRef = useRef<HTMLDivElement>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [inputUrl, setInputUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>([]);
  const [consoleFilter, setConsoleFilter] = useState<string>('all');
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);

  useEffect(() => {
    if (!workspaceRoot) {
      setServerUrl(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const port = await window.electronAPI.server.start(workspaceRoot);
        if (!cancelled) {
          const url = `http://127.0.0.1:${port}`;
          setServerUrl(url);
          setCurrentUrl(url);
          setInputUrl(url);
        }
      } catch (err) {
        console.error('Failed to start preview server:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [workspaceRoot]);

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;

    // Set initial src programmatically to avoid React VDOM re-applying it and causing reloads on every render
    if (serverUrl) {
      (wv as any).src = serverUrl;
    }

    const onStartLoading = () => setIsLoading(true);
    const onStopLoading = () => {
      setIsLoading(false);
      setCanGoBack((wv as any).canGoBack());
      setCanGoForward((wv as any).canGoForward());
    };
    const onNavigate = (e: any) => {
      setCurrentUrl(e.url);
      setInputUrl(e.url);
    };

    const onConsoleMessage = (e: any) => {
      const levelMap: Record<number, ConsoleEntry['level']> = {
        0: 'debug', 1: 'log', 2: 'warn', 3: 'error',
      };
      const entry: ConsoleEntry = {
        id: ++entryIdCounter,
        level: levelMap[e.level] || 'log',
        message: e.message,
        source: e.sourceId || '',
        line: e.line || 0,
        timestamp: Date.now(),
      };
      setConsoleLogs((prev) => [...prev.slice(-500), entry]);
    };

    wv.addEventListener('did-start-loading', onStartLoading);
    wv.addEventListener('did-stop-loading', onStopLoading);
    wv.addEventListener('did-navigate', onNavigate);
    wv.addEventListener('did-navigate-in-page', onNavigate);
    wv.addEventListener('console-message', onConsoleMessage);

    return () => {
      wv.removeEventListener('did-start-loading', onStartLoading);
      wv.removeEventListener('did-stop-loading', onStopLoading);
      wv.removeEventListener('did-navigate', onNavigate);
      wv.removeEventListener('did-navigate-in-page', onNavigate);
      wv.removeEventListener('console-message', onConsoleMessage);
    };
  }, [serverUrl]);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleLogs]);

  useEffect(() => {
    const handleFileSaved = () => {
      (webviewRef.current as any)?.reload();
    };
    window.addEventListener('file-saved', handleFileSaved as EventListener);
    return () => {
      window.removeEventListener('file-saved', handleFileSaved as EventListener);
    };
  }, []);

  const refresh = useCallback(() => {
    (webviewRef.current as any)?.reload();
  }, []);

  const goBack = useCallback(() => {
    (webviewRef.current as any)?.goBack();
  }, []);

  const goForward = useCallback(() => {
    (webviewRef.current as any)?.goForward();
  }, []);

  const navigateHome = useCallback(() => {
    if (serverUrl && webviewRef.current) {
      (webviewRef.current as any).loadURL(serverUrl);
    }
  }, [serverUrl]);

  const toggleConsole = useCallback(() => {
    setConsoleOpen((v) => !v);
  }, []);

  const handleUrlSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!webviewRef.current) return;

    let targetUrl = inputUrl.trim();

    // Prepend http:// when user types localhost or 127.0.0.1 directly
    if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(targetUrl)) {
      targetUrl = 'http://' + targetUrl;
    }

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      if (serverUrl) {
        targetUrl = targetUrl.startsWith('/')
          ? serverUrl + targetUrl
          : serverUrl + '/' + targetUrl;
      } else {
        return;
      }
    }

    try {
      const urlObj = new URL(targetUrl);
      if (urlObj.hostname !== 'localhost' && urlObj.hostname !== '127.0.0.1') {
        if (serverUrl) targetUrl = serverUrl;
        else return;
      }
    } catch {
      if (serverUrl) targetUrl = serverUrl;
      else return;
    }

    setInputUrl(targetUrl);
    setCurrentUrl(targetUrl);
    (webviewRef.current as any).loadURL(targetUrl);
  }, [inputUrl, serverUrl]);

  const clearConsole = useCallback(() => {
    setConsoleLogs([]);
  }, []);

  const openInspector = useCallback(() => {
    if (devtoolsOpen) {
      window.electronAPI.devtools.close();
      setDevtoolsOpen(false);
      return;
    }
    setDevtoolsOpen(true);
  }, [devtoolsOpen]);

  useEffect(() => {
    if (!devtoolsOpen) return;
    const wv = webviewRef.current as any;
    if (!wv) return;

    let previewId: number;
    try {
      previewId = wv.getWebContentsId();
    } catch {
      return;
    }
    window.electronAPI.devtools.open(previewId);

    return () => {
      window.electronAPI.devtools.close();
    };
  }, [devtoolsOpen]);

  useEffect(() => {
    if (!devtoolsOpen || !devtoolsContainerRef.current) return;

    const updateBounds = () => {
      const el = devtoolsContainerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      window.electronAPI.devtools.resize({
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };

    const timer = setTimeout(updateBounds, 50);
    const observer = new ResizeObserver(updateBounds);
    observer.observe(devtoolsContainerRef.current);
    window.addEventListener('resize', updateBounds);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener('resize', updateBounds);
    };
  }, [devtoolsOpen]);

  const filteredLogs = consoleFilter === 'all'
    ? consoleLogs
    : consoleLogs.filter((l) => l.level === consoleFilter);

  const errorCount = consoleLogs.filter((l) => l.level === 'error').length;
  const warnCount = consoleLogs.filter((l) => l.level === 'warn').length;

  if (!serverUrl) {
    return (
      <div className={`preview-panel ${isFullTab ? 'preview-full-tab' : ''}`}>
        <div className="preview-body" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div className="empty-state">
            <MonitorPlay size={48} className="empty-icon" />
            <p>Open a folder (or file) to start the preview server</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`preview-panel ${isFullTab ? 'preview-full-tab' : ''}`}>
      <div className="preview-toolbar">
        <button className="preview-btn preview-btn-hide-small" onClick={goBack} disabled={!canGoBack} title="Go Back">
          <ArrowLeft size={16} />
        </button>
        <button className="preview-btn preview-btn-hide-small" onClick={goForward} disabled={!canGoForward} title="Go Forward">
          <ArrowRight size={16} />
        </button>
        <button className="preview-btn preview-btn-hide-small" onClick={refresh} title="Reload">
          <RotateCw size={16} className={isLoading ? 'spinning' : ''} />
        </button>
        <button className="preview-btn preview-btn-hide-small" onClick={navigateHome} title="Home">
          <Home size={16} />
        </button>

        <form className="preview-address-bar-form" onSubmit={handleUrlSubmit} style={{ flex: 1, display: 'flex', minWidth: 0 }}>
          <input
            type="text"
            className="preview-address-bar input"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            title={inputUrl}
          />
        </form>

        {!isFullTab && onOpenInTab && (
          <button className="preview-btn preview-btn-hide-small" onClick={onOpenInTab} title="Open in Editor Tab">
            <ExternalLink size={16} />
          </button>
        )}
        <button className={`preview-btn ${consoleOpen ? 'active' : ''}`} onClick={toggleConsole} title="Toggle Console">
          <Terminal size={16} />
        </button>
        <button className={`preview-btn preview-btn-hide-small ${devtoolsOpen ? 'active' : ''}`} onClick={openInspector} title="Toggle Inspector">
          <Monitor size={16} />
        </button>
        {!isFullTab && onClose && (
          <button className="preview-btn" onClick={onClose} title="Close Preview Panel" style={{ flexShrink: 0 }}>
            <X size={16} />
          </button>
        )}
      </div>

      <div className="preview-body">
        {isLoading && <div className="preview-loading-bar" />}
        <PanelGroup direction="vertical">
          <Panel id="webview-panel" minSize={10} style={{ display: 'flex', flexDirection: 'column' }}>
            <webview
              ref={webviewRef}
              className="preview-webview"
              webpreferences="allowRunningInsecureContent=no"
            />
          </Panel>
          {devtoolsOpen && (
            <>
              <PanelResizeHandle className="resize-handle horizontal" />
              <Panel id="devtools-panel" defaultSize={40} minSize={10}>
                <div className="devtools-container" ref={devtoolsContainerRef} style={{ width: '100%', height: '100%' }} />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      {consoleOpen && !devtoolsOpen && (
        <div className="preview-console">
          <div className="console-header">
            <div className="console-filters">
              <button className={`filter-btn ${consoleFilter === 'all' ? 'active' : ''}`} onClick={() => setConsoleFilter('all')}>All</button>
              <button className={`filter-btn ${consoleFilter === 'error' ? 'active' : ''}`} onClick={() => setConsoleFilter('error')}>
                <XCircle size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }}/> Errors {errorCount > 0 && `(${errorCount})`}
              </button>
              <button className={`filter-btn ${consoleFilter === 'warn' ? 'active' : ''}`} onClick={() => setConsoleFilter('warn')}>
                <AlertTriangle size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }}/> Warn {warnCount > 0 && `(${warnCount})`}
              </button>
            </div>
            <div className="console-actions">
              <button className="preview-btn" onClick={clearConsole} title="Clear Console">
                <Ban size={14} />
              </button>
            </div>
          </div>
          <div className="console-logs">
            {filteredLogs.map((log) => (
              <div key={log.id} className={`console-entry ${log.level}`}>
                <span className="console-msg">{log.message}</span>
                <span className="console-source">{log.source.split('/').pop()}:{log.line}</span>
              </div>
            ))}
            <div ref={consoleEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
