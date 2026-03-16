<script lang="ts">
  import { onMount } from "svelte";
  import Download from "lucide-svelte/icons/download";
  import Monitor from "lucide-svelte/icons/monitor";
  import ShieldAlert from "lucide-svelte/icons/shield-alert";
  import Wifi from "lucide-svelte/icons/wifi";
  import Link2 from "lucide-svelte/icons/link-2";
  import Copy from "lucide-svelte/icons/copy";
  import Check from "lucide-svelte/icons/check";
  import Terminal from "lucide-svelte/icons/terminal";

  type ClientOS = "windows" | "mac" | "other";

  let clientOS = $state<ClientOS>("other");
  let linkCopied = $state(false);
  let updateLinkCopied = $state(false);
  const macInstallCommand = "brew install --cask rkvishwa/knurdz/sonar-code-editor";
  const macUpdateCommand = "brew upgrade --cask rkvishwa/knurdz/sonar-code-editor";

  function copyMacLink() {
    navigator.clipboard.writeText(macInstallCommand).then(() => {
      linkCopied = true;
      setTimeout(() => {
        linkCopied = false;
      }, 2000);
    });
  }

  function copyUpdateLink() {
    navigator.clipboard.writeText(macUpdateCommand).then(() => {
      updateLinkCopied = true;
      setTimeout(() => {
        updateLinkCopied = false;
      }, 2000);
    });
  }

  onMount(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("windows")) {
      clientOS = "windows";
    } else if (ua.includes("macintosh") || ua.includes("mac os x")) {
      clientOS = "mac";
    } else {
      clientOS = "other";
    }
  });
</script>

<svelte:head>
  <title>Download | Sonar IDE</title>
  <meta name="description" content="Download Sonar IDE for Windows, macOS, and Linux. Get the official client for supervised exam environments and secure code collaboration." />
  <meta property="og:title" content="Download | Sonar IDE" />
  <meta property="og:description" content="Download Sonar IDE for Windows, macOS, and Linux. Get the official client for supervised exam environments and secure code collaboration." />
  <meta property="og:image" content="/favicon.png" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<div
  class="px-6 py-20 lg:py-32 max-w-4xl mx-auto w-full text-center transition-colors duration-200"
