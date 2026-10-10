import assert from "node:assert/strict";
import { accordionSizes, scrollingColumnWidth, scrollingSizes, landingIndex, fitRectangle, resizeRectangle } from "../presentation-geometry.mjs";

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

assert.deepEqual(accordionSizes(1200, 4), {expanded:1068, strip:44});
assert.deepEqual(accordionSizes(1200, 4, 2000), {expanded:1104, strip:32});
assert.deepEqual(accordionSizes(1200, 4, 0), {expanded:320, strip:880/3});
assert.deepEqual(accordionSizes(100, 4, 2000), {expanded:50, strip:50/3});
assert.deepEqual(accordionSizes(0, 4, 500), {expanded:0, strip:0});
assert.deepEqual(accordionSizes(500, 1, 20), {expanded:500, strip:0});
const fractional = accordionSizes(1200.75, 4, 800.125);
near(fractional.expanded, 800.125);
near(fractional.expanded + fractional.strip * 3, 1200.75);
assert.ok(!Number.isInteger(fractional.strip));

for (const width of [0, 80.125, 400, 1200.75]) for (const count of [2, 3, 4]) {
  for (const desired of [-100, 350.125, 10000]) {
    const sizes = accordionSizes(width, count, desired);
    near(sizes.expanded + sizes.strip * (count - 1), width);
    assert.ok(sizes.strip >= Math.min(32, width / (count + 2)) - 1e-9);
    assert.ok(sizes.expanded >= 0);
  }
}

assert.deepEqual(scrollingSizes(1000.25,65,[800.125,null]),{
 viewport:1000.25,width:650.1625,widths:[800.125,650.1625],positions:[0,810.125],max:800.125 + 10 + 650.1625 - 1000.25
});
assert.deepEqual(scrollingSizes(200,65,[500,10]).widths,[200,200]);
assert.equal(scrollingColumnWidth(1000.25,800.125),800.125);
assert.equal(scrollingColumnWidth(1000.25,9999),1000.25);
assert.equal(scrollingColumnWidth(1000.25,10),320);
assert.equal(scrollingColumnWidth(200.125,10),200.125);

const even = scrollingSizes(100, 100, [100, 100]);
assert.equal(landingIndex(even, 55), 0, "an exact midpoint keeps the earlier card");
assert.equal(landingIndex(even, 56), 1);
assert.equal(landingIndex(even, -20), 0);
assert.equal(landingIndex(even, 400), 1);

assert.deepEqual(fitRectangle({x:900,y:800,width:480,height:420},800,600), {x:320,y:180,width:480,height:420});
assert.deepEqual(fitRectangle({x:-20,y:-10,width:10,height:20},800,600), {x:0,y:0,width:260,height:180});
assert.deepEqual(fitRectangle({x:40,y:50,width:480,height:420},200,100), {x:0,y:0,width:200,height:100});

const rect = {x:100,y:100,width:400,height:300};
assert.deepEqual(resizeRectangle(rect,"nw",-50,-30,1000,800),{x:50,y:70,width:450,height:330});
assert.deepEqual(resizeRectangle(rect,"nw",900,900,1000,800),{x:240,y:220,width:260,height:180});
assert.deepEqual(resizeRectangle(rect,"se",900,900,1000,800),{x:100,y:100,width:900,height:700});
assert.deepEqual(resizeRectangle(rect,"w",-900,50,1000,800),{x:0,y:100,width:500,height:300});
for (const edge of ["n","s","e","w","ne","nw","se","sw"]) {
  const result=resizeRectangle(rect,edge,25,20,1000,800);
  assert.ok(result.width>=260 && result.height>=180);
  if (!edge.includes("w")) assert.equal(result.x,rect.x);
  if (!edge.includes("n")) assert.equal(result.y,rect.y);
  if (!edge.includes("e")) assert.equal(result.x+result.width,rect.x+rect.width);
  if (!edge.includes("s")) assert.equal(result.y+result.height,rect.y+rect.height);
}

console.log("Presentation geometry: accordion, scrolling, landing ties, and float edges passed.");
