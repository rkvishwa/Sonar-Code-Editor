<script lang="ts">
  import { Download, Monitor, ShieldAlert, WifiOff } from 'lucide-svelte';
</script>

<svelte:head>
  <title>Download | Sonar IDE</title>
</svelte:head>

<div class="px-6 py-20 lg:py-32 max-w-4xl mx-auto w-full text-center transition-colors duration-200">
  <div class="w-20 h-20 bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-blue-500/20">
    <Download size={40} />
  </div>
  
  <h1 class="text-4xl sm:text-6xl font-extrabold mb-6 tracking-tight text-zinc-900 dark:text-white">Get Sonar IDE</h1>
  <p class="text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-12">
    Download the official client to join supervised exam environments or start collaborating securely.
  </p>

  <div class="bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 rounded-3xl p-8 sm:p-12 mb-16 shadow-sm dark:shadow-none transition-colors duration-200">
    <div class="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12">
      <button class="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center space-x-3 transition-all hover:scale-105 active:scale-95">
        <Monitor size={24} />
        <div class="text-left font-sans">
          <div class="text-sm font-medium opacity-80 leading-none mb-1">Download for</div>
          <div class="text-xl leading-none">Windows</div>
        </div>
      </button>

      <button class="w-full sm:w-auto px-8 py-4 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-400 font-bold rounded-xl flex items-center justify-center space-x-3 transition-colors cursor-not-allowed">
        <Monitor size={24} />
        <div class="text-left font-sans">
          <div class="text-sm font-medium opacity-80 leading-none mb-1">Coming Soon</div>
          <div class="text-xl leading-none">macOS</div>
        </div>
      </button>
    </div>

    <div class="grid sm:grid-cols-2 gap-6 text-left border-t border-zinc-100 dark:border-white/5 pt-10">
      <div class="flex items-start space-x-4">
        <div class="w-10 h-10 rounded-lg bg-red-100 dark:bg-rose-500/10 flex items-center justify-center text-red-600 dark:text-rose-400 shrink-0">
          <ShieldAlert size={20} />
        </div>
        <div>
          <h3 class="font-bold text-zinc-900 dark:text-white mb-1">Admin Privileges Required</h3>
          <p class="text-sm text-zinc-600 dark:text-zinc-400">Sonar needs elevated access to reliably capture operating system window focus telemetry.</p>
        </div>
      </div>
      <div class="flex items-start space-x-4">
        <div class="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
          <WifiOff size={20} />
        </div>
        <div>
          <h3 class="font-bold text-zinc-900 dark:text-white mb-1">Firewall Whitelisting</h3>
          <p class="text-sm text-zinc-600 dark:text-zinc-400">Ensure Appwrite WebSocket connections are permitted through your school's network firewall.</p>
        </div>
      </div>
    </div>
  </div>

  <p class="text-zinc-500 dark:text-zinc-500 text-sm">
    Currently tracking version: <span class="font-mono text-zinc-900 dark:text-white">v1.2.0</span> • By downloading, you agree to the Academic Data Policy.
  </p>
</div>
