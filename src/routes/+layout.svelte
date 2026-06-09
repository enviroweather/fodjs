<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '$lib/assets/global.css';
	import Inspect, {InspectOptionsProvider, type InspectOptions} from 'svelte-inspect-value'
  	import { page } from '$app/state'
  	import { dev } from '$app/environment'

	let { children } = $props();


	let inspectOptions = $state<InspectOptions>({
    	renderIf: dev,
    	expandLevel: 0,
    	// other preferences
  	})


</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<InspectOptionsProvider options={inspectOptions}>
  <Inspect.Panel values={{
    // spread to access getters
    page: { ...page },
    // or just pass page data
    pageData: page.data,
	
  }} />





<main>
	{@render children()}
</main>

</InspectOptionsProvider>