import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

type ReaderChromeNavigation = {
  canGoPreviousChapter: boolean;
  canGoNextChapter: boolean;
  goToPreviousChapter: () => void;
  goToNextChapter: () => void;
};

type ReaderChromeContextValue = ReaderChromeNavigation & {
  showChrome: boolean;
  setShowChrome: (next: boolean) => void;
  isSettingsVisible: boolean;
  setIsSettingsVisible: (next: boolean) => void;
  setNavigation: (next: ReaderChromeNavigation) => void;
};

const noop = () => {};

const ReaderChromeContext = createContext<ReaderChromeContextValue>({
  showChrome: true,
  setShowChrome: noop,
  isSettingsVisible: false,
  setIsSettingsVisible: noop,
  setNavigation: noop,
  canGoPreviousChapter: false,
  canGoNextChapter: false,
  goToPreviousChapter: noop,
  goToNextChapter: noop,
});

export function ReaderChromeProvider({ children }: PropsWithChildren) {
  const [showChrome, setShowChrome] = useState(true);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [navigationState, setNavigationState] = useState({
    canGoPreviousChapter: false,
    canGoNextChapter: false,
    goToPreviousChapter: noop,
    goToNextChapter: noop,
  });

  const value = useMemo(
    () => ({
      showChrome,
      setShowChrome,
      isSettingsVisible,
      setIsSettingsVisible,
      setNavigation: setNavigationState,
      ...navigationState,
    }),
    [isSettingsVisible, navigationState, showChrome]
  );

  return <ReaderChromeContext.Provider value={value}>{children}</ReaderChromeContext.Provider>;
}

export function useReaderChrome() {
  return useContext(ReaderChromeContext);
}

export function useSetReaderChromeNavigation() {
  const context = useContext(ReaderChromeContext);

  return context.setNavigation;
}
