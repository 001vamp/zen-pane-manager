"""Run against a disposable Zen profile named pane-zen-qa-originals on port 2829.
Launch with --marionette --remote-allow-system-access. Never uses a personal profile.
The harness loads Pane directly into browser chrome; it does not test Sine installation.
"""
from pathlib import Path
import re
from marionette_driver.marionette import Marionette
import time,json
m=Marionette(port=2829);m.start_session();m.set_context('chrome');js=m.execute_script
assert js('return Services.dirsvc.get("ProfD",Ci.nsIFile).leafName')=='pane-zen-qa-originals'
try:
 root=Path(__file__).resolve().parent.parent
 profile=Path(js('return Services.dirsvc.get("ProfD",Ci.nsIFile).path'))
 alias='pane-origin-qa'+str(int(time.time()*1000))
 source=(root/'pane.uc.mjs').read_text()
 source=re.sub(r'import \{([^}]+)\} from "\./([^"?]+)[^"]*";',lambda match:'const {'+match[1]+'} = ChromeUtils.importESModule("resource://'+alias+'/'+match[2]+'");',source)
 runtime=profile/'pane-test-runtime.js'
 runtime.write_text('(function(){'+source+'})();')
 js("Services.io.getProtocolHandler('resource').QueryInterface(Ci.nsIResProtocolHandler).setSubstitution(arguments[0],Services.io.newURI(arguments[1]));Services.scriptloader.loadSubScript(arguments[2],window);",[alias,root.as_uri()+'/',runtime.as_uri()])
 # A real content document keeps unsaved state and history in the same browser.
 js("""window.stateTab=gBrowser.addTrustedTab('data:text/html,<input id=note><div style=height:3000px></div>');
 window.stateCompanion=gBrowser.addTrustedTab('about:blank');
 gBrowser.selectedTab=stateTab;""")
 time.sleep(.5)
 m.set_context('content')
 for handle in m.window_handles:
  m.switch_to_window(handle)
  if m.get_url().startswith('data:text/html,<input id=note>'):
   break
 else:
  raise AssertionError('State test tab did not load')
 js("document.getElementById('note').value='unsaved Pane text';scrollTo(0,700);history.pushState({pane:true},'', '#kept');")
 m.set_context('chrome')
 js('window.stateBrowser=stateTab.linkedBrowser;')
 js("__paneInstance.multiwindow.add(stateTab,stateCompanion,'right');gBrowser.selectedTab=stateTab;")
 m.set_context('content')
 result=js("return {value:document.getElementById('note').value,scrollY,history:history.length,hash:location.hash};")
 m.set_context('chrome')
 assert result['value']=='unsaved Pane text' and result['scrollY']>0 and result['history']>1 and result['hash']=='#kept',result
 assert js('return stateTab.linkedBrowser===stateBrowser;')
 js("gZenViewSplitter.removeTabFromGroup(stateTab,undefined,{forUnsplit:true});")
 time.sleep(.3)
 print('Form, scroll, history, and browser identity: passed')
 result=js('''if(window.life)for(const t of life)if(t.isConnected)gBrowser.removeTab(t,{animate:false});window.life=Array.from({length:4},()=>gBrowser.addTrustedTab('about:blank'));
 life.forEach((t,i)=>{t.label='Lifecycle '+i;t.setAttribute('pane-qa-id',String(i))});
 gZenPinnedTabManager.addToEssentials(life[0]);gBrowser.pinTab(life[2]);
 window.lifeBrowsers=life.map(t=>t.linkedBrowser);
 __paneInstance.multiwindow.add(life[0],life[1],'right');
 __paneInstance.multiwindow.add(life[1],life[2],'float');
 __paneInstance.multiwindow.add(life[1],life[3],'float');
 return {count:__paneInstance.multiwindow.floatingTabs.length,same:life.every((t,i)=>t.linkedBrowser===lifeBrowsers[i])};''')
 assert result=={'count':2,'same':True},result
 # Native close-to-sidebar leaves other float alive and restores original pinned status.
 js('gZenViewSplitter.removeTabFromGroup(life[2],undefined,{forUnsplit:true});')
 time.sleep(.4)
 assert js('return life[2].pinned && !life[2].splitView && __paneInstance.multiwindow.floatingTabs.includes(life[3]);')
 # Native removal of Essential restores it while split is still active.
 js('gZenViewSplitter.removeTabFromGroup(life[0],undefined,{forUnsplit:true});')
 time.sleep(.4)
 assert js('return life[0].hasAttribute("zen-essential") && !life[0].splitView;')
 js('gZenViewSplitter.removeTabFromGroup(life[3],undefined,{forUnsplit:true});')
 time.sleep(.4)
 assert js('return !life[1].pinned && !life[3].pinned && life.every((t,i)=>t.linkedBrowser===lifeBrowsers[i]);')
 print('Native unsplit with multiple floats and original state: passed')
 # Replace pinned companion with the same Essential, then unsplit.
 js('''__paneInstance.multiwindow.add(life[1],life[2],'right');
 life[0].label='Lifecycle 0';__paneInstance.openPicker(life[2]);
 const search=document.getElementById('pane-search');search.value='Lifecycle 0';search.dispatchEvent(new Event('input',{bubbles:true}));
 const item=document.querySelector('#pane-results .pane-item');if(!item)throw new Error('Missing Essential candidate');item.click();''')
 time.sleep(.4)
 result=js('return {essentialInSplit:life[0].splitView,pinnedRestored:life[2].pinned,same:life[0].linkedBrowser===lifeBrowsers[0]};')
 assert all(result.values()),result
 js('gZenViewSplitter.removeTabFromGroup(life[0],undefined,{forUnsplit:true});')
 time.sleep(.4)
 assert js('return life[0].hasAttribute("zen-essential")&&!life[1].pinned;')
 print('Picker replacement preserves original Essential and companion states: passed')
 # A native failure must restore placement too.
 result=js('''const v=gZenViewSplitter, original=v.splitTabs;v.splitTabs=()=>{throw new Error('qa failure')};
 let rejected=false;try{__paneInstance.multiwindow.add(life[0],life[1],'right')}catch(e){rejected=true}finally{v.splitTabs=original}
 return {rejected,essential:life[0].hasAttribute('zen-essential'),standard:!life[1].pinned};''')
 assert all(result.values()),result
 print('Failure rollback: passed')
 # A folder tab returns to its exact position among its original siblings.
 js('''window.orderTabs=Array.from({length:3},()=>gBrowser.addTrustedTab('about:blank'));
 orderTabs.forEach((t,i)=>t.setAttribute('pane-order-id',String(i)));
 window.orderFolder=gZenFolders.createFolder(orderTabs,{label:'Pane order QA'});
 window.orderCompanion=gBrowser.addTrustedTab('about:blank');
 __paneInstance.multiwindow.add(orderTabs[1],orderCompanion,'right');
 gZenViewSplitter.removeTabFromGroup(orderTabs[1],undefined,{forUnsplit:true});''')
 time.sleep(.4)
 result=js('''return {sameFolder:orderTabs.every(t=>t.group===orderFolder),
 order:orderFolder.tabs.filter(t=>t.hasAttribute('pane-order-id')).map(t=>t.getAttribute('pane-order-id')).join(','),
 companionNormal:!orderCompanion.pinned};''')
 assert result=={'sameFolder':True,'order':'0,1,2','companionNormal':True},result
 print('Folder and exact sidebar order restoration: passed')
 # If the old folder is gone, the tab remains usable in the pinned section.
 js('''window.deletedTab=gBrowser.addTrustedTab('about:blank');
 window.deletedFolder=gZenFolders.createFolder([deletedTab],{label:'Pane deleted folder QA'});
 window.deletedCompanion=gBrowser.addTrustedTab('about:blank');
 __paneInstance.multiwindow.add(deletedTab,deletedCompanion,'right');
 deletedFolder.after(deletedTab.group);
 deletedFolder.remove();
 gZenViewSplitter.removeTabFromGroup(deletedTab,undefined,{forUnsplit:true});''')
 time.sleep(.4)
 assert js('''return deletedTab.isConnected && deletedTab.pinned && !deletedTab.splitView &&
 deletedTab.parentElement?.classList.contains('zen-workspace-pinned-tabs-section') && !deletedCompanion.pinned;''')
 print('Deleted folder fallback: passed')
 js('__paneInstance.multiwindow.add(life[0],life[1],"right");__paneInstance.destroy();')
 assert js('return life[0].hasAttribute("zen-essential")&&!life[1].pinned&&!life[0].splitView;')
 print('Disable restores tabs: passed')
 # Browser shutdown keeps the placement record. A fresh runtime recovers it.
 js("""Services.scriptloader.loadSubScript(arguments[0],window);
 __paneInstance.multiwindow.add(life[0],life[1],'right');
 Services.obs.notifyObservers(null,'quit-application-granted');
 __paneInstance.destroy();""", [runtime.as_uri()])
 assert js("return life[0].splitView && Boolean(SessionStore.getCustomTabValue(life[0],'pane-original-tab-v1'));")
 js("Services.scriptloader.loadSubScript(arguments[0],window);gZenViewSplitter.removeTabFromGroup(life[0],undefined,{forUnsplit:true});", [runtime.as_uri()])
 time.sleep(.4)
 assert js("return life[0].hasAttribute('zen-essential') && !life[1].pinned && !SessionStore.getCustomTabValue(life[0],'pane-original-tab-v1');")
 js('__paneInstance.destroy();')
 print('Shutdown record and startup recovery: passed')
finally:m.delete_session()
