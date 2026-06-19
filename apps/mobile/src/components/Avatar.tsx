import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const PALETTE = ['#2563EB','#7C3AED','#059669','#D97706','#DB2777','#DC2626'];

function bgColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface Props {
  name: string;
  size?: number;
}

export default function Avatar({ name, size = 48 }: Props) {
  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor(name) },
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base:  { justifyContent: 'center', alignItems: 'center' },
  text:  { color: '#fff', fontWeight: '700' },
});
