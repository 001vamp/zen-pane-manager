// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
import { numericSettings, colorSettings, numericValue, glassPresets } from './appearance.mjs';

const INSTANCE = '__paneSettings';
window[INSTANCE]?.destroy();
const prefs = Services.prefs;
const prefix = 'mod.pane.';
const rows = new Map();
let preview, previewHost, frame = 0;
const element = (tag, attrs = {}, text) => {
  const node = document.createElementNS('http://www.w3.org/1999/xhtml', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
};
const style = element('style', {}, `
.pane-control { display:grid; gap:8px; width:100%; min-width:0; padding:10px 0; font:inherit; }
.pane-control label { font-weight:600; }
.pane-control-line { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.pane-control input { box-sizing:border-box; font:inherit; min-width:0; }
.pane-control input[type=range] { flex:1; min-width:100px; accent-color:AccentColor; }
.pane-control input[type=number] { width:80px; }
.pane-control input[type=text] { flex:1; width:200px; }
.pane-control input[type=color] { width:48px; height:36px; padding:2px; cursor:pointer; }
.pane-control input:focus-visible,.pane-control button:focus-visible { outline:2px solid AccentColor; outline-offset:2px; }
.pane-control input[aria-invalid=true] { outline:2px solid #d94848; }
.pane-control-error { color:light-dark(#a51c30,#ff9ca9); font-size:12px; }
.pane-control-note { font-size:12px; opacity:.8; }
#pane-settings-preview { display:block; width:100%; box-sizing:border-box; padding:16px; margin:12px 0; border:1px solid color-mix(in srgb,currentColor 18%,transparent); border-radius:16px; }
.pane-preview-stage { padding:22px; margin-block:12px; background:linear-gradient(125deg,#7b64ad,#649cae 50%,#c391a0); border-radius:12px; overflow:hidden; }
.pane-preview-card { box-sizing:border-box; max-width:100%; margin:auto; border:1px solid #ffffff44; box-shadow:0 8px 20px #0003; }
.pane-preview-sample { border:2px solid; border-radius:8px; margin-top:10px; }
`);
document.documentElement.append(style);

function useCustom(setting) {
  if (setting.custom && prefs.getIntPref(prefix + 'style-preset', 0) !== 4) prefs.setIntPref(prefix + 'style-preset', 4);
}
function readColor(setting) { return prefs.getStringPref(prefix + setting.key, setting.value); }
function rgba(value) {
  if (!window.CSS.supports('color', value)) return null;
  try {
    const probe = element('span');
    probe.style.color = value;
    document.documentElement.append(probe);
    const resolved = window.getComputedStyle(probe).color;
    probe.remove();
    return InspectorUtils.colorToRGBA(resolved);
  } catch { return null; }
}
function colorText(color) { return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${Math.round(color.a * 100) / 100})`; }
function hex(color) { return '#' + [color.r, color.g, color.b].map(n => Math.round(n).toString(16).padStart(2, '0')).join(''); }
function resetButton(setting) {
  const button = element('button', { type:'button', 'aria-label':`Reset ${setting.label}` }, 'Reset');
  button.addEventListener('click', () => { useCustom(setting); prefs.clearUserPref(prefix + setting.key); refresh(); });
  return button;
}
function numberControl(setting, box) {
  const id = `pane-control-${setting.key}`;
  const label = element('label', { for:id }, setting.label);
  const line = element('div', { class:'pane-control-line' });
  const range = element('input', { type:'range', min:setting.min, max:setting.max, step:1, 'aria-label':setting.label });
  const number = element('input', { id, type:'number', min:setting.min, max:setting.max, step:1, 'aria-label':`${setting.label} in ${setting.unit}` });
  const error = element('span', { class:'pane-control-error', id:`${id}-error`, 'aria-live':'polite' });
  number.setAttribute('aria-describedby', error.id);
  function save(input) {
    const value = Number(input.value);
    const valid = input.value.trim() !== '' && Number.isInteger(value) && value >= setting.min && value <= setting.max;
    number.setAttribute('aria-invalid', String(!valid));
    error.textContent = valid ? '' : `Enter a whole number from ${setting.min} to ${setting.max}.`;
    if (!valid) return;
    useCustom(setting);
    prefs.setIntPref(prefix + setting.key, value);
    range.value = number.value = String(value);
  }
  range.addEventListener('input', () => save(range));
  number.addEventListener('input', () => save(number));
  line.append(range, number, element('span', {}, setting.unit), resetButton(setting));
  box.append(label, line, error);
  return () => {
    const value = String(numericValue(setting.key, prefs));
    range.value = value;
    if (document.activeElement !== number) { number.value = value; number.removeAttribute('aria-invalid'); error.textContent = ''; }
  };
}
function colorControl(setting, box) {
  const id = `pane-control-${setting.key}`;
  const color = element('input', { type:'color', 'aria-label':`${setting.label} color picker` });
  const text = element('input', { type:'text', id, 'aria-label':`${setting.label} HEX or RGBA`, spellcheck:'false' });
  const alpha = element('input', { type:'range', min:setting.minAlpha, max:100, step:1, 'aria-label':`${setting.label} opacity` });
  const opacity = element('input', { type:'number', min:setting.minAlpha, max:100, step:1, 'aria-label':`${setting.label} opacity percent` });
  const error = element('span', { id:`${id}-error`, class:'pane-control-error', 'aria-live':'polite' });
  text.setAttribute('aria-describedby', error.id);
  opacity.setAttribute('aria-describedby', error.id);
  let current = { r:124, g:92, b:255, a:1 };
  function save(value) {
    const parsed = rgba(value);
    if (!parsed || parsed.a < setting.minAlpha / 100) {
      text.setAttribute('aria-invalid','true');
      error.textContent = parsed ? 'Use at least 30% opacity so keyboard focus stays visible.' : 'Enter a valid HEX, RGB, RGBA, or CSS color.';
      return;
    }
    text.removeAttribute('aria-invalid'); error.textContent = '';
    current = parsed;
    useCustom(setting);
    prefs.setStringPref(prefix + setting.key, value);
    sync();
  }
  function sync() {
    const value = readColor(setting);
    const parsed = rgba(value);
    if (parsed) current = parsed;
    color.value = hex(current);
    alpha.value = String(Math.round(current.a * 100));
    if (document.activeElement !== opacity) opacity.value = alpha.value;
    if (document.activeElement !== text) { text.value = value; text.removeAttribute('aria-invalid'); error.textContent = ''; }
  }
  color.addEventListener('input', () => {
    const rgb = rgba(color.value);
    if (rgb) save(colorText({ ...rgb, a:current.a }));
  });
  text.addEventListener('input', () => save(text.value.trim()));
  function saveOpacity(input) {
    const n = Number(input.value);
    const valid = input.value.trim() !== '' && Number.isInteger(n) && n >= setting.minAlpha && n <= 100;
    opacity.setAttribute('aria-invalid', String(!valid));
    if (!valid) { error.textContent = `Enter an opacity from ${setting.minAlpha} to 100.`; return; }
    save(colorText({ ...current, a:n / 100 }));
    opacity.value = alpha.value;
  }
  alpha.addEventListener('input', () => saveOpacity(alpha));
  opacity.addEventListener('input', () => saveOpacity(opacity));
  const line = element('div', { class:'pane-control-line' });
  line.append(color, text, resetButton(setting));
  const alphaLine = element('div', { class:'pane-control-line' });
  alphaLine.append(element('span', {}, 'Opacity'), alpha, opacity, element('span', {}, '%'));
  box.append(element('label', { for:id }, setting.label), line, alphaLine, error);
  return sync;
}
function buildPreview(host) {
  previewHost = host;
  preview = element('section', { id:'pane-settings-preview', 'aria-label':'Pane appearance preview' });
  const top = element('div', { class:'pane-control-line' });
  const reset = element('button', { type:'button' }, 'Reset appearance');
  reset.addEventListener('click', () => {
    for (const setting of [...numericSettings, ...colorSettings]) {
      if (setting.key !== 'recent-count') prefs.clearUserPref(prefix + setting.key);
    }
    prefs.setIntPref(prefix + 'style-preset', 0);
    prefs.clearUserPref(prefix + 'compact-picker');
    refresh();
  });
  top.append(element('strong', {}, 'Live preview'), reset);
  const mode = element('select', { 'aria-label':'Preview color scheme' });
  for (const name of ['System','Light','Dark']) mode.append(element('option', { value:name.toLowerCase() }, name));
  top.append(mode);
  const stage = element('div', { class:'pane-preview-stage' });
  const card = element('div', { class:'pane-preview-card' });
  card.append(element('strong', {}, 'Replace this pane'), element('div', { class:'pane-preview-sample' }, 'Example tab'));
  stage.append(card);
  mode.addEventListener('change', refresh);
  preview.append(top, stage, element('div', { class:'pane-control-note' }, 'Changes save automatically. Editing tint, blur, or corners selects Custom glass. The preview fits this panel; the picker uses your saved width.'));
  host.before(preview);
}
function refresh() {
  for (const [row, record] of rows) {
    if (!row.isConnected) { rows.delete(row); continue; }
    record.sync();
  }
  if (!preview?.isConnected) return;
  const card = preview.querySelector('.pane-preview-card');
  const mode = preview.querySelector('select').value;
  const dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const custom = { light:readColor(colorSettings[1]), dark:readColor(colorSettings[2]), blur:numericValue('glass-blur',prefs), radius:numericValue('corner-radius',prefs) };
  const appearance = glassPresets[prefs.getIntPref(prefix + 'style-preset',0)] ?? custom;
  card.style.background = dark ? appearance.dark : appearance.light;
  card.style.color = dark ? '#f5f5f7' : '#1f2024';
  card.style.width = `${numericValue('picker-width',prefs)}px`;
  card.style.padding = '16px';
  card.style.borderRadius = `${appearance.radius}px`;
  card.style.backdropFilter = `blur(${appearance.blur}px)`;
  const sample = card.querySelector('.pane-preview-sample');
  sample.style.borderColor = readColor(colorSettings[0]);
  sample.style.padding = `${numericValue('item-spacing',prefs)}px 9px`;
}
function scan() {
  frame = 0;
  for (const setting of [...numericSettings, ...colorSettings]) {
    const row = document.getElementById((prefix + setting.key).replaceAll('.','-'));
    if (!row || rows.has(row)) continue;
    const original = [...row.childNodes];
    const box = element('div', { class:'pane-control' });
    const sync = setting.min !== undefined ? numberControl(setting, box) : colorControl(setting, box);
    row.replaceChildren(box);
    rows.set(row, { original, sync });
    sync();
  }
  const host = document.getElementById('mod-pane-accent-color');
  if (host && (!preview?.isConnected || previewHost !== host)) { preview?.remove(); buildPreview(host); refresh(); }
}
function schedule() { if (!frame) frame = window.requestAnimationFrame(scan); }
const observer = new MutationObserver(schedule);
observer.observe(document.documentElement, { childList:true, subtree:true });
const preferenceObserver = { observe:refresh };
prefs.addObserver(prefix, preferenceObserver);
const scheme = window.matchMedia('(prefers-color-scheme: dark)');
scheme.addEventListener('change', refresh);
function destroy() {
  window.removeEventListener("unload", destroy);
  observer.disconnect();
  if (frame) window.cancelAnimationFrame(frame);
  prefs.removeObserver(prefix, preferenceObserver);
  scheme.removeEventListener('change', refresh);
  for (const [row, record] of rows) if (row.isConnected) row.replaceChildren(...record.original);
  rows.clear(); preview?.remove(); style.remove();
  if (window[INSTANCE]?.destroy === destroy) delete window[INSTANCE];
}
window[INSTANCE] = { destroy };
window.addUnloadListener?.(destroy);
window.addEventListener("unload", destroy, { once:true });
scan();
