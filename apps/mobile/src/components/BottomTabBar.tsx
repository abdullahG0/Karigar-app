import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme';
import type { ResidentStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<ResidentStackParamList>;

const TABS: {
  route: keyof ResidentStackParamList;
  label: string;
  icon: string;
  activeIcon: string;
}[] = [
  { route: 'Home',       label: 'Home',     icon: 'home-outline',     activeIcon: 'home' },
  { route: 'MyBookings', label: 'Bookings', icon: 'calendar-outline', activeIcon: 'calendar' },
];

export default function BottomTabBar() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute();
  const insets     = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map((tab) => {
        const active = route.name === tab.route;
        return (
          <TouchableOpacity
            key={tab.route}
            style={styles.tab}
            activeOpacity={0.7}
            onPress={() => {
              if (!active) {
                // Replace instead of push so the back stack doesn't grow.
                navigation.navigate(tab.route as any);
              }
            }}
          >
            <Ionicons
              name={(active ? tab.activeIcon : tab.icon) as any}
              size={24}
              color={active ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  tab:         { flex: 1, alignItems: 'center', gap: 2 },
  label:       { fontSize: 11, color: colors.textMuted },
  labelActive: { color: colors.primary, fontWeight: '600' },
});
