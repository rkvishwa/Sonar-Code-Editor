import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";

// Global clipboard for cut/paste operations
export let fileClipboard: { path: string; type: "file" | "directory"; action: "cut" | "copy" } | null = null;

// Global undo stack for file tree operations
export const fileUndoStack: Array<{ 
  originalPath: string; 
  trashPath: string; 
  type: "file" | "directory"; 
  onRestored: () => void; 
}> = [];

if (typeof window !== "undefined") {
  window.addEventListener("keydown", async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      const activeEl = document.activeElement;
      if (activeEl?.tagName === "INPUT" || activeEl?.tagName === "TEXTAREA" || activeEl?.closest('.monaco-editor')) {
         return; 
      }
      
      const lastOp = fileUndoStack.pop();
      if (lastOp) {
        try {
          await window.electronAPI.fs.renameItem(lastOp.trashPath, lastOp.originalPath);
          lastOp.onRestored();
        } catch (err) {
          console.error("Failed to restore item:", err);
          fileUndoStack.push(lastOp); // put it back if failed
        }
      }
    }
  });
}

import {
  ChevronRight,
  ChevronDown,
  Folder,
  File,
  FileCode2,
  FileJson,
  FileText,
  FileImage,
  Terminal,
  Database,
  ShieldAlert,
  FilePlus2,
  FolderPlus,
  Braces,
  Code2,
  Palette,
} from "lucide-react";
import { FileNode } from "../../../shared/types";
import { fileTreeInputCallbacks } from "../../fileTreeKeyShield";
import "./FileTree.css";

// Track global mouse interaction to distinguish programmatic focus steals from user clicks
let isUserClicking = false;
if (typeof window !== "undefined") {
  window.addEventListener("mousedown", () => { isUserClicking = true; }, true);
  window.addEventListener("mouseup", () => { isUserClicking = false; }, true);
  window.addEventListener("keydown", () => { isUserClicking = true; }, true);
  window.addEventListener("keyup", () => { isUserClicking = false; }, true);
}
const isWindows = navigator.userAgent.toLowerCase().includes("win");
const INDENT_PX = isWindows ? 16 : 28;

function getIcon(node: FileNode) {
  if (node.type === "directory")
    return <Folder size={14} color="var(--accent)" />;

  const ext = node.extension || "";
  switch (ext) {
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
      return <Braces size={14} color="#eab308" />;
    case "json":
      return <FileJson size={14} color="#22c55e" />;
    case "html":
      return <Code2 size={14} color="#ef4444" />;
    case "css":
      return <Palette size={14} color="var(--accent)" />;
    case "md":
      return <FileText size={14} color="#a1a1aa" />;
    case "png":
    case "jpg":
    case "svg":
      return <FileImage size={14} color="#8b5cf6" />;
    case "sh":
    case "bash":
      return <Terminal size={14} color="#10b981" />;
    case "php":
      return <FileCode2 size={14} color="#7b7fb5" />;
    case "sql":
      return <Database size={14} color="#f97316" />;
    case "env":
      return <ShieldAlert size={14} color="#eab308" />;
    default:
      return <File size={14} color="var(--text-muted)" />;
  }
}

interface CreatingItem {
  type: "file" | "folder";
  parentPath: string;
}

interface InlineCreateInputProps {
  type: "file" | "folder";
  depth: number;
  hasFolders: boolean;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

function InlineCreateInput({
  type,
  depth,
  hasFolders,
  onSubmit,
  onCancel,
}: InlineCreateInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const submittedRef = useRef(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep latest callbacks in refs so the debounced blur always calls the
  // current versions (parent re-renders may swap identities).
  const onSubmitRef = useRef(onSubmit);
  const onCancelRef = useRef(onCancel);
  onSubmitRef.current = onSubmit;
  onCancelRef.current = onCancel;

  useEffect(() => {
    // Initial focus with multiple strategies for reliability across platforms
    const el = inputRef.current;
    if (el) el.focus();
    const rafId = requestAnimationFrame(() => inputRef.current?.focus());

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Register native-level Enter / Escape callbacks so the global window
  // capture listener can invoke them (React handlers are dead by that point).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    fileTreeInputCallbacks.set(el, {
      onSubmit: () => {
        if (blurTimeoutRef.current) {
          clearTimeout(blurTimeoutRef.current);
          blurTimeoutRef.current = null;
        }
        handleSubmit();
      },
      onCancel: () => {
        if (blurTimeoutRef.current) {
          clearTimeout(blurTimeoutRef.current);
          blurTimeoutRef.current = null;
        }
        onCancelRef.current();
      },
    });
    return () => { fileTreeInputCallbacks.delete(el); };
  });

