import * as Location from 'expo-location';

export interface HourlyWeather {
  time: string;
  temperature: number;
  weatherCode: number;
  precipitation: number;
  humidity: number;
}

export interface CurrentWeather {
  temperature: number;
  weatherCode: number;
  humidity: number;
  precipitation: number;
}

export interface WeatherData {
  current: CurrentWeather;
  hourly: HourlyWeather[];
  location: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Get weather icon name based on WMO weather codes
 * Reference: https://open-meteo.com/en/docs
 */
export const getWeatherIcon = (weatherCode: number): string => {
  // Clear sky
  if (weatherCode === 0) return 'clear';
  // Mainly clear, partly cloudy
  if (weatherCode === 1 || weatherCode === 2) return 'partly-cloudy';
  // Overcast
  if (weatherCode === 3) return 'cloudy';
  // Fog
  if (weatherCode === 45 || weatherCode === 48) return 'fog';
  // Drizzle
  if (weatherCode >= 51 && weatherCode <= 57) return 'drizzle';
  // Rain
  if (weatherCode >= 61 && weatherCode <= 65) return 'rain';
  // Heavy rain
  if (weatherCode >= 66 && weatherCode <= 67) return 'heavy-rain';
  // Snow
  if (weatherCode >= 71 && weatherCode <= 77) return 'snow';
  // Rain showers
  if (weatherCode >= 80 && weatherCode <= 82) return 'rain';
  // Heavy rain showers
  if (weatherCode === 82) return 'heavy-rain';
  // Snow showers
  if (weatherCode >= 85 && weatherCode <= 86) return 'snow';
  // Thunderstorm
  if (weatherCode >= 95 && weatherCode <= 99) return 'thunderstorm';
  
  return 'clear';
};

/**
 * Get weather condition translation key based on weather code
 */
export const getWeatherConditionKey = (weatherCode: number): string => {
  if (weatherCode === 0) return 'clear';
  if (weatherCode === 1 || weatherCode === 2) return 'partlyCloudy';
  if (weatherCode === 3) return 'cloudy';
  if (weatherCode === 45 || weatherCode === 48) return 'foggy';
  if (weatherCode >= 51 && weatherCode <= 57) return 'drizzle';
  if (weatherCode >= 61 && weatherCode <= 65) return 'rainy';
  if (weatherCode >= 66 && weatherCode <= 67) return 'heavyRain';
  if (weatherCode >= 71 && weatherCode <= 77) return 'snowy';
  if (weatherCode >= 80 && weatherCode <= 82) return 'showers';
  if (weatherCode >= 85 && weatherCode <= 86) return 'snowShowers';
  if (weatherCode >= 95 && weatherCode <= 99) return 'thunderstorm';
  
  return 'clear';
};

/**
 * Request location permission and get current location
 */
export const getUserLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      console.error('Location permission denied');
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error('Error getting location:', error);
    return null;
  }
};

/**
 * Fetch weather data from Open-Meteo API
 */
export const fetchWeatherData = async (
  latitude: number,
  longitude: number
): Promise<WeatherData | null> => {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,relative_humidity_2m,precipitation&hourly=temperature_2m,weather_code,precipitation,relative_humidity_2m&timezone=auto&forecast_days=1`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Failed to fetch weather data');
    }

    const data = await response.json();

    // Get current hour's data
    const current: CurrentWeather = {
      temperature: Math.round(data.current.temperature_2m),
      weatherCode: data.current.weather_code,
      humidity: data.current.relative_humidity_2m,
      precipitation: data.current.precipitation,
    };

    // Parse hourly data for the next 24 hours
    const hourly: HourlyWeather[] = data.hourly.time.map((time: string, index: number) => ({
      time,
      temperature: Math.round(data.hourly.temperature_2m[index]),
      weatherCode: data.hourly.weather_code[index],
      precipitation: data.hourly.precipitation[index],
      humidity: data.hourly.relative_humidity_2m[index],
    }));

    return {
      current,
      hourly,
      location: {
        latitude,
        longitude,
      },
    };
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return null;
  }
};

/**
 * Get weather data for user's current location
 */
export const getWeatherForCurrentLocation = async (): Promise<WeatherData | null> => {
  const location = await getUserLocation();
  
  if (!location) {
    return null;
  }

  return await fetchWeatherData(location.latitude, location.longitude);
};
