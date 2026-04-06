import React, { useEffect } from "react";
import {
  FileTree as JackFileTree,
  updateFileTreeClipboardPath,
  type FileTreeItemType,
} from "@knurdz/jack-file-tree";
import "./FileTree.css";

const LEGACY_CLOSE_CONTEXT_MENUS_EVENT = "close-context-menus";
const PACKAGE_CLOSE_CONTEXT_MENUS_EVENT = "jack-file-tree:close-context-menus";

export function updateFileClipboardPath(oldPath: string, newPath: string): void {
  updateFileTreeClipboardPath(oldPath, newPath);
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
  onFileDeleted?: (path: string, type: FileTreeItemType, skipBroadcast?: boolean) => void;
  onFileRenamed?: (oldPath: string, newPath: string) => void;
  onFileCreated?: (path: string, name: string, savedContent?: string, isUndo?: boolean) => void;
  onFolderCreated?: (path: string) => void;
  onFileCopied?: (newPath: string, type: FileTreeItemType) => void;
  onFileMoved?: () => void;
  refreshTrigger?: number;
}

const FileTree = React.memo(function FileTree({
  workspaceRoot,
  onOpenFolder,
  onFileClick,
  activeFilePath,
  autoSave: _autoSave,
  onAutoSaveChange: _onAutoSaveChange,
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
  useEffect(() => {
    const forwardLegacyCloseContextMenus = () => {
      document.dispatchEvent(new CustomEvent(PACKAGE_CLOSE_CONTEXT_MENUS_EVENT));
    };

    document.addEventListener(
      LEGACY_CLOSE_CONTEXT_MENUS_EVENT,
      forwardLegacyCloseContextMenus,
    );

    return () => {
      document.removeEventListener(
        LEGACY_CLOSE_CONTEXT_MENUS_EVENT,
        forwardLegacyCloseContextMenus,
      );
    };
  }, []);

  return (
    <JackFileTree
      className="sonar-file-tree"
      fs={window.electronAPI.fs}
      workspaceRoot={workspaceRoot}
      onOpenFolder={onOpenFolder}
      onFileClick={onFileClick}
      activeFilePath={activeFilePath}
      onFileOpened={onFileOpened}
      newFileTrigger={newFileTrigger}
      onFileDeleted={onFileDeleted}
      onFileRenamed={onFileRenamed}
      onFileCreated={onFileCreated}
      onFolderCreated={onFolderCreated}
      onFileCopied={onFileCopied}
      onFileMoved={onFileMoved}
      refreshTrigger={refreshTrigger}
    />
  );
});

export default FileTree;
