import * as Location from 'expo-location';
import { INDIAN_DISTRICTS, INDIAN_STATES } from '../constants/data';

export type DeviceCoords = { latitude: number; longitude: number };

export type DetectedLocation = {
  coords: DeviceCoords;
  stateName?: string;
  districtName?: string;
  cityName?: string;
  formatted: string;
  // Values that match our dropdown constants (when possible)
  stateValue?: string;
  districtValue?: string;
  // Good for distance sorting (tries to be a known city/state name)
  sortKey: string;
};

export type DetectLocationResult =
  | { ok: true; location: DetectedLocation }
  | {
      ok: false;
      reason: 'services-disabled' | 'permission-denied' | 'error';
      message?: string;
    };

const slugify = (raw: string): string =>
  raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');

const matchStateValue = (stateName: string | undefined): string | undefined => {
  const name = stateName?.trim();
  if (!name) return undefined;
  const slug = slugify(name);
  return INDIAN_STATES.find((s) => s.value === slug)?.value;
};

const matchDistrictValue = (
  districtName: string | undefined
): string | undefined => {
  const name = districtName?.trim();
  if (!name) return undefined;
  const slug = slugify(name);
  return INDIAN_DISTRICTS.find((d) => d.value === slug)?.value;
};

const buildFormatted = (p: Location.LocationGeocodedAddress): string => {
  // Prefer city + district for precise location (e.g., "sodepur kolkata")
  // Otherwise fall back to city/district alone, then subregion, then state/region
  const city = (p.city || '').trim();
  const district = (p.district || '').trim();
  const subregion = (p.subregion || '').trim();
  const region = (p.region || '').trim();

  // Best: city + district (e.g., "sodepur kolkata")
  if (city && district) return `${city} ${district}`;
  // Good: city alone or district alone
  if (city) return city;
  if (district) return district;
  // OK: subregion or region
  if (subregion) return subregion;
  if (region) return region;
  return '';
};

export const detectCurrentLocation = async (): Promise<DetectLocationResult> => {
  try {
    // First, check for permission status
    let { status } = await Location.getForegroundPermissionsAsync();
    
    // If permission is not granted, request it
    if (status !== 'granted') {
      const permissionResponse = await Location.requestForegroundPermissionsAsync();
      status = permissionResponse.status;
      
      if (status !== 'granted') {
        return {
          ok: false,
          reason: 'permission-denied',
          message: 'Location permission was not granted.',
        };
      }
    }

    // Try to get current position (this will attempt to enable location services if needed)
    let position: Location.LocationObject | null = null;
    try {
      position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
    } catch (posError: any) {
      // If location is not available, it could be services disabled
      if (
        posError?.message?.includes('denied') ||
        posError?.code === 'E_LOCATION_UNAVAILABLE'
      ) {
        // Check if services are actually enabled
        try {
          const servicesEnabled = await Location.hasServicesEnabledAsync();
          if (!servicesEnabled) {
            return {
              ok: false,
              reason: 'services-disabled',
              message: 'Location services are turned off.',
            };
          }
        } catch {
          // Continue anyway, might work
        }
      }
      throw posError;
    }

    if (!position) {
      return {
        ok: false,
        reason: 'error',
        message: 'Could not get current position.',
      };
    }

    const coords: DeviceCoords = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };

    const placemarks = await Location.reverseGeocodeAsync(coords);
    const p = placemarks?.[0];

    const stateName = p?.region?.trim() || undefined;
    const districtName = p?.district?.trim() || undefined;
    const cityName = p?.city?.trim() || undefined;

    const formatted = p ? buildFormatted(p) : '';

    // For sorting, prefer a known city (best), then district, then state.
    const sortKey = cityName || districtName || stateName || formatted || '';

    return {
      ok: true,
      location: {
        coords,
        stateName,
        districtName,
        cityName,
        formatted,
        stateValue: matchStateValue(stateName),
        districtValue: matchDistrictValue(districtName || cityName),
        sortKey,
      },
    };
  } catch (e: any) {
    return { ok: false, reason: 'error', message: e?.message };
  }
};