>
  <div
    class="w-20 h-20 bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-blue-500/20"
  >
    <Download size={40} />
  </div>

  <h1
    class="text-4xl sm:text-6xl font-extrabold mb-6 tracking-tight text-zinc-900 dark:text-white"
  >
    Get Sonar IDE
  </h1>
  <p class="text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-12">
    Download the official client to join supervised exam environments or start
    collaborating securely.
  </p>

  <div
    class="bg-white dark:bg-white/2 border border-zinc-200 dark:border-white/5 rounded-3xl p-8 sm:p-12 mb-16 shadow-sm dark:shadow-none transition-colors duration-200"
  >
    <div class="flex flex-col items-center justify-center gap-4 mb-12">
      {#if clientOS === "mac"}
        <div
          class="w-full max-w-2xl rounded-2xl border border-zinc-200/50 dark:border-white/10 bg-black/5 dark:bg-black/20 backdrop-blur-md p-6 sm:p-8 flex flex-col items-center gap-6 shadow-sm"
        >
          <div class="w-full">
            <label
              for="download-mac-link"
              class="mb-3 text-[11px] uppercase tracking-[0.2em] font-semibold text-cyan-600 dark:text-cyan-400 justify-center flex items-center gap-2"
            >
              <Terminal size={14} />
              <span>macOS Install Command</span>
            </label>
            <div
              class="rounded-xl border border-zinc-200/80 dark:border-white/10 bg-white/50 dark:bg-white/5 p-1.5 backdrop-blur-md flex items-center shadow-sm transition-colors hover:border-zinc-300 dark:hover:border-white/20"
            >
              <div class="flex items-center flex-1 min-w-0 pl-3">
                <span class="text-zinc-500 font-mono mr-2 shrink-0">$</span>
                <input
                  id="download-mac-link"
                  type="text"
                  value={macInstallCommand}
                  readonly
                  onclick={(event) =>
                    (event.currentTarget as HTMLInputElement).select()}
                  class="bg-transparent text-sm font-mono text-zinc-700 dark:text-zinc-300 w-full outline-none truncate cursor-copy selection:bg-cyan-500/20"
                />
              </div>
              <button
                onclick={copyMacLink}
                aria-label="Copy command"
                class="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-all cursor-pointer
                  {linkCopied
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400'}"
              >
                {#if linkCopied}
                  <Check size={14} />
                {:else}
                  <Copy size={14} />
                {/if}
              </button>
            </div>
            <p
              class="mt-3 text-xs text-zinc-600 dark:text-zinc-400 text-center"
            >
              Run this command in your terminal using Homebrew.
            </p>
          </div>

          <div class="w-full">
            <label
              for="mac-update-link"
              class="mb-3 text-xs text-zinc-500 dark:text-zinc-400 font-medium justify-center flex items-center"
              >Already installed an older version?&nbsp;<span
                class="text-cyan-600 dark:text-cyan-400">Update here:</span
              ></label
            >
            <div
              class="rounded-xl border border-zinc-200/80 dark:border-white/10 bg-white/50 dark:bg-white/5 p-1.5 backdrop-blur-md flex items-center shadow-sm transition-colors hover:border-zinc-300 dark:hover:border-white/20"
            >
              <div class="flex items-center flex-1 min-w-0 pl-3">
                <span class="text-zinc-500 font-mono mr-2 shrink-0">$</span>
                <input
                  id="mac-update-link"
                  type="text"
                  value={macUpdateCommand}
                  readonly
                  onclick={(event) =>
                    (event.currentTarget as HTMLInputElement).select()}
                  class="bg-transparent text-sm font-mono text-zinc-700 dark:text-zinc-300 w-full outline-none truncate cursor-copy selection:bg-cyan-500/20"
                />
              </div>
              <button
                onclick={copyUpdateLink}
                aria-label="Copy update link"
                class="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-all cursor-pointer
                  {updateLinkCopied
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400'}"
              >
                {#if updateLinkCopied}
                  <Check size={14} />
                {:else}
                  <Copy size={14} />
                {/if}
              </button>
            </div>
          </div>
        </div>
      {:else}
        <a
          href="/windows/download"
          class="group relative overflow-hidden w-full sm:w-auto px-8 py-3.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold rounded-xl shadow-lg shadow-zinc-900/10 dark:shadow-white/10 hover:shadow-cyan-500/25 dark:hover:shadow-cyan-400/25 border border-transparent dark:border-white/5 flex items-center justify-center gap-3 text-lg transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
        >
          <!-- Expanding Pattern Fill Background -->
          <div class="absolute inset-0 flex items-center justify-center z-0 pointer-events-none overflow-hidden rounded-xl">
            <div class="w-[120%] aspect-square bg-cyan-600 dark:bg-cyan-500 rounded-full scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-500 ease-out flex items-center justify-center origin-center">
              <div class="absolute inset-0 opacity-20 pattern-dots"></div>
            </div>
          </div>
          
          <div class="relative z-10 flex items-center gap-3 transition-all duration-300 group-hover:scale-[1.02] text-white dark:text-zinc-900 group-hover:text-white dark:group-hover:text-white font-semibold">
            <Download size={20} class="group-hover:-translate-y-[1px] transition-transform duration-300" />
            <span class="text-lg">Download for Windows</span>
          </div>
        </a>
        <p class="text-xs text-zinc-600 dark:text-zinc-400 mt-2">
          Allow permission in your browser to download the file.
        </p>
      {/if}
    </div>

    <div
      class="grid sm:grid-cols-2 gap-6 text-left border-t border-zinc-100 dark:border-white/5 pt-10"
    >
      <div class="flex items-start space-x-4">
        <div
          class="w-10 h-10 rounded-lg bg-red-100 dark:bg-rose-500/10 flex items-center justify-center text-red-600 dark:text-rose-400 shrink-0"
        >
          <ShieldAlert size={20} />
        </div>
        <div>
          <h3 class="font-bold text-zinc-900 dark:text-white mb-1">
            Monitoring Permission Required
          </h3>
          <p class="text-sm text-zinc-600 dark:text-zinc-400">
            Required monitoring permission to access the app.
          </p>
        </div>
      </div>
      <div class="flex items-start space-x-4">
        <div
          class="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0"
        >
          <Wifi size={20} />
        </div>
        <div>
          <h3 class="font-bold text-zinc-900 dark:text-white mb-1">
            Local Network Permission
          </h3>
          <p class="text-sm text-zinc-600 dark:text-zinc-400">
            Also need local network permission to collaborate. Not mandatory if not collaborating.
          </p>
        </div>
      </div>
    </div>
  </div>

  <p class="text-zinc-500 dark:text-zinc-500 text-sm">
    Currently tracking version: <span
      class="font-mono text-zinc-900 dark:text-white">v1.2.0</span
    > • By downloading, you agree to the Academic Data Policy.
  </p>
</div>

<style>
  /* --- Button Pattern Fill --- */
  .pattern-dots {
    background-image: radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px);
    background-size: 10px 10px;
  }
</style>
