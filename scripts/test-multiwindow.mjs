import assert from "node:assert/strict";
import { fitRectangle, resizeRectangle, layoutTypes, isSupportedTab, needsTabCopy, tabWorkspace } from "../multiwindow.mjs";
assert.deepEqual(layoutTypes, { right: "vsep", below: "hsep", grid: "grid" });
assert.deepEqual(fitRectangle({x:900,y:800,width:480,height:420},800,600), {x:320,y:180,width:480,height:420});
assert.deepEqual(fitRectangle({x:-20,y:-10,width:10,height:20},800,600), {x:0,y:0,width:260,height:180});
assert.deepEqual(fitRectangle({x:40,y:50,width:480,height:420},200,100), {x:0,y:0,width:200,height:100});
console.log("Floating geometry and native layout mapping tests passed.");

const rect = {x:100,y:100,width:400,height:300};
assert.deepEqual(resizeRectangle(rect,"nw",-50,-30,1000,800),{x:50,y:70,width:450,height:330});
assert.deepEqual(resizeRectangle(rect,"nw",900,900,1000,800),{x:240,y:220,width:260,height:180});
assert.deepEqual(resizeRectangle(rect,"se",900,900,1000,800),{x:100,y:100,width:900,height:700});
assert.deepEqual(resizeRectangle(rect,"w",-900,50,1000,800),{x:0,y:100,width:500,height:300});
for(const edge of ["n","s","e","w","ne","nw","se","sw"]) {
 const result=resizeRectangle(rect,edge,25,20,1000,800);
 assert.ok(result.width>=260 && result.height>=180);
 if(!edge.includes("w")) assert.equal(result.x,rect.x);
 if(!edge.includes("n")) assert.equal(result.y,rect.y);
 if(!edge.includes("e")) assert.equal(result.x+result.width,rect.x+rect.width);
 if(!edge.includes("s")) assert.equal(result.y+result.height,rect.y+rect.height);
}
console.log("All eight resize edges preserve their opposite anchors and bounds.");

const ordinary = { pinned: false, hidden: false, closing: false, hasAttribute: () => false, closest: () => null };
assert.equal(isSupportedTab(ordinary), true);
assert.equal(isSupportedTab({ ...ordinary, pinned: true }), true);
const folderTab = { ...ordinary, pinned: true, closest: () => ({ collapsed: true }) };
assert.equal(isSupportedTab(folderTab), true);
assert.equal(isSupportedTab({ ...folderTab, hidden: true }), false);
assert.equal(isSupportedTab({ ...folderTab, closing: true }), false);
for (const blocked of ["zen-empty-tab"]) {
  assert.equal(isSupportedTab({ ...folderTab, hasAttribute: name => name === blocked }), false);
}
console.log("Folder eligibility and protected tab exclusions passed.");

const essential = { ...ordinary, hasAttribute: name => name === "zen-essential" };
assert.equal(isSupportedTab(essential), true);
assert.equal(needsTabCopy(essential), true);
assert.equal(needsTabCopy({ ...ordinary, pinned: true }), false);
assert.equal(needsTabCopy(ordinary), false);
assert.equal(tabWorkspace({ gZenWorkspaces: { activeWorkspace: "active" } }, essential), "active");
