<script lang="ts">
	import { 
		ShieldAlert, 
		Activity, 
		Users, 
		Code2, 
		ChevronRight, 
		Eye, 
		Lock,
		FileBox,
		Download,
		Terminal,
		Zap,
		ArrowRight,
		Monitor,
		Sparkles
	} from 'lucide-svelte';
	import { onMount } from 'svelte';

	let mounted = $state(false);
	onMount(() => { mounted = true; });
</script>

<svelte:head>
	<title>Sonar IDE | Supervised Coding & Exam Environment</title>
	<meta name="description" content="A real-time collaborative code editor built for supervised teams, featuring advanced activity monitoring and strict local environments." />
</svelte:head>

<!-- Hero Section -->
<section class="relative flex flex-col items-center justify-center text-center px-4 pt-28 sm:pt-36 xl:pt-44 pb-20 overflow-hidden min-h-screen">
	
	<!-- Grid pattern background -->
	<div class="absolute inset-0 -z-20 opacity-[0.025] dark:opacity-[0.04]" style="background-image: linear-gradient(rgba(59,130,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.5) 1px, transparent 1px); background-size: 60px 60px;"></div>
	
	<!-- Radial fade mask -->
	<div class="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_20%,var(--mask-color)_75%)]" style="--mask-color: white;" class:dark-mask={true}></div>

	<!-- Sonar Radar -->
	<div class="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] sm:w-[800px] sm:h-[800px] pointer-events-none -z-10">
		<!-- Static rings -->
		<div class="absolute inset-0 flex items-center justify-center">
			<div class="absolute w-[120px] h-[120px] rounded-full border border-blue-500/[0.07] dark:border-blue-400/[0.12]"></div>
			<div class="absolute w-[240px] h-[240px] rounded-full border border-blue-500/[0.06] dark:border-blue-400/[0.10]"></div>
			<div class="absolute w-[360px] h-[360px] rounded-full border border-blue-500/[0.05] dark:border-blue-400/[0.08]"></div>
			<div class="absolute w-[480px] h-[480px] rounded-full border border-blue-500/[0.04] dark:border-blue-400/[0.06]"></div>
			<div class="absolute w-[600px] h-[600px] rounded-full border border-blue-500/[0.03] dark:border-blue-400/[0.04]"></div>
		</div>
		<!-- Crosshair lines -->
		<div class="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/[0.06] to-transparent dark:via-blue-400/[0.10]"></div>
		<div class="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-blue-500/[0.06] to-transparent dark:via-blue-400/[0.10]"></div>
		<!-- Sweep arm -->
		<div class="absolute inset-0 flex items-center justify-center">
			<div class="absolute w-full h-full animate-sweep origin-center">
				<div class="absolute top-1/2 left-1/2 w-[48%] h-[1px] origin-left bg-gradient-to-r from-blue-500/50 via-blue-400/20 to-transparent dark:from-blue-400/60 dark:via-blue-400/25"></div>
				<!-- Sweep trail (conic gradient) -->
				<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full rounded-full" style="background: conic-gradient(from 0deg, transparent 0deg, rgba(59,130,246,0.06) 0deg, transparent 30deg);"></div>
			</div>
		</div>
		<!-- Ping ripples -->
		<div class="absolute inset-0 flex items-center justify-center">
			<div class="absolute w-8 h-8 rounded-full border border-blue-400/50 dark:border-blue-400/60 animate-ping-out" style="animation-delay: 0s;"></div>
			<div class="absolute w-8 h-8 rounded-full border border-cyan-400/40 dark:border-cyan-400/50 animate-ping-out" style="animation-delay: 2s;"></div>
			<div class="absolute w-8 h-8 rounded-full border border-blue-400/30 dark:border-blue-400/40 animate-ping-out" style="animation-delay: 4s;"></div>
		</div>
		<!-- Blips on the radar (scattered dots) -->
		<div class="absolute top-[30%] left-[62%] w-1.5 h-1.5 rounded-full bg-blue-400/60 dark:bg-blue-400/80 animate-blip" style="animation-delay: 1s;"></div>
		<div class="absolute top-[55%] left-[28%] w-1 h-1 rounded-full bg-cyan-400/50 dark:bg-cyan-400/70 animate-blip" style="animation-delay: 3s;"></div>
		<div class="absolute top-[38%] left-[40%] w-1.5 h-1.5 rounded-full bg-blue-400/40 dark:bg-blue-400/60 animate-blip" style="animation-delay: 5s;"></div>
		<!-- Center dot -->
		<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
			<div class="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 shadow-[0_0_12px_3px_rgba(59,130,246,0.3)] dark:shadow-[0_0_12px_3px_rgba(96,165,250,0.4)]"></div>
		</div>
		<!-- Ambient glow -->
		<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-500/[0.03] dark:bg-blue-500/[0.06] rounded-full blur-[80px]"></div>
	</div>
	
	<!-- Hero Content -->
	<div class="relative z-10 flex flex-col items-center" class:animate-hero-in={mounted}>
		<!-- Top pill badge -->
		<div class="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-blue-50/80 dark:bg-blue-500/[0.08] border border-blue-200/50 dark:border-blue-400/[0.12] text-blue-600 dark:text-blue-400 text-[13px] font-medium mb-8 backdrop-blur-sm hero-stagger-1">
			<Sparkles size={13} class="opacity-80" />
			<span>Open-source supervised coding</span>
		</div>

		<!-- Logo mark -->
		<div class="mb-6 hero-stagger-2">
			<div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 dark:from-blue-400 dark:to-cyan-400 flex items-center justify-center shadow-xl shadow-blue-500/20 dark:shadow-blue-400/20">
				<img src="/favicon.png" alt="Sonar Icon" class="w-10 h-10 sm:w-12 sm:h-12 brightness-0 invert" />
			</div>
		</div>

		<!-- Heading -->
		<h1 class="text-[2.5rem] sm:text-6xl lg:text-7xl font-bold tracking-tight max-w-3xl mx-auto leading-[1.1] text-zinc-900 dark:text-white mb-5 hero-stagger-3">
			The IDE built for
			<span class="relative whitespace-nowrap">
				<span class="relative text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 dark:from-blue-400 dark:via-cyan-400 dark:to-blue-400 animate-gradient bg-[length:200%_auto]">
					supervision
				</span>
			</span>
		</h1>
		
		<!-- Subtitle -->
		<p class="text-base sm:text-lg text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-10 leading-relaxed hero-stagger-4">
			Real-time collaboration, exam monitoring, and secure coding — powered by Monaco and Electron.
		</p>
		
		<!-- CTA buttons -->
		<div class="flex flex-col sm:flex-row items-center gap-3 hero-stagger-5">
			<a href="/download" class="group w-full sm:w-auto px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 font-semibold rounded-lg shadow-lg shadow-zinc-900/10 dark:shadow-white/10 flex items-center justify-center gap-2 text-sm transition-all hover:-translate-y-0.5 active:translate-y-0">
				<Download size={15} />
				<span>Download for Windows</span>
			</a>
			<a href="/docs" class="group w-full sm:w-auto px-6 py-2.5 bg-white/70 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.1] backdrop-blur-md text-zinc-700 dark:text-zinc-300 font-medium rounded-lg flex items-center justify-center gap-2 border border-zinc-200/80 dark:border-white/[0.08] text-sm transition-all hover:-translate-y-0.5 active:translate-y-0 hover:shadow-sm">
				<span>Read Docs</span>
				<ArrowRight size={14} class="opacity-50 group-hover:translate-x-0.5 transition-transform" />
			</a>
		</div>
	</div>

	<!-- Dashboard Preview -->
	<div class="mt-20 sm:mt-28 max-w-4xl w-full relative z-10" class:animate-float-in={mounted}>
		<div class="absolute -inset-px bg-gradient-to-b from-blue-500/20 via-transparent to-transparent rounded-2xl"></div>
		<div class="absolute -inset-4 bg-gradient-to-b from-blue-500/[0.07] to-transparent rounded-3xl blur-2xl"></div>
		<div class="relative bg-white dark:bg-[#111113] rounded-xl border border-zinc-200/80 dark:border-white/[0.08] shadow-2xl shadow-zinc-300/40 dark:shadow-none overflow-hidden">
			<!-- Window chrome -->
			<div class="h-10 bg-zinc-50 dark:bg-[#1a1a1d] border-b border-zinc-200/80 dark:border-white/[0.06] flex items-center justify-between px-4">
				<div class="flex gap-1.5">
					<div class="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700"></div>
					<div class="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700"></div>
					<div class="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700"></div>
				</div>
				<div class="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono tracking-wider flex items-center gap-1.5 uppercase">
					<Activity size={10} class="text-blue-500" />
					<span>Sonar — Admin Dashboard</span>
				</div>
				<div class="w-14"></div>
			</div>
			<!-- Body -->
			<div class="h-[320px] sm:h-[360px] flex">
				<!-- Sidebar -->
				<div class="w-44 border-r border-zinc-100 dark:border-white/[0.05] p-3 space-y-1 hidden sm:block bg-zinc-50/50 dark:bg-transparent">
					<div class="flex items-center gap-2.5 text-[13px] text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-500/10 px-2.5 py-2 rounded-lg">
						<Activity size={14} /> <span>Live Session</span>
					</div>
					<div class="flex items-center gap-2.5 text-[13px] text-zinc-500 dark:text-zinc-400 px-2.5 py-2 rounded-lg">
						<Users size={14} /> <span>Users (12)</span>
					</div>
					<div class="flex items-center gap-2.5 text-[13px] text-zinc-500 dark:text-zinc-400 px-2.5 py-2 rounded-lg">
						<Eye size={14} /> <span>Logs</span>
					</div>
					<div class="flex items-center gap-2.5 text-[13px] text-zinc-500 dark:text-zinc-400 px-2.5 py-2 rounded-lg">
						<ShieldAlert size={14} /> <span>Alerts</span>
					</div>
				</div>
				<!-- Feed -->
				<div class="flex-1 p-5 sm:p-6 font-mono text-xs sm:text-[13px] text-left overflow-hidden">
					<div class="flex justify-between items-center mb-5 pb-3 border-b border-zinc-100 dark:border-white/[0.05]">
						<div class="text-zinc-800 dark:text-white font-semibold text-sm">Activity Feed</div>
						<div class="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded text-[10px] font-medium border border-emerald-100 dark:border-emerald-500/20">
							<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
							Recording
						</div>
					</div>
					<div class="space-y-3 text-zinc-600 dark:text-zinc-400">
						<div class="flex gap-3 items-center animate-feed-line" style="animation-delay:0.2s"><span class="text-zinc-400 dark:text-zinc-600 shrink-0">[10:42:01]</span> <span class="text-zinc-800 dark:text-white font-medium">user_2</span> <span class="truncate">joined session <code class="text-blue-600 dark:text-blue-400">'exam_A1'</code></span></div>
						<div class="flex gap-3 items-center animate-feed-line" style="animation-delay:0.4s"><span class="text-zinc-400 dark:text-zinc-600 shrink-0">[10:42:15]</span> <span class="text-zinc-800 dark:text-white font-medium">user_2</span> <span class="truncate">typing in <code class="text-blue-600 dark:text-blue-400">src/main.ts</code></span></div>
						<div class="flex gap-3 items-center text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1.5 rounded-md border border-amber-100 dark:border-amber-500/20 -mx-1 animate-feed-line" style="animation-delay:0.6s"><span class="text-amber-400 dark:text-amber-500/60 shrink-0">[10:43:05]</span> <span class="font-medium">user_4</span> <span class="truncate">⚠ window defocus (3s)</span></div>
						<div class="flex gap-3 items-center text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-2.5 py-1.5 rounded-md border border-rose-100 dark:border-rose-500/20 -mx-1 animate-feed-line" style="animation-delay:0.8s"><span class="text-rose-400 dark:text-rose-500/60 shrink-0">[10:44:12]</span> <span class="font-medium">user_1</span> <span class="truncate">🚨 unauthorized paste</span></div>
						<div class="flex gap-3 items-center opacity-50 animate-feed-line" style="animation-delay:1s"><span class="text-zinc-400 dark:text-zinc-600 shrink-0">[10:45:00]</span> <span class="truncate">Exporting log to PDF…</span></div>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>

