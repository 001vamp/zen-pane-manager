// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
import { numericSettings, colorSettings, numericValue, glassPresets, settingsSections } from './appearance.mjs?pane=0.11.0-macos-shortcut';
import { shortcutSettings, accordionBindings, pickerBinding, diagnosticsBinding, scrollingModifiers, shortcutLabel, parseBinding, bindingFromEvent } from './keybindings.mjs?pane=0.11.0-macos-shortcut';

const INSTANCE = '__paneSettings';
window[INSTANCE]?.destroy();
const prefs = Services.prefs;
const prefix = 'mod.pane.';
let stopRecording = null;
const hiddenRows=new Map();
const rows = new Map();
const sections = new Map();
let preview, previewHost, frame = 0;
const extraPreviews = new Map();
const element = (tag, attrs = {}, text) => {
  const node = document.createElementNS('http://www.w3.org/1999/xhtml', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
};
const style = element('style', {}, `
.pane-control { display:grid; gap:6px; width:100%; min-width:0; padding:8px 0; font:inherit; }
.pane-control label { font-weight:600; }
.pane-control-line { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.pane-control input { box-sizing:border-box; font:inherit; min-width:0; }
.pane-control input[type=range] { flex:1; min-width:100px; accent-color:AccentColor; }
.pane-control input[type=number] { width:80px; }
.pane-control input[type=text] { flex:1; width:200px; }
.pane-control-error:empty { display:none; }
.pane-control input[type=color] { width:48px; height:36px; padding:2px; cursor:pointer; }
.pane-control input:focus-visible,.pane-control button:focus-visible { outline:2px solid AccentColor; outline-offset:2px; }
.pane-control input[aria-invalid=true] { outline:2px solid #d94848; }
.pane-control-error { color:light-dark(#a51c30,#ff9ca9); font-size:12px; }
.pane-control-note { font-size:12px; opacity:.8; }
#pane-settings-preview { display:block; width:100%; box-sizing:border-box; padding:16px; margin:12px 0; border:1px solid color-mix(in srgb,currentColor 18%,transparent); border-radius:16px; }
.pane-settings-section { display:block; margin:10px 0; border:1px solid color-mix(in srgb,currentColor 12%,transparent); border-radius:12px; overflow:hidden; }
.pane-settings-section > summary { cursor:pointer; padding:14px 16px; font-weight:600; font-size:15px; }
.pane-settings-section > summary:focus-visible { outline:2px solid AccentColor; outline-offset:-3px; }
.pane-settings-section[open] > summary { border-bottom:1px solid color-mix(in srgb,currentColor 8%,transparent); }
.pane-settings-section-body { display:block; padding:8px 16px 14px; }
.pane-settings-section-body > [hidden] { display:none !important; }
.pane-settings-section-body .sineItemPreferenceLabel { font-size:13px; }
.pane-settings-section-body .pane-control-note { line-height:1.5; }
.pane-control button { appearance:none; border:1px solid color-mix(in srgb,currentColor 16%,transparent); border-radius:8px; padding:5px 9px; min-width:0; font:12px system-ui; cursor:pointer; }
.pane-control-line input[type=text] { max-width:420px; }
.pane-preview-stage { padding:22px; margin-block:12px; background:linear-gradient(125deg,#7b64ad,#649cae 50%,#c391a0); border-radius:12px; overflow:hidden; }
.pane-preview-card { box-sizing:border-box; max-width:100%; margin:auto; border:1px solid #ffffff44; box-shadow:0 8px 20px #0003; }
.pane-preview-sample { border:1px solid; border-radius:8px; min-width:0; overflow:hidden; }
.pane-preview-sample strong,.pane-preview-sample small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; }
.pane-preview-sample small { opacity:.65; margin-top:3px; }
.pane-preview-tabs { display:grid; gap:6px; margin-top:10px; }
.pane-preview-footer { margin-top:10px; font-size:10px; opacity:.7; }
.pane-preview-footer[hidden] { display:none !important; }
.pane-settings-mini-preview { display:block; padding:12px; margin:8px 0 12px; border:1px solid color-mix(in srgb,currentColor 10%,transparent); border-radius:12px; }
.pane-settings-mini-preview > strong { display:block; font-size:12px; margin-bottom:10px; opacity:.8; }
.pane-settings-mini-preview .pane-preview-card { padding:14px; }
.pane-preview-stack { display:flex; height:100px; overflow:hidden; border-radius:10px; background:#20212a; margin-bottom:8px; }
.pane-preview-edge { box-sizing:border-box; width:36px; padding:10px; writing-mode:vertical-rl; color:#eee; background:#555068; box-shadow:5px 0 12px #0005; z-index:1; }
.pane-preview-edge:nth-child(2) { background:#686078; }
.pane-preview-expanded { flex:1; padding:18px; color:#eee; background:#292934; font-size:12px; }
.pane-settings-mini-preview > small { font-size:11px; opacity:.7; }
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
function shortcutControl(setting, box) {
  const id = `pane-control-${setting.key}`;
  const display = element('input', {id, type:'text', readonly:'true', 'aria-label':setting.label});
  const note = element('span', {class:'pane-control-note', 'aria-live':'polite'});
  const change = element('button', {type:'button'}, 'Change shortcut');
  const reset = element('button', {type:'button'}, 'Use default');
  const disable = element('button', {type:'button'}, 'Disable');
  let recording = false, held = '', warnedBinding='';
  const sync = () => {
    const record=accordionBindings(prefs).find(r=>r.key===setting.key);
    const binding = setting.picker ? pickerBinding(prefs) : setting.hold ? scrollingModifiers(prefs)
      : setting.key === 'diagnostics-keybinding' ? diagnosticsBinding(prefs)
      : accordionBindings(prefs).find(r=>r.key===setting.key)?.binding;
    display.setAttribute('aria-invalid',String(Boolean(record?.error)));
    display.value = setting.hold && binding ? shortcutLabel(binding).replace('+Space','') : shortcutLabel(binding);
    change.textContent = recording ? 'Cancel' : 'Change shortcut';
    change.toggleAttribute('data-pane-recording', recording);
    note.textContent = recording ? (setting.hold ? 'Hold your modifier keys, then release to save. Escape cancels.' : 'Press your shortcut. Escape cancels.') : record?.error || 'Click Change shortcut, then press the keys you want. Zen and system conflicts cannot be detected reliably.';
    display.toggleAttribute('data-recording',recording);
  };
  const stop = () => {
    recording=false; held=''; warnedBinding='';
    window.removeEventListener('keydown', captureDown, true);
    window.removeEventListener('keyup', captureUp, true);
    window.removeEventListener('blur', stop);
    document.removeEventListener('pointerdown', outsideRecorder, true);
    if (stopRecording===stop) {stopRecording=null; document.documentElement.removeAttribute('data-pane-recording');}
    sync();
  };
  const outsideRecorder = event => {if (!box.contains(event.target)) stop();};
  const save = value => {
    if (!setting.hold) {
      const binding = parseBinding(value);
      const candidates = [
        {key:'shortcut', label:'Open Pane', binding:pickerBinding(prefs)},
        {key:'diagnostics-keybinding', label:'Diagnostic report', binding:diagnosticsBinding(prefs)},
        ...accordionBindings(prefs),
      ];
      const conflict = candidates.find(other=>other.key !== setting.key && other.binding?.label === binding?.label);
      if (conflict) { note.textContent = `Already used by ${conflict.label}. Press another combination.`; return; }
    }
    if (setting.picker) { prefs.setStringPref(prefix+'custom-shortcut',value); prefs.setIntPref(prefix+'shortcut',3); }
    else if (setting.hold) {prefs.setStringPref(prefix+'scrolling-custom-modifier',value); prefs.setIntPref(prefix+'scrolling-modifier',3);}
    else prefs.setStringPref(prefix+setting.key,value);
    stop(); refresh();
  };
  change.addEventListener('click',()=>{
    if (recording) return stop();
    stopRecording?.();
    recording=true; held=''; stopRecording=stop;
    document.documentElement.setAttribute('data-pane-recording','true');
    window.addEventListener('keydown',captureDown,true);
    window.addEventListener('keyup',captureUp,true);
    window.addEventListener('blur',stop);
    document.addEventListener('pointerdown',outsideRecorder,true);
    sync();
  });
  const captureDown = event=>{
    if (!box.isConnected) return stop();
    if (!recording) return;
    if (event.key==='Tab') return stop();
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.key==='Escape') return stop();
    if (setting.hold) {
      if (!event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {note.textContent='Hold Control, Option/Alt, Shift or Command.'; return;}
      held = [event.ctrlKey&&'Ctrl',event.altKey&&'Alt',event.shiftKey&&'Shift',event.metaKey&&'Command'].filter(Boolean).join('+');
      display.value=held; return;
    }
    const binding=bindingFromEvent(event);
    if (binding && /^[a-z0-9]$/i.test(binding.key) && !binding.ctrlKey && !binding.altKey && !binding.shiftKey && !binding.metaKey && warnedBinding!==binding.label) {
      warnedBinding=binding.label;note.textContent='This shortcut may intercept typing. Press it again to use it, or choose a modifier/function key.'; return;
    }
    if (binding) save(binding.label);
  };
  const captureUp = event=>{
    if (!recording || !setting.hold || !held) return;
    event.preventDefault(); event.stopImmediatePropagation(); save(held);
  };
  reset.addEventListener('click',()=>{
    if (setting.picker || setting.hold) prefs.setIntPref(prefix+setting.key,0);
    else prefs.clearUserPref(prefix+setting.key);
    stop(); refresh();
  });
  disable.addEventListener('click',()=>{
    if (setting.picker || setting.hold) prefs.setIntPref(prefix+setting.key,2);
    else prefs.setStringPref(prefix+setting.key,'Disabled');
    stop(); refresh();
  });
  const line=element('div',{class:'pane-control-line'});
  line.append(display,change,reset,disable);
  box.append(element('label',{for:id},setting.label),line,note);
  return sync;
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
      if (!['recent-count', 'scrolling-width'].includes(setting.key)) prefs.clearUserPref(prefix + setting.key);
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
  card.append(element('strong', {}, 'Replace this pane'), element('div', { class:'pane-preview-tabs' }), element('div', { class:'pane-preview-footer' }, '↑ ↓ Navigate · Enter Replace · Esc Cancel'));
  stage.append(card);
  mode.addEventListener('change', refresh);
  preview.append(top, stage, element('div', { class:'pane-control-note' }, 'Changes save automatically. Editing tint, blur, or corners selects Custom glass. The preview fits this panel; the picker uses your saved width.'));
  host.before(preview);
}
function refresh() {
  for (const row of hiddenRows.keys()) if (row.isConnected) row.hidden=true;
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
  renderPickerPreview(card);
  for (const [host, record] of extraPreviews) {
    if (!host.isConnected) { record.node.remove(); extraPreviews.delete(host); continue; }
    if (record.kind === 'accordion') {
      const width = numericValue('accordion-border-width', prefs);
      for (const pane of record.node.querySelectorAll('.pane-preview-edge')) {
        pane.style.borderRight = 'none';
        pane.style.backgroundImage = `linear-gradient(${readColor(colorSettings[3])}, ${readColor(colorSettings[3])})`;
        pane.style.backgroundSize = `${width}px calc(100% - 20px)`;
        pane.style.backgroundPosition = 'right center';
        pane.style.backgroundRepeat = 'no-repeat';
      }
      const active = record.node.querySelector('.pane-preview-expanded');
      active.style.boxShadow = `inset 0 0 0 ${numericValue('accordion-active-border-width', prefs)}px ${readColor(colorSettings[4])}`;
      active.style.borderRadius = '10px';
    } else {
      record.card.style.background = card.style.background;
      record.card.style.color = card.style.color;
      record.card.style.borderRadius = card.style.borderRadius;
      renderPickerPreview(record.card);
    }
  }
}
function renderPickerPreview(card) {
  const count = numericValue('recent-count', prefs);
  const columns = prefs.getIntPref(prefix + 'grid-columns', 0) || 2;
  const list = card.querySelector('.pane-preview-tabs');
  list.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
  const urls = prefs.getBoolPref(prefix + 'show-urls', true);
  const signature = `${count}:${urls}`;
  if (list.dataset.signature !== signature) {
    list.dataset.signature = signature;
    list.replaceChildren();
    for (let i = 0; i < count; i++) {
      const tab = element('div', { class:'pane-preview-sample' });
      tab.append(element('strong', {}, ['Project notes', 'Design ideas', 'Pane roadmap', 'Documentation'][i % 4]));
      if (urls) tab.append(element('small', {}, ['notes.example', 'design.example', 'github.com', 'docs.example'][i % 4]));
      list.appendChild(tab);
    }
  }
  for (const tab of list.children) {
    tab.style.padding = `${numericValue('item-spacing', prefs)}px 9px`;
    tab.style.borderColor = readColor(colorSettings[0]);
  }
  card.querySelector('.pane-preview-footer').hidden = !prefs.getBoolPref(prefix + 'show-help', true);
}
function buildExtraPreviews() {
  let added = false;
  for (const [key, kind] of [['accordion-border-width', 'accordion'], ['recent-count', 'tabs'], ['tint-light', 'glass']]) {
    const host = document.getElementById(`mod-pane-${key}`);
    if (!host || extraPreviews.has(host)) continue;
    const node = element('section', { class:'pane-settings-mini-preview', 'aria-label':`${kind} live preview` });
    node.append(element('strong', {}, kind === 'accordion' ? 'Accordion edges' : 'Live preview'));
    let card;
    if (kind === 'accordion') {
      const stack = element('div', { class:'pane-preview-stack' });
      stack.append(element('div', { class:'pane-preview-edge' }, 'Notes'), element('div', { class:'pane-preview-edge' }, 'Design'), element('div', { class:'pane-preview-expanded' }, 'Your active page'));
      node.append(stack, element('small', {}, 'Edges use shadows when thickness is 0.'));
    } else {
      card = element('div', { class:'pane-preview-card' });
      card.append(element('strong', {}, 'Replace this pane'), element('div', { class:'pane-preview-tabs' }), element('div', { class:'pane-preview-footer' }, '↑ ↓ Navigate · Enter Replace · Esc Cancel'));
      node.append(card);
    }
    host.before(node);
    extraPreviews.set(host, { node, card, kind });
    added = true;
  }
  return added;
}

function organizeSections() {
  for (const [marker, record] of sections) if (!record.group.isConnected) sections.delete(marker);
  const names = settingsSections;
  for (let index = 0; index < names.length; index++) {
    const marker = document.getElementById(`mod-pane-section-${names[index][0]}`);
    if (!marker || sections.has(marker)) continue;
    const nodes = [marker];
    let next = marker.nextElementSibling;
    while (next && !next.id.startsWith('mod-pane-section-')) {
      nodes.push(next); next = next.nextElementSibling;
    }
    const group = element('details', { class:'pane-settings-section' });
    if (index === 0) group.open = true;
    const summary = element('summary', {}, names[index][1]);
    const content = element('div', { class:'pane-settings-section-body' });
    marker.before(group);
    group.append(summary, content);
    const reset=element('button',{type:'button',class:'pane-section-reset'},'Reset this section');
    reset.addEventListener('click',()=>{
      stopRecording?.();
      const owned=[...content.querySelectorAll('[id]')].map(node=>node.id).filter(id=>id.startsWith('mod-pane-') && !id.startsWith('mod-pane-section-'));
      for (const id of owned) {const key=prefix+id.slice('mod-pane-'.length);if (prefs.prefHasUserValue(key)) prefs.clearUserPref(key);}
      refresh();
    });
    content.append(reset);
    // Preserve native preference nodes and their event listeners.
    for (const node of nodes.slice(1)) content.appendChild(node);
    marker.hidden = true;
    content.prepend(marker);
    sections.set(marker, { group, nodes });
  }
}

function scan() {
  frame = 0;
  organizeSections();
  const openSection=document.getElementById('mod-pane-section-0');
  if (openSection && !document.getElementById('pane-complete-settings') && !location.href.includes('/settings.html')) {
    const complete=element('button',{id:'pane-complete-settings',type:'button'},'Open complete Pane settings');
    complete.addEventListener('click',()=>Services.wm.getMostRecentWindow('navigator:browser')?.openTrustedLinkIn('chrome://sine/content/zen-pane-manager/settings.html','tab'));
    openSection.after(complete);
  }
  for (const key of ['custom-shortcut','scrolling-custom-modifier']) {
    const row = document.getElementById('mod-pane-'+key);
    if (row) {if (!hiddenRows.has(row)) hiddenRows.set(row,row.hidden);row.hidden = true;}
  }
  for (const setting of [...numericSettings, ...colorSettings, ...shortcutSettings]) {
    const row = document.getElementById((prefix + setting.key).replaceAll('.','-'));
    if (!row || rows.has(row)) continue;
    const original = [...row.childNodes];
    const box = element('div', { class:'pane-control' });
    const sync = setting.defaultBinding ? shortcutControl(setting, box) : setting.min !== undefined ? numberControl(setting, box) : colorControl(setting, box);
    row.replaceChildren(box);
    rows.set(row, { original, sync });
    sync();
  }
  const addedPreview = buildExtraPreviews();
  const host = document.getElementById('mod-pane-accent-color');
  if (host && (!preview?.isConnected || previewHost !== host)) { preview?.remove(); buildPreview(host); refresh(); }
  else if (addedPreview) refresh();
}
function schedule() { if (!frame) frame = window.requestAnimationFrame(scan); }
const observer = new MutationObserver(schedule);
observer.observe(document.documentElement, { childList:true, subtree:true });
const preferenceObserver = { observe:refresh };
prefs.addObserver(prefix, preferenceObserver);
const scheme = window.matchMedia('(prefers-color-scheme: dark)');
scheme.addEventListener('change', refresh);
function destroy() {
  stopRecording?.();
  document.getElementById('pane-complete-settings')?.remove();
  document.querySelectorAll('.pane-section-reset').forEach(node=>node.remove());
  for (const [row,hidden] of hiddenRows) row.hidden=hidden;
  hiddenRows.clear();
  window.removeEventListener("unload", destroy);
  observer.disconnect();
  if (frame) window.cancelAnimationFrame(frame);
  prefs.removeObserver(prefix, preferenceObserver);
  scheme.removeEventListener('change', refresh);
  for (const [row, record] of rows) if (row.isConnected) row.replaceChildren(...record.original);
  rows.clear(); preview?.remove();
  for (const [marker, {group, nodes}] of sections) {
    if (group.isConnected) { for (const node of nodes) group.before(node); group.remove(); marker.hidden = false; }
  }
  sections.clear();
  for (const record of extraPreviews.values()) record.node.remove();
  extraPreviews.clear(); style.remove();
  if (window[INSTANCE]?.destroy === destroy) delete window[INSTANCE];
}
window[INSTANCE] = { destroy };
window.addUnloadListener?.(destroy);
window.addEventListener("unload", destroy, { once:true });
scan();
