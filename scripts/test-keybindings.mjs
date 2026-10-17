import assert from 'node:assert/strict';
import { parseBinding, matchesBinding, pickerBinding, defaultPickerBinding, defaultDiagnosticsBinding, diagnosticsBinding, accordionBindings, accordionShortcuts, shortcutLabel, hubCycleConflict, isHubCycleBinding, isHubCycleChord, pickerShortcutAction, windowPlatform } from '../keybindings.mjs';
const event = overrides => ({key:'r', code:'KeyR',ctrlKey:true,altKey:true,shiftKey:false,metaKey:false,...overrides});
assert.throws(() => pickerBinding({getIntPref:()=>0}), /platform.*required/i, 'picker callers must supply their window platform');
assert.throws(() => pickerShortcutAction(event({}), {binding:parseBinding('Ctrl+Alt+R')}), /platform.*required/i, 'shortcut arbitration must not infer a platform');
assert.throws(() => defaultPickerBinding(), /platform.*required/i);
assert.throws(() => defaultDiagnosticsBinding(), /platform.*required/i);
assert.throws(() => diagnosticsBinding({getStringPref:()=>'Auto'}), /platform.*required/i);
assert.throws(() => accordionBindings({getStringPref:()=>'Auto'}), /platform.*required/i);
assert.throws(() => shortcutLabel(parseBinding('Ctrl+K')), /platform.*required/i);
assert.throws(() => windowPlatform({}), /platform.*required/i);
assert.equal(windowPlatform({navigator:{platform:'MacIntel'}}),'MacIntel');
for (const platform of [undefined, null, '', '  ']) {
  for (const selection of [0, 1, 2, 3]) {
    assert.throws(() => pickerBinding({getIntPref:()=>selection}, platform), TypeError);
  }
  assert.throws(() => pickerShortcutAction(event({}), {platform}), TypeError);
  assert.throws(() => pickerShortcutAction({ctrlKey:true,shiftKey:true,code:'BracketRight'}, {overlayOpen:true,platform}), TypeError, 'cycling cannot bypass the platform contract');
}
assert.throws(() => pickerShortcutAction(event({})), /platform.*required/i);
assert.equal(shortcutLabel(parseBinding('Ctrl+Alt+Command+K'), 'MacIntel'), 'Control+Option+Command+K');
assert.equal(shortcutLabel(parseBinding('Ctrl+Alt+R'), 'MacIntel'), 'Control+Option+R');
assert.equal(shortcutLabel(parseBinding('Ctrl+Alt+K'), 'Win32'), 'Ctrl+Alt+K', 'Windows keeps Ctrl and Alt');
assert.equal(shortcutLabel(parseBinding('Ctrl+Alt+K'), 'Linux x86_64'), 'Ctrl+Alt+K', 'Linux keeps Ctrl and Alt');
assert.equal(shortcutLabel(parseBinding('Ctrl+Shift+L'), 'Win32'), 'Ctrl+Shift+L');
assert.equal(shortcutLabel(parseBinding('Alt+Shift+P'), 'Linux x86_64'), 'Alt+Shift+P');
const defaultBinding = pickerBinding({getIntPref:()=>0}, 'MacIntel');
assert.equal(defaultBinding.label,'Ctrl+Alt+R');
assert.equal(pickerBinding({getIntPref:()=>0}, 'Win32').label,'Alt+Shift+P');
assert.equal(pickerBinding({getIntPref:()=>1}, 'MacIntel').label,'Alt+Shift+P');
assert.equal(defaultDiagnosticsBinding('Win32').label,'Alt+Shift+D');
assert.equal(defaultDiagnosticsBinding('MacIntel').label,'Ctrl+Alt+D');
assert.equal(diagnosticsBinding({getStringPref:()=> 'Auto'}, 'Win32').label,'Alt+Shift+D');
assert.equal(diagnosticsBinding({getStringPref:()=> 'Ctrl+Alt+D'}, 'Win32').label,'Alt+Shift+D');
assert.equal(diagnosticsBinding({getStringPref:()=> 'Alt+F6'}, 'Win32').label,'Alt+F6');
assert.ok(matchesBinding(event({}),defaultBinding));
assert.ok(matchesBinding(event({key:'®'}),defaultBinding),'Mac Option must not break default');
assert.ok(!matchesBinding(event({code:'KeyS',key:'ß'}),defaultBinding));
for (const extra of [{repeat:true},{isComposing:true},{shiftKey:true},{metaKey:true},{getModifierState:()=>true,view:{navigator:{platform:"Win32"}}}]) assert.ok(!matchesBinding(event(extra),defaultBinding));
assert.equal(parseBinding('Control+Option+R').label,defaultBinding.label);
assert.ok(matchesBinding(event({key:'P',code:'KeyP',ctrlKey:false,altKey:false,metaKey:true,shiftKey:true}),parseBinding('Command+Shift+P')));
assert.ok(matchesBinding(event({key:'F8',ctrlKey:false,altKey:false}),parseBinding('F8')));
assert.ok(matchesBinding(event({key:'+',ctrlKey:false,altKey:false,shiftKey:true}),parseBinding('Shift+Plus')));
assert.ok(matchesBinding(event({key:'ArrowLeft',altKey:false}),parseBinding('Ctrl+Left')));
assert.ok(matchesBinding(event({key:'q',code:'KeyA',altKey:false}),parseBinding('Ctrl+Q')),'non-Option bindings follow the keyboard layout');
for (const invalid of ['', 'Ctrl', 'Ctrl++R', 'Ctrl+Ctrl+R','Hyper+R','Ctrl+made-up','F25']) assert.equal(parseBinding(invalid),null);
assert.equal(pickerBinding({getIntPref:()=>2}, 'MacIntel'),null);
assert.equal(pickerBinding({getIntPref:()=>3,getStringPref:()=> 'bad binding'}, 'MacIntel'),null);
assert.equal(pickerBinding({getIntPref:()=>3,getStringPref:()=> 'Cmd+K'}, 'MacIntel').label,'Command+K');
assert.ok(matchesBinding(event({key:'®',getModifierState:()=>true,view:{navigator:{platform:'MacIntel'}}}),defaultBinding),'Real Mac Option reports AltGraph and must match');
assert.ok(!matchesBinding(event({key:'r',getModifierState:()=>true,view:{navigator:{platform:'Linux x86_64'}}}),defaultBinding),'Linux AltGr must not trigger a shortcut');
const prefs = values => ({getStringPref:(key,fallback)=>values[key] ?? fallback,getIntPref:()=>0,getBoolPref:(key,fallback)=>values[key] ?? fallback});
for (const platform of ['MacIntel','Win32','Linux x86_64']) {
  const bindings = accordionBindings(prefs({}),platform);
  assert.equal(bindings[0].binding.label,'Alt+Shift+ArrowLeft');
  assert.equal(bindings[1].binding.label,'Alt+Shift+ArrowRight');
  assert.equal(bindings[2].binding.label,/Mac/i.test(platform) ? 'Ctrl+Shift+L' : 'Alt+Shift+L');
  assert.equal(bindings[3].binding.label,/Mac/i.test(platform) ? 'Ctrl+Shift+Plus' : 'Alt+Shift+Plus');
  assert.equal(bindings[4].binding.label,/Mac/i.test(platform) ? 'Ctrl+Shift+Minus' : 'Alt+Shift+Minus');
  assert.ok(bindings.every(record=>!record.error), `${platform} default layout bindings do not collide`);
  assert.ok(matchesBinding(event({key:'ArrowRight',ctrlKey:false,shiftKey:true}),bindings[1].binding));
  assert.ok(matchesBinding(event({key:'=',code:'Equal',ctrlKey:/Mac/i.test(platform),altKey:!/Mac/i.test(platform),shiftKey:true}),bindings[3].binding));
  assert.ok(matchesBinding(event({key:'_',code:'Minus',ctrlKey:/Mac/i.test(platform),altKey:!/Mac/i.test(platform),shiftKey:true}),bindings[4].binding));
  assert.ok(matchesBinding(event({key:'Add',code:'NumpadAdd',ctrlKey:/Mac/i.test(platform),altKey:!/Mac/i.test(platform),shiftKey:true}),bindings[3].binding));
  assert.ok(matchesBinding(event({key:'Subtract',code:'NumpadSubtract',ctrlKey:/Mac/i.test(platform),altKey:!/Mac/i.test(platform),shiftKey:true}),bindings[4].binding));
  assert.ok(!matchesBinding(event({key:'ArrowRight',ctrlKey:false,shiftKey:false}),bindings[1].binding));
}
assert.equal(shortcutLabel(accordionBindings(prefs({}),'MacIntel')[0].binding,'MacIntel'),'Option+Shift+←');
for (const disabled of ['Disabled','disabled','']) assert.equal(accordionBindings(prefs({'mod.pane.accordion-next':disabled}),'Win32')[1].binding,null);
const duplicate = accordionBindings(prefs({'mod.pane.accordion-previous':'Alt+Shift+Right'}),'Win32');
assert.ok(duplicate.slice(0,2).every(record=>record.error && !record.binding),'both duplicate navigation bindings are disabled');
assert.match(accordionBindings(prefs({'mod.pane.accordion-next':'Alt+Shift+P'}),'Win32')[1].error,/picker/);
assert.match(accordionBindings(prefs({'mod.pane.accordion-next':'Alt+Shift+D'}),'Win32')[1].error,/diagnostics/);
assert.ok(accordionBindings(prefs({'mod.pane.accordion-next':'Alt+Shift+D','mod.pane.diagnostics-shortcut':false}),'Win32')[1].binding);
assert.ok(accordionBindings(prefs({'mod.pane.accordion-next':'Hyper+R'}),'Win32')[1].error);
assert.equal(accordionBindings(prefs({'mod.pane.accordion-next':'Ctrl+F8'}),'Win32')[1].binding.label,'Ctrl+F8');
console.log('Keybinding tests passed, including accordion customization and conflicts.');

