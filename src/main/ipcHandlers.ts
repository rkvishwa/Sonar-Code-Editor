import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import { IpcMain, Dialog, webContents, BrowserView, BrowserWindow, clipboard, shell } from 'electron';
import { FileNode } from '../shared/types';
import { IPC_CHANNELS } from '../shared/constants';
import { startStaticServer, stopStaticServer, getServerUrl } from './staticServer';

const trustedRoots = new Set<string>();

export function enforceTrustedPath(targetPath: string) {
  if (!targetPath) return;
  const absTarget = path.resolve(targetPath);
  let isTrusted = false;
  for (const root of trustedRoots) {
    const resolvedRoot = path.resolve(root);
    // Enforce strict prefix matching or exact match to prevent sibling directory traversal
    if (absTarget === resolvedRoot || absTarget.startsWith(resolvedRoot + path.sep)) {
      isTrusted = true;
      break;
    }
  }
  if (!isTrusted) {
    throw new Error(`Security Error: Access to path denied outside trusted workspace roots: ${targetPath}`);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Normalise a path to forward-slashes and collapse repeated separators.
 * This makes comparisons robust on Windows where paths can arrive as
 * either "D:/foo" or "D:\\foo".
 */
function normPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/\/+$/, '');
}

function getUniquePath(targetPath: string): string {
  const targetDir = path.dirname(targetPath);
  const ext = path.extname(targetPath);
  const base = path.basename(targetPath, ext);
  let finalPath = targetPath;
  let counter = 1;

  while (fs.existsSync(finalPath)) {
    finalPath = path.join(
      targetDir,
      `${base} copy${counter > 1 ? ` ${counter}` : ''}${ext}`,
    );
    counter++;
  }

  return finalPath;
}

/**
 * Validate a file/folder name.
 * Returns an error string if invalid, or null if OK.
 */
function validateName(name: string): string | null {
  if (!name || !name.trim()) return 'Name cannot be empty';
  // Reject names with characters that are invalid on Windows and/or could
  // cause path-traversal issues.
  if (/[<>:"|?*\x00-\x1f]/.test(name)) return 'Name contains invalid characters';
  if (name === '.' || name === '..') return 'Invalid name';
  if (name.length > 255) return 'Name too long (max 255 characters)';
  return null;
}

/**
 * Detect whether a file is likely binary by checking the first 8 KB for
 * NULL bytes.  Used to decide utf-8 vs raw read.
 */
function isBinaryFile(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(8192);
    const bytesRead = fs.readSync(fd, buf, 0, 8192, 0);
    fs.closeSync(fd);
    for (let i = 0; i < bytesRead; i++) {
      if (buf[i] === 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function readDirectoryRecursive(dirPath: string, deep = false): FileNode[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return []; // Directory may have been deleted / inaccessible
  }
  const nodes: FileNode[] = [];
  for (const entry of entries) {
    if (entry.name === '.git') continue;
    try {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          type: 'directory' as const,
          path: fullPath,
          children: deep ? readDirectoryRecursive(fullPath) : [],
        });
      } else {
        nodes.push({
          name: entry.name,
          type: 'file' as const,
          path: fullPath,
          extension: getExtension(entry.name),
        });
      }
    } catch {
      // Skip entries that vanished between readdir and stat (race with collab)
    }
  }
  nodes.sort((a, b) => {
    if (a.type === 'directory' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });
  return nodes;
}

function searchFilesRecursive(dirPath: string, query: string, results: any[]) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules') continue;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        searchFilesRecursive(fullPath, query, results);
      } else {
        const ext = getExtension(entry.name);
        if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'ico',
             'exe', 'dll', 'so', 'bin', 'zip', 'tar', 'gz', 'rar',
             'pdf', 'woff', 'woff2', 'ttf', 'otf', 'mp3', 'mp4', 'wav',
             'sqlite', 'db', 'lock', 'class', 'pyc'].includes(ext)) continue;
        try {
          // Skip binary files
          if (isBinaryFile(fullPath)) continue;
          const content = fs.readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(query.toLowerCase())) {
              results.push({
                path: fullPath,
                name: entry.name,
                line: i + 1,
                text: lines[i].trim()
              });
            }
          }
        } catch (e) {
          // ignore read errors
        }
      }
    }
  } catch (e) {
    // ignore dir errors
  }
}

