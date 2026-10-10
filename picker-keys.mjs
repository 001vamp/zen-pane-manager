// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/

import { modeLabels } from "./layout-modes.mjs?pane=0.11.0-picker";

// One reducer for every later hub PR. Pointer (hover/click) stays at the edge.
// scope / peek / pending stay null until those PRs fill them in.

const IME = input => Boolean(input.isComposing || input.keyCode === 229);

export function isHubCycleChord(input) {
  return Boolean(
    input?.ctrlKey
    && input.shiftKey
    && !input.altKey
    && !input.metaKey
    && (input.code === "BracketLeft" || input.code === "BracketRight")
  );
}

// Solo tabs do not show Replace. The chip bar still lists every other layout.
export function visibleModes({ inSplit } = {}) {
  return Object.keys(modeLabels).filter(mode => inSplit || mode !== "replace");
}

export function cycleMode(mode, direction, { inSplit } = {}) {
  const modes = visibleModes({ inSplit });
  if (!modes.length) return mode;
  const index = modes.indexOf(mode);
  const from = index < 0 ? (direction > 0 ? -1 : 0) : index;
  return modes[(from + direction + modes.length) % modes.length];
}

function done(state, action = null) {
  return { state, action };
}

export function reduce(state, keyInput = {}) {
  const input = {
    key: keyInput.key ?? "",
    code: keyInput.code ?? "",
    keyCode: keyInput.keyCode ?? 0,
    ctrlKey: Boolean(keyInput.ctrlKey),
    shiftKey: Boolean(keyInput.shiftKey),
    altKey: Boolean(keyInput.altKey),
    metaKey: Boolean(keyInput.metaKey),
    isComposing: Boolean(keyInput.isComposing),
  };

  const guarded = isHubCycleChord(input)
    || ["Enter", "Escape", "ArrowUp", "ArrowDown"].includes(input.key);
  if (IME(input) && guarded) return done(state, null);

  if (isHubCycleChord(input)) {
    const direction = input.code === "BracketRight" ? 1 : -1;
    const mode = cycleMode(state.mode, direction, { inSplit: state.inSplit });
    return done({ ...state, mode }, { type: "cycleMode", mode, preventDefault: true });
  }

  if (input.key === "Escape") {
    if (String(state.query ?? "")) {
      return done({ ...state, query: "", expanded: false }, { type: "clearQuery", preventDefault: true });
    }
    if (state.expanded) {
      return done({ ...state, expanded: false }, { type: "collapse", preventDefault: true });
    }
    return done(state, { type: "close", preventDefault: true });
  }

  if (input.key === "ArrowUp" || input.key === "ArrowDown") {
    const rows = state.rows ?? [];
    const step = input.key === "ArrowDown" ? 1 : -1;
    const selectedIndex = rows.length
      ? (((state.selectedIndex ?? 0) + step) % rows.length + rows.length) % rows.length
      : 0;
    return done({ ...state, selectedIndex }, { type: "move", preventDefault: true });
  }

  if (input.key === "Enter") {
    const row = (state.rows ?? [])[state.selectedIndex];
    if (!row) return done(state, null);
    const kind = row.kind === "split" ? "split" : "tab";
    // Peek mapping lands in PR4. Until then, Shift+Enter floats a split card only.
    const mode = input.shiftKey && kind === "split" ? "float" : state.mode;
    return done(state, { type: "activate", kind, mode, preventDefault: true });
  }

  // Letters, digits, bare brackets, Tab, and Left/Right stay with the input / trap.
  return done(state, null);
}
