import React from 'react';
import { View, Text } from 'react-native';

interface Props {
  rating: number;
  size?: number;
  showNumber?: boolean;
}

export default function StarRating({ rating, size = 13, showNumber = false }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text
          key={i}
          style={{ fontSize: size, color: i <= Math.round(rating) ? '#F59E0B' : '#D1D5DB' }}
        >
          ★
        </Text>
      ))}
      {showNumber && (
        <Text style={{ fontSize: size - 1, color: '#6B7280', marginLeft: 2 }}>
          {rating.toFixed(1)}
        </Text>
      )}
    </View>
  );
}