export function registerFsHandlers(ipcMain: IpcMain, dialog: Dialog): void {
  ipcMain.handle(IPC_CHANNELS.FS_READ_DIR, async (_event, dirPath: string) => {
    if (!dirPath) throw new Error("Path is required");
    enforceTrustedPath(dirPath);
    if (!fs.existsSync(dirPath)) throw new Error("Directory does not exist");
    
    try {
      return readDirectoryRecursive(dirPath);
    } catch (err) {
      console.error('FS_READ_DIR error:', err);
      throw err;
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_READ_FILE, async (_event, filePath: string) => {
    try {
      if (!filePath) throw new Error('No file path provided');
      enforceTrustedPath(filePath);
      if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
      // Check if file is binary — return empty string for binary files
      // to avoid garbled UTF-8 data or IPC serialisation issues
      if (isBinaryFile(filePath)) {
        return '';
      }
      return await fsp.readFile(filePath, 'utf-8');
    } catch (err) {
      throw new Error(`Failed to read file: ${(err as Error).message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_READ_FILE_BASE64, async (_event, filePath: string) => {
    try {
      if (!filePath) throw new Error('No file path provided');
      enforceTrustedPath(filePath);
      const buffer = await fsp.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase().slice(1);
      const mimeMap: Record<string, string> = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml',
        webp: 'image/webp', ico: 'image/x-icon',
      };
      const mime = mimeMap[ext] || 'application/octet-stream';
      return `data:${mime};base64,${buffer.toString('base64')}`;
    } catch (err) {
      throw new Error(`Failed to read file as base64: ${(err as Error).message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_WRITE_FILE, async (_event, filePath: string, content: string) => {
    try {
      if (!filePath) throw new Error('No file path provided');
      enforceTrustedPath(filePath);
      // Ensure parent directory exists (collaboration may create files before folders)
      const parentDir = path.dirname(filePath);
      if (!fs.existsSync(parentDir)) {
        await fsp.mkdir(parentDir, { recursive: true });
      }
      await fsp.writeFile(filePath, content, 'utf-8');
    } catch (err) {
      throw new Error(`Failed to write file: ${(err as Error).message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_CREATE_FILE, async (_event, filePath: string) => {
    try {
      if (!filePath) throw new Error('No file path provided');
      enforceTrustedPath(filePath);
      const fileName = path.basename(filePath);
      const nameErr = validateName(fileName);
      if (nameErr) throw new Error(nameErr);

      // Ensure parent directory exists (important for cross-platform collaboration sync)
      const parentDir = path.dirname(filePath);
      if (!fs.existsSync(parentDir)) {
        await fsp.mkdir(parentDir, { recursive: true });
      }
      if (fs.existsSync(filePath)) {
        throw new Error('An item with this name already exists');
      }
      await fsp.writeFile(filePath, '', 'utf-8');
      return filePath;
    } catch (err) {
      throw new Error(`Failed to create file: ${(err as Error).message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_CREATE_FOLDER, async (_event, folderPath: string) => {
    try {
      if (!folderPath) throw new Error('No folder path provided');
      enforceTrustedPath(folderPath);
      const folderName = path.basename(folderPath);
      const nameErr = validateName(folderName);
      if (nameErr) throw new Error(nameErr);

      if (fs.existsSync(folderPath)) {
        throw new Error('An item with this name already exists');
      }

      await fsp.mkdir(folderPath, { recursive: true });
      return folderPath;
    } catch (err) {
      throw new Error(`Failed to create folder: ${(err as Error).message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_DELETE_ITEM, async (_event, itemPath: string) => {
    try {
      if (!itemPath) return;
      enforceTrustedPath(itemPath);
      // If it doesn't exist, treat as success (idempotent — collab peer may have deleted first)
      if (!fs.existsSync(itemPath)) return;
      const stat = await fsp.stat(itemPath);
      if (stat.isDirectory()) {
        await fsp.rm(itemPath, { recursive: true, force: true });
      } else {
        await fsp.unlink(itemPath);
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw new Error(`Failed to delete item: ${(err as Error).message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_RENAME_ITEM, async (_event, oldPath: string, newPath: string) => {
    try {
      if (!oldPath || !newPath) throw new Error('Missing path for rename');
      enforceTrustedPath(oldPath);
      enforceTrustedPath(newPath);

      // If source doesn't exist, it may have been renamed/deleted by a collab peer.
      // If the destination already exists, treat it as an idempotent success.
      // Otherwise return undefined so callers can skip state migration.
      if (!fs.existsSync(oldPath)) {
        console.warn(`Rename source not found (collab race?): ${oldPath}`);
        if (fs.existsSync(newPath)) {
          return newPath;
        }
        return;
      }

      const newBase = path.basename(newPath);
      const nameErr = validateName(newBase);
      if (nameErr) throw new Error(nameErr);

      // Ensure target parent directory exists (important for cross-platform collaboration sync)
      const targetDir = path.dirname(newPath);
      if (!fs.existsSync(targetDir)) {
        await fsp.mkdir(targetDir, { recursive: true });
      }

      // Detect case-only rename (e.g. File.txt → file.txt).  On case-insensitive
      // file systems (Windows, default macOS) fs.renameSync silently succeeds but
      // may not actually change the on-disk name.  Use a two-step rename via a
      // temporary name to force the change.
      const oldBase = path.basename(oldPath);
      const isCaseOnlyRename =
        oldBase !== newBase && oldBase.toLowerCase() === newBase.toLowerCase();

      // Auto-rename on collision: if a different file already exists at the
      // destination, generate a unique name (e.g. "file copy.txt",
      // "file copy 2.txt") instead of overwriting or throwing.
      // Case-only renames are exempt (same file, different casing).
      let finalNewPath = newPath;
      if (!isCaseOnlyRename && normPath(oldPath) !== normPath(newPath) && fs.existsSync(newPath)) {
        finalNewPath = getUniquePath(newPath);
      }

      if (isCaseOnlyRename) {
        const tmpPath = oldPath + '.__rename_tmp__';
        await fsp.rename(oldPath, tmpPath);
        await fsp.rename(tmpPath, finalNewPath);
      } else {
        await fsp.rename(oldPath, finalNewPath);
      }

      return finalNewPath;
    } catch (err) {
      // ENOENT during rename is treated as non-fatal (collab race condition)
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        console.warn(`Rename failed (ENOENT, collab race?): ${oldPath} → ${newPath}`);
        if (fs.existsSync(newPath)) {
          return newPath;
        }
        return;
      }
      throw new Error(`Failed to rename item: ${(err as Error).message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_COPY_ITEM, async (_event, srcPath: string, destPath: string) => {
    try {
      if (!srcPath || !destPath) throw new Error('Missing path for copy');
      enforceTrustedPath(srcPath);
      enforceTrustedPath(destPath);
      if (!fs.existsSync(srcPath)) throw new Error('Source path does not exist');

      // Ensure target parent directory exists
      const targetDir = path.dirname(destPath);
      if (!fs.existsSync(targetDir)) {
        await fsp.mkdir(targetDir, { recursive: true });
      }

      let finalDestPath = destPath;
      if (fs.existsSync(finalDestPath)) {
        finalDestPath = getUniquePath(destPath);
      }

      const destBase = path.basename(finalDestPath);
      const nameErr = validateName(destBase);
      if (nameErr) throw new Error(nameErr);

      await fsp.cp(srcPath, finalDestPath, { recursive: true });
      
      return finalDestPath;
    } catch (err) {
      throw new Error(`Failed to copy item: ${(err as Error).message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_SEARCH, async (_event, dirPath: string, query: string) => {
    const results: any[] = [];
    if (!dirPath || !query) return results;
    try { enforceTrustedPath(dirPath); } catch { return results; }
    searchFilesRecursive(dirPath, query, results);
    return results;
  });

  ipcMain.handle(IPC_CHANNELS.FS_GET_WORKSPACE_STATS, async (_event, dirPath: string) => {
    try {
      if (!dirPath) throw new Error('Path required');
      enforceTrustedPath(dirPath);
      const stats = {
        totalFiles: 0,
        totalFolders: 0,
        authors: {
          npm: { count: 0, files: [] as string[] },
          composer: { count: 0, files: [] as string[] },
          user: { count: 0, files: [] as string[] }
        }
      };

      const scanDirectory = (currentPath: string, parentAuthor: 'npm' | 'composer' | 'user') => {
        try {
          const items = fs.readdirSync(currentPath, { withFileTypes: true });
          for (const item of items) {
            // Determine author context based on current item or parent
            let author = parentAuthor;
            if (item.name === 'node_modules') author = 'npm';
            else if (item.name === 'vendor') author = 'composer';
            else if (item.name === '.git') continue;

            if (item.isDirectory()) {
              stats.totalFolders++;
              scanDirectory(path.join(currentPath, item.name), author);
            } else if (item.isFile()) {
              stats.totalFiles++;
              stats.authors[author].count++;
              stats.authors[author].files.push(path.join(currentPath, item.name));
            }
          }
        } catch (e) {
          console.error(`Failed to scan directory ${currentPath}`, e);
        }
      };
      
      scanDirectory(dirPath, 'user');
      return stats;
    } catch (err: any) {
      throw new Error(`Failed to get workspace stats: ${err.message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_CANCEL_FOLDER_DIALOG, async () => {
    // Native dialogs cannot be force-dismissed reliably across platforms.
    // The renderer now queues follow-up prompts instead of depending on this
    // call to close an already-open folder picker.
  });

  ipcMain.handle(IPC_CHANNELS.FS_OPEN_FOLDER_DIALOG, async (event) => {
    const parentWin = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
    try {
      const options: Electron.OpenDialogOptions = {
        properties: ['openDirectory', 'createDirectory'],
        title: 'Open Folder',
      };
      const result =
        process.platform === 'darwin'
          ? await dialog.showOpenDialog(options)
          : parentWin
            ? await dialog.showOpenDialog(parentWin, options)
            : await dialog.showOpenDialog(options);

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) return null;
      trustedRoots.add(result.filePaths[0]);
      return { path: result.filePaths[0], isDirectory: true };
    } catch (err) {
      throw new Error(`Failed to open folder dialog: ${(err as Error).message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_OPEN_FILE_DIALOG, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
    try {
      const options: Electron.OpenDialogOptions = {
        properties: ['openFile'],
        title: 'Open File',
      };
      const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
      if (result.canceled || result.filePaths.length === 0) return null;
      const selectedPath = result.filePaths[0];
      trustedRoots.add(selectedPath);
      return { path: selectedPath, isDirectory: false, parentPath: path.dirname(selectedPath), name: path.basename(selectedPath) };
    } catch (err) {
      throw new Error(`Failed to open file dialog: ${(err as Error).message}`);
    }
  });

  // Static server handlers
  ipcMain.handle(IPC_CHANNELS.SERVER_START, async (_event, rootDir: string) => {
    const port = await startStaticServer(rootDir);
    return port;
  });

  ipcMain.handle(IPC_CHANNELS.SERVER_STOP, async () => {
    await stopStaticServer();
  });

  ipcMain.handle(IPC_CHANNELS.SERVER_GET_URL, async () => {
    return getServerUrl();
  });

  // DevTools docking handlers using BrowserView
  let devtoolsView: BrowserView | null = null;

  ipcMain.handle(IPC_CHANNELS.DEVTOOLS_OPEN, async (event, previewId: number) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    const previewContents = webContents.fromId(previewId);
    if (!previewContents) return;

    if (previewContents.hostWebContents?.id !== event.sender.id) {
      throw new Error('Unauthorized DevTools access');
    }

    // Clean up existing
    if (devtoolsView) {
      try {
        win.removeBrowserView(devtoolsView);
        devtoolsView.webContents.close();
      } catch {}
      devtoolsView = null;
    }

    devtoolsView = new BrowserView();
    win.addBrowserView(devtoolsView);
    devtoolsView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    previewContents.setDevToolsWebContents(devtoolsView.webContents);
    previewContents.openDevTools();
  });

  ipcMain.handle(IPC_CHANNELS.DEVTOOLS_CLOSE, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || !devtoolsView) return;
    try {
      win.removeBrowserView(devtoolsView);
      devtoolsView.webContents.close();
    } catch {}
    devtoolsView = null;
  });

  ipcMain.handle(IPC_CHANNELS.DEVTOOLS_RESIZE, async (_event, bounds: { x: number; y: number; width: number; height: number }) => {
    if (!devtoolsView) return;
    devtoolsView.setBounds({
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
    });
  });

  // Active window title detection
  // Returns null if the active window is the app itself (any of its windows)
  ipcMain.handle(IPC_CHANNELS.GET_ACTIVE_WINDOW, async (event) => {
    try {
      const platform = process.platform;
      let title = '';

      // Check if any of the app's own windows are focused
      const allWindows = BrowserWindow.getAllWindows();
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      const anyOwnWindowFocused = allWindows.some(w => w.isFocused());
      // Also check if the sender window itself is focused (covers iframe/webview focus changes)
      if (anyOwnWindowFocused || (senderWindow && senderWindow.isFocused())) {
        return null; // It's our own app, not an external switch
      }

      if (platform === 'win32') {
        // PowerShell: get foreground window title
        const cmd = 'powershell -NoProfile -Command "(Add-Type -MemberDefinition \'[DllImport(\\\"user32.dll\\\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\\\"user32.dll\\\", CharSet=CharSet.Auto)] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);\' -Name Win32 -Namespace Native -PassThru)| Out-Null; $h=[Native.Win32]::GetForegroundWindow(); $sb=New-Object System.Text.StringBuilder 256; [Native.Win32]::GetWindowText($h,$sb,256)|Out-Null; $sb.ToString()"';
        title = execSync(cmd, { timeout: 3000, encoding: 'utf-8' }).trim();
      } else if (platform === 'darwin') {
        // Use NSWorkspace via JXA to get the localized app name and bundle ID.
        // AppleScript's `name of application process` returns the process name
        // which is "Electron" for all Electron-based apps (VS Code, etc.),
        // making them indistinguishable. NSWorkspace gives the proper display
        // name (e.g. "Visual Studio Code") and a unique bundle identifier.
        const OWN_BUNDLE_ID = 'com.sonar.editor';
        const info = execSync(
          `osascript -l JavaScript -e 'ObjC.import("AppKit"); var ws = $.NSWorkspace.sharedWorkspace; var app = ws.frontmostApplication; (app.bundleIdentifier.js) + "||" + (app.localizedName.js)'`,
          { timeout: 3000, encoding: 'utf-8' }
        ).trim();

        const separatorIdx = info.indexOf('||');
        const bundleId = separatorIdx >= 0 ? info.substring(0, separatorIdx) : '';
        const appName = separatorIdx >= 0 ? info.substring(separatorIdx + 2) : info;

        // Filter out our own app reliably by bundle identifier
        if (bundleId === OWN_BUNDLE_ID) {
          return null;
        }

        title = appName;
      } else {
        // Linux
        title = execSync('xdotool getactivewindow getwindowname 2>/dev/null || echo ""', {
          timeout: 3000, encoding: 'utf-8'
        }).trim();
      }

      // Non-macOS: fallback filter by comparing with own window titles
      if (platform !== 'darwin') {
        const ownTitles = allWindows.map(w => w.getTitle()).filter(Boolean);
        if (ownTitles.some(ownTitle => title === ownTitle || title.includes(ownTitle) || ownTitle.includes(title))) {
          return null;
        }
      }

      return title || null;
    } catch {
      return null;
    }
  });

  // Clipboard read
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_READ_TEXT, async () => {
    return clipboard.readText();
  });

  // Permission check: returns true if Automation/System Events access is granted on macOS
  ipcMain.handle(IPC_CHANNELS.SYSTEM_CHECK_PERMISSION, async (): Promise<boolean> => {
    if (process.platform !== 'darwin') return true;
    return new Promise((resolve) => {
      try {
        // Must query a protected resource to actually exercise the Automation
        // permission. A simple `return "ok"` succeeds without permission.
        execSync(
          'osascript -e \'tell application "System Events" to get name of first application process whose frontmost is true\'',
          { timeout: 5000, encoding: 'utf-8' }
        );
        resolve(true);
      } catch (err: unknown) {
        const msg = String((err as Error).message || '');
        if (
          msg.includes('Not authorized') ||
          msg.includes('1743') ||
          msg.includes('not allowed to send Apple events') ||
          msg.includes('errAEEventNotPermitted') ||
          msg.includes('not allowed assistive access')
        ) {
          resolve(false);
        } else {
          resolve(true);
        }
      }
    });
  });

  // Open macOS Privacy & Security → Automation settings
  ipcMain.handle(IPC_CHANNELS.SYSTEM_OPEN_PREFS, async () => {
    if (process.platform === 'darwin') {
      await shell.openExternal(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation'
      );
    }
  });
}
