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
	let canvas: HTMLCanvasElement;

	onMount(() => {
mounted = true;
if (!canvas) return;
const ctx = canvas.getContext('2d');
if (!ctx) return;

let width = 0;
let height = 0;
let animationFrame: number;

const resize = () => {
const rect = canvas.getBoundingClientRect();
width = rect.width;
height = rect.height;
canvas.width = width * window.devicePixelRatio;
canvas.height = height * window.devicePixelRatio;
ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
};

window.addEventListener('resize', resize);
resize();

const symbols = ['<html>', '</div>', '.class {}', 'const', '=>', '#id', '@media', 'flex', 'var()', 'import'];
const colors = ['#38aaff', '#7dd3fc', '#ffffff'];

class Meteor {
x: number = 0;
y: number = 0;
speed: number = 0;
angle: number = 0;
symbol: string = '';
color: string = '';
size: number = 0;
opacity: number = 0;
history: {x: number, y: number}[] = [];

constructor(resetToTop = false) {
this.init(resetToTop);
}

init(resetToTop = false) {
// Origin around 50% horizontally, 30% from top
const originX = width * 0.5;
const originY = height * 0.3;

this.symbol = symbols[Math.floor(Math.random() * symbols.length)];
this.color = colors[Math.floor(Math.random() * colors.length)];
this.size = Math.random() * 6 + 12; // 12px to 18px
this.opacity = Math.random() * 0.2 + 0.35; // 0.35 to 0.55

this.speed = Math.random() * 1.2 + 0.3; // 0.3 to 1.5 speed

// Angle: 360 degrees outward from center
this.angle = Math.random() * Math.PI * 2;

if (resetToTop) {
this.x = originX;
this.y = originY;
} else {
// Disperse initially
let dist = Math.random() * Math.max(width, height);
this.x = originX + Math.cos(this.angle) * dist;
this.y = originY + Math.sin(this.angle) * dist;
}

this.history = [];
}

update() {
this.history.push({x: this.x, y: this.y});
if (this.history.length > 5) {
this.history.shift();
}

this.x += Math.cos(this.angle) * this.speed;
this.y += Math.sin(this.angle) * this.speed;

if (this.x < -100 || this.x > width + 100 || this.y < -100 || this.y > height + 100) {
this.init(true);
}
}

draw(ctx: CanvasRenderingContext2D) {
ctx.font = this.size.toString() + 'px monospace';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';

// Draw history trail
for (let i = 0; i < this.history.length; i++) {
const point = this.history[i];
const histOpacity = this.opacity * ((i + 1) / this.history.length) * 0.4;
ctx.fillStyle = this.color;
ctx.globalAlpha = histOpacity;
ctx.fillText(this.symbol, point.x, point.y);
}

// Draw current meteor
ctx.globalAlpha = this.opacity;
ctx.fillStyle = this.color;
ctx.fillText(this.symbol, this.x, this.y);
}
}

const meteors: Meteor[] = [];
for (let i = 0; i < 35; i++) {
meteors.push(new Meteor(false));
}

const drawScene = () => {
if (!ctx) return;
ctx.clearRect(0, 0, width, height);

for (let meteor of meteors) {
meteor.update();
meteor.draw(ctx);
}

ctx.globalAlpha = 1;
animationFrame = requestAnimationFrame(drawScene);
};

drawScene();

return () => {
window.removeEventListener('resize', resize);
cancelAnimationFrame(animationFrame);
};
});
</script>

<svelte:head>
	<title>Sonar IDE | Supervised Coding & Exam Environment</title>
	<meta name="description" content="A real-time collaborative code editor built for supervised teams, featuring advanced activity monitoring and strict local environments." />
</svelte:head>

<!-- Hero Section -->
<section class="relative flex flex-col items-center justify-center text-center px-4 pt-28 sm:pt-36 xl:pt-44 pb-20 overflow-hidden min-h-screen bg-[#050508]">
	
	<!-- Radial fade mask for top/sides -->
<div class="absolute inset-0 z-0 pointer-events-none" style="background: radial-gradient(circle at top, transparent 20%, #050508 80%);"></div>

<!-- Meteor Shower Canvas -->
<div class="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden">
<canvas bind:this={canvas} class="w-full h-full"></canvas>
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






