import { Platform, StyleSheet } from 'react-native';
import { cloneElement, isValidElement } from 'react';
import type { ReactElement } from 'react';
import type { TextStyle } from 'react-native';

const WEIGHT_TO_INTER: Record<string, string> = {
  '100': 'Inter_400Regular',
  '200': 'Inter_400Regular',
  '300': 'Inter_400Regular',
  '400': 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
  '900': 'Inter_800ExtraBold',
  normal: 'Inter_400Regular',
  bold: 'Inter_700Bold',
};

const ANDROID_TEXT_FIX: TextStyle =
  Platform.OS === 'android'
    ? { includeFontPadding: false, textAlignVertical: 'center' }
    : {};

function resolveBaseStyle(userStyle: unknown): TextStyle {
  const flat = (StyleSheet.flatten(userStyle as any) || {}) as TextStyle;
  // If the call-site already specified a fontFamily, respect it entirely.
  if (flat.fontFamily) return ANDROID_TEXT_FIX;
  const w = flat.fontWeight != null ? String(flat.fontWeight) : '400';
  const fontFamily = WEIGHT_TO_INTER[w] || 'Inter_400Regular';
  return { fontFamily, ...ANDROID_TEXT_FIX };
}

type Renderable = {
  render?: (...args: unknown[]) => unknown;
  defaultProps?: Record<string, unknown>;
};

const PATCHED = Symbol.for('jobrunner.r14.text-defaults');

function patch(Component: unknown): void {
  const c = Component as Renderable & { [PATCHED]?: boolean };
  if (c[PATCHED]) return;
  c.defaultProps = {
    ...(c.defaultProps ?? {}),
    allowFontScaling: c.defaultProps?.allowFontScaling ?? true,
  };
  const original = c.render;
  if (typeof original === 'function') {
    c.render = function patched(this: unknown, ...args: unknown[]) {
      const out = original.apply(this, args);
      if (!isValidElement(out)) return out;
      const el = out as ReactElement<{ style?: unknown }>;
      const base = resolveBaseStyle(el.props.style);
      // Base goes first so the call-site's own style still overrides on
      // iOS / non-conflicting properties. fontFamily resolution above already
      // bowed out if the user set one explicitly.
      return cloneElement(el, { style: [base, el.props.style] });
    };
  }
  c[PATCHED] = true;
}

export function applyGlobalTextDefaults({
  Text,
  TextInput,
}: {
  Text: unknown;
  TextInput: unknown;
}): void {
  patch(Text);
  patch(TextInput);
}
