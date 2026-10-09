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
const tab = id => ({id, isConnected:true, closing:false});
function fixture(tabs) {
  const win = {gBrowser:{tabs,selectedTab:tabs[0]},SessionStore:{
    getCustomTabValue: tab=>values.get(tab.id) ?? '',setCustomTabValue:(tab,key,value)=>values.set(tab.id,value),deleteCustomTabValue:tab=>values.delete(tab.id),
  }};
  const view = {_data:[], currentView:-1, MAX_TABS:4, _tabToSplitNode:new WeakMap(), calls:0,
    calculateLayoutTree: tabs => new Branch(tabs.map(tab=>new Leaf(tab,100/tabs.length))),
    splitTabs(tabs,type) {this.calls++; this.splitArgs=[...arguments]; const data={tabs,gridType:type,layoutTree:this.calculateLayoutTree(tabs)};this._data.push(data);this.currentView=this._data.indexOf(data);win.gBrowser.selectedTab=tabs[0];return data;},
    activateSplitView(data) {this.currentView=this._data.indexOf(data);},removeSplitters(){},applyGridLayout(tree){this.applied=tree;},
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
deferred.view.splitTabs = () => {deferred.view.calls++; throw new Error('hidden workspace');};
deferred.persistence.restore();
deferred.persistence.save();
assert.deepEqual([...values],saved,'failed restore keeps complete saved split records for a later workspace');
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
    assert.deepEqual(fresh.view.splitArgs,[restored.tabs,'grid'],'restore uses the same splitTabs(tabs, type) call shape as add');
    assert.equal(fresh.win.gBrowser.selectedTab.id,'c','restore keeps the browser-selected tab stable');
    fresh.persistence.save(); assert.deepEqual([...values],saved,'layout and focus round-trip exactly');
  }
}
values.clear();saved.forEach(([id,value])=>values.set(id,value));
const solo=fixture([tab('a')]);solo.persistence.restore();solo.persistence.save();assert.equal(solo.view.calls,0);assert.equal(values.has('a'),false);
values.set('a',JSON.stringify({version:99,group:'stale'}));solo.persistence.restore();assert.equal(values.has('a'),false);
values.set('a','{broken');solo.persistence.restore();solo.persistence.save();assert.equal(values.has('a'),false);
console.log('Split persistence: exact nested geometry/focus round-trip, native prototypes, idempotence, restore gating, missing and stale tabs passed.');