const { bindingFromEvent } = await import('../keybindings.mjs');
assert.equal(bindingFromEvent({key:'®',code:'KeyR',altKey:true}).label, 'Alt+R');
assert.equal(bindingFromEvent({key:'ArrowLeft',altKey:true,shiftKey:true}).label, 'Alt+Shift+ArrowLeft');
assert.equal(bindingFromEvent({key:'+',ctrlKey:true}).label, 'Ctrl+Plus');
assert.equal(bindingFromEvent({key:'Shift',shiftKey:true}), null);
assert.equal(bindingFromEvent({key:'r',repeat:true}), null);

const {scrollingModifiers} = await import('../keybindings.mjs');
assert.equal(scrollingModifiers({getIntPref:()=>2}), null);
const customHold = scrollingModifiers({getIntPref:()=>3,getStringPref:()=> 'Ctrl+Shift'});
assert.equal(customHold.ctrlKey, true);
assert.equal(customHold.shiftKey, true);
assert.equal(customHold.altKey, false);
assert.equal(scrollingModifiers({getIntPref:()=>3,getStringPref:()=> 'garbage'}), null);

assert.equal(accordionBindings(prefs({}),'MacIntel')[2].binding.label,'Ctrl+Shift+L');
assert.equal(accordionShortcuts.find(shortcut=>shortcut.key==='layout-menu').macDefaultBinding,'Ctrl+Shift+L');
assert.equal(accordionShortcuts.find(shortcut=>shortcut.key==='accordion-widen').macDefaultBinding,'Ctrl+Shift+Plus');
assert.equal(accordionShortcuts.find(shortcut=>shortcut.key==='accordion-narrow').defaultBinding,'Alt+Shift+Minus');
assert.equal(accordionBindings(prefs({}),'Win32')[2].binding.label,'Alt+Shift+L');
assert.equal(accordionBindings(prefs({}),'Linux x86_64')[2].binding.label,'Alt+Shift+L');
assert.equal(accordionBindings(prefs({'mod.pane.layout-menu':'Disabled'}),'Win32')[2].binding,null);
assert.equal(accordionBindings(prefs({'mod.pane.layout-menu':'Ctrl+F8'}),'Win32')[2].binding.label,'Ctrl+F8');
assert.match(accordionBindings(prefs({'mod.pane.layout-menu':'Alt+Shift+Right'}),'Win32')[2].error,/Already used/);
assert.match(accordionBindings(prefs({'mod.pane.accordion-next':'Ctrl+Shift+L'}),'MacIntel')[1].error,/Already used.*layout menu/);
assert.match(accordionBindings(prefs({'mod.pane.accordion-widen':'Alt+Shift+Minus'}),'Win32')[3].error,/Already used.*Narrow/);
assert.equal(accordionBindings(prefs({'mod.pane.accordion-widen':'Disabled'}),'Win32')[3].binding,null);

