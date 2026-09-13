/**
 * The printable manual.
 *
 * Builds the whole of `content.ts` into one self-contained document and hands it
 * to the browser's print dialog, where "Save as PDF" writes the file.
 *
 * It prints through a hidden iframe rather than the live page — the same route
 * every table export in this app already takes (see `Table/pdf.svelte`). The
 * document therefore carries its own type scale, palette and rules, and none of
 * the dashboard's chrome can leak into it.
 *
 * It is laid out as a delivered document rather than a screen dump: an amno
 * letterhead, a title page, a contents list, then numbered chapters and the
 * route map as an appendix. The palette is taken off the mark — teal #027F81,
 * gold #CDA756 — so the whole thing reads as one piece of stationery.
 */

import {
	HELP_SECTIONS,
	ROUTE_MAP,
	ROUTE_COUNT,
	TOPIC_COUNT,
	type HelpTopic,
	type RouteEntry
} from './content';

const TEAL = '#027F81';
const GOLD = '#CDA756';
const INK = '#12212b';

/** Raw values only ever reach the document through here. */
function esc(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * The same light markup `rich-text.svelte` renders on screen — `**bold**` and
 * `` `code` `` — turned into HTML. Everything is escaped first, so the markup is
 * the only thing that can produce a tag.
 */
function rich(text: string): string {
	return esc(text)
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/`([^`]+)`/g, '<code>$1</code>');
}

function topicHtml(topic: HelpTopic): string {
	const where = topic.where ? `<p class="where"><span>Where</span>${rich(topic.where)}</p>` : '';

	const permission = topic.permission
		? `<p class="perm"><span>Needs</span>${rich(topic.permission)}</p>`
		: '';

	const steps = topic.steps?.length
		? `<ol class="steps">${topic.steps.map((step) => `<li>${rich(step)}</li>`).join('')}</ol>`
		: '';

	const notes = topic.notes?.length
		? `<ul class="notes">${topic.notes.map((note) => `<li>${rich(note)}</li>`).join('')}</ul>`
		: '';

	return `<article class="topic">
		<h3>${esc(topic.title)}</h3>
		<p class="summary">${rich(topic.summary)}</p>
		${where}${permission}${steps}${notes}
	</article>`;
}

function routeRowHtml(route: RouteEntry): string {
	return `<tr>
		<td class="route"><code>${esc(route.path)}</code><span class="route-title">${esc(route.title)}</span></td>
		<td>${esc(route.purpose)}</td>
		<td class="perm-cell">${route.permission ? `<code>${esc(route.permission)}</code>` : 'Any signed-in user'}</td>
	</tr>`;
}

function routeMapHtml(): string {
	const groups = [...new Set(ROUTE_MAP.map((route) => route.group))];

	return groups
		.map(
			(group) => `<table class="routes">
			<thead>
				<tr><th colspan="3" class="group">${esc(group)}</th></tr>
				<tr><th>Address</th><th>What it is for</th><th>Permission</th></tr>
			</thead>
			<tbody>${ROUTE_MAP.filter((route) => route.group === group)
				.map(routeRowHtml)
				.join('')}</tbody>
		</table>`
		)
		.join('');
}

function styles(): string {
	return `
	@page { size: A4 portrait; margin: 18mm 16mm; }

	* { box-sizing: border-box; }

	html, body {
		margin: 0;
		padding: 0;
		color: ${INK};
		font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
		font-size: 10.5pt;
		line-height: 1.55;
		-webkit-print-color-adjust: exact;
		print-color-adjust: exact;
	}

	/* --- letterhead ------------------------------------------------------ */
	.masthead {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
		padding-bottom: 10px;
	}
	.masthead img { height: 46px; width: auto; }
	.masthead p { margin: 0; font-size: 8.5pt; letter-spacing: 0.14em; text-transform: uppercase; color: ${TEAL}; }

	.rule { display: flex; height: 5px; margin: 0 0 28px; }
	.rule span:nth-child(1) { flex: 6; background: ${TEAL}; }
	.rule span:nth-child(2) { flex: 2; background: ${GOLD}; }
	.rule span:nth-child(3) { flex: 1; background: ${TEAL}; opacity: 0.25; }

	/* --- cover ----------------------------------------------------------- */
	.cover { break-after: page; page-break-after: always; }
	.eyebrow {
		margin: 0 0 6px;
		font-size: 9pt;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: ${GOLD};
		font-weight: 700;
	}
	h1 {
		margin: 0 0 14px;
		font-size: 30pt;
		line-height: 1.1;
		letter-spacing: -0.02em;
		color: ${TEAL};
	}
	.cover-sub { margin: 0 0 32px; max-width: 44em; font-size: 12pt; color: #3d5462; }

	.facts { display: flex; gap: 40px; margin: 0 0 40px; padding: 0; }
	.facts div { margin: 0; }
	.facts dt {
		font-size: 8pt;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #6b8391;
		margin: 0 0 2px;
	}
	.facts dd { margin: 0; font-size: 15pt; font-weight: 700; color: ${TEAL}; }

	.cover-note {
		border-left: 3px solid ${GOLD};
		padding: 4px 0 4px 16px;
		max-width: 44em;
		color: #3d5462;
	}
	.cover-note p { margin: 0; }

	/* --- contents -------------------------------------------------------- */
	.contents { break-after: page; page-break-after: always; }
	h2 {
		margin: 0 0 4px;
		font-size: 17pt;
		letter-spacing: -0.01em;
		color: ${TEAL};
	}
	.toc { list-style: none; margin: 18px 0 0; padding: 0; }
	.toc li { display: flex; gap: 14px; padding: 9px 0; border-bottom: 1px solid #e3ebee; }
	.toc-n { font-size: 9pt; font-weight: 700; color: ${GOLD}; padding-top: 3px; min-width: 24px; }
	.toc-title { margin: 0; font-weight: 700; }
	.toc-blurb { margin: 1px 0 0; font-size: 9.5pt; color: #5c7583; }

	/* --- chapters -------------------------------------------------------- */
	.chapter { break-before: page; page-break-before: always; }
	.chapter-head {
		display: flex;
		gap: 14px;
		align-items: flex-start;
		border-bottom: 2px solid ${TEAL};
		padding-bottom: 10px;
		margin-bottom: 18px;
	}
	.chapter-n {
		font-size: 22pt;
		font-weight: 800;
		line-height: 1;
		color: ${GOLD};
		min-width: 42px;
	}
	.chapter-blurb { margin: 3px 0 0; color: #5c7583; font-size: 10pt; }

	.topic { break-inside: avoid; page-break-inside: avoid; margin: 0 0 20px; }
	.topic h3 { margin: 0 0 3px; font-size: 12pt; color: ${INK}; }
	.summary { margin: 0 0 8px; color: #3d5462; }

	.where, .perm { margin: 0 0 6px; font-size: 9pt; color: ${TEAL}; }
	.where span, .perm span {
		display: inline-block;
		min-width: 46px;
		font-size: 7.5pt;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #7b93a1;
	}

	ol.steps, ul.notes { margin: 6px 0 0; padding-left: 20px; }
	ol.steps li { margin: 0 0 4px; }
	ul.notes { list-style: none; padding-left: 0; }
	ul.notes li {
		position: relative;
		margin: 0 0 4px;
		padding-left: 16px;
		color: #46606f;
		font-size: 10pt;
	}
	ul.notes li::before {
		content: "";
		position: absolute;
		left: 0;
		top: 0.62em;
		width: 6px;
		height: 6px;
		background: ${GOLD};
	}

	strong { font-weight: 700; color: ${INK}; }
	code {
		font-family: "SFMono-Regular", Consolas, monospace;
		font-size: 0.88em;
		background: #eef4f5;
		padding: 0 3px;
		border-radius: 2px;
		color: ${TEAL};
	}

	/* --- route map ------------------------------------------------------- */
	table.routes {
		width: 100%;
		border-collapse: collapse;
		margin: 0 0 22px;
		font-size: 9pt;
	}
	table.routes th.group {
		background: ${TEAL};
		color: #fff;
		text-align: left;
		font-size: 11pt;
		padding: 6px 8px;
		letter-spacing: 0.02em;
	}
	table.routes thead tr:nth-child(2) th {
		background: #eef4f5;
		text-align: left;
		font-size: 8pt;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #5c7583;
		padding: 5px 8px;
		border-bottom: 1px solid #d7e3e6;
	}
	table.routes thead { display: table-header-group; }
	table.routes td { padding: 6px 8px; border-bottom: 1px solid #e8eff1; vertical-align: top; }
	table.routes tr { break-inside: avoid; page-break-inside: avoid; }
	td.route { width: 34%; }
	td.route code { display: block; background: none; padding: 0; word-break: break-all; }
	.route-title { display: block; color: #5c7583; font-size: 8.5pt; }
	td.perm-cell { width: 22%; color: #5c7583; }

	/* --- colophon -------------------------------------------------------- */
	.colophon { break-before: page; page-break-before: always; padding-top: 40px; }
	.colophon-row { display: flex; align-items: center; gap: 16px; }
	.colophon img { height: 34px; width: auto; }
	.colophon p { margin: 0; font-size: 9pt; color: #5c7583; }
	`;
}

/**
 * The whole manual as one self-contained HTML document.
 *
 * Exported so it can be rendered without opening a print dialog — that is how it
 * is checked when the layout changes.
 */
export function buildDocument(origin: string, stamp: string): string {
	const logo = `${origin}/newLogo.png`;

	const masthead = `<header class="masthead">
		<img src="${esc(logo)}" alt="amno ERP Solutions" />
		<p>Complexity, Simplified.</p>
	</header>
	<div class="rule"><span></span><span></span><span></span></div>`;

	const cover = `<section class="cover">
		${masthead}
		<p class="eyebrow">System manual</p>
		<h1>Running the amno&nbsp;system</h1>
		<p class="cover-sub">
			A complete guide to the dashboard — what each screen does, what happens when you use it,
			and where every address in the system leads. Written for the people who run the business.
		</p>
		<dl class="facts">
			<div><dt>Chapters</dt><dd>${HELP_SECTIONS.length}</dd></div>
			<div><dt>Topics</dt><dd>${TOPIC_COUNT}</dd></div>
			<div><dt>Routes</dt><dd>${ROUTE_COUNT}</dd></div>
			<div><dt>Issued</dt><dd>${esc(stamp)}</dd></div>
		</dl>
		<aside class="cover-note">
			<p>
				Keep this beside the system. Every screen named here is the one you are looking at, and
				every step is written in the order you would actually do it.
			</p>
		</aside>
	</section>`;

	const contents = `<section class="contents">
		<h2>Contents</h2>
		<ol class="toc">
			${HELP_SECTIONS.map(
				(section, i) => `<li>
				<span class="toc-n">${String(i + 1).padStart(2, '0')}</span>
				<div>
					<p class="toc-title">${esc(section.title)}</p>
					<p class="toc-blurb">${esc(section.blurb)}</p>
				</div>
			</li>`
			).join('')}
			<li>
				<span class="toc-n">${String(HELP_SECTIONS.length + 1).padStart(2, '0')}</span>
				<div>
					<p class="toc-title">Appendix — the route map</p>
					<p class="toc-blurb">Every address in the system, what it is for, and the permission it sits behind.</p>
				</div>
			</li>
		</ol>
	</section>`;

	const chapters = HELP_SECTIONS.map(
		(section, i) => `<section class="chapter">
			<header class="chapter-head">
				<span class="chapter-n">${String(i + 1).padStart(2, '0')}</span>
				<div>
					<h2>${esc(section.title)}</h2>
					<p class="chapter-blurb">${esc(section.blurb)}</p>
				</div>
			</header>
			${section.topics.map(topicHtml).join('')}
		</section>`
	).join('');

	const appendix = `<section class="chapter">
		<header class="chapter-head">
			<span class="chapter-n">${String(HELP_SECTIONS.length + 1).padStart(2, '0')}</span>
			<div>
				<h2>Appendix — the route map</h2>
				<p class="chapter-blurb">
					Every address in the system, what it is for, and the permission it sits behind. A route
					with no permission is open to any signed-in user.
				</p>
			</div>
		</header>
		${routeMapHtml()}
	</section>`;

	const colophon = `<footer class="colophon">
		<div class="rule"><span></span><span></span><span></span></div>
		<div class="colophon-row">
			<img src="${esc(logo)}" alt="amno ERP Solutions" />
			<p>amno system manual &middot; issued ${esc(stamp)} &middot; built and maintained by amno ERP Solutions</p>
		</div>
	</footer>`;

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>amno — System Manual</title>
<style>${styles()}</style>
</head>
<body>
${cover}
${contents}
${chapters}
${appendix}
${colophon}
</body>
</html>`;
}

/** Resolve once every image in the frame has settled, so nothing prints blank. */
function imagesReady(frame: Window): Promise<void> {
	const images = Array.from(frame.document.images);

	return Promise.all(
		images.map(
			(image) =>
				new Promise<void>((resolve) => {
					if (image.complete && image.naturalWidth > 0) return resolve();
					image.addEventListener('load', () => resolve(), { once: true });
					image.addEventListener('error', () => resolve(), { once: true });
				})
		)
	).then(() => undefined);
}

/**
 * Builds the manual and opens the print dialog. Resolves once the dialog has
 * been handed the document — the caller uses that to drop its "Preparing…"
 * state, not to know whether anything was actually printed.
 */
export function printManual(): Promise<void> {
	return new Promise((resolve) => {
		const stamp = new Date().toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});

		const html = buildDocument(window.location.origin, stamp);

		// Hidden iframe: no popup blockers, no navigation away, app state untouched.
		const iframe = window.document.createElement('iframe');
		iframe.style.position = 'fixed';
		iframe.style.right = '0';
		iframe.style.bottom = '0';
		iframe.style.width = '0';
		iframe.style.height = '0';
		iframe.style.border = '0';
		iframe.setAttribute('aria-hidden', 'true');
		window.document.body.appendChild(iframe);

		const cleanup = () => {
			// Delayed so the print dialog fully detaches from the frame first.
			setTimeout(() => iframe.remove(), 1000);
		};

		iframe.onload = async () => {
			const frame = iframe.contentWindow;
			if (!frame) {
				cleanup();
				resolve();
				return;
			}

			frame.onafterprint = cleanup;
			await imagesReady(frame);

			// One paint frame so the long document finishes layout before printing.
			requestAnimationFrame(() => {
				frame.focus();
				frame.print();
				// Fallback for browsers that never fire onafterprint.
				setTimeout(cleanup, 60000);
				resolve();
			});
		};

		const frameDoc = iframe.contentWindow?.document;
		if (!frameDoc) {
			iframe.remove();
			resolve();
			return;
		}

		frameDoc.open();
		frameDoc.write(html);
		frameDoc.close();
	});
}
