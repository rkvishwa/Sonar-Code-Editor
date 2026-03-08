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

// Point @monaco-editor/react at the local bundle instead of CDN.
// This is the critical fix — without it, @monaco-editor/react attempts to
// fetch Monaco from jsdelivr.net which fails on restricted networks and
// behind Electron's production CSP.
loader.config({ monaco });
