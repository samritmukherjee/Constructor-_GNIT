import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import {
  Sun,
  Moon,
  Cloud,
  CloudSun,
  CloudMoon,
  CloudRain,
  CloudDrizzle,
  CloudSnow,
  Snowflake,
  CloudLightning,
  CloudFog,
} from 'lucide-react-native';
import type { WeatherIllustrationKey } from '../services/weather';

type Props = {
  iconKey: WeatherIllustrationKey;
  size?: number;
  style?: StyleProp<ViewStyle>;
  color?: string;
};

// Map weather keys to Lucide icons and their colors
const getWeatherIcon = (iconKey: WeatherIllustrationKey, size: number, color?: string) => {
  const iconProps = {
    size: size * 0.85,
    strokeWidth: 1.5,
  };

  switch (iconKey) {
    case 'day':
      return <Sun {...iconProps} color={color || '#F59E0B'} />;
    case 'night':
      return <Moon {...iconProps} color={color || '#6366F1'} />;
    case 'cloudy':
      return <Cloud {...iconProps} color={color || '#64748B'} />;
    case 'cloudy-day-1':
    case 'cloudy-day-2':
    case 'cloudy-day-3':
      return <CloudSun {...iconProps} color={color || '#F59E0B'} />;
    case 'cloudy-night-1':
    case 'cloudy-night-2':
    case 'cloudy-night-3':
      return <CloudMoon {...iconProps} color={color || '#6366F1'} />;
    case 'rainy-1':
    case 'rainy-2':
    case 'rainy-3':
      return <CloudDrizzle {...iconProps} color={color || '#3B82F6'} />;
    case 'rainy-4':
    case 'rainy-5':
    case 'rainy-6':
    case 'rainy-7':
      return <CloudRain {...iconProps} color={color || '#2563EB'} />;
    case 'snowy-1':
    case 'snowy-2':
    case 'snowy-3':
      return <Snowflake {...iconProps} color={color || '#93C5FD'} />;
    case 'snowy-4':
    case 'snowy-5':
    case 'snowy-6':
      return <CloudSnow {...iconProps} color={color || '#60A5FA'} />;
    case 'thunder':
      return <CloudLightning {...iconProps} color={color || '#FBBF24'} />;
    default:
      return <CloudFog {...iconProps} color={color || '#9CA3AF'} />;
  }
};

export function WeatherIcon({ iconKey, size = 56, style, color }: Props) {
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      {getWeatherIcon(iconKey, size, color)}
    </View>
  );
}
