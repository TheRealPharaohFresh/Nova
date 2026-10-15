import { useEffect, useMemo, useState } from "react";

interface ScreenCapture {
  width: number;
  height: number;
  dataUrl: string;
}

interface WorkspaceFile {
  path: string;
  content: string;
}

interface PhaseToolsProps {
  screenEnabled: boolean;
  filesEnabled: boolean;
  emergencyStopped: boolean;
  automationPaused: boolean;
  onOpenSettings: () => void;
}

export function PhaseTools({
  screenEnabled,
  filesEnabled,
  emergencyStopped,
  automationPaused,
  onOpenSettings
}: PhaseToolsProps) {
  const [capture, setCapture] = useState<ScreenCapture | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [selectedPath, setSelectedPath] = useState("");
  const [editorValue, setEditorValue] = useState("");
  const [savedValue, setSavedValue] = useState("");
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDirty = editorValue !== savedValue;
  const toolsPaused = emergencyStopped || automationPaused;

  const visibleFiles = useMemo(() => {
    const normalizedFilter = filter.trim().toLowerCase();
    return normalizedFilter
      ? files.filter((path) => path.toLowerCase().includes(normalizedFilter))
      : files;
  }, [files, filter]);

  async function refreshFiles(): Promise<void> {
    if (!filesEnabled || toolsPaused) {
      return;
    }
    setLoadingFiles(true);
    setError(null);
    try {
      const result = (await window.nova.listWorkspaceFiles()) as string[];
      setFiles(result);
      if (selectedPath && !result.includes(selectedPath)) {
        setSelectedPath("");
        setEditorValue("");
        setSavedValue("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not list workspace files.");
    } finally {
      setLoadingFiles(false);
    }
  }

  useEffect(() => {
    if (filesEnabled && !toolsPaused) {
      void refreshFiles();
    } else if (!filesEnabled) {
      setFiles([]);
      setSelectedPath("");
      setEditorValue("");
      setSavedValue("");
    }
  }, [filesEnabled, toolsPaused]);

  async function captureScreen(): Promise<void> {
    if (!screenEnabled || toolsPaused || capturing) {
      return;
    }
    if (!window.confirm("Capture the primary display now? The image stays in this preview and is not added to chat history.")) {
      return;
    }
    setCapturing(true);
    setError(null);
    try {
      const result = (await window.nova.captureScreen()) as ScreenCapture;
      setCapture(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Screen capture failed.");
    } finally {
      setCapturing(false);
    }
  }

  async function openFile(path: string): Promise<void> {
    if (isDirty && !window.confirm("Discard your unsaved changes and open another file?")) {
      return;
    }
    setLoadingFile(true);
    setError(null);
    try {
      const result = (await window.nova.readWorkspaceFile(path)) as WorkspaceFile;
      setSelectedPath(path);
      setEditorValue(result.content);
      setSavedValue(result.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read this workspace file.");
    } finally {
      setLoadingFile(false);
    }
  }

  async function saveFile(): Promise<void> {
    if (!selectedPath || !filesEnabled || toolsPaused || !isDirty || saving) {
      return;
    }
    if (!window.confirm(`Replace the contents of ${selectedPath}?`)) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await window.nova.writeWorkspaceFile(selectedPath, editorValue);
      setSavedValue(editorValue);
      setFiles((current) => (current.includes(selectedPath) ? current : [...current, selectedPath].sort()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this workspace file.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="phase-tools" aria-label="Computer awareness and workspace">
      <div className="tools-heading">
        <div>
          <div className="eyebrow">PHASE 09 · PHASE 10</div>
          <h2>Computer &amp; workspace</h2>
          <p className="hint">Screen snapshots and project files stay behind their opt-in permissions.</p>
        </div>
        {emergencyStopped ? (
          <span className="tool-badge stopped">EMERGENCY STOP</span>
        ) : automationPaused ? (
          <span className="tool-badge stopped">PAUSED</span>
        ) : (
          <span className="tool-badge">LOCAL TOOLS</span>
        )}
      </div>

      {error ? <div className="tool-error" role="alert">{error}</div> : null}
      {automationPaused && !emergencyStopped ? (
        <div className="pause-note">
          <span>Automation is paused. Resume it in Settings to use screen and workspace tools.</span>
          <button className="text-action" type="button" onClick={onOpenSettings}>Open Settings</button>
        </div>
      ) : null}

      <section className="tool-card">
        <div className="tool-card-heading">
          <div>
            <div className="tool-kicker">PHASE 09</div>
            <h3>Screen capture</h3>
          </div>
          <span className={`tool-badge ${screenEnabled ? "enabled" : ""}`}>
            {screenEnabled ? "SCREEN ON" : "SCREEN OFF"}
          </span>
        </div>
        <p className="hint">Capture the primary display on demand. Each capture requires a click-through confirmation.</p>
        {capture ? (
          <div className="capture-preview">
            <img src={capture.dataUrl} alt={`Primary display captured at ${capture.width} by ${capture.height}`} />
            <div className="capture-meta">
              <span><i className="status-dot" /> Captured for this session</span>
              <span>{capture.width} × {capture.height}</span>
            </div>
          </div>
        ) : (
          <div className="capture-placeholder">
            <span className="preview-icon" aria-hidden="true">▧</span>
            <strong>No screen preview yet</strong>
            <span>Nothing is captured until you request it.</span>
          </div>
        )}
        <div className="tool-actions">
          <button
            className="primary"
            type="button"
            disabled={!screenEnabled || toolsPaused || capturing}
            onClick={() => void captureScreen()}
          >
            {capturing ? "Capturing…" : capture ? "Capture again" : "Capture primary display"}
          </button>
          {capture ? (
            <button className="icon-btn" type="button" onClick={() => setCapture(null)}>
              Clear preview
            </button>
          ) : null}
          {!screenEnabled ? <button className="text-action" type="button" onClick={onOpenSettings}>Enable in Settings</button> : null}
        </div>
      </section>

      <section className="tool-card workspace-card">
        <div className="tool-card-heading">
          <div>
            <div className="tool-kicker">PHASE 10</div>
            <h3>Workspace files</h3>
          </div>
          <span className={`tool-badge ${filesEnabled ? "enabled" : ""}`}>
            {filesEnabled ? `${files.length} FILES` : "FILES OFF"}
          </span>
        </div>
        <p className="hint">Browse and read files inside the current project. Saving always asks before replacing content.</p>
        {!filesEnabled ? (
          <div className="permission-empty">
            <strong>Files access is off</strong>
            <span>Turn on the Files permission to browse this project.</span>
            <button className="text-action" type="button" onClick={onOpenSettings}>Open permission settings</button>
          </div>
        ) : (
          <>
            <div className="file-browser">
              <div className="file-toolbar">
                <input
                  aria-label="Filter workspace files"
                  type="text"
                  value={filter}
                  placeholder="Filter files…"
                  onChange={(event) => setFilter(event.target.value)}
                />
                <button
                  className="icon-btn"
                  type="button"
                  disabled={loadingFiles || toolsPaused}
                  onClick={() => void refreshFiles()}
                >
                  {loadingFiles ? "…" : "Refresh"}
                </button>
              </div>
              <div className="file-list" role="listbox" aria-label="Workspace files">
                {visibleFiles.map((path) => (
                  <button
                    key={path}
                    className={`file-entry ${selectedPath === path ? "selected" : ""}`}
                    type="button"
                    role="option"
                    aria-selected={selectedPath === path}
                    disabled={loadingFile || toolsPaused}
                    onClick={() => void openFile(path)}
                  >
                    <span className="file-glyph" aria-hidden="true">⌁</span>
                    <span>{path}</span>
                  </button>
                ))}
                {visibleFiles.length === 0 ? (
                  <div className="file-list-empty">                  {loadingFiles ? "Loading project…" : toolsPaused ? "Resume tools to browse files." : "No matching files."}</div>
                ) : null}
              </div>
            </div>
            <div className="file-editor">
              <div className="editor-toolbar">
                <div className="editor-file">
                  <span className="file-glyph" aria-hidden="true">⌁</span>
                  <strong>{selectedPath || "Select a file to read"}</strong>
                  {isDirty ? <span className="dirty-indicator">UNSAVED</span> : null}
                </div>
                <button
                  className="primary save-button"
                  type="button"
                  disabled={!selectedPath || !isDirty || saving || toolsPaused}
                  onClick={() => void saveFile()}
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
              <textarea
                aria-label="Workspace file contents"
                className="file-content"
                value={editorValue}
                placeholder={loadingFile ? "Reading file…" : "Choose a project file to inspect its contents."}
                readOnly={!selectedPath || toolsPaused}
                onChange={(event) => setEditorValue(event.target.value)}
                spellCheck={false}
              />
              <div className="editor-footnote">
                {selectedPath ? "Edits remain local until you confirm Save changes." : "Workspace paths are checked before every read and write."}
              </div>
            </div>
          </>
        )}
      </section>
    </section>
  );
}
