// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

const modifiers = { ctrl: 'ctrlKey', control: 'ctrlKey', alt: 'altKey', option: 'altKey', shift: 'shiftKey', meta: 'metaKey', cmd: 'metaKey', command: 'metaKey', super: 'metaKey', win: 'metaKey' };
const names = { space: ' ', spacebar: ' ', esc: 'Escape', escape: 'Escape', enter: 'Enter', return: 'Enter', tab: 'Tab', backspace: 'Backspace', delete: 'Delete', insert: 'Insert', home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', arrowup: 'ArrowUp', arrowdown: 'ArrowDown', arrowleft: 'ArrowLeft', arrowright: 'ArrowRight', plus: '+', minus: '-' };

export function parseBinding(value) {
  const parts = String(value).trim().split('+').map(part => part.trim());
  const binding = { ctrlKey: false, altKey: false, shiftKey: false, metaKey: false };
  const last = parts.pop()?.toLowerCase();
  for (const part of parts) {
    const modifier = modifiers[part.toLowerCase()];
    if (!modifier || binding[modifier]) return null;
    binding[modifier] = true;
  }
  if (!last || modifiers[last]) return null;
  binding.key = names[last] ?? (/^f([1-9]|1\d|2[0-4])$/.test(last) ? last.toUpperCase() : [...last].length === 1 ? last : null);
  if (!binding.key) return null;
  binding.label = [binding.ctrlKey && 'Ctrl', binding.altKey && 'Alt', binding.shiftKey && 'Shift', binding.metaKey && 'Command', binding.key === ' ' ? 'Space' : binding.key === '+' ? 'Plus' : binding.key.length === 1 ? binding.key.toUpperCase() : binding.key].filter(Boolean).join('+');
  return binding;
}

export function matchesBinding(event, binding) {
  if (!binding || event.repeat || event.isComposing) return false;
  // Real macOS Option events report AltGraph, unlike WebDriver's synthetic Alt.
  // Keep rejecting Windows/Linux AltGr text entry without rejecting Mac shortcuts.
  const platform = event.view?.navigator?.platform ?? globalThis.navigator?.platform ?? '';
  if (event.getModifierState?.('AltGraph') && !/Mac/i.test(platform)) return false;
  if (['ctrlKey', 'altKey', 'shiftKey', 'metaKey'].some(key => Boolean(event[key]) !== binding[key])) return false;
  // Option changes event.key on macOS (Option+R produces ®). Match the
  // physical letter/digit while Option is held so the default still works.
  if (binding.altKey && /^[a-z0-9]$/.test(binding.key) && /^(Key[A-Z]|Digit[0-9])$/.test(event.code ?? '')) {
    return event.code === (/^[a-z]$/.test(binding.key) ? `Key${binding.key.toUpperCase()}` : `Digit${binding.key}`);
  }
  return String(event.key).toLowerCase() === binding.key.toLowerCase();
}

const currentPlatform = () => globalThis.navigator?.platform ?? '';

export function defaultPickerBinding(platform = currentPlatform()) {
  return parseBinding(/Mac/i.test(platform) ? 'Ctrl+Alt+R' : 'Alt+Shift+P');
}

export function defaultDiagnosticsBinding(platform = currentPlatform()) {
  return parseBinding(/Mac/i.test(platform) ? 'Ctrl+Alt+D' : 'Alt+Shift+D');
}

export function diagnosticsBinding(prefs, platform = currentPlatform()) {
  let configured = 'Auto';
  try { configured = prefs.getStringPref('mod.pane.diagnostics-keybinding', 'Auto'); } catch {}
  // Move untouched Windows/Linux installs away from the previous default.
  if (configured === 'Auto' || (!/Mac/i.test(platform) && configured === 'Ctrl+Alt+D')) {
    return defaultDiagnosticsBinding(platform);
  }
  return parseBinding(configured);
}

export function pickerBinding(prefs, platform = currentPlatform()) {
  let selection = 0;
  try { selection = prefs.getIntPref('mod.pane.shortcut', 0); } catch {}
  if (selection === 2) return null;
  if (selection === 3) {
    try { return parseBinding(prefs.getStringPref('mod.pane.custom-shortcut', '')); } catch { return null; }
  }
  return selection === 1 ? parseBinding('Alt+Shift+P') : defaultPickerBinding(platform);
}

export const accordionShortcuts = [
  { key: 'accordion-previous', label: 'Previous accordion tab', value: 'Auto', defaultBinding: 'Alt+Shift+Left' },
  { key: 'accordion-next', label: 'Next accordion tab', value: 'Auto', defaultBinding: 'Alt+Shift+Right' },
];

export function shortcutLabel(binding, platform = currentPlatform()) {
  if (!binding) return 'Disabled';
  return binding.label.replace('Alt', /Mac/i.test(platform) ? 'Option' : 'Alt')
    .replace('ArrowLeft', '←').replace('ArrowRight', '→');
}

// Conflicting navigation bindings are inactive until the user changes them.
export function accordionBindings(prefs, platform = currentPlatform()) {
  const records = accordionShortcuts.map(setting => {
    const value = prefs?.getStringPref?.(`mod.pane.${setting.key}`, 'Auto') ?? 'Auto';
    const disabled = !value.trim() || /^disabled$/i.test(value.trim());
    const binding = disabled ? null : parseBinding(/^auto$/i.test(value.trim()) ? setting.defaultBinding : value);
    return { ...setting, binding, error: !disabled && !binding ? 'Use a shortcut such as Alt+Shift+Left, Auto, or Disabled.' : '' };
  });
  const reserved = [{ label: 'the picker', binding: pickerBinding(prefs ?? {}, platform) }];
  if (prefs?.getBoolPref?.('mod.pane.diagnostics-shortcut', true) !== false) {
    reserved.push({ label: 'diagnostics', binding: diagnosticsBinding(prefs ?? {}, platform) });
  }
  for (const record of records) {
    const conflict = [...reserved, ...records.filter(other => other !== record)]
      .find(other => record.binding && other.binding?.label === record.binding.label);
    if (conflict) record.error = `Already used by ${conflict.label}. Choose another shortcut.`;
  }
  for (const record of records) if (record.error) record.binding = null;
  return records;
}
