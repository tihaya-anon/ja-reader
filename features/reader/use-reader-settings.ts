import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

type ReaderModalSettings = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const SETTINGS_KEY = 'reader.modal-settings.v1';

const DEFAULT_MODAL_SETTINGS: ReaderModalSettings = {
  x: 24,
  y: 140,
  width: 320,
  height: 320,
};

export function useReaderSettings() {
  const [modalSettings, setModalSettings] = useState<ReaderModalSettings>(DEFAULT_MODAL_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        if (!raw || !isMounted) {
          return;
        }

        const parsed = JSON.parse(raw) as Partial<ReaderModalSettings>;
        if (!parsed) {
          return;
        }

        setModalSettings((current) => mergeSettings(current, parsed));
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

    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(modalSettings)).catch(() => {
      // Ignore persistence failures in the MVP.
    });
  }, [isLoaded, modalSettings]);

  return {
    modalSettings,
    setModalSettings: (next: Partial<ReaderModalSettings>) => {
      setModalSettings((current) => mergeSettings(current, next));
    },
  };
}

function mergeSettings(
  current: ReaderModalSettings,
  next: Partial<ReaderModalSettings>
): ReaderModalSettings {
  const sanitized = sanitizeSettings(next);

  return {
    x: sanitized.x ?? current.x,
    y: sanitized.y ?? current.y,
    width: sanitized.width ?? current.width,
    height: sanitized.height ?? current.height,
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