<!-- Stats strip -->
<section class="relative py-12 border-y border-zinc-100 dark:border-white/[0.04] bg-zinc-50/50 dark:bg-white/[0.015]">
	<div class="container mx-auto px-6">
		<div class="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto text-center">
			<div>
				<div class="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-1">100%</div>
				<div class="text-sm text-zinc-500 dark:text-zinc-400">Offline capable</div>
			</div>
			<div>
				<div class="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-1">Yjs</div>
				<div class="text-sm text-zinc-500 dark:text-zinc-400">CRDT sync engine</div>
			</div>
			<div>
				<div class="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-1">MIT</div>
				<div class="text-sm text-zinc-500 dark:text-zinc-400">Open source</div>
			</div>
			<div>
				<div class="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-1">&lt;50ms</div>
				<div class="text-sm text-zinc-500 dark:text-zinc-400">Collab latency</div>
			</div>
		</div>
	</div>
</section>

<!-- Features Section -->
<section class="py-24 sm:py-32 relative">
	<div class="container mx-auto px-6">
		<div class="text-center mb-16">
			<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/[0.08] text-blue-600 dark:text-blue-400 text-xs font-semibold uppercase tracking-wider mb-4 border border-blue-100 dark:border-blue-500/[0.15]">
				<Zap size={12} />
				Features
			</div>
			<h2 class="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white tracking-tight mb-4">Everything you need for secure coding</h2>
			<p class="text-zinc-500 dark:text-zinc-400 text-base sm:text-lg max-w-xl mx-auto">A comprehensive toolkit built from the ground up for monitored exam sessions and collaborative development.</p>
		</div>
		
		<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
			<!-- Card 1 -->
			<div class="group relative p-6 rounded-2xl bg-white dark:bg-white/[0.03] border border-zinc-100 dark:border-white/[0.06] hover:border-blue-200 dark:hover:border-blue-500/20 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/[0.04]">
				<div class="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4 group-hover:scale-110 transition-transform">
					<ShieldAlert size={20} strokeWidth={1.8} />
				</div>
				<h3 class="text-base font-semibold mb-2 text-zinc-900 dark:text-white">Activity Monitoring</h3>
				<p class="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
					Tracks keystrokes, focus changes, and clipboard events. Auto-generates PDF reports.
				</p>
			</div>
			
			<!-- Card 2 -->
			<div class="group relative p-6 rounded-2xl bg-white dark:bg-white/[0.03] border border-zinc-100 dark:border-white/[0.06] hover:border-blue-200 dark:hover:border-blue-500/20 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/[0.04]">
				<div class="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center text-violet-600 dark:text-violet-400 mb-4 group-hover:scale-110 transition-transform">
					<Users size={20} strokeWidth={1.8} />
				</div>
				<h3 class="text-base font-semibold mb-2 text-zinc-900 dark:text-white">Yjs Collaboration</h3>
				<p class="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
					Google Docs-style live editing with shared cursors and conflict-free data types.
				</p>
			</div>
			
			<!-- Card 3 -->
			<div class="group relative p-6 rounded-2xl bg-white dark:bg-white/[0.03] border border-zinc-100 dark:border-white/[0.06] hover:border-cyan-200 dark:hover:border-cyan-500/20 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/[0.04]">
				<div class="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 flex items-center justify-center text-cyan-600 dark:text-cyan-400 mb-4 group-hover:scale-110 transition-transform">
					<Lock size={20} strokeWidth={1.8} />
				</div>
				<h3 class="text-base font-semibold mb-2 text-zinc-900 dark:text-white">Secured Preview</h3>
				<p class="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
					Integrated browser restricts traffic to <code class="text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 px-1 py-0.5 rounded text-xs">localhost</code> only.
				</p>
			</div>

			<!-- Card 4 -->
			<div class="group relative p-6 rounded-2xl bg-white dark:bg-white/[0.03] border border-zinc-100 dark:border-white/[0.06] hover:border-amber-200 dark:hover:border-amber-500/20 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/[0.04]">
				<div class="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 group-hover:scale-110 transition-transform">
					<Code2 size={20} strokeWidth={1.8} />
				</div>
				<h3 class="text-base font-semibold mb-2 text-zinc-900 dark:text-white">Monaco Editor</h3>
				<p class="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
					VS Code's editor engine with syntax highlighting, auto-complete, and formatting.
				</p>
			</div>

			<!-- Card 5 -->
			<div class="group relative p-6 rounded-2xl bg-white dark:bg-white/[0.03] border border-zinc-100 dark:border-white/[0.06] hover:border-emerald-200 dark:hover:border-emerald-500/20 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/[0.04]">
				<div class="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
					<FileBox size={20} strokeWidth={1.8} />
				</div>
				<h3 class="text-base font-semibold mb-2 text-zinc-900 dark:text-white">Key Shield Storage</h3>
				<p class="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
					Isolated local directories protected by Key Shield within the Electron process.
				</p>
			</div>

			<!-- Card 6 — CTA -->
			<a href="/docs" class="group relative p-6 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-800 dark:from-white dark:to-zinc-100 border border-transparent flex flex-col justify-center items-center text-center cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5">
				<div class="w-10 h-10 rounded-xl bg-white/10 dark:bg-black/5 flex items-center justify-center text-white dark:text-zinc-900 mb-4 group-hover:scale-110 transition-transform">
					<Terminal size={20} strokeWidth={1.8} />
				</div>
				<h3 class="text-base font-semibold text-white dark:text-zinc-900 mb-1">Explore Architecture</h3>
				<span class="text-xs text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
					View docs <ArrowRight size={11} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
		</div>
	</div>
