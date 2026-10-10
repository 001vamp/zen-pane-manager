import assert from "node:assert/strict";
import { clonePresentation, remapPresentation } from "../presentation-snapshot.mjs";

const outgoing = {id:"out"};
const incoming = {id:"in"};
const other = {id:"other"};
const saved = {
  selected: outgoing,
  floating: [{tab:outgoing, rect:{x:10.5,y:20,width:300,height:200}, headerPinned:true}],
  scrolling: {widths: new Map([[outgoing, 800.125], [other, 640]])},
  accordion: outgoing,
};

const clone = clonePresentation(saved);
clone.floating[0].rect.x = 99;
clone.floating[0].tab = incoming;
clone.scrolling.widths.set(outgoing, 1);
clone.selected = incoming;
clone.accordion = incoming;
assert.equal(saved.floating[0].rect.x, 10.5, "clone does not mutate rollback rects");
assert.equal(saved.floating[0].tab, outgoing);
assert.equal(saved.scrolling.widths.get(outgoing), 800.125, "clone does not mutate rollback widths");
assert.equal(saved.selected, outgoing);
assert.equal(saved.accordion, outgoing);

const remapped = remapPresentation(saved, outgoing, incoming);
assert.equal(remapped.selected, incoming, "a finished swap always selects the incoming tab");
assert.equal(remapped.floating[0].tab, incoming);
assert.equal(remapped.accordion, incoming);
assert.equal(remapped.scrolling.widths.get(incoming), 800.125);
assert.equal(remapped.scrolling.widths.has(outgoing), false);
assert.equal(remapped.scrolling.widths.get(other), 640);
assert.equal(saved.selected, outgoing, "remap leaves the rollback snapshot alone");
assert.equal(saved.floating[0].tab, outgoing);
assert.equal(saved.scrolling.widths.has(outgoing), true);

const third = remapPresentation({
  selected: other,
  floating: [{tab:other, rect:{x:1,y:2,width:3,height:4}, headerPinned:false}],
  scrolling: {widths: new Map([[other, 500]])},
  accordion: other,
}, outgoing, incoming);
assert.equal(third.selected, incoming, "incoming is selected even when a third tab was selected");
assert.equal(third.floating[0].tab, other);
assert.equal(third.accordion, other);
assert.equal(third.scrolling.widths.get(other), 500);

const empty = remapPresentation({selected:outgoing, floating:[]}, outgoing, incoming);
assert.equal(empty.selected, incoming);
assert.equal(empty.scrolling, undefined);
assert.equal(empty.accordion, undefined);

console.log("Presentation snapshot: clone isolation and replacement remap passed.");
