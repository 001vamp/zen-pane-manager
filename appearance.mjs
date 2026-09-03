// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
export const numericSettings = [
  { key: 'picker-width', label: 'Picker width', min: 320, max: 1000, value: 520, unit: 'px' },
  { key: 'recent-count', label: 'Tabs in compact view', min: 1, max: 12, value: 4, unit: 'tabs' },
  { key: 'item-spacing', label: 'Tab spacing', min: 0, max: 24, value: 8, unit: 'px' },
  { key: 'glass-blur', label: 'Glass blur', min: 0, max: 80, value: 38, unit: 'px', custom: true },
  { key: 'corner-radius', label: 'Corner radius', min: 0, max: 48, value: 24, unit: 'px', custom: true },
];
export const colorSettings = [
  { key: 'accent-color', label: 'Focus and highlight color', value: 'AccentColor', minAlpha: 30 },
  { key: 'tint-light', label: 'Light-mode glass tint', value: 'rgba(247, 248, 251, 0.78)', minAlpha: 0, custom: true },
  { key: 'tint-dark', label: 'Dark-mode glass tint', value: 'rgba(24, 25, 30, 0.78)', minAlpha: 0, custom: true },
];
export function boundedNumber(value, setting) {
  const number = typeof value === 'string' && !value.trim() ? NaN : Number(value);
  return Number.isFinite(number) ? Math.min(setting.max, Math.max(setting.min, Math.round(number))) : setting.value;
}
export function numericValue(key, prefs) {
  const setting = numericSettings.find(item => item.key === key);
  const fallback = key === 'item-spacing' && prefs.getBoolPref('mod.pane.compact-picker', false) ? 5 : setting.value;
  return boundedNumber(prefs.getIntPref(`mod.pane.${key}`, fallback), setting);
}
export const glassPresets = [
  { light: 'rgba(247, 248, 251, 0.78)', dark: 'rgba(24, 25, 30, 0.78)', blur: 38, radius: 24 },
  { light: 'rgba(255, 255, 255, 0.46)', dark: 'rgba(18, 20, 26, 0.52)', blur: 18, radius: 18 },
  { light: 'rgba(247, 248, 251, 0.9)', dark: 'rgba(24, 25, 30, 0.9)', blur: 52, radius: 24 },
  { light: 'rgba(224, 232, 255, 0.8)', dark: 'rgba(40, 34, 62, 0.84)', blur: 38, radius: 30 },
];