</section>

<!-- Bottom CTA -->
<section class="py-20 sm:py-24 relative overflow-hidden">
	<div class="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/[0.02] to-transparent dark:via-blue-500/[0.04]"></div>
	<div class="container mx-auto px-6 text-center relative z-10">
		<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/[0.08] text-blue-600 dark:text-blue-400 text-xs font-semibold uppercase tracking-wider mb-5 border border-blue-100 dark:border-blue-500/[0.15]">
			<Monitor size={12} />
			Get Started
		</div>
		<h2 class="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white tracking-tight mb-4">Ready to secure your coding sessions?</h2>
		<p class="text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-8 text-base">Download Sonar IDE and set up supervised exams or collaborative workspaces in minutes.</p>
		<div class="flex flex-col sm:flex-row items-center justify-center gap-3">
			<a href="/download" class="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold rounded-lg shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 text-sm transition-all hover:-translate-y-0.5 active:translate-y-0">
				<Download size={15} />
				Download Now
			</a>
			<a href="https://github.com/rkvishwa/Sonar-Code-Editor" target="_blank" rel="noreferrer" class="w-full sm:w-auto px-6 py-2.5 bg-white/70 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 font-medium rounded-lg flex items-center justify-center gap-2 border border-zinc-200/80 dark:border-white/[0.08] text-sm transition-all hover:-translate-y-0.5 active:translate-y-0 hover:shadow-sm">
				Star on GitHub
				<ArrowRight size={14} class="opacity-50" />
			</a>
		</div>
	</div>
