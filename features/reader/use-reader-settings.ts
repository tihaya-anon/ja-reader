import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export type ReaderModalSettings = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ReaderAppearanceSettings = {
  fontFamily: 'serif' | 'sans' | 'rounded';
  fontSize: number;
  lineHeight: number;
  paragraphGap: number;
  horizontalInset: number;
  verticalInset: number;
};

type ReaderSettings = {
  modal: ReaderModalSettings;
  appearance: ReaderAppearanceSettings;
};

const SETTINGS_KEY = 'reader.settings.v2';

const DEFAULT_MODAL_SETTINGS: ReaderModalSettings = {
  x: 24,
  y: 140,
  width: 320,
  height: 320,
};

const DEFAULT_APPEARANCE_SETTINGS: ReaderAppearanceSettings = {
  fontFamily: 'serif',
  fontSize: 26,
  lineHeight: 38,
  paragraphGap: 26,
  horizontalInset: 0,
  verticalInset: 0,
};

export function useReaderSettings() {
  const [settings, setSettings] = useState<ReaderSettings>({
    modal: DEFAULT_MODAL_SETTINGS,
    appearance: DEFAULT_APPEARANCE_SETTINGS,
  });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        if (!raw || !isMounted) {
          return;
        }

        const parsed = JSON.parse(raw) as {
          modal?: Partial<ReaderModalSettings>;
          appearance?: Partial<ReaderAppearanceSettings>;
        };
        if (!parsed) {
          return;
        }

        setSettings((current) => ({
          modal: mergeModalSettings(current.modal, parsed.modal),
          appearance: mergeAppearanceSettings(current.appearance, parsed.appearance),
        }));
      } catch {
        // Ignore invalid persisted state and fall back to defaults.
      } finally {
        if (isMounted) {
          setIsLoaded(true);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(() => {
      // Ignore persistence failures in the MVP.
    });
  }, [isLoaded, settings]);

  return {
    modalSettings: settings.modal,
    appearanceSettings: settings.appearance,
    setModalSettings: (next: Partial<ReaderModalSettings>) => {
      setSettings((current) => ({
        ...current,
        modal: mergeModalSettings(current.modal, next),
      }));
    },
    setAppearanceSettings: (next: Partial<ReaderAppearanceSettings>) => {
      setSettings((current) => ({
        ...current,
        appearance: mergeAppearanceSettings(current.appearance, next),
      }));
    },
  };
}

function mergeModalSettings(
  current: ReaderModalSettings,
  next?: Partial<ReaderModalSettings>
): ReaderModalSettings {
  if (!next) {
    return current;
  }

  const sanitized = sanitizeSettings(next);

  return {
    x: sanitized.x ?? current.x,
    y: sanitized.y ?? current.y,
    width: sanitized.width ?? current.width,
    height: sanitized.height ?? current.height,
  };
}

function mergeAppearanceSettings(
  current: ReaderAppearanceSettings,
  next?: Partial<ReaderAppearanceSettings>
): ReaderAppearanceSettings {
  if (!next) {
    return current;
  }

  return {
    fontFamily:
      next.fontFamily === 'serif' ||
      next.fontFamily === 'sans' ||
      next.fontFamily === 'rounded'
        ? next.fontFamily
        : current.fontFamily,
    fontSize: clampNumber(next.fontSize, 20, 40) ?? current.fontSize,
    lineHeight: clampNumber(next.lineHeight, 28, 56) ?? current.lineHeight,
    paragraphGap: clampNumber(next.paragraphGap, 16, 44) ?? current.paragraphGap,
    horizontalInset: clampNumber(next.horizontalInset, 0, 36) ?? current.horizontalInset,
    verticalInset: clampNumber(next.verticalInset, 0, 36) ?? current.verticalInset,
  };
}

function sanitizeSettings(settings: Partial<ReaderModalSettings>) {
  return {
    x: clampNumber(settings.x, 0, 9999),
    y: clampNumber(settings.y, 0, 9999),
    width: clampNumber(settings.width, 240, 720),
    height: clampNumber(settings.height, 180, 720),
  };
}

function clampNumber(value: number | undefined, min: number, max: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined;
  }

  return Math.min(Math.max(value, min), max);
}