  // Cleanup blur timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  const handleSubmit = useCallback(() => {
    // Guard against double-submit (blur can fire after Enter)
    if (submittedRef.current) return;
    if (value.trim()) {
      submittedRef.current = true;
      onSubmitRef.current(value.trim());
    } else {
      onCancelRef.current();
    }
  }, [value]);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    // If the blur was caused by the user physically clicking away, we want to submit.
    // If Monaco steals focus programmatically, we DO NOT submit and optionally restore focus.
    const userClickedAway = isUserClicking;
    const relatedTarget = e.relatedTarget as Element | null;
    const wentToMonaco = relatedTarget && !!relatedTarget.closest('.monaco-editor');
    const wentToBody = relatedTarget === document.body || !relatedTarget;

    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    blurTimeoutRef.current = setTimeout(() => {
      if (document.activeElement === inputRef.current) return;
      
      if (!userClickedAway && (wentToMonaco || wentToBody)) {
        // This was a programmatic focus steal (e.g., y-monaco merging edits).
        // Safely put focus back without aggressive capture loops that crash React.
        inputRef.current?.focus();
        return; 
      }
      
      handleSubmit();
    }, 300);
  }, [handleSubmit]);

  const handleFocus = useCallback(() => {
    // Cancel any pending blur-triggered cancel/submit.
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  }, []);

  return (
    <div
      className="tree-node inline-create"
      style={{ paddingLeft: `${depth * INDENT_PX + 8}px` }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {hasFolders ? (
        <span className="expand-icon"></span>
      ) : (
        <span className="expand-icon expand-icon-empty"></span>
      )}
      <span className="file-icon">
        {type === "folder" ? (
          <Folder size={14} color="var(--accent)" />
        ) : (
          <File size={14} />
        )}
      </span>
      <input
        ref={inputRef}
        className="inline-create-input"
        title="Create item"
        value={value}
        placeholder={type === "folder" ? "Folder name" : "File name"}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  hasFolders: boolean;
  activeFilePath: string | null;
  onFileClick: (path: string, name: string) => void;
  onRefresh: () => void;
  workspaceRoot: string;
  creatingItem: CreatingItem | null;
  onSetCreating: (item: CreatingItem | null) => void;
  selectedNode: { path: string; type: "file" | "directory" } | null;
  onSelectNode: (node: { path: string; type: "file" | "directory" } | null) => void;
  onFileOpened: (path: string, name: string, isPreview?: boolean) => void;
  onFileDeleted: (path: string, type: "file" | "directory") => void;
  onFileRenamed?: (oldPath: string, newPath: string) => void;
  onFileCreated?: (path: string, name: string, savedContent?: string, isUndo?: boolean) => void;
  onFolderCreated?: (path: string) => void;
  onFileCopied?: (newPath: string, type: "file" | "directory") => void;
  onFileMoved?: () => void;
  refreshTrigger?: number;
}

function FileTreeNode({
  node,
  depth,
  hasFolders,
  activeFilePath,
  onFileClick,
  onRefresh,
  workspaceRoot,
  creatingItem,
  onSetCreating,
  selectedNode,
  onSelectNode,
  onFileOpened,
  onFileDeleted,
  onFileRenamed,
  onFileCreated,
  onFolderCreated,
  onFileCopied,
  onFileMoved,
  refreshTrigger,
}: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileNode[]>(node.children || []);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isCut, setIsCut] = useState(() => fileClipboard?.action === "cut" && fileClipboard?.path === node.path);
  const dragCounter = useRef(0);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(node.name);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const renameBlurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProcessedActivePath = useRef<string | null>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const commitRenameRef = useRef(false);
  const childrenDragCounter = useRef(0);

  const hasChildFolders = children.some((c) => c.type === "directory");

  const isCreatingHere =
    creatingItem &&
    creatingItem.parentPath === node.path &&
    node.type === "directory";

  const loadChildren = useCallback(async () => {
    if (node.type === "directory") {
      try {
        const items = await window.electronAPI.fs.readDirectory(node.path);
        setChildren(items);
      } catch (err) {
        // Directory may have been renamed/deleted by a collaboration peer.
        // Silently return stale children instead of crashing.
        console.warn('loadChildren failed (collab race?):', err);
      }
    }
  }, [node]);

  useEffect(() => {
    if (isCreatingHere && !expanded) {
      setExpanded(true);
      loadChildren();
    }
  }, [isCreatingHere, expanded, loadChildren]);

  useEffect(() => {
    const handleClipboardUpdate = () => {
      setIsCut(fileClipboard?.action === "cut" && fileClipboard?.path === node.path);
    };
    window.addEventListener("clipboard-updated", handleClipboardUpdate);
    return () => window.removeEventListener("clipboard-updated", handleClipboardUpdate);
  }, [node.path]);

  useEffect(() => {
    if (expanded && typeof refreshTrigger === 'number' && refreshTrigger > 0) {
      loadChildren();
    }
  }, [refreshTrigger, expanded, loadChildren]);

  useEffect(() => {
    if (activeFilePath !== lastProcessedActivePath.current) {
      lastProcessedActivePath.current = activeFilePath;
      
      if (node.type === "directory" && activeFilePath) {
        const normalizedActive = activeFilePath.replace(/\\/g, "/");
        const normalizedNode = node.path.replace(/\\/g, "/");
        
        if (normalizedActive.startsWith(normalizedNode + "/")) {
          if (!expanded) {
            setExpanded(true);
            loadChildren();
          }
        }
      }
    }
  }, [activeFilePath, node.path, node.type, expanded, loadChildren]);

  const toggleExpanded = async () => {
    if (node.type !== "directory") return;
    if (!expanded) await loadChildren();
    setExpanded((v) => !v);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    document.dispatchEvent(new CustomEvent("close-context-menus"));
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleNewFile = () => {
    closeContextMenu();
    const dirPath =
      node.type === "directory"
        ? node.path
        : node.path.split(/[\\/]/).slice(0, -1).join("/");
    onSetCreating({ type: "file", parentPath: dirPath });
  };

  const handleNewFolder = () => {
    closeContextMenu();
    const dirPath =
      node.type === "directory"
        ? node.path
        : node.path.split(/[\\/]/).slice(0, -1).join("/");
    onSetCreating({ type: "folder", parentPath: dirPath });
  };

  const handleInlineCreate = async (name: string) => {
    if (!creatingItem) return;
    // Normalize path separators for cross-platform safety (Windows backslashes)
    const parentNorm = creatingItem.parentPath.replace(/\\/g, "/");
    const fullPath = `${parentNorm}/${name}`;
    // Clear creating state FIRST so the input is always removed even if the
    // fs call fails — this prevents the UI from "freezing" with an orphaned
    // inline input that can never be dismissed.
    const itemType = creatingItem.type;
    onSetCreating(null);
    try {
      if (itemType === "file") {
        await window.electronAPI.fs.createFile(fullPath);
        await loadChildren();
        onFileCreated?.(fullPath, name);
        onFileOpened(fullPath, name, false);
      } else {
        await window.electronAPI.fs.createFolder(fullPath);
        await loadChildren();
        onFolderCreated?.(fullPath);
      }
    } catch (err) {
      console.error("Failed to create item:", err);
      // Still refresh to show current state
      await loadChildren().catch(() => {});
    }
  };

  const handleDeleteMenuClick = async () => {
    closeContextMenu();

    try {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      // Perform pseudo-delete by renaming to a hidden .trash file
      const dirStr = node.path.substring(0, Math.max(node.path.lastIndexOf('/'), node.path.lastIndexOf('\\')));
      const fileName = node.path.substring(Math.max(node.path.lastIndexOf('/'), node.path.lastIndexOf('\\')) + 1);
      const trashPath = `${dirStr}/.trash_${Date.now()}_${fileName}`;

      // Read file content BEFORE renaming so we can restore it on undo.
      // This is the most reliable source — it doesn't depend on Y.Text,
      // Monaco model state, or re-reading after rename.
      let savedContent: string | undefined;
      if (node.type === "file") {
        try {
          savedContent = await window.electronAPI.fs.readFile(node.path);
        } catch (readErr) {
          console.warn(`Could not pre-read file for undo stack: ${node.path}`, readErr);
        }
      }
      
      await window.electronAPI.fs.renameItem(node.path, trashPath);
      
      // Store in global undo stack so Ctrl+Z brings it back
      fileUndoStack.push({
        originalPath: node.path,
        trashPath,
        type: node.type,
        onRestored: () => {
            if (node.type === "file") {
               onFileCreated?.(node.path, node.name, savedContent, true);
            } else {
               onFolderCreated?.(node.path);
            }
            onRefresh();
        }
      });
      
      onFileDeleted(node.path, node.type);
      onRefresh();
    } catch (err) {
      console.error("Failed to delete item:", err);
    }
  };

  const handleCut = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    closeContextMenu();
    fileClipboard = { path: node.path, type: node.type, action: "cut" };
    window.dispatchEvent(new CustomEvent("clipboard-updated"));
  };

  const handleCopy = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    closeContextMenu();
    fileClipboard = { path: node.path, type: node.type, action: "copy" };
    window.dispatchEvent(new CustomEvent("clipboard-updated"));
  };

  const handlePaste = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    closeContextMenu();
    if (!fileClipboard) return;

    const targetDir = node.type === "directory" ? node.path : node.path.substring(0, Math.max(node.path.lastIndexOf("/"), node.path.lastIndexOf("\\")));
    const fileName = fileClipboard.path.substring(Math.max(fileClipboard.path.lastIndexOf("/"), fileClipboard.path.lastIndexOf("\\")) + 1);
    const newPath = `${targetDir}/${fileName}`.replace(/\\/g, "/");

    if (fileClipboard.action === "cut" && newPath === fileClipboard.path) return;

    try {
      if (fileClipboard.action === "cut") {
        // Perform disk rename FIRST, then update tabs on success
        try {
          await window.electronAPI.fs.renameItem(fileClipboard.path, newPath);
        } catch (err) {
          console.error("Paste failed on disk:", err);
          return;
        }
        onFileRenamed?.(fileClipboard.path, newPath);
        fileClipboard = null;
        window.dispatchEvent(new CustomEvent("clipboard-updated"));
        onFileMoved?.();
      } else if (fileClipboard.action === "copy") {
        let finalPath = newPath;
        try {
          const resultPath = await window.electronAPI.fs.copyItem(fileClipboard.path, newPath);
          if (resultPath) finalPath = resultPath.replace(/\\/g, "/");
        } catch (err) {
          console.error("Paste copy failed on disk:", err);
          return;
        }
        // For copy, we don't clear the clipboard so the user can paste multiple times.
        onFileCopied?.(finalPath, fileClipboard.type);
        onFileMoved?.();
      }
      
      onRefresh();
    } catch (err) {
      console.error("Paste parse failed:", err);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.setData("application/sonar-file", JSON.stringify({ path: node.path, type: node.type }));
    e.dataTransfer.effectAllowed = "move";
  };

  // --- Folder-level drag handlers (only used on directory nodes) ---
  const handleDragEnter = (e: React.DragEvent) => {
    if (node.type !== "directory") return; // files don't handle drag highlights
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (dragCounter.current === 1) {
      setIsDragOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (node.type === "directory") e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (node.type !== "directory") return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragCounter.current = 0;
    setIsDragOver(false);

    const data = e.dataTransfer.getData("application/sonar-file");
    if (!data) return;

    // Always resolve the target as this node's parent folder (for files)
    // or this node itself (for directories).
    const targetDir = node.type === "directory" ? node.path : node.path.substring(0, Math.max(node.path.lastIndexOf("/"), node.path.lastIndexOf("\\")));

    try {
      const source = JSON.parse(data);
      const fileName = source.path.substring(Math.max(source.path.lastIndexOf("/"), source.path.lastIndexOf("\\")) + 1);
      const newPath = `${targetDir}/${fileName}`.replace(/\\/g, "/");

      if (newPath === source.path) return;

      onFileRenamed?.(source.path, newPath);
      try {
        await window.electronAPI.fs.renameItem(source.path, newPath);
      } catch (err) {
        console.error("Drop failed on disk:", err);
        onFileRenamed?.(newPath, source.path); // rollback
        return;
      }
      onRefresh();
      onFileMoved?.();
    } catch (err) {
      console.error("Drop failed:", err);
    }
  };

  // --- Handlers for the tree-children container (highlights parent folder when dragging over children) ---

  const handleChildrenDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    childrenDragCounter.current += 1;
    if (childrenDragCounter.current === 1) {
      setIsDragOver(true);
    }
  };

  const handleChildrenDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  };

  const handleChildrenDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    childrenDragCounter.current -= 1;
    if (childrenDragCounter.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleChildrenDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    childrenDragCounter.current = 0;
    dragCounter.current = 0;
    setIsDragOver(false);

    const data = e.dataTransfer.getData("application/sonar-file");
    if (!data) return;

    try {
      const source = JSON.parse(data);
      const fileName = source.path.substring(Math.max(source.path.lastIndexOf("/"), source.path.lastIndexOf("\\")) + 1);
      const newPath = `${node.path}/${fileName}`.replace(/\\/g, "/");

      if (newPath === source.path) return;

      onFileRenamed?.(source.path, newPath);
      try {
        await window.electronAPI.fs.renameItem(source.path, newPath);
      } catch (err) {
        console.error("Drop in children failed on disk:", err);
        onFileRenamed?.(newPath, source.path);
        return;
      }
      onRefresh();
      onFileMoved?.();
    } catch (err) {
      console.error("Drop in children failed:", err);
    }
  };

  const startRename = () => {
    closeContextMenu();
    setNewName(node.name);
    setRenaming(true);
    commitRenameRef.current = false;
  };



  const commitRename = async () => {
    if (commitRenameRef.current) return;
    commitRenameRef.current = true;
    
    setRenaming(false);
    if (newName !== node.name && newName.trim()) {
      const dir = node.path.split(/[\\/]/).slice(0, -1).join("/");
      const newPath = `${dir}/${newName.trim()}`;
      try {
        onFileRenamed?.(node.path, newPath);
      } catch (err) {
        console.error('broadcastRename failed:', err);
      }
      try {
        await window.electronAPI.fs.renameItem(node.path, newPath);
      } catch (err) {
        console.error("Local rename failed:", err);
        commitRenameRef.current = false;
        try { onFileRenamed?.(newPath, node.path); } catch(e){} // rollback
        onRefresh();
        return;
      }
      onRefresh();
    }
  };

  const handleRenameBlur = useCallback((e: React.FocusEvent) => {
    const userClickedAway = isUserClicking;
    const relatedTarget = e.relatedTarget as Element | null;
    const wentToMonaco = relatedTarget && !!relatedTarget.closest('.monaco-editor');
    const wentToBody = relatedTarget === document.body || !relatedTarget;
    
    if (renameBlurTimeoutRef.current) clearTimeout(renameBlurTimeoutRef.current);
    renameBlurTimeoutRef.current = setTimeout(() => {
      // Focus came back naturally — do nothing.
      if (document.activeElement === renameInputRef.current) return;
      
      if (!userClickedAway && (wentToMonaco || wentToBody)) {
        // Focus stolen programmatically by Monaco during a collab sync.
        // Prevent premature rename commit, gently restore focus.
        renameInputRef.current?.focus();
        return;
      }
      
      // We only commit if it's an explicit submit (Enter key, or actually clicking away).
      // Double check that it's still renaming to avoid double-commit race condition.
      commitRename();
    }, 300);
  }, [newName, node.name, node.path]);

  // Register native-level Enter / Escape callbacks for the rename input
  useEffect(() => {
    if (!renaming) return;
    const el = renameInputRef.current;
    if (el) {
      fileTreeInputCallbacks.set(el, {
        onSubmit: () => {
          if (renameBlurTimeoutRef.current) {
            clearTimeout(renameBlurTimeoutRef.current);
            renameBlurTimeoutRef.current = null;
          }
          commitRename();
        },
        onCancel: () => {
          if (renameBlurTimeoutRef.current) {
            clearTimeout(renameBlurTimeoutRef.current);
            renameBlurTimeoutRef.current = null;
          }
          setRenaming(false);
        },
      });
    }

    // cleanup timeouts + callback registry when renaming finishes/cancels
    return () => {
      if (renameBlurTimeoutRef.current) clearTimeout(renameBlurTimeoutRef.current);
      if (el) fileTreeInputCallbacks.delete(el);
    };
  }, [renaming, newName, node.name, node.path]);

  useEffect(() => {
    if (contextMenu) {
      const handler = (e: Event) => {
        const el =
          e.target instanceof HTMLElement
            ? e.target
            : (e.target as Node).parentElement;
        if (el?.closest?.(".context-menu")) return;
        closeContextMenu();
      };
      const blurHandler = () => closeContextMenu();
      const closeHandler = () => closeContextMenu();
      window.addEventListener("mousedown", handler);
      window.addEventListener("blur", blurHandler);
      document.addEventListener("close-context-menus", closeHandler);
      return () => {
        window.removeEventListener("mousedown", handler);
        window.removeEventListener("blur", blurHandler);
        document.removeEventListener("close-context-menus", closeHandler);
      };
    }
  }, [contextMenu]);

  const isSelected = selectedNode?.path.replace(/\\/g, "/") === node.path.replace(/\\/g, "/");
  const isSelectedFile = isSelected && node.type === "file";
  const isSelectedFolder = isSelected && node.type === "directory";

  useEffect(() => {
    if (isSelectedFile && nodeRef.current) {
      setTimeout(() => {
        nodeRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }, 50);
    }
  }, [isSelectedFile]);

  return (
    <div className="tree-node-wrapper" ref={nodeRef}>
      <div
        className={`tree-node ${isSelectedFile ? "active" : ""} ${isSelectedFolder ? "selected-folder" : ""} ${isDragOver && node.type === "directory" ? "drag-over" : ""} ${isCut ? "cut-node" : ""}`}
        style={{ paddingLeft: `${depth * INDENT_PX + 8}px` }}
        draggable={!renaming}
        onDragStart={handleDragStart}
        {...(node.type === "directory" ? {
          onDragEnter: handleDragEnter,
          onDragOver: handleDragOver,
          onDragLeave: handleDragLeave,
          onDrop: handleDrop,
        } : {
          onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; },
        })}
        onKeyDown={(e) => {
          if (renaming) return;
          if (e.key.toLowerCase() === "x" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            e.stopPropagation();
            handleCut();
          } else if (e.key.toLowerCase() === "c" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            e.stopPropagation();
            handleCopy();
          } else if (e.key.toLowerCase() === "v" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            e.stopPropagation();
            handlePaste();
          } else if (e.key === "F2") {
            e.preventDefault();
            e.stopPropagation();
            startRename();
          } else if (e.key === "Delete" || e.key === "Del" || (e.metaKey && e.key === "Backspace")) {
            e.preventDefault();
            e.stopPropagation();
            handleDeleteMenuClick();
          } else if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            onSelectNode({ path: node.path, type: node.type });
            if (node.type === "file") onFileClick(node.path, node.name);
            else {
              toggleExpanded();
            }
          }
        }}
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          (e.currentTarget as HTMLElement).focus();
          onSelectNode({ path: node.path, type: node.type });
          if (node.type === "file") onFileClick(node.path, node.name);
          else {
            toggleExpanded();
          }
        }}
        onContextMenu={(e) => {
          onSelectNode({ path: node.path, type: node.type });
          handleContextMenu(e);
        }}
      >
        {hasFolders ? (
          node.type === "directory" ? (
            <span className="expand-icon">
              {expanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </span>
          ) : (
            <span className="expand-icon"></span>
          )
        ) : (
          <span className="expand-icon expand-icon-empty"></span>
        )}
        <span className="file-icon">{getIcon(node)}</span>
        {renaming ? (
          <input
            ref={renameInputRef}
            autoFocus
            className="rename-input"
            title="Rename item"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onFocus={(e) => {
              if (renameBlurTimeoutRef.current) {
                clearTimeout(renameBlurTimeoutRef.current);
                renameBlurTimeoutRef.current = null;
              }
              e.target.select();
            }}
            onBlur={handleRenameBlur}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="node-name">{node.name}</span>
        )}
      </div>

      {contextMenu &&
        createPortal(
          <div
            className="context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <div className="context-menu-item" onClick={handleNewFile}>
              <span>New File</span>
            </div>
            <div className="context-menu-item" onClick={handleNewFolder}>
              <span>New Folder</span>
            </div>
            <div className="context-menu-separator" />
            <div className="context-menu-item" onClick={handleCut}>
              <span>Cut</span>
              <span className="context-menu-shortcut">{isWindows ? "Ctrl+X" : "⌘X"}</span>
            </div>
            <div className="context-menu-item" onClick={handleCopy}>
              <span>Copy</span>
              <span className="context-menu-shortcut">{isWindows ? "Ctrl+C" : "⌘C"}</span>
            </div>
            <div
              className={`context-menu-item ${!fileClipboard ? "disabled" : ""}`}
              onClick={handlePaste}
            >
              <span>Paste</span>
              <span className="context-menu-shortcut">{isWindows ? "Ctrl+V" : "⌘V"}</span>
            </div>
            <div className="context-menu-separator" />
            <div className="context-menu-item" onClick={startRename}>
              <span>Rename</span>
              <span className="context-menu-shortcut">F2</span>
            </div>
            <div className="context-menu-separator" />
              <div className="context-menu-item danger" onClick={handleDeleteMenuClick}>
                <span>Delete</span>
                <span className="context-menu-shortcut">{isWindows ? "Del" : "⌘⌫"}</span>
              </div>
            </div>,
            document.body,
          )}

      {expanded && node.type === "directory" && (
        <div
          className="tree-children"
          onDragEnter={handleChildrenDragEnter}
          onDragOver={handleChildrenDragOver}
          onDragLeave={handleChildrenDragLeave}
          onDrop={handleChildrenDrop}
        >
          {isCreatingHere && creatingItem?.type === "folder" && (
            <InlineCreateInput
              type={creatingItem.type}
              depth={depth + 1}
              hasFolders={hasChildFolders}
              onSubmit={handleInlineCreate}
              onCancel={() => onSetCreating(null)}
            />
          )}
          {children
            .filter((c) => c.type === "directory")
            .map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                hasFolders={hasChildFolders}
                activeFilePath={activeFilePath}
                onFileClick={onFileClick}
                onRefresh={loadChildren}
                workspaceRoot={workspaceRoot}
                creatingItem={creatingItem}
                onSetCreating={onSetCreating}
                selectedNode={selectedNode}
                onSelectNode={onSelectNode}
                onFileOpened={onFileOpened}
                onFileDeleted={onFileDeleted}
                onFileRenamed={onFileRenamed}
                onFileCreated={onFileCreated}
                onFolderCreated={onFolderCreated}
                onFileCopied={onFileCopied}
                onFileMoved={onFileMoved}
                refreshTrigger={refreshTrigger}
              />
            ))}
          {isCreatingHere && creatingItem?.type === "file" && (
            <InlineCreateInput
              type={creatingItem.type}
              depth={depth + 1}
              hasFolders={hasChildFolders}
              onSubmit={handleInlineCreate}
              onCancel={() => onSetCreating(null)}
            />
          )}
          {children
            .filter((c) => c.type !== "directory")
            .map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                hasFolders={hasChildFolders}
                activeFilePath={activeFilePath}
                onFileClick={onFileClick}
                onRefresh={loadChildren}
                workspaceRoot={workspaceRoot}
                creatingItem={creatingItem}
                onSetCreating={onSetCreating}
                selectedNode={selectedNode}
                onSelectNode={onSelectNode}
                onFileOpened={onFileOpened}
                onFileDeleted={onFileDeleted}
                onFileRenamed={onFileRenamed}
                onFileCreated={onFileCreated}
                onFolderCreated={onFolderCreated}
                onFileCopied={onFileCopied}
                onFileMoved={onFileMoved}
                refreshTrigger={refreshTrigger}
              />
            ))}
        </div>
      )}
    </div>
  );
}

