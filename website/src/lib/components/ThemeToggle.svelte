<script lang="ts">
  import { Sun, Moon, Monitor } from 'lucide-svelte';
  import { onMount } from 'svelte';

  let currentTheme = 'system';
  let isOpen = false;

  function updateTheme(theme: string) {
    currentTheme = theme;
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
    } else {
      localStorage.removeItem('theme');
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
    isOpen = false;
  }

  onMount(() => {
    if (localStorage.theme === 'dark') {
      currentTheme = 'dark';
    } else if (localStorage.theme === 'light') {
      currentTheme = 'light';
    } else {
      currentTheme = 'system';
    }

    // Optional: listen for system theme changes if set to system
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (currentTheme === 'system') {
        if (e.matches) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    });
  });

  function toggleMenu() {
    isOpen = !isOpen;
  }

  // Click outside to close
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.theme-toggle-container')) {
      isOpen = false;
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<div class="relative theme-toggle-container">
  <button 
    onclick={toggleMenu}
    class="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
    aria-label="Toggle theme"
  >
    {#if currentTheme === 'light'}
      <Sun size={20} />
    {:else if currentTheme === 'dark'}
      <Moon size={20} />
    {:else}
      <Monitor size={20} />
    {/if}
  </button>

  {#if isOpen}
    <div class="absolute right-0 mt-2 w-36 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl shadow-lg shadow-black/5 z-50">
      <button 
        class="w-full px-4 py-2 text-left text-sm flex items-center space-x-2 {currentTheme === 'light' ? 'text-blue-500 font-medium' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5'} transition-colors"
        onclick={() => updateTheme('light')}
      >
        <Sun size={16} />
        <span>Light</span>
      </button>
      <button 
        class="w-full px-4 py-2 text-left text-sm flex items-center space-x-2 {currentTheme === 'dark' ? 'text-blue-500 font-medium' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5'} transition-colors"
        onclick={() => updateTheme('dark')}
      >
        <Moon size={16} />
        <span>Dark</span>
      </button>
      <button 
        class="w-full px-4 py-2 text-left text-sm flex items-center space-x-2 {currentTheme === 'system' ? 'text-blue-500 font-medium' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5'} transition-colors"
        onclick={() => updateTheme('system')}
      >
        <Monitor size={16} />
        <span>System</span>
      </button>
    </div>
  {/if}
</div>
