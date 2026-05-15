import { Platform, StyleSheet } from 'react-native';
import { cloneElement, isValidElement } from 'react';
import type { ReactElement } from 'react';
import type { TextStyle } from 'react-native';

// iOS App Store builds shipped with the system font (San Francisco) and
// no global text defaults. Re-introducing a global Inter mapping in r13/r14
// caused a visible weight regression on iOS — light and regular text became
// noticeably heavier and tighter than the App Store build. To restore that
// look we now leave iOS entirely alone and only patch Android, where the
// includeFontPadding/textAlignVertical fix is needed for vertical alignment
// parity with iOS.

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

function resolveAndroidBaseStyle(userStyle: unknown): TextStyle {
  const flat = (StyleSheet.flatten(userStyle as any) || {}) as TextStyle;
  if (flat.fontFamily) return ANDROID_TEXT_FIX;
  const w = flat.fontWeight != null ? String(flat.fontWeight) : '400';
  const fontFamily = WEIGHT_TO_INTER[w] || 'Inter_400Regular';
  return { fontFamily, ...ANDROID_TEXT_FIX };
}

type Renderable = {
  render?: (...args: unknown[]) => unknown;
  defaultProps?: Record<string, unknown>;
};

const PATCHED = Symbol.for('jobrunner.r15.text-defaults');

function patchAndroid(Component: unknown): void {
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
      const base = resolveAndroidBaseStyle(el.props.style);
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
  // iOS: no patching at all. Preserves the App Store typography (system font,
  // native weight rendering, no fontFamily injection).
  if (Platform.OS !== 'android') return;
  patchAndroid(Text);
  patchAndroid(TextInput);
}
