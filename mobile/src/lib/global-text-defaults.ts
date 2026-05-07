import { Platform } from 'react-native';
import { cloneElement, isValidElement } from 'react';
import type { ReactElement } from 'react';
import type { TextStyle } from 'react-native';

const BASE: TextStyle = {
  fontFamily: 'Inter_400Regular',
  ...(Platform.OS === 'android'
    ? { includeFontPadding: false, textAlignVertical: 'center' as const }
    : {}),
};

type Renderable = {
  render?: (...args: unknown[]) => unknown;
  defaultProps?: Record<string, unknown>;
};

const PATCHED = Symbol.for('jobrunner.r13.text-defaults');

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
      return cloneElement(el, { style: [BASE, el.props.style] });
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
