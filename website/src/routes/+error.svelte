<script lang="ts">
  import { page } from "$app/state";
  import { ArrowLeft, AlertTriangle, Bug, XCircle } from "lucide-svelte";
</script>

<svelte:head>
  <title>{page.status} - {page.error?.message || "Error"} | Sonar IDE</title>
</svelte:head>

<div class="relative isolate flex flex-grow min-h-[70vh] flex-col items-center justify-center px-4 sm:px-6">
  <!-- Decorative background -->
  <div
    class="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.1),transparent_50%)] dark:bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.15),transparent_50%)]"
  ></div>

  <!-- Main Content Box -->
  <div class="z-10 w-full max-w-2xl text-center">
    <div class="mb-8 flex justify-center">
      <div class="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-cyan-100/50 p-6 shadow-inner ring-1 ring-cyan-200/50 backdrop-blur-md dark:bg-cyan-950/30 dark:ring-cyan-800/50">
        {#if page.status === 404}
          <XCircle class="h-12 w-12 text-cyan-600 dark:text-cyan-400" strokeWidth={1.5} />
        {:else if page.status >= 500}
          <AlertTriangle class="h-12 w-12 text-cyan-600 dark:text-cyan-400" strokeWidth={1.5} />
        {:else}
          <Bug class="h-12 w-12 text-cyan-600 dark:text-cyan-400" strokeWidth={1.5} />
        {/if}
      </div>
    </div>

    <h1 class="mb-2 text-7xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-8xl">
      {page.status}
    </h1>

    <h2 class="mb-4 text-2xl font-semibold text-zinc-800 dark:text-zinc-200 sm:text-3xl">
      {#if page.status === 404}
        Page Not Found
      {:else if page.status === 510}
        Not Extended
      {:else}
        Oops! Something went wrong
      {/if}
    </h2>

    <p class="mx-auto mb-10 max-w-xl text-base text-zinc-600 dark:text-zinc-400 sm:text-lg sm:leading-relaxed">
      {page.error?.message || "An unexpected error occurred."}
    </p>

    <!-- Actions -->
    <div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
      <a
        href="/"
        class="group flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 transition-all hover:-translate-y-0.5 hover:bg-cyan-500 dark:bg-cyan-500 dark:shadow-cyan-900/30 dark:hover:bg-cyan-400 sm:w-auto"
      >
        <ArrowLeft class="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        Return Home
      </a>
      
      <a
        href="/contact"
        class="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white/50 px-6 py-3 text-sm font-semibold text-zinc-700 backdrop-blur-md transition-all hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300 dark:hover:bg-zinc-800 sm:w-auto"
      >
        Contact Support
      </a>
    </div>
  </div>
</div>
