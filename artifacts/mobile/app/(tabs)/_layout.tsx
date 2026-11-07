import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router/js-tabs';
import { NativeTabs } from 'expo-router/native-tabs';
import { SymbolView } from 'expo-symbols';

// IMPORTANT: iOS 26 uses NativeTabs for native tabs with liquid glass support.
// NativeTabs intentionally does NOT use custom design tokens — liquid glass
// is a system-level appearance provided by iOS and cannot be overridden.
// Custom brand colors are applied only on the ClassicTabLayout path (older iOS / Android / web).
function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'list.bullet', selected: 'list.bullet' }}
        />
        <NativeTabs.Trigger.Label>My tickets</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} />
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const isDark = true;
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isIOS ? 'transparent' : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'My tickets',
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name="list.bullet" tintColor={color} size={24} />
            ) : (
              <Feather
                name="list"
                size={22}
                color={focused ? colors.primary : colors.mutedForeground}
              />
            ),
        }}
      />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: ({ color }) =>
        <Feather name="user" size={22} color={typeof color === 'string' ? color : colors.foreground} /> }} />
    </Tabs>
  );
}

export default function TabLayout() {
  if (Platform.OS === 'ios' && isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