const optionLayoutEvent = event({key:'Ò',code:'KeyL',ctrlKey:false,shiftKey:true,getModifierState:()=>true,view:{navigator:{platform:''}}});
assert.ok(matchesBinding(optionLayoutEvent,parseBinding('Alt+Shift+L'),'MacIntel'));
assert.ok(!matchesBinding(optionLayoutEvent,parseBinding('Alt+Shift+L'),'Win32'));
assert.ok(!matchesBinding(optionLayoutEvent,parseBinding('Alt+Shift+L'),'Linux x86_64'));
const macLayoutEvent = event({key:'l',code:'KeyL',ctrlKey:true,altKey:false,shiftKey:true,view:{navigator:{platform:'MacIntel'}}});
assert.ok(matchesBinding(macLayoutEvent,accordionBindings(prefs({}),'MacIntel')[2].binding,'MacIntel'));

for (const label of ['Ctrl+Shift+}', 'Ctrl+Shift+]', 'Ctrl+Shift+{', 'Ctrl+Shift+[']) {
  assert.match(hubCycleConflict(parseBinding(label)), /layout cycle/, `${label} is reserved for the picker layout cycle`);
  assert.ok(isHubCycleBinding(parseBinding(label)));
}
assert.equal(hubCycleConflict(parseBinding('Ctrl+Shift+L')), '');
assert.equal(hubCycleConflict(parseBinding('Ctrl+Alt+R')), '');
assert.match(accordionBindings(prefs({'mod.pane.layout-menu':'Ctrl+Shift+}'}),'Win32').find(record => record.key === 'layout-menu').error, /layout cycle/);
assert.match(accordionBindings(prefs({'mod.pane.layout-menu':'Ctrl+Shift+]'}),'Win32').find(record => record.key === 'layout-menu').error, /layout cycle/);
assert.match(accordionBindings(prefs({'mod.pane.accordion-next':'Ctrl+Shift+{'}),'Win32').find(record => record.key === 'accordion-next').error, /layout cycle/);
assert.equal(
  pickerBinding({getIntPref:()=>3,getStringPref:()=> 'Ctrl+Shift+}'}, 'MacIntel').label,
  'Ctrl+Shift+}',
  'an already-saved Open Pane pref can still hold the reserved chord'
);

