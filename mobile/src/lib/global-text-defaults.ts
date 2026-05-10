import { Platform, StyleSheet } from 'react-native';
import { cloneElement, isValidElement } from 'react';
import type { ReactElement } from 'react';
import type { TextStyle } from 'react-native';

// Typography rule (re-established 2026-05 after Round 13 regression):
//   - iOS  → SYSTEM FONT (San Francisco). SF Pro Display/Text renders weight
//     hierarchy crisply across all 9 weights with no font loading needed.
//     Forcing Inter on iOS in r13 collapsed weights 100/200/300 onto
//     Inter_400Regular (the only "light-ish" weight we ship), flattening
//     the visual hierarchy. The user confirmed via screenshot diff that
//     SF is the intended iOS look — revert.
//   - Android → INTER, because the Android default (Roboto) renders weight
//     hierarchy poorly and we already ship Inter_400/500/600/700/800.
// Inter fonts are loaded in mobile/app/_layout.tsx via useFonts() before
// this runs.

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

// Maps an explicit Inter_X fontFamily back to the equivalent fontWeight so
// that when we strip the family on iOS, React Native still renders the
// intended visual weight via San Francisco's native weight axis.
const INTER_TO_WEIGHT: Record<string, TextStyle['fontWeight']> = {
  Inter_100Thin: '100',
  Inter_200ExtraLight: '200',
  Inter_300Light: '300',
  Inter_400Regular: '400',
  Inter_500Medium: '500',
  Inter_600SemiBold: '600',
  Inter_700Bold: '700',
  Inter_800ExtraBold: '800',
  Inter_900Black: '900',
};

function resolveBaseStyle(userStyle: unknown, isAndroid: boolean): TextStyle {
  const flat = (StyleSheet.flatten(userStyle as any) || {}) as TextStyle;
  if (!isAndroid) {
    // iOS: leave fontFamily unset so RN falls through to San Francisco.
    // SF natively honours fontWeight 100→900 with crisp hierarchy.
    // If a component explicitly set fontFamily: 'Inter_…', strip it
    // (override AFTER the user style applies — see patched render below)
    // while preserving the implied fontWeight so the visual size stays.
    const fam = flat.fontFamily;
    if (typeof fam === 'string' && fam.startsWith('Inter_')) {
      const inferredWeight = INTER_TO_WEIGHT[fam];
      // Use 'System' instead of undefined — undefined values are skipped
      // by React Native's style flatten and would NOT override an earlier
      // `fontFamily: 'Inter_…'` in the merged array. 'System' is a name
      // iOS resolves to SF Pro Display/Text and reliably wins the merge.
      const override: TextStyle = { fontFamily: 'System' };
      if (inferredWeight && flat.fontWeight == null) override.fontWeight = inferredWeight;
      return override;
    }
    return {};
  }
  const androidFix = ANDROID_TEXT_FIX;
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
      // Order matters: on Android `base` provides DEFAULTS that user style
      // should override (so [base, userStyle]). On iOS `base` is an OVERRIDE
      // that strips explicit Inter_… fontFamily, so it must come AFTER user
      // style ([userStyle, base]). When `base` is `{}` either order is a no-op.
      const merged = isAndroid
        ? [base, el.props.style]
        : [el.props.style, base];
      return cloneElement(el, { style: merged });
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
