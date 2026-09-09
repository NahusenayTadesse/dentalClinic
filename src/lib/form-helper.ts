import { superForm, type FormOptions } from 'sveltekit-superforms';
import { toast } from 'svelte-sonner';

export function useAppForm(data: any, options: FormOptions<any, any> = {}) {
	return superForm(data, {
		...options,
		onResult: async (event) => {
			// 1. Handle Same-Page Success (No Redirect)
			if (event.result.type === 'success' && event.result.data?.form?.message) {
				toast.success(event.result.data.form.message);
			}

			// 2. Handle Errors
			if (event.result.type === 'failure') {
				toast.error('Please check the form for errors');
			}

			if (options.onResult) options.onResult(event);
		},
		onError: (event) => {
			toast.error('A server error occurred');
			if (options.onError) options.onError(event);
		}
	});
}