const savedCycle = pickerBinding({getIntPref:()=>3,getStringPref:()=> 'Ctrl+Shift+}'}, 'MacIntel');
const cycleEvent = event({key:'}',code:'BracketRight',ctrlKey:true,altKey:false,shiftKey:true});
assert.equal(pickerShortcutAction(cycleEvent, {overlayOpen:true, binding:savedCycle, platform:'MacIntel'}), 'cycle', 'saved hub chord cycles and does not toggle while open');
assert.equal(pickerShortcutAction(cycleEvent, {overlayOpen:false, binding:savedCycle, platform:'MacIntel'}), 'open', 'the same saved chord can still open the picker');
const defaultOpen = pickerBinding({getIntPref:()=>0}, 'Win32');
assert.equal(
  pickerShortcutAction(event({key:'P',code:'KeyP',ctrlKey:false,altKey:true,shiftKey:true}), {overlayOpen:true, binding:defaultOpen, platform:'Win32'}),
  'close',
  'default Open Pane with the hub open still closes it'
);
assert.equal(isHubCycleChord(cycleEvent), true, 'layout shortcuts step aside for the physical hub chord');
assert.equal(isHubCycleChord(event({key:'l',code:'KeyL',ctrlKey:true,shiftKey:true})), false);

const germanStar = {key:'*',code:'BracketRight',ctrlKey:true,shiftKey:true,altKey:false,metaKey:false};
assert.equal(isHubCycleChord(germanStar), true);
assert.match(hubCycleConflict(bindingFromEvent(germanStar), germanStar), /layout cycle/, 'recorder rejects the physical bracket chord on non-US layouts');
assert.equal(hubCycleConflict(parseBinding('Ctrl+Shift+*')), '', 'a saved star label is not reserved unless the event is the physical chord');
