<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { BadgeCheck, Loader, OctagonMinus } from '@lucide/svelte';

	/* ---------- public prop ---------- */
	interface Props {
		/** Nullable: most status columns are, and an unknown value already falls back to grey. */
		status: string | null | undefined;
	}
	let { status }: Props = $props();

	/* ---------- lookup tables ---------- */
	const statusMeta = $derived({
		/* confirmed / paid */
		confirmed: { icon: BadgeCheck, colour: 'bg-green-400' },
		paid: { icon: BadgeCheck, colour: 'bg-green-400' },

		complete: { icon: BadgeCheck, colour: 'bg-green-400' },
		incomplete: { icon: OctagonMinus, colour: 'bg-red-500' },

		/* cancelled / unpaid */
		cancelled: { icon: OctagonMinus, colour: 'bg-red-500' },
		unpaid: { icon: OctagonMinus, colour: 'bg-red-500' },
		dead: { icon: OctagonMinus, colour: 'bg-red-500' },

		/* pending */
		pending: { icon: Loader, colour: 'bg-yellow-500' },
		rejected: { icon: OctagonMinus, colour: 'bg-red-500' },
		terminated: { icon: OctagonMinus, colour: 'bg-red-500' },
		approved: { icon: BadgeCheck, colour: 'bg-green-400' },

		/* active */
		active: { icon: BadgeCheck, colour: 'bg-green-400' },
		contracted: { icon: BadgeCheck, colour: 'bg-green-400' },
		inactive: { icon: OctagonMinus, colour: 'bg-red-500' },

		yes: { icon: BadgeCheck, colour: 'bg-green-400' },
		no: { icon: OctagonMinus, colour: 'bg-red-500' },

		unremovable: { icon: BadgeCheck, colour: 'bg-green-400' },
		removable: { icon: OctagonMinus, colour: 'bg-red-500' },
		calculated: { icon: BadgeCheck, colour: 'bg-green-400' },
		'not calculated': { icon: OctagonMinus, colour: 'bg-red-500' },

		/* fallback */
		unknown: { icon: Loader, colour: 'bg-gray-500' }
	});

	/* ---------- derived ---------- */
	const key = $derived(String(status).trim().toLowerCase() as keyof typeof statusMeta);
	const { icon: Icon, colour } = $derived(statusMeta[key] ?? statusMeta.unknown);
</script>

<Badge variant="secondary" class="{colour} text-white">
	<Icon />
	{status}
</Badge>
