import prettier from 'eslint-config-prettier';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import { fileURLToPath } from 'node:url';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default ts.config(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		}
	},
	{
		// Was a bare top-level key rather than a `rules` entry, which is not a valid flat-config
		// object — ESLint refused the whole config, so `npm run lint` failed before linting
		// anything. The rule had never run.
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		rules: {
			'svelte/no-navigation-without-resolve': [
				'error',
				{
					ignoreGoto: false,
					ignoreLinks: true,
					ignorePushState: false,
					ignoreReplaceState: false
				}
			]
		}
	},
	{
		rules: {
			// Promoted from the `warn` that `ts.configs.recommended` sets. CLAUDE.md §3 forbids new
			// explicit `any`; a warning nobody sees is not a rule.
			'@typescript-eslint/no-explicit-any': 'error'
		}
	}
);
