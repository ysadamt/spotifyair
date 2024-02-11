<script lang="ts">
	import '../app.css';
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<main class="h-dvh font-jakarta">
	<slot />
</main>

<style>
	main {
		background-image: url('/bg.svg');
		background-size: 35%;
		background-position: center;
	}
</style>
