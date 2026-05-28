import { Tabs } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { ReaderAnnotationsProvider } from '@/features/reader/reader-annotations-context';
import { ReaderChromeProvider, useReaderChrome } from '@/features/reader/reader-chrome-context';
import { ReaderStateProvider } from '@/features/reader/reader-state-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  return (
    <ReaderAnnotationsProvider>
      <ReaderStateProvider>
        <ReaderChromeProvider>
          <ReaderTabs />
        </ReaderChromeProvider>
      </ReaderStateProvider>
    </ReaderAnnotationsProvider>
  );
}

function ReaderTabs() {
  const colorScheme = useColorScheme();
  const tabColors = Colors[colorScheme ?? 'light'];

  return (
    <Tabs
      tabBar={(props) => <ReaderTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tabColors.tint,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Read',
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Library',
        }}
      />
    </Tabs>
  );
}

function ReaderTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const colorScheme = useColorScheme();
  const chrome = useReaderChrome();
  const colors = Colors[colorScheme ?? 'light'];
  const isReadRoute = state.routes[state.index]?.name === 'index';
  const barBorder = colors.icon;
  const activeBackground = colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,28,0.06)';
  const inactiveBackground = colorScheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(17,24,28,0.02)';
  const items = isReadRoute
    ? [
        {
          key: 'index',
          label: descriptors[state.routes[0].key]?.options.title ?? 'Read',
          icon: 'book.pages.fill' as const,
          active: state.routes[state.index]?.name === 'index',
          onPress: () => navigation.navigate('index'),
          disabled: false,
        },
        {
          key: 'explore',
          label: descriptors[state.routes[1].key]?.options.title ?? 'Library',
          icon: 'square.grid.2x2.fill' as const,
          active: state.routes[state.index]?.name === 'explore',
          onPress: () => navigation.navigate('explore'),
          disabled: false,
        },
        {
          key: 'prev',
          label: 'Prev',
          icon: 'chevron.left.circle.fill' as const,
          active: false,
          onPress: chrome.goToPreviousChapter,
          disabled: !chrome.canGoPreviousChapter,
        },
        {
          key: 'menu',
          label: 'Format',
          icon: 'slider.horizontal.3' as const,
          active: chrome.isSettingsVisible,
          onPress: () => chrome.setIsSettingsVisible(!chrome.isSettingsVisible),
          disabled: false,
        },
        {
          key: 'next',
          label: 'Next',
          icon: 'chevron.right.circle.fill' as const,
          active: false,
          onPress: chrome.goToNextChapter,
          disabled: !chrome.canGoNextChapter,
        },
      ]
    : [
        {
          key: state.routes[0].key,
          label: descriptors[state.routes[0].key]?.options.title ?? 'Read',
          icon: 'book.pages.fill' as const,
          active: state.routes[state.index]?.name === 'index',
          onPress: () => navigation.navigate('index'),
          disabled: false,
        },
        {
          key: state.routes[1].key,
          label: descriptors[state.routes[1].key]?.options.title ?? 'Library',
          icon: 'square.grid.2x2.fill' as const,
          active: state.routes[state.index]?.name === 'explore',
          onPress: () => navigation.navigate('explore'),
          disabled: false,
        },
        {
          key: 'prev',
          label: 'Prev',
          icon: 'chevron.left.circle.fill' as const,
          active: false,
          onPress: chrome.goToPreviousChapter,
          disabled: !chrome.canGoPreviousChapter,
        },
        {
          key: 'menu',
          label: 'Format',
          icon: 'slider.horizontal.3' as const,
          active: chrome.isSettingsVisible,
          onPress: () => chrome.setIsSettingsVisible(!chrome.isSettingsVisible),
          disabled: false,
        },
        {
          key: 'next',
          label: 'Next',
          icon: 'chevron.right.circle.fill' as const,
          active: false,
          onPress: chrome.goToNextChapter,
          disabled: !chrome.canGoNextChapter,
        },
      ];

  return (
    <View style={[styles.barShell, { backgroundColor: colors.background, borderTopColor: barBorder }]}>
      <View style={styles.unifiedRow}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            disabled={item.disabled}
            onPress={item.onPress}
            style={[
              styles.unifiedButton,
              {
                backgroundColor: item.active ? activeBackground : inactiveBackground,
                opacity: item.disabled ? 0.36 : 1,
              },
            ]}>
            <IconSymbol
              size={20}
              name={item.icon}
              color={item.active ? colors.tint : colors.text}
            />
            <Text
              style={[
                styles.unifiedLabel,
                { color: item.active ? colors.tint : colors.text },
              ]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barShell: {
    borderTopWidth: 1,
  },
  unifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
  },
  unifiedButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  unifiedLabel: {
    fontFamily: Fonts.rounded,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
});
