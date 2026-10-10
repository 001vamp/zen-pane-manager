import assert from "node:assert/strict";
import { encodeFloat, decodeFloat, encodeAccordion, decodeAccordionGroup, encodeScrolling, decodeScrollingGroup } from "../presentation-records.mjs";

const rect = {x:10.125,y:20,width:300.5,height:200};
assert.equal(
  encodeFloat({rect, headerPinned:true}),
  JSON.stringify({version:1,rect,headerPinned:true}),
  "float writer keeps version, rect, then pin"
);
assert.equal(
  encodeFloat({rect, headerPinned:0}),
  JSON.stringify({version:1,rect,headerPinned:false})
);
assert.deepEqual(decodeFloat(""), {kind:"missing"});
assert.deepEqual(decodeFloat(undefined), {kind:"missing"});
assert.deepEqual(decodeFloat("null"), {kind:"missing"});
assert.deepEqual(decodeFloat("0"), {kind:"missing"});
assert.deepEqual(decodeFloat("false"), {kind:"missing"});
assert.deepEqual(decodeFloat("{"), {kind:"invalid"});
assert.deepEqual(decodeFloat(JSON.stringify({version:1})), {kind:"invalid"});
assert.deepEqual(decodeFloat(JSON.stringify({version:99,rect:{x:0,y:0,width:300,height:200}})), {kind:"invalid"});
assert.deepEqual(decodeFloat(JSON.stringify({version:1,rect:{x:0,y:0,width:-2,height:10}})), {kind:"invalid"});
assert.deepEqual(decodeFloat(JSON.stringify({version:1,rect:{x:0,y:0,width:300,height:NaN}})), {kind:"invalid"});
assert.deepEqual(
  decodeFloat(JSON.stringify({version:1,rect,headerPinned:true})),
  {kind:"valid", value:{rect, headerPinned:true}}
);
assert.equal(decodeFloat(JSON.stringify({version:1,rect})).value.headerPinned, false);
assert.equal(decodeFloat(encodeFloat({rect, headerPinned:true})).value.rect.width, 300.5);

assert.equal(encodeAccordion("group-a", true), JSON.stringify({group:"group-a",active:true}));
assert.equal(encodeAccordion("group-a", 0), JSON.stringify({group:"group-a",active:false}));
assert.equal(decodeAccordionGroup(["{", encodeAccordion("group-a", true)]), null, "malformed accordion records skip");
assert.equal(decodeAccordionGroup([encodeAccordion("a", true), encodeAccordion("b", false)]), null, "mixed accordion groups skip");
assert.equal(decodeAccordionGroup([null, encodeAccordion("a", true)]), null);
assert.deepEqual(decodeAccordionGroup([encodeAccordion("g", false), encodeAccordion("g", true)]), {group:"g", activeIndex:1});
assert.deepEqual(decodeAccordionGroup([encodeAccordion("g", false), encodeAccordion("g", false)]), {group:"g", activeIndex:0}, "no active flag uses the first tab");
assert.deepEqual(decodeAccordionGroup([encodeAccordion("g", true), encodeAccordion("g", true)]), {group:"g", activeIndex:0}, "first truthy active wins");

assert.equal(encodeScrolling("g", true, 800.125), JSON.stringify({group:"g",active:true,mode:"scrolling",width:800.125}));
assert.equal(encodeScrolling("g", false, undefined), JSON.stringify({group:"g",active:false,mode:"scrolling",width:null}));
assert.equal(decodeScrollingGroup(["{", encodeScrolling("g", true, 100)]), null, "malformed scrolling records skip");
assert.equal(decodeScrollingGroup([encodeScrolling("a", true, 100), encodeScrolling("b", false, 100)]), null);
const legacy = JSON.stringify({group:"g",active:true,snapshot:true,width:800.125});
const recovered = decodeScrollingGroup([legacy, JSON.stringify({group:"g",active:false,width:null})]);
assert.equal(recovered.group, "g");
assert.deepEqual(recovered.widths, [800.125, null], "legacy snapshot records keep fractional widths and ignore active");
assert.deepEqual(decodeScrollingGroup([encodeScrolling("g", true, 0)]).widths, [null], "zero width is not restored");
assert.deepEqual(decodeScrollingGroup([encodeScrolling("g", true, -4)]).widths, [null]);

console.log("Presentation records: float, accordion, and scrolling codecs passed.");
