import { Platform, StyleSheet } from 'react-native';
import { cloneElement, isValidElement } from 'react';
import type { ReactElement } from 'react';
import type { TextStyle } from 'react-native';

// Inter is the brand font on both iOS and Android. iOS was previously left on
// system font (San Francisco) due to a weight regression in r13/r14, but the
// user has confirmed Inter is the intended look across both platforms. Inter
// fonts are loaded in mobile/app/_layout.tsx via useFonts() before this runs.

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

const ANDROID_TEXT_FIX: TextStyle = { includeFontPadding: false, textAlignVertical: 'center' };

function resolveBaseStyle(userStyle: unknown, isAndroid: boolean): TextStyle {
  const flat = (StyleSheet.flatten(userStyle as any) || {}) as TextStyle;
  const androidFix = isAndroid ? ANDROID_TEXT_FIX : {};
  if (flat.fontFamily) return androidFix;
  const w = flat.fontWeight != null ? String(flat.fontWeight) : '400';
  const fontFamily = WEIGHT_TO_INTER[w] || 'Inter_400Regular';
  return { fontFamily, ...androidFix };
}

type Renderable = {
  render?: (...args: unknown[]) => unknown;
  defaultProps?: Record<string, unknown>;
};

const PATCHED = Symbol.for('jobrunner.r16.text-defaults');

function patchComponent(Component: unknown, isAndroid: boolean): void {
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
      const base = resolveBaseStyle(el.props.style, isAndroid);
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
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
  const isAndroid = Platform.OS === 'android';
  patchComponent(Text, isAndroid);
  patchComponent(TextInput, isAndroid);
}
