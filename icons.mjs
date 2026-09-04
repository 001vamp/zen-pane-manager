// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/
// Icon data from Lucide Icons 1.41.0, licensed under ISC. See LICENSES/LUCIDE-ICONS.txt.
const icons = {
  check: [["path",{"d":"M20 6 9 17l-5-5"}]],
  down: [["path",{"d":"m6 9 6 6 6-6"}]],
  up: [["path",{"d":"m18 15-6-6-6 6"}]],
  plus: [["path",{"d":"M5 12h14"}],["path",{"d":"M12 5v14"}]],
  back: [["path",{"d":"m12 19-7-7 7-7"}],["path",{"d":"M19 12H5"}]],
  forward: [["path",{"d":"M5 12h14"}],["path",{"d":"m12 5 7 7-7 7"}]],
  close: [["path",{"d":"M18 6 6 18"}],["path",{"d":"m6 6 12 12"}]],
  more: [["circle",{"cx":"12","cy":"12","r":"1"}],["circle",{"cx":"19","cy":"12","r":"1"}],["circle",{"cx":"5","cy":"12","r":"1"}]],
  info: [["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M12 16v-4"}],["path",{"d":"M12 8h.01"}]],
  settings: [["path",{"d":"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"}],["circle",{"cx":"12","cy":"12","r":"3"}]],
  search: [["path",{"d":"m21 21-4.34-4.34"}],["circle",{"cx":"11","cy":"11","r":"8"}]],
  pin: [["path",{"d":"M12 17v5"}],["path",{"d":"M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"}]],
  swap: [["path",{"d":"M8 3 4 7l4 4"}],["path",{"d":"M4 7h16"}],["path",{"d":"m16 21 4-4-4-4"}],["path",{"d":"M20 17H4"}]],
  right: [["rect",{"x":"3","y":"4","width":"18","height":"16","rx":"2"}],["rect",{"class":"pane-icon-fill","x":"13","y":"5","width":"7","height":"14","rx":"1"}]],
  below: [["rect",{"x":"3","y":"4","width":"18","height":"16","rx":"2"}],["rect",{"class":"pane-icon-fill","x":"4","y":"13","width":"16","height":"6","rx":"1"}]],
  grid: [["rect",{"class":"pane-icon-fill","x":"3","y":"3","width":"8","height":"8","rx":"1"}],["rect",{"class":"pane-icon-fill","x":"13","y":"3","width":"8","height":"8","rx":"1"}],["rect",{"class":"pane-icon-fill","x":"3","y":"13","width":"8","height":"8","rx":"1"}],["rect",{"class":"pane-icon-fill","x":"13","y":"13","width":"8","height":"8","rx":"1"}]],
  float: [["rect",{"x":"3","y":"3","width":"18","height":"18","rx":"2"}],["rect",{"class":"pane-icon-fill","x":"11","y":"11","width":"9","height":"8","rx":"1.5"}]],
  normal: [["rect",{"class":"pane-icon-fill","x":"4","y":"4","width":"16","height":"16","rx":"2"}]],
  grip: [["circle",{"cx":"12","cy":"9","r":"1"}],["circle",{"cx":"19","cy":"9","r":"1"}],["circle",{"cx":"5","cy":"9","r":"1"}],["circle",{"cx":"12","cy":"15","r":"1"}],["circle",{"cx":"19","cy":"15","r":"1"}],["circle",{"cx":"5","cy":"15","r":"1"}]],
  unsplit: [["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2"}],["path",{"d":"M3 9h18"}],["path",{"d":"m9 16 3-3 3 3"}]]
};
export function paneIcon(doc, name) {
  const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("pane-svg"); svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
  for (const [tag, attributes] of icons[name] || []) {
    const child = doc.createElementNS(svg.namespaceURI, tag);
    for (const [key, value] of Object.entries(attributes)) child.setAttribute(key, value);
    svg.append(child);
  }
  return svg;
}
export function setPaneIcon(node, name) { node.replaceChildren(paneIcon(node.ownerDocument, name)); }

function iconMarkup(name) {
  return (icons[name] || []).map(([tag, attributes]) => {
    const attrs = Object.entries(attributes)
      .filter(([key]) => key !== "class")
      .map(([key, value]) => `${key}="${value}"`).join(" ");
    return `<${tag} ${attrs}/>`;
  }).join("");
}

// Native Zen toolbarbuttons paint their `image` attribute through anonymous XUL
// content, so a child SVG can be suppressed by browser chrome styles.
export function setPaneNativeIcon(node, name) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="context-stroke" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${iconMarkup(name)}</svg>`;
  node.setAttribute("image", `data:image/svg+xml,${encodeURIComponent(svg)}`);
  node.setAttribute("data-pane-icon", name);
}
