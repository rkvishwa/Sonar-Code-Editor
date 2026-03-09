<script lang="ts">
  import { Terminal, Code, Cpu, Github, ExternalLink } from 'lucide-svelte';
</script>

<svelte:head>
  <title>Developer | Sonar IDE</title>
</svelte:head>

<div class="px-6 py-20 lg:py-32 max-w-5xl mx-auto w-full transition-colors duration-200">
  <div class="mb-16">
    <div class="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 text-sm font-medium mb-6">
      <Terminal size={14} />
      <span>Developer Resources</span>
    </div>
    <h1 class="text-4xl sm:text-5xl font-extrabold mb-6 tracking-tight text-zinc-900 dark:text-white">Build the Future of EdTech</h1>
    <p class="text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
      Learn how Sonar IDE operates under the hood. Join us in building a more secure and collaborative exam environment.
    </p>
  </div>

  <div class="grid md:grid-cols-2 gap-8 mb-20">
    <div class="p-8 rounded-3xl bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 shadow-sm dark:shadow-none hover:border-blue-500/30 transition-colors">
      <Code size={28} class="text-blue-600 dark:text-blue-400 mb-6" />
      <h2 class="text-2xl font-bold mb-3 text-zinc-900 dark:text-white">Tech Stack</h2>
      <ul class="space-y-4 text-zinc-600 dark:text-zinc-400">
        <li class="flex items-center space-x-3">
          <div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
          <span><strong>Electron:</strong> Native OS APIs and Window Management</span>
        </li>
        <li class="flex items-center space-x-3">
          <div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
          <span><strong>React & Vite:</strong> Lightning-fast UI rendering</span>
        </li>
        <li class="flex items-center space-x-3">
          <div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
          <span><strong>Tailwind CSS v4:</strong> Utility-first styling</span>
        </li>
        <li class="flex items-center space-x-3">
          <div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
          <span><strong>Yjs & Monaco:</strong> CRDT-based real-time sync</span>
        </li>
        <li class="flex items-center space-x-3">
          <div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
          <span><strong>Appwrite:</strong> Backend-as-a-Service for sessions</span>
        </li>
      </ul>
    </div>

    <div class="p-8 rounded-3xl bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 shadow-sm dark:shadow-none hover:border-blue-500/30 transition-colors">
      <Cpu size={28} class="text-blue-600 dark:text-blue-400 mb-6" />
      <h2 class="text-2xl font-bold mb-3 text-zinc-900 dark:text-white">Core Modules</h2>
      <div class="space-y-4 text-zinc-600 dark:text-zinc-400">
        <p><strong>CollaborationManager:</strong> Handles Appwrite sockets, WebRTC, and Yjs document generation.</p>
        <p><strong>Monitoring Tracker:</strong> Hooks into system OS events using Electron IPC to watch user behavior.</p>
        <p><strong>Local Server:</strong> Embeds an Express server internally to serve project files via `localhost` only.</p>
        <p><strong>KeyShield:</strong> Abstracted secure local file system preventing tampering.</p>
      </div>
    </div>
  </div>

  <div class="p-10 rounded-3xl bg-zinc-50 dark:bg-[#121214] border border-zinc-200 dark:border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-colors duration-200">
    <div>
      <h2 class="text-2xl font-bold mb-2 text-zinc-900 dark:text-white">Open Source Repository</h2>
      <p class="text-zinc-600 dark:text-zinc-400 max-w-xl">
        Clone the application, run it locally, and start pushing pull requests. We welcome features, bug fixes, and documentation improvements.
      </p>
    </div>
    <a href="https://github.com/rkvishwa/Sonar-Code-Editor" target="_blank" rel="noreferrer" class="shrink-0 px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-[#09090b] hover:bg-zinc-800 dark:hover:bg-zinc-200 font-semibold rounded-lg transition-colors flex items-center space-x-2">
      <Github size={18} />
      <span>View on GitHub</span>
      <ExternalLink size={14} class="opacity-70 ml-1" />
    </a>
  </div>
</div>