</section>

<style>
	/* --- Dark mask override --- */
	:global(.dark) .dark-mask {
		--mask-color: #09090b;
	}

	/* --- Radar sweep --- */
	@keyframes sweep {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
	.animate-sweep {
		animation: sweep 5s linear infinite;
	}

	/* --- Sonar ping --- */
	@keyframes ping-out {
		0% { transform: scale(1); opacity: 0.7; }
		100% { transform: scale(14); opacity: 0; }
	}
	.animate-ping-out {
		animation: ping-out 4s cubic-bezier(0, 0, 0.2, 1) infinite;
	}

	/* --- Blip --- */
	@keyframes blip {
		0%, 100% { opacity: 0; transform: scale(0); }
		10% { opacity: 1; transform: scale(1); }
		30% { opacity: 1; transform: scale(1); }
		50% { opacity: 0; transform: scale(0); }
	}
	.animate-blip {
		animation: blip 6s ease-in-out infinite;
	}

	/* --- Gradient text --- */
	@keyframes gradient-move {
		0%, 100% { background-position: 0% 50%; }
		50% { background-position: 100% 50%; }
	}
	.animate-gradient {
		animation: gradient-move 5s ease infinite;
	}

	/* --- Hero stagger entrance --- */
	.animate-hero-in .hero-stagger-1,
	.animate-hero-in .hero-stagger-2,
	.animate-hero-in .hero-stagger-3,
	.animate-hero-in .hero-stagger-4,
	.animate-hero-in .hero-stagger-5 {
		animation: fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
	}
	.hero-stagger-1 { opacity: 0; }
	.hero-stagger-2 { opacity: 0; }
	.hero-stagger-3 { opacity: 0; }
	.hero-stagger-4 { opacity: 0; }
	.hero-stagger-5 { opacity: 0; }
	.animate-hero-in .hero-stagger-1 { animation-delay: 0.05s; }
	.animate-hero-in .hero-stagger-2 { animation-delay: 0.12s; }
	.animate-hero-in .hero-stagger-3 { animation-delay: 0.2s; }
	.animate-hero-in .hero-stagger-4 { animation-delay: 0.3s; }
	.animate-hero-in .hero-stagger-5 { animation-delay: 0.4s; }

	@keyframes fade-up {
		from { opacity: 0; transform: translateY(16px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* --- Dashboard float in --- */
	.animate-float-in {
		animation: float-in 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.5s both;
	}
	@keyframes float-in {
		from { opacity: 0; transform: translateY(30px) scale(0.98); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	/* --- Feed line entrance --- */
	.animate-feed-line {
		animation: feed-slide 0.5s ease both;
	}
	@keyframes feed-slide {
		from { opacity: 0; transform: translateX(-8px); }
		to { opacity: 1; transform: translateX(0); }
	}
</style>
