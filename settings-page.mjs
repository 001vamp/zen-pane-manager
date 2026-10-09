// This Source Code Form is subject to the Mozilla Public License, v. 2.0.
// You can obtain a copy at https://mozilla.org/MPL/2.0/.
import { numericSettings, colorSettings, conditionMatches } from './appearance.mjs?pane=0.11.0-labels';
import { shortcutSettings } from './keybindings.mjs?pane=0.11.0-macos-shortcut';
try {
  // This page is served from Sine's privileged chrome URI, never from the web.
  document.getElementById('show-updates').addEventListener('click', () => {
    const browserWindow = Services.wm.getMostRecentWindow('navigator:browser');
    if (browserWindow?.__paneInstance?.showUpdates) browserWindow.__paneInstance.showUpdates();
    else document.getElementById('load-error').textContent = 'Enable Pane in Sine and restart Zen to open the guide.';
  });
  const rows = document.getElementById('rows');
  const settings=await (await fetch(new URL('./preferences.json',import.meta.url))).json();
  const refreshers=[];
  const registered=new Set();
  for (const setting of settings) {
    const row=document.createElement('div');
    if (setting.property || setting.id) row.id=(setting.property ?? setting.id).replaceAll('.','-');
    rows.append(row);
    if (!setting.property) {row.textContent=setting.label ?? '';continue;}
    registered.add(setting.property.slice('mod.pane.'.length));
    const label=document.createElement('label');label.textContent=setting.label;
    const input=document.createElement(setting.type==='dropdown'?'select':'input');
    input.id=row.id+'-input';label.htmlFor=input.id;
    if (setting.type==='dropdown') for (const option of setting.options) {
      const node=document.createElement('option');node.value=option.value;node.textContent=option.label;input.append(node);
    }
    else input.type=setting.type==='checkbox'?'checkbox':'text';
    const read=()=>setting.type==='checkbox'?Services.prefs.getBoolPref(setting.property,setting.defaultValue):setting.value==='number'?Services.prefs.getIntPref(setting.property,setting.defaultValue):Services.prefs.getStringPref(setting.property,setting.defaultValue);
    const sync=()=>{
      if(setting.type==='checkbox')input.checked=read();else input.value=read();
      const condition=setting.conditions?.if ?? setting.conditions?.not;
      if(condition) {
        const matches=conditionMatches(Services.prefs,condition,settings);
        row.hidden=['mod.pane.custom-shortcut','mod.pane.scrolling-custom-modifier'].includes(setting.property) || (setting.conditions.if?!matches:matches);
      }
    };
    input.addEventListener('change',()=>{
      if(setting.type==='checkbox')Services.prefs.setBoolPref(setting.property,input.checked);
      else if(setting.value==='number')Services.prefs.setIntPref(setting.property,Number(input.value));
      else Services.prefs.setStringPref(setting.property,input.value);
    });
    row.append(label,input);sync();refreshers.push(sync);
  }
  for (const setting of [...numericSettings,...colorSettings,...shortcutSettings]) if (!registered.has(setting.key)) {
    const row=document.createElement('div');row.id='mod-pane-'+setting.key;rows.append(row);
  }
  const observer={observe:()=>refreshers.forEach(sync=>sync())};
  Services.prefs.addObserver('mod.pane.',observer);
  window.addEventListener('unload',()=>Services.prefs.removeObserver('mod.pane.',observer),{once:true});
  await import('./pane-settings.uc.mjs?pane=0.11.0-labels');
} catch (error) {
  document.getElementById('load-error').textContent = 'Pane could not open its appearance controls. Enable Pane in Sine and restart Zen, then try again.';
  console.error('[Pane appearance]',error);
}
