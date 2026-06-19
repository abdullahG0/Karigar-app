import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme';
import type { ProfessionalStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<ProfessionalStackParamList>;

const TABS: {
  route: keyof ProfessionalStackParamList;
  label: string;
  icon: string;
  activeIcon: string;
}[] = [
  { route: 'Dashboard', label: 'Dashboard', icon: 'grid-outline',      activeIcon: 'grid' },
  { route: 'Jobs',      label: 'Jobs',      icon: 'briefcase-outline', activeIcon: 'briefcase' },
  { route: 'Profile',   label: 'Profile',   icon: 'person-outline',    activeIcon: 'person' },
];

export default function ProfessionalTabBar() {
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
              if (!active) navigation.navigate(tab.route as any);
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
  bar:         { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 8 },
  tab:         { flex: 1, alignItems: 'center', gap: 2 },
  label:       { fontSize: 11, color: '#6B7280' },
  labelActive: { color: '#2563EB', fontWeight: '600' },
});
