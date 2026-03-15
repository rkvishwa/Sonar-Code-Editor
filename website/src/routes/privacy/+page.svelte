<script lang="ts">
</script>

<svelte:head>
	<title>Privacy Policy | Sonar IDE</title>
	<meta name="description" content="Privacy Policy for Sonar Code Editor. Learn how we handle data in our offline-first, locally hosted collaborative IDE." />
	<meta property="og:title" content="Privacy Policy | Sonar IDE" />
	<meta property="og:description" content="Privacy Policy for Sonar Code Editor. Learn how we handle data in our offline-first, locally hosted collaborative IDE." />
	<meta property="og:image" content="/favicon.png" />
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<section class="max-w-4xl mx-auto px-6 pt-10 pb-20 lg:pt-16 sm:pb-32">
	<div class="max-w-3xl mx-auto">
		<h1 class="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white mb-6">Privacy Policy</h1>
		
		<p class="text-xl text-zinc-600 dark:text-zinc-400 mb-12">
			Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
		</p>

		<div class="space-y-10 text-zinc-700 dark:text-zinc-300 leading-relaxed">
			<section>
				<h2 class="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">1. Introduction</h2>
				<p>
					Welcome to Sonar IDE. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our website or use our application.
				</p>
			</section>

			<section>
				<h2 class="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">2. Data Collection</h2>
				<p class="mb-4">
					Since Sonar IDE is a locally hosted, privacy-first application, we collect minimal data:
				</p>
				<ul class="list-disc pl-6 space-y-3">
					<li><strong class="text-zinc-900 dark:text-zinc-100">Telemetry:</strong> We may collect anonymized usage statistics to improve the editor, though this can be disabled.</li>
					<li><strong class="text-zinc-900 dark:text-zinc-100">Local Data:</strong> All your code, collaboration sessions, and exam monitoring data are stored strictly on your local machine or shared directly via P2P connections.</li>
				</ul>
			</section>

			<section>
				<h2 class="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">3. Data Usage</h2>
				<p class="mb-4">
					Any data we collect from the website is used exclusively to:
				</p>
				<ul class="list-disc pl-6 space-y-3">
					<li>Provide and maintain our service</li>
					<li>Notify you about changes to our application</li>
					<li>Provide customer support</li>
				</ul>
			</section>

			<section>
				<h2 class="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">4. Permissions Required by the Application</h2>
				<p class="mb-4">
					To function as a monitored evaluation environment, the application requires and utilizes the following two native permissions:
				</p>
				<ul class="list-disc pl-6 space-y-3">
					<li><strong class="text-zinc-900 dark:text-zinc-100">Local & Outbound Network Access:</strong> Required for Appwrite authentication and real-time WebSocket collaboration (Yjs). Local network access is only required if you are actively collaborating.</li>
					<li><strong class="text-zinc-900 dark:text-zinc-100">Activity Monitoring:</strong> The IDE automatically tracks window focus states (e.g., leaving the IDE during an exam), keyboard activity metrics, and internal application navigation. This data is logged and accessible to authorized Administrators via the Admin Panel or PDF reports. Without granting monitoring permissions, users cannot use the IDE.</li>
				</ul>
			</section>

			<section>
				<h2 class="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">5. Third-party Links</h2>
				<p>
					This website may include links to third-party websites, plug-ins, and applications. Clicking on those links or enabling those connections may allow third parties to collect or share data about you. We do not control these third-party websites and are not responsible for their privacy statements.
				</p>
			</section>

			<section>
				<h2 class="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">6. Contact Us</h2>
				<p>
					If you have any questions about this privacy policy, please contact us at our GitHub repository or via the <a href="/contact" class="text-cyan-600 dark:text-cyan-400 hover:underline">Contact page</a>.
				</p>
			</section>
		</div>
	</div>
</section>
