import assert from 'node:assert/strict';
import {createSplitPersistence, encodeTree} from '../split-persistence.mjs';
class Leaf {
  constructor(tab, sizeInParent) {Object.assign(this, {tab, sizeInParent});}
  get widthInParent() {return this.parent.direction === 'row' ? this.sizeInParent : 100;}
}
class Branch extends Leaf {
  constructor(children, direction = 'row', size = 100) {super(null,size); this.direction=direction; this.children=children;}
  set children(value) {this._children=value; value.forEach(child=>child.parent=this);}
  get children() {return this._children;}
  addChild(child) {this.children=[...this.children,child];}
}
const values = new Map();
const tab = id => ({id, isConnected:true, closing:false, hidden:false, pending:false, loads:0, hasAttribute(name) { return name === 'pending' && this.pending; }});
function fixture(tabs) {
  const win = {reads:0,gBrowser:{tabs,selectedTab:tabs[0]}};
  win.SessionStore = {
    getCustomTabValue: tab=>{win.reads++; return values.get(tab.id) ?? '';},setCustomTabValue:(tab,key,value)=>values.set(tab.id,value),deleteCustomTabValue:tab=>values.delete(tab.id),
  };
  const view = {_data:[], currentView:-1, MAX_TABS:4, _tabToSplitNode:new WeakMap(), calls:0, activations:0,
    calculateLayoutTree: tabs => new Branch(tabs.map(tab=>new Leaf(tab,100/tabs.length))),
    splitTabs(tabs,type,initialIndex=0,options={}) {
      this.calls++; this.splitArgs=[...arguments];
      tabs = tabs.filter(tab => !tab.hidden && !tab.hasAttribute('zen-empty-tab'));
      if (tabs.length < 2) return undefined;
      const data={tabs,gridType:type,layoutTree:this.calculateLayoutTree(tabs)};this._data.push(data);
      if (options.activate !== false) {win.gBrowser.selectedTab=tabs[Math.max(0,initialIndex)] ?? tabs[0];this.activateSplitView(data);}
      else tabs.forEach(tab=>{tab.splitView=true;});
      return data;
    },
    activateSplitView(data) {this.activations++; this.currentView=this._data.indexOf(data); data.tabs.forEach(tab=>{if(tab.pending) tab.loads++;});},removeSplitters(){},applyGridLayout(tree){this.applied=tree;},
  };
  win.gZenViewSplitter = view;
  return {win,view,persistence:createSplitPersistence(win,{begin(){},end(){}})};
}
const sizes = node => [node.sizeInParent, ...(node.children ?? []).flatMap(sizes)].filter(size => size !== undefined);
const original = fixture(['a','b','c'].map(tab));
const [a,b,c]=original.win.gBrowser.tabs;
const tree=new Branch([new Leaf(a,37),new Branch([new Leaf(b,61),new Leaf(c,39)],'column',63)]);
original.view._data=[{tabs:[a,b,c],gridType:'grid',layoutTree:tree}];
original.win.gBrowser.selectedTab=c;
original.persistence.save();
const saved=JSON.parse(JSON.stringify([...values]));
values.clear(); saved.forEach(([id,value])=>values.set(id,value));
const deferred=fixture(['a','b','c'].map(tab));
deferred.win.gBrowser.tabs[1].hidden = true;
deferred.persistence.restore();
deferred.persistence.save();
deferred.persistence.restore();
for (let i=0;i<8;i++) deferred.persistence.restore({retryDeferred:true});
assert.equal(deferred.view.calls,0,'hidden groups defer until their workspace is visible');
assert.deepEqual([...values],saved,'hidden workspace records survive ordinary sync saves');
deferred.win.gBrowser.tabs[1].hidden = false;
deferred.persistence.restore({retryDeferred:true});
assert.equal(deferred.view.calls,1,'hidden boundaries do not burn the retry cap before the workspace is shown');
assert.deepEqual([...values],saved,'failed restore keeps complete saved split records for a later workspace');
values.clear(); saved.forEach(([id,value])=>values.set(id,value));
const incompleteHidden=fixture(['a','b'].map(tab));
incompleteHidden.win.gBrowser.tabs[1].hidden = true;
incompleteHidden.persistence.restore();
incompleteHidden.persistence.save();
assert.equal(values.has('a'),true,'incomplete hidden groups keep visible member records');
assert.equal(values.has('b'),true,'incomplete hidden groups keep hidden member records');
incompleteHidden.win.gBrowser.tabs[1].hidden = false;
incompleteHidden.persistence.restore({retryDeferred:true});
assert.equal(incompleteHidden.view.calls,1,'incomplete hidden groups restore once enough members are visible');
values.clear(); saved.forEach(([id,value])=>values.set(id,value));
const clearing=fixture(['a','b','c'].map(tab));
clearing.win.gBrowser.tabs[1].hidden = true;
clearing.persistence.clear();
assert.equal(values.has('a'),false,'disable clears visible split records');
assert.equal(values.has('b'),false,'disable clears hidden split records');
values.clear(); saved.forEach(([id,value])=>values.set(id,value));
const foreverHidden=fixture(['a','b'].map(tab));
foreverHidden.win.gBrowser.tabs[1].hidden = true;
for (let i=0;i<30;i++) foreverHidden.persistence.restore({retryDeferred:true});
foreverHidden.persistence.save();
assert.equal(values.has('a'),false,'forever-pending hidden groups are eventually discarded');
assert.equal(values.has('b'),false,'forever-pending hidden groups discard hidden member records too');
values.clear(); saved.forEach(([id,value])=>values.set(id,value));
const refused=fixture(['a','b','c'].map(tab));
refused.view.splitTabs = () => {refused.view.calls++; return undefined;};
refused.persistence.restore(); refused.persistence.restore(); refused.persistence.save();
assert.equal(refused.view.calls,1,'failed splitTabs does not retry on every sync');
assert.deepEqual([...values],saved,'splitTabs returning undefined keeps records pending');
values.clear(); saved.forEach(([id,value])=>values.set(id,value));
const idle=fixture(['a','b','c'].map(tab));
idle.persistence.sync();
idle.win.reads = 0;
idle.persistence.sync();
assert.equal(idle.win.reads,0,'idle sync skips SessionStore reads when no restore is pending and layout is unchanged');
values.clear();
const late=fixture(['a','b'].map(tab));
late.persistence.sync();
const lateTree=encodeTree(new Branch(late.win.gBrowser.tabs.map(tab => new Leaf(tab,50))),late.win.gBrowser.tabs);
late.win.gBrowser.tabs.forEach((tab,index)=>values.set(tab.id,JSON.stringify({version:1,group:'late',count:2,type:'grid',index,tree:lateTree})));
late.persistence.sync({retryDeferred:true});
assert.equal(late.view.calls,0,'an idle first frame stays skipped without a restore boundary');
late.persistence.armRestoreScan();
late.persistence.sync({retryDeferred:true});
assert.equal(late.view.calls,1,'restore boundaries re-arm scanning after Zen session records arrive');
// A normal live sync must never replay a record written by this controller.
tree.children[0].sizeInParent=42;
original.persistence.restore();
assert.equal(tree.children[0].sizeInParent,42);
tree.children[0].sizeInParent=37;
assert.ok(!values.get('a').includes('_children'),'record contains plain layout data only');
for (const missing of [null,'b','c']) {
  values.clear(); saved.forEach(([id,value])=>values.set(id,value));
  const fresh=fixture(['a','b','c'].filter(id=>id!==missing).map(tab));
  if (!missing) fresh.win.gBrowser.selectedTab = fresh.win.gBrowser.tabs[2];
  fresh.view._sessionRestoring=true;fresh.persistence.restore();assert.equal(fresh.view.calls,0);
  fresh.view._sessionRestoring=false;fresh.persistence.restore();fresh.persistence.restore();
  assert.equal(fresh.view.calls,1,'repeat boundary restore does not duplicate split');
  const restored=fresh.view._data[0];
  assert.deepEqual(restored.tabs.map(tab=>tab.id),['a','b','c'].filter(id=>id!==missing));
  assert.equal(restored.gridType,'grid');
  assert.ok(restored.layoutTree instanceof Branch,'native node methods survive boundary hydration');
  if (!missing) {
    assert.deepEqual(sizes(restored.layoutTree), sizes(tree),'every divider size survives boundary hydration');
    assert.deepEqual(encodeTree(restored.layoutTree,restored.tabs),encodeTree(tree,[a,b,c]));
    assert.deepEqual(fresh.view.splitArgs,[restored.tabs,'grid',-1,{activate:false}],'restore creates fallback groups without activation');
    assert.equal(fresh.win.gBrowser.selectedTab.id,'c','restore keeps the browser-selected tab stable');
    fresh.persistence.save(); assert.deepEqual([...values],saved,'layout and focus round-trip exactly');
  }
}
values.clear();
const startup=fixture(['a','b','c','d'].map(tab));
startup.win.gBrowser.tabs.forEach(tab=>{tab.pending=true;});
startup.win.gBrowser.selectedTab=startup.win.gBrowser.tabs[2];
for (const [group, ids] of [['left',['a','b']], ['right',['c','d']]]) {
  const groupTabs = ids.map(id => startup.win.gBrowser.tabs.find(tab => tab.id === id));
  const savedTree = encodeTree(new Branch(groupTabs.map(tab => new Leaf(tab,50))), groupTabs);
  groupTabs.forEach((tab,index)=>values.set(tab.id,JSON.stringify({version:1,group,count:2,type:'grid',index,tree:savedTree})));
}
startup.persistence.restore();
assert.equal(startup.view.calls,2,'both missing groups are rebuilt');
assert.equal(startup.view.activations,1,'startup restore activates only the selected group');
assert.deepEqual(startup.win.gBrowser.tabs.map(tab=>tab.loads),[0,0,1,1],'non-selected pending split tabs stay unloaded');
const native=fixture(['a','b'].map(tab));
native.win.gBrowser.tabs.forEach(tab=>{tab.pending=true;});
native.view._data=[{tabs:native.win.gBrowser.tabs,gridType:'grid',layoutTree:new Branch(native.win.gBrowser.tabs.map(tab=>new Leaf(tab,50)))}];
values.clear();
const nativeTree=encodeTree(native.view._data[0].layoutTree,native.win.gBrowser.tabs);
native.win.gBrowser.tabs.forEach((tab,index)=>values.set(tab.id,JSON.stringify({version:1,group:'native',count:2,type:'grid',index,tree:nativeTree})));
const beforeTree=native.view._data[0].layoutTree;
native.persistence.restore();
assert.equal(native.view._data[0].layoutTree,beforeTree,'native-restored groups keep Zen node instances');
values.clear();saved.forEach(([id,value])=>values.set(id,value));
const solo=fixture([tab('a')]);solo.persistence.restore();solo.persistence.save();assert.equal(solo.view.calls,0);assert.equal(values.has('a'),false);
values.set('a',JSON.stringify({version:99,group:'stale'}));solo.persistence.restore();assert.equal(values.has('a'),false);
values.set('a','{broken');solo.persistence.restore();solo.persistence.save();assert.equal(values.has('a'),false);
console.log('Split persistence: fallback restore, deferred retries, unloaded tabs, native coexistence, idempotence, missing and stale tabs passed.');
