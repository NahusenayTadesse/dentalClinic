<script lang="ts">
	import Contrast from '@lucide/svelte/icons/contrast';
	import Expand from '@lucide/svelte/icons/expand';
	import RotateCw from '@lucide/svelte/icons/rotate-cw';
	import Sun from '@lucide/svelte/icons/sun';
	import Undo from '@lucide/svelte/icons/undo-2';
	import ZoomIn from '@lucide/svelte/icons/zoom-in';
	import ZoomOut from '@lucide/svelte/icons/zoom-out';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { clampZoom, freshView, type View } from './view';

	/**
	 * One radiograph, to be read: wheel or buttons to zoom, drag to move, and brightness, contrast,
	 * invert and turn — the adjustments a dark or faint film needs. All of it is CSS on the image;
	 * the file itself is never changed.
	 *
	 * `view` is bindable so the page can hand two panes the same one.
	 */
	let {
		src,
		label,
		view = $bindable(),
		full
	}: {
		src: string;
		/** What the film is, for the heading and the image's alt text. */
		label: string;
		view: View;
		/** The file at full size, in a tab of its own. */
		full: string;
	} = $props();

	let frame: HTMLDivElement | undefined = $state();
	let dragging: { id: number; x: number; y: number } | null = null;

	function zoomBy(factor: number) {
		const zoom = clampZoom(view.zoom * factor);
		// Back to fitted, back to centred: a film dragged off at 1× is a film lost.
		view = zoom === 1 ? { ...view, zoom, x: 0, y: 0 } : { ...view, zoom };
	}

	// The wheel listener must be able to stop the page scrolling, which a passive one cannot.
	$effect(() => {
		if (!frame) return;
		const onWheel = (event: WheelEvent) => {
			event.preventDefault();
			zoomBy(event.deltaY < 0 ? 1.15 : 1 / 1.15);
		};
		frame.addEventListener('wheel', onWheel, { passive: false });
		return () => frame?.removeEventListener('wheel', onWheel);
	});

	function down(event: PointerEvent & { currentTarget: HTMLDivElement }) {
		if (view.zoom === 1) return;
		event.currentTarget.setPointerCapture(event.pointerId);
		dragging = { id: event.pointerId, x: event.clientX - view.x, y: event.clientY - view.y };
	}

	function move(event: PointerEvent) {
		if (!dragging || dragging.id !== event.pointerId) return;
		view = { ...view, x: event.clientX - dragging.x, y: event.clientY - dragging.y };
	}

	const up = () => (dragging = null);

	const transform = $derived(
		`translate(${view.x}px, ${view.y}px) scale(${view.zoom}) rotate(${view.turns * 90}deg)`
	);
	const filter = $derived(
		`brightness(${view.brightness}%) contrast(${view.contrast}%)${view.invert ? ' invert(1)' : ''}`
	);
</script>

<figure class="flex min-w-0 flex-col gap-2">
	<figcaption class="truncate text-sm font-medium">{label}</figcaption>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={frame}
		class="relative h-[55vh] min-h-64 touch-none overflow-hidden rounded-md bg-black select-none {view.zoom >
		1
			? 'cursor-grab active:cursor-grabbing'
			: ''}"
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={up}
		ondblclick={() => (view = freshView())}
	>
		<img
			{src}
			alt={label}
			draggable="false"
			class="pointer-events-none size-full object-contain"
			style:transform
			style:filter
		/>
	</div>

	<div class="flex flex-wrap items-center gap-1">
		<Button size="icon" variant="outline" aria-label="Zoom out" onclick={() => zoomBy(1 / 1.25)}>
			<ZoomOut class="size-4" />
		</Button>
		<span class="w-10 text-center text-xs tabular-nums">{view.zoom.toFixed(1)}×</span>
		<Button size="icon" variant="outline" aria-label="Zoom in" onclick={() => zoomBy(1.25)}>
			<ZoomIn class="size-4" />
		</Button>
		<Button
			size="icon"
			variant="outline"
			aria-label="Turn a quarter"
			onclick={() => (view = { ...view, turns: (view.turns + 1) % 4 })}
		>
			<RotateCw class="size-4" />
		</Button>
		<Button
			size="sm"
			variant={view.invert ? 'default' : 'outline'}
			aria-pressed={view.invert}
			onclick={() => (view = { ...view, invert: !view.invert })}
		>
			Invert
		</Button>
		<Button
			size="icon"
			variant="ghost"
			aria-label="Back as taken"
			onclick={() => (view = freshView())}
		>
			<Undo class="size-4" />
		</Button>
		<Button size="icon" variant="ghost" aria-label="Open full size" href={full} target="_blank">
			<Expand class="size-4" />
		</Button>
	</div>
	<div class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
		<span class="flex items-center gap-1"><Sun class="size-3.5" /> Brightness</span>
		<!-- Native: the kit's slider draws no track (its classes look for an attribute bits-ui does not set). -->
		<input
			type="range"
			class="w-full accent-primary"
			min={40}
			max={220}
			step="5"
			value={view.brightness}
			oninput={(e) => (view = { ...view, brightness: Number(e.currentTarget.value) })}
			aria-label="Brightness"
		/>
		<span class="flex items-center gap-1"><Contrast class="size-3.5" /> Contrast</span>
		<input
			type="range"
			class="w-full accent-primary"
			min={40}
			max={300}
			step="5"
			value={view.contrast}
			oninput={(e) => (view = { ...view, contrast: Number(e.currentTarget.value) })}
			aria-label="Contrast"
		/>
	</div>
</figure>