interface FileTreeProps {
  workspaceRoot: string | null;
  onOpenFolder: () => void;
  onFileClick: (path: string, name: string) => void;
  activeFilePath: string | null;
  autoSave: boolean;
  onAutoSaveChange: (autoSave: boolean) => void;
  onFileOpened?: (path: string, name: string, isPreview?: boolean) => void;
  newFileTrigger?: number;
  onFileDeleted?: (path: string, type: "file" | "directory") => void;
  onFileRenamed?: (oldPath: string, newPath: string) => void;
  onFileCreated?: (path: string, name: string, savedContent?: string, isUndo?: boolean) => void;
  onFolderCreated?: (path: string) => void;
  onFileCopied?: (newPath: string, type: "file" | "directory") => void;
  onFileMoved?: () => void;
  refreshTrigger?: number;
}

const FileTree = React.memo(function FileTree({
  workspaceRoot,
  onOpenFolder,
  onFileClick,
  activeFilePath,
  autoSave,
  onAutoSaveChange,
  onFileOpened,
  newFileTrigger,
  onFileDeleted,
  onFileRenamed,
  onFileCreated,
  onFolderCreated,
  onFileCopied,
  onFileMoved,
  refreshTrigger,
}: FileTreeProps) {
  const [rootNodes, setRootNodes] = useState<FileNode[]>([]);
  const [creatingItem, setCreatingItem] = useState<CreatingItem | null>(null);
  const [selectedNode, setSelectedNode] = useState<{ path: string; type: "file" | "directory" } | null>(
    workspaceRoot ? { path: workspaceRoot, type: "directory" } : null
  );
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeFilePath) {
      setSelectedNode({ path: activeFilePath, type: "file" });
    }
  }, [activeFilePath]);

  useEffect(() => {
    if (!newFileTrigger || !workspaceRoot) return;
    const pPath = selectedNode
      ? (selectedNode.type === "directory" ? selectedNode.path : selectedNode.path.split(/[/\\]/).slice(0, -1).join("/"))
      : workspaceRoot;
    setCreatingItem({
      type: "file",
      parentPath: pPath,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newFileTrigger]);

  useEffect(() => {
    if (contextMenu) {
      const handler = (e: Event) => {
        const el =
          e.target instanceof HTMLElement
            ? e.target
            : (e.target as Node).parentElement;
        if (el?.closest?.(".context-menu")) return;
        setContextMenu(null);
      };
      const blurHandler = () => setContextMenu(null);
      const closeHandler = () => setContextMenu(null);
      window.addEventListener("mousedown", handler);
      window.addEventListener("blur", blurHandler);
      document.addEventListener("close-context-menus", closeHandler);
      return () => {
        window.removeEventListener("mousedown", handler);
        window.removeEventListener("blur", blurHandler);
        document.removeEventListener("close-context-menus", closeHandler);
      };
    }
  }, [contextMenu]);



  const loadRoot = useCallback(async () => {
    if (!workspaceRoot) return;
    try {
      const items = await window.electronAPI.fs.readDirectory(workspaceRoot);
      setRootNodes(items);
    } catch (err) {
      console.warn('loadRoot failed:', err);
      // Don't clear rootNodes — keep showing stale data so UI isn't blank
    }
  }, [workspaceRoot]);

  useEffect(() => {
    loadRoot();
  }, [loadRoot]);

  useEffect(() => {
    if (typeof refreshTrigger === 'number' && refreshTrigger > 0) {
      loadRoot();
      // Wait for React to render, then close context menu and creating state
      setCreatingItem(null);
    }
  }, [refreshTrigger, loadRoot]);

  const handleSetCreating = (item: CreatingItem | null) => {
    setCreatingItem(item);
  };

  const handleRootPaste = async () => {
    setContextMenu(null);
    if (!fileClipboard || !workspaceRoot) return;

    const fileName = fileClipboard.path.substring(Math.max(fileClipboard.path.lastIndexOf("/"), fileClipboard.path.lastIndexOf("\\")) + 1);
    const newPath = `${workspaceRoot.replace(/\\/g, "/")}/${fileName}`;

    if (fileClipboard.action === "cut" && newPath === fileClipboard.path) return;

    try {
      if (fileClipboard.action === "cut") {
        // Perform disk rename FIRST, then update tabs on success
        try {
          await window.electronAPI.fs.renameItem(fileClipboard.path, newPath);
        } catch (err) {
          console.error("Paste failed at root:", err);
          return;
        }
        onFileRenamed?.(fileClipboard.path, newPath);
        fileClipboard = null;
        window.dispatchEvent(new CustomEvent("clipboard-updated"));
        onFileMoved?.();
      } else if (fileClipboard.action === "copy") {
        let finalPath = newPath;
        try {
          const resultPath = await window.electronAPI.fs.copyItem(fileClipboard.path, newPath);
          if (resultPath) finalPath = resultPath.replace(/\\/g, "/");
        } catch (err) {
          console.error("Paste copy failed at root:", err);
          return;
        }
        onFileCopied?.(finalPath, fileClipboard.type);
        onFileMoved?.();
      }
      loadRoot();
    } catch (err) {
      console.error("Paste failed at root:", err);
    }
  };

  const handleRootDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  };

  const handleRootDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/sonar-file");
    if (!data || !workspaceRoot) return;

    try {
      const source = JSON.parse(data);
      const fileName = source.path.substring(Math.max(source.path.lastIndexOf("/"), source.path.lastIndexOf("\\")) + 1);
      const newPath = `${workspaceRoot.replace(/\\/g, "/")}/${fileName}`;

      if (newPath === source.path) return;

      onFileRenamed?.(source.path, newPath);
      try {
        await window.electronAPI.fs.renameItem(source.path, newPath);
      } catch (err) {
        console.error("Drop failed at root:", err);
        onFileRenamed?.(newPath, source.path); // rollback
        return;
      }
      loadRoot();
      onFileMoved?.();
    } catch (err) {
      console.error("Drop failed at root (parse):", err);
    }
  };

  const hasRootFolders = rootNodes.some((n) => n.type === "directory");

  if (!workspaceRoot) {
    return (
      <div className="file-tree-panel">
        <div className="tree-header">
          <span className="tree-header-title">
            Explorer
          </span>
          <div className="tree-actions" />
        </div>
        <div className="empty-folder-container">
          <p className="empty-folder-text">No folder opened</p>
          <div className="empty-folder-actions">
            <button
              onClick={onOpenFolder}
              className="empty-folder-btn"
            >
              Open Folder
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="file-tree-panel"
      onClick={() => {
        if (workspaceRoot) setSelectedNode({ path: workspaceRoot, type: "directory" });
      }}
      onDragEnter={handleRootDragEnter}
      onDragOver={handleRootDragOver}
      onDrop={handleRootDrop}
      tabIndex={0}
      onKeyDown={(e) => {
        // Only handle Cmd+V at root level if the event did NOT originate
        // from within a tree-node (which has its own paste handler).
        // Without this check, keydown bubbles up and paste fires TWICE.
        if (e.key.toLowerCase() === "v" && (e.metaKey || e.ctrlKey)) {
          if ((e.target as HTMLElement).closest(".tree-node")) return;
          e.preventDefault();
          handleRootPaste();
        }
      }}
      onContextMenu={(e) => {
        // Prevent default browser context menu and only show root context if clicking dead space
        if ((e.target as HTMLElement).closest(".tree-node")) return;
        e.preventDefault();
        e.stopPropagation();
        document.dispatchEvent(new CustomEvent("close-context-menus"));
        setContextMenu({ x: e.clientX, y: e.clientY });
        if (workspaceRoot) setSelectedNode({ path: workspaceRoot, type: "directory" });
      }}
    >
      <div className="tree-header" title={workspaceRoot}>
        <span className="tree-header-title">
          {workspaceRoot.split(/[/\\]/).pop()}
        </span>
        <div className="tree-actions">
          <button
            className="tree-action-btn"
            title="New File"
            onClick={(e) => {
              e.stopPropagation();
              const pPath = selectedNode ? (selectedNode.type === "directory" ? selectedNode.path : selectedNode.path.split(/[/\\]/).slice(0, -1).join("/")) : workspaceRoot;
              setCreatingItem({
                type: "file",
                parentPath: pPath,
              });
            }}
          >
            <FilePlus2 size={18} />
          </button>
          <button
            className="tree-action-btn"
            title="New Folder"
            onClick={(e) => {
              e.stopPropagation();
              const pPath = selectedNode ? (selectedNode.type === "directory" ? selectedNode.path : selectedNode.path.split(/[/\\]/).slice(0, -1).join("/")) : workspaceRoot;
              setCreatingItem({
                type: "folder",
                parentPath: pPath,
              });
            }}
          >
            <FolderPlus size={18} />
          </button>
        </div>
      </div>
      <div className="tree-content">
        {creatingItem &&
          creatingItem.parentPath === workspaceRoot &&
          creatingItem.type === "folder" && (
            <InlineCreateInput
              type={creatingItem.type}
              depth={0}
              hasFolders={hasRootFolders}
              onSubmit={async (name) => {
                const rootNorm = workspaceRoot.replace(/\\/g, "/");
                const fullPath = `${rootNorm}/${name}`;
                // Clear creating state FIRST to prevent frozen input
                setCreatingItem(null);
                try {
                  await window.electronAPI.fs.createFolder(fullPath);
                  loadRoot();
                  onFolderCreated?.(fullPath);
                } catch (err) {
                  console.error("Failed to create folder at root:", err);
                  loadRoot();
                }
              }}
              onCancel={() => setCreatingItem(null)}
            />
          )}
        {rootNodes
          .filter((n) => n.type === "directory")
          .map((node) => (
            <FileTreeNode
              key={node.path}
              node={node}
              depth={0}
              hasFolders={hasRootFolders}
              activeFilePath={activeFilePath}
              onFileClick={onFileClick}
              onRefresh={loadRoot}
              workspaceRoot={workspaceRoot}
              creatingItem={creatingItem}
              onSetCreating={handleSetCreating}
              selectedNode={selectedNode}
              onSelectNode={setSelectedNode}
              onFileOpened={onFileOpened ?? (() => {})}
              onFileDeleted={onFileDeleted ?? (() => {})}
              onFileRenamed={onFileRenamed}
              onFileCreated={onFileCreated}
              onFolderCreated={onFolderCreated}
              onFileCopied={onFileCopied}
              onFileMoved={onFileMoved}
              refreshTrigger={refreshTrigger}
            />
          ))}
        {creatingItem &&
          creatingItem.parentPath === workspaceRoot &&
          creatingItem.type === "file" && (
            <InlineCreateInput
              type={creatingItem.type}
              depth={0}
              hasFolders={hasRootFolders}
              onSubmit={async (name) => {
                const rootNorm = workspaceRoot.replace(/\\/g, "/");
                const fullPath = `${rootNorm}/${name}`;
                // Clear creating state FIRST to prevent frozen input
                setCreatingItem(null);
                try {
                  await window.electronAPI.fs.createFile(fullPath);
                  loadRoot();
                  onFileCreated?.(fullPath, name);
                  onFileOpened?.(fullPath, name, false);
                } catch (err) {
                  console.error("Failed to create file at root:", err);
                  loadRoot();
                }
              }}
              onCancel={() => setCreatingItem(null)}
            />
          )}
        {rootNodes
          .filter((n) => n.type !== "directory")
          .map((node) => (
            <FileTreeNode
              key={node.path}
              node={node}
              depth={0}
              hasFolders={hasRootFolders}
              activeFilePath={activeFilePath}
              onFileClick={onFileClick}
              onRefresh={loadRoot}
              workspaceRoot={workspaceRoot}
              creatingItem={creatingItem}
              onSetCreating={handleSetCreating}
              selectedNode={selectedNode}
              onSelectNode={setSelectedNode}
              onFileOpened={onFileOpened ?? (() => {})}
              onFileDeleted={onFileDeleted ?? (() => {})}
              onFileRenamed={onFileRenamed}
              onFileCreated={onFileCreated}
              onFolderCreated={onFolderCreated}
              onFileCopied={onFileCopied}
              onFileMoved={onFileMoved}
              refreshTrigger={refreshTrigger}
            />
          ))}
      </div>

      {contextMenu &&
        createPortal(
          <div
            className="context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <div
              className="context-menu-item"
              onClick={() => {
                setCreatingItem({ type: "file", parentPath: workspaceRoot });
                setContextMenu(null);
              }}
            >
              <span>New File</span>
            </div>
            <div
              className="context-menu-item"
              onClick={() => {
                setCreatingItem({ type: "folder", parentPath: workspaceRoot });
                setContextMenu(null);
              }}
            >
              <span>New Folder</span>
            </div>
            <div className="context-menu-separator" />
            <div
              className={`context-menu-item ${!fileClipboard ? "disabled" : ""}`}
              onClick={handleRootPaste}
            >
              <span>Paste</span>
              <span className="context-menu-shortcut">{isWindows ? "Ctrl+V" : "⌘V"}</span>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
});

export default FileTree;
