// This Source Code Form is subject to the Mozilla Public License, v. 2.0.
// You can obtain a copy at https://mozilla.org/MPL/2.0/.
import { numericSettings, colorSettings } from './appearance.mjs';
try {
  // This page is served from Sine's privileged chrome URI, never from the web.
  const rows = document.getElementById('rows');
  for (const setting of [colorSettings[0], ...numericSettings, ...colorSettings.slice(1)]) {
    const row = document.createElement('div');
    row.id = 'mod-pane-' + setting.key;
    rows.append(row);
  }
  const preset = document.getElementById('preset');
  const sync = () => { preset.value = String(Services.prefs.getIntPref('mod.pane.style-preset',0)); };
  const observer = { observe:sync };
  sync();
  preset.addEventListener('change', () => Services.prefs.setIntPref('mod.pane.style-preset',Number(preset.value)));
  Services.prefs.addObserver('mod.pane.style-preset',observer);
  window.addEventListener('unload', () => Services.prefs.removeObserver('mod.pane.style-preset',observer), {once:true});
  await import('./pane-settings.uc.mjs');
} catch (error) {
  document.getElementById('load-error').textContent = 'Pane could not open its appearance controls. Enable Pane in Sine and restart Zen, then try again.';
  console.error('[Pane appearance]',error);
}
