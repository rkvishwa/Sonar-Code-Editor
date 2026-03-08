/**
 * Configure @monaco-editor/react to use the locally bundled monaco-editor
 * instead of fetching from CDN.  This ensures the editor loads on machines
 * without internet access (e.g. exam-room Windows clients) and avoids CSP
 * issues in the production Electron build.
 *
 * Must be imported BEFORE any <MonacoEditor /> component is rendered.
 */
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

// Vite worker imports — Vite handles bundling these as separate worker scripts.
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

// Tell Monaco how to create web workers from the Vite-bundled assets.
self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === "json") return new jsonWorker();
    if (label === "css" || label === "scss" || label === "less")
      return new cssWorker();
    if (label === "html" || label === "handlebars" || label === "razor")
      return new htmlWorker();
    if (label === "typescript" || label === "javascript") return new tsWorker();
    return new editorWorker();
  },
};

// Point @monaco-editor/react at the local bundle instead of CDN.
loader.config({ monaco });
