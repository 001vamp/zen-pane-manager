import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import { remapPresentation } from '../presentation-snapshot.mjs';
import { activatePlan } from '../picker-model.mjs';

// Exercise the actual runtime transaction with injected native API failures.
const source=await readFile(new URL('../pane.uc.mjs',import.meta.url),'utf8');
const body=source.slice(source.indexOf('function replacePane(incoming)'),source.indexOf('const toolbarReveals'));
function run(failure) {
  const group={hasAttribute:()=>true}, outgoing={group,closing:false}, incoming={group:null,closing:false,hasAttribute:()=>false};
  const leaf={tab:outgoing},data={tabs:[outgoing]},messages=[];
  let moves=0,ended=0,activation=0;
  const browser={selectedTab:outgoing,moveTabToExistingGroup(tab,target){tab.group=target;if(++moves===1 && failure==='move')throw Error('move failed');},ungroupTab(tab){tab.group=null;},removeTab(){}};
  const view={getSplitNodeFromTab:()=>leaf,_tabToSplitNode:new Map([[outgoing,leaf]]),resetTabState(tab){tab.splitView=false;},activateSplitView(){if((failure==='activate-once' && ++activation===1)||failure==='rollback')throw Error('activate failed');}};
  const context={incoming,splitter:()=>view,activeData:()=>data,targetTab:outgoing,closePicker(){},diagnosticLog(){},showToast:message=>messages.push(message),workspaceId:()=>1,gBrowser:browser,boolPref:()=>true,PREF:{keep:'keep'},dispatch(){},TAG:'Pane',console:{error(){}},tabTitle:()=> 'Sample',Map,remapPresentation,
    multiwindow:{origins:{begin(){if(failure==='prepare')throw Error('prepare failed');},end(){ended++;}},capturePresentation:()=>({selected:outgoing,floating:[],scrolling:null}),restorePresentation(){}}};
  vm.runInNewContext(body+'\nreplacePane(incoming);',context);
  return {data,leaf,outgoing,incoming,browser,messages,ended};
}
for(const failure of ['move','activate-once']) {
  const result=run(failure);
  assert.equal(result.data.tabs[0],result.outgoing);
  assert.equal(result.leaf.tab,result.outgoing);
  assert.equal(result.incoming.group,null,'early move failure restores incoming membership');
  assert.equal(result.browser.selectedTab,result.outgoing);
  assert.match(result.messages.at(-1),/original split was restored/);
  assert.equal(result.ended,1);
}
assert.match(run('rollback').messages.at(-1),/could not fully restore/,'failed recovery is reported honestly');
assert.equal(run('prepare').ended,0,'failed preparation does not end an unstarted transaction');
assert.match(run(null).messages.at(-1),/Now showing/);
console.log('Replacement: early mutations, rollback failures and origin lifecycle passed.');

const openCandidateSource=source.slice(source.indexOf('function openCandidate'),source.indexOf('function buildPicker'));
{
  const targetTab={label:'current'}, group={tabs:[]};
  let joined=null, closed=false;
  const context={targetTab,group,openMode:'below',activatePlan,multiwindow:{join:(joinedGroup,incoming,mode)=>{joined={joinedGroup,incoming,mode};}},closePicker:()=>{closed=true;},showToast:message=>{throw new Error(message);}};
  vm.runInNewContext(openCandidateSource+'\nopenCandidate({kind:"split",group});',context);
  assert.deepEqual(joined,{joinedGroup:group,incoming:targetTab,mode:'below'},'split picker activation uses the selected layout mode');
  assert.equal(closed,true);
}
{
  const targetTab={label:'current'}, group={tabs:[]};
  let joined=null, closed=false;
  const context={targetTab,group,openMode:'replace',activatePlan,multiwindow:{join:(joinedGroup,incoming,mode)=>{joined={joinedGroup,incoming,mode};}},closePicker:()=>{closed=true;},showToast:message=>{throw new Error(message);}};
  vm.runInNewContext(openCandidateSource+'\nopenCandidate({kind:"split",group});',context);
  assert.deepEqual(joined,{joinedGroup:group,incoming:targetTab,mode:'grid'},'Replace on a split card still joins as grid');
  assert.equal(closed,true);
}
assert.deepEqual(activatePlan({kind:'split',mode:'float'}),{op:'join',mode:'float'});
console.log('Picker split activation preserves the selected layout mode.');
