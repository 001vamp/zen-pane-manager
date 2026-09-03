"""Live smoke test. Requires marionette_driver and a disposable Sine/Zen profile.
Start Zen with --marionette --remote-allow-system-access and marionette.port=2829.
Never run against a personal profile. The test checks the profile name first.
"""
from marionette_driver.marionette import Marionette
from pathlib import Path
import json
import time

m = Marionette(port=2829)
m.start_session()
m.set_context('chrome')
js = m.execute_script
assert js('return Services.dirsvc.get("ProfD",Ci.nsIFile).leafName.startsWith("pane-zen-qa")'), 'Use a disposable pane-zen-qa profile'
assert js('return !!window.addUnloadListener && !!window.__paneInstance'), 'Pane must be loaded through Sine'
m.set_window_rect(width=1200, height=900)
report = {}
try:
    js('''for(const t of [...gBrowser.tabs])if(t.hasAttribute("pane-test"))gBrowser.removeTab(t,{animate:false});
    window.paneTestTabs = Array.from({length:4},()=>gBrowser.addTrustedTab('about:blank'));
    window.paneTestTabs.forEach(t=>t.setAttribute('pane-test','true'));''')
    for handle in m.window_handles:
        m.switch_to_window(handle)
        if js('return gBrowser.selectedTab===window.paneTestTabs[1]'):
            break
    m.set_context('content')
    m.navigate('data:text/html,<title>Pane QA Reference</title><style>body{font:18px system-ui;padding:30px;min-width:600px;overflow-anchor:none;background:%23f7f8fb}input{padding:10px}article{height:1400px}</style><h1>Reference tab</h1><input id="draft"><article>Live content stays here while floating.</article>')
    js('document.getElementById("draft").value="Unsaved Pane test";document.documentElement.dataset.paneMarker="retained";scrollTo(0,130);')
    m.set_context('chrome')
    report['picker'] = js('''const [a,c]=window.paneTestTabs;gBrowser.selectedTab=a;
    window.__paneInstance.openPicker(a);
    const result={visible:!document.getElementById('pane-overlay').hidden,replaceHidden:document.querySelector('[data-mode="replace"]').hidden};
    document.getElementById('pane-close').click();return result;''')
    assert all(report['picker'].values())
    report['layouts'] = js('''const p=window.__paneInstance,v=gZenViewSplitter,[a,c,d]=window.paneTestTabs;
    window.paneOriginalBrowser=c.linkedBrowser;window.paneOriginalContext=c.linkedBrowser.browsingContext.id;
    p.multiwindow.add(a,c,'right');const right=v._data[v.currentView].gridType==='vsep';
    p.multiwindow.arrange(c,'below');const below=v._data[v.currentView].gridType==='hsep';
    p.multiwindow.add(a,d,'grid');const grid=v._data[v.currentView].gridType==='grid'&&v._data[v.currentView].tabs.length===3;
    p.multiwindow.arrange(c,'float');return {right,below,grid,sameBrowser:window.paneOriginalBrowser===c.linkedBrowser,sameContext:window.paneOriginalContext===c.linkedBrowser.browsingContext.id};''')
    assert all(report['layouts'].values())
    time.sleep(.3)
    m.set_context('content')
    report['retained'] = js('return {draft:document.getElementById("draft").value,marker:document.documentElement.dataset.paneMarker,scroll:scrollY};')
    assert report['retained']['draft'] == 'Unsaved Pane test'
    assert report['retained']['marker'] == 'retained'
    assert abs(report['retained']['scroll'] - 130) < 2, report['retained']
    m.set_context('chrome')
    report['handles'] = js('''const h=document.querySelector('.pane-float-header'),r=document.querySelector('.pane-float-resize'),c=h.parentElement;
    const before=c.getBoundingClientRect();h.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    r.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));const after=c.getBoundingClientRect();
    return {moved:Math.abs(after.x-before.x-10)<1,resized:Math.abs(after.height-before.height+10)<1,headerAbovePage:c.querySelector('browser').getBoundingClientRect().top>=h.getBoundingClientRect().bottom-1};''')
    assert all(report['handles'].values()), report['handles']
    report['pointerResize'] = {}
    for edge in ['se','e','s','w','n','nw','ne','sw']:
        js('window.__paneInstance.multiwindow.arrange(window.paneTestTabs[1],"float");')
        start = js('const h=document.querySelector(`.pane-float-resize[data-edge="${arguments[0]}"]`),r=h.getBoundingClientRect(),p=h.parentElement.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:p.width,h:p.height};',[edge])
        dx = -30 if 'e' in edge else 30 if 'w' in edge else 0
        dy = -25 if 's' in edge else 25 if 'n' in edge else 0
        m.actions.sequence('pointer','resize',{'pointerType':'mouse'}).pointer_move(int(start['x']),int(start['y'])).pointer_down().pointer_move(int(start['x']+dx),int(start['y']+dy),duration=200).pointer_up().perform()
        after = js('const r=document.querySelector("[pane-floating]").getBoundingClientRect();return {w:r.width,h:r.height};')
        assert abs(after['w']-(start['w']-(30 if dx else 0)))<2, edge
        assert abs(after['h']-(start['h']-(25 if dy else 0)))<2, edge
        report['pointerResize'][edge] = True
    report['switchAway'] = js('gBrowser.selectedTab=window.paneTestTabs[3];return gZenViewSplitter.currentView===-1&&!document.querySelector("[pane-floating][zen-split]");')
    assert report['switchAway']
    js('gBrowser.selectedTab=window.paneTestTabs[1];')
    time.sleep(.15)
    assert js('return !!document.querySelector("[pane-floating][zen-split]");')
    js('''const p=window.__paneInstance,t=window.paneTestTabs[1];p.multiwindow.openMenu(t,t.linkedBrowser.closest('.browserSidebarContainer'));
    document.querySelector('#pane-layout-menu [data-mode="below"]').click();''')
    assert js('return gZenViewSplitter._data[gZenViewSplitter.currentView].gridType==="hsep"&&!document.querySelector("[pane-floating]");')
    m.set_context('content')
    assert js('return document.getElementById("draft").value') == 'Unsaved Pane test'
    m.set_context('chrome')
    js('window.__paneInstance.multiwindow.arrange(window.paneTestTabs[1],"float");document.querySelector(".pane-float-actions button:last-child").click();')
    report['closeKeepsTab'] = js('return !window.paneTestTabs[1].splitView&&window.paneTestTabs[1].isConnected&&!document.querySelector("[pane-floating]");')
    assert report['closeKeepsTab']
    # Replacement must preserve the leaf and a user-adjusted divider ratio.
    report['replacement'] = js('''const p=window.__paneInstance,v=gZenViewSplitter,[a,c,d,e]=window.paneTestTabs;
    gBrowser.selectedTab=a;const data=v._data[v.currentView],leaf=v.getSplitNodeFromTab(a);leaf.sizeInParent=36;v.applyGridLayout(data.layoutTree);
    p.openPicker(a);document.getElementById('pane-search').value='Pane QA Reference';document.getElementById('pane-search').dispatchEvent(new Event('input'));
    document.querySelector('.pane-item').click();return {keptOutgoing:a.isConnected&&!a.splitView,leafSame:leaf.tab===c,sizeSame:leaf.sizeInParent===36};''')
    assert all(report['replacement'].values())
    report['rollback'] = js('''const p=window.__paneInstance,v=gZenViewSplitter,[a,c]=window.paneTestTabs;
    const data=v._data[v.currentView],count=data.tabs.length,original=v.activateSplitView;
    let injected=false,failed=false;v.activateSplitView=function(...args){if(!injected){injected=true;throw new Error('Injected test failure')}return original.apply(this,args)};
    try{p.multiwindow.add(c,a,'grid')}catch{failed=true}finally{v.activateSplitView=original}
    return failed&&data.tabs.length===count&&!a.splitView&&a.isConnected&&data.tabs.includes(c);''')
    assert report['rollback']
    report['limit'] = js('''const p=window.__paneInstance,v=gZenViewSplitter,[a,c,d,e]=window.paneTestTabs;
    p.multiwindow.add(c,a,'grid');p.multiwindow.add(c,e,'grid');
    const extra=gBrowser.addTrustedTab('about:blank');window.paneTestTabs.push(extra);
    let rejected=false;try{p.multiwindow.add(c,extra,'right')}catch{rejected=true}
    return rejected&&!extra.splitView&&v._data[v.currentView].tabs.length===4;''')
    assert report['limit']
    # Closing the actual browser tab must also remove floating controls.
    js('window.__paneInstance.multiwindow.arrange(window.paneTestTabs[0],"float");gBrowser.removeTab(window.paneTestTabs[0],{animate:false});')
    time.sleep(.2)
    report['tabCloseCleanup'] = js('return !document.querySelector("[pane-floating],.pane-float-header");')
    assert report['tabCloseCleanup']
    js('window.__paneInstance.multiwindow.arrange(window.paneTestTabs[1],"float");window.__paneInstance.destroy();')
    report['unload'] = js('return !document.querySelector("[pane-floating],.pane-float-header,.pane-layout-menu,.pane-button,.pane-layout-button,#pane-overlay");')
    assert report['unload']
    print(json.dumps(report, indent=2))
finally:
    js('for(const t of window.paneTestTabs||[])if(t.isConnected&&!t.closing)gBrowser.removeTab(t,{animate:false});delete window.paneTestTabs;')
    m.delete_session()
