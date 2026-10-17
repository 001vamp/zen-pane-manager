import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../chrome.css', import.meta.url), 'utf8');

assert.match(
  css,
  /\.browserSidebarContainer\[pane-accordion\]:not\(\[pane-accordion-active\]\) > :not\(\.pane-accordion-bar\):not\(\.pane-accordion-resize\) \{ pointer-events: none !important; \}/,
  'inactive accordion panes must leave resize targets pointerable',
);

const resizeRule = css.match(/\.pane-accordion-resize \{(?<body>[^}]+)\}/)?.groups?.body ?? '';
assert.ok(resizeRule, 'accordion resize rule exists');
assert.match(resizeRule, /\btop: 0\b/, 'accordion resize target starts at the top boundary');
assert.match(resizeRule, /\bz-index: 10\b/, 'accordion resize target stays above strip chrome');
assert.doesNotMatch(resizeRule, /\btop: 36px\b/, 'accordion resize target covers the full boundary');
assert.doesNotMatch(css, /pane-accordion-active[^{]*\{[^}]*overflow:\s*visible/, 'active accordion stays clipped');

console.log('CSS accordion resize pointer and boundary rules passed.');

const pickerRule = css.match(/#pane-dialog \{([^}]+)\}/)?.[1] ?? '';
assert.match(pickerRule, /background:[^;]*light-dark\(#f7f8fb, #18191e\)/,
  'picker uses an opaque light/dark base beneath its theme tint');
assert.match(pickerRule, /linear-gradient\([^;]*var\(--pane-user-tint-light\)[^;]*var\(--pane-user-tint-dark\)/,
  'picker keeps the configured theme tint over the opaque base');
