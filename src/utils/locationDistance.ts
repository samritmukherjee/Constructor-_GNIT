export type LatLng = { lat: number; lng: number };

// Minimal coordinate map to support "nearest farmer" sorting.
// Keys are normalized (lowercase). Add more as needed.
const LOCATION_COORDS: Record<string, LatLng> = {
  // Major cities
  'delhi': { lat: 28.6139, lng: 77.2090 },
  'kolkata': { lat: 22.5726, lng: 88.3639 },
  'mumbai': { lat: 19.0760, lng: 72.8777 },
  'bengaluru': { lat: 12.9716, lng: 77.5946 },
  'bangalore': { lat: 12.9716, lng: 77.5946 },
  'chennai': { lat: 13.0827, lng: 80.2707 },
  'hyderabad': { lat: 17.3850, lng: 78.4867 },
  'pune': { lat: 18.5204, lng: 73.8567 },
  'ahmedabad': { lat: 23.0225, lng: 72.5714 },
  'jaipur': { lat: 26.9124, lng: 75.7873 },
  'lucknow': { lat: 26.8467, lng: 80.9462 },
  'patna': { lat: 25.5941, lng: 85.1376 },

  // States (use capital-ish coords; good enough for sorting)
  'bihar': { lat: 25.5941, lng: 85.1376 },
  'west bengal': { lat: 22.5726, lng: 88.3639 },
  'ncr': { lat: 28.6139, lng: 77.2090 },
  'uttar pradesh': { lat: 26.8467, lng: 80.9462 },
  'maharashtra': { lat: 19.0760, lng: 72.8777 },
  'tamil nadu': { lat: 13.0827, lng: 80.2707 },
  'karnataka': { lat: 12.9716, lng: 77.5946 },
  'telangana': { lat: 17.3850, lng: 78.4867 },
  'gujarat': { lat: 23.0225, lng: 72.5714 },
  'rajasthan': { lat: 26.9124, lng: 75.7873 },
  'punjab': { lat: 31.6340, lng: 74.8723 },
  'kerala': { lat: 8.5241, lng: 76.9366 },
  'odisha': { lat: 20.2961, lng: 85.8245 },
  'jharkhand': { lat: 23.3441, lng: 85.3096 },
  'madhya pradesh': { lat: 23.2599, lng: 77.4126 },
  'chhattisgarh': { lat: 21.2514, lng: 81.6296 },
  'assam': { lat: 26.1445, lng: 91.7362 },
  'haryana': { lat: 28.4595, lng: 77.0266 },
  'uttarakhand': { lat: 30.3165, lng: 78.0322 },
  'andhra pradesh': { lat: 16.5062, lng: 80.6480 },
  'himachal pradesh': { lat: 31.1048, lng: 77.1734 },
  'jammu and kashmir': { lat: 34.0837, lng: 74.7973 },
  'goa': { lat: 15.4909, lng: 73.8278 },
};

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\./g, '')
    .trim();

export const getLocationCoords = (raw: string): LatLng | null => {
  const text = normalize(raw);
  if (!text) return null;

  // If format is "City, State", try city then state.
  if (text.includes(',')) {
    const [cityPart, statePart] = text.split(',').map((s) => normalize(s));
    if (cityPart && LOCATION_COORDS[cityPart]) return LOCATION_COORDS[cityPart];
    if (statePart && LOCATION_COORDS[statePart]) return LOCATION_COORDS[statePart];
  }

  // Try exact.
  if (LOCATION_COORDS[text]) return LOCATION_COORDS[text];

  // Try matching by substring against known keys (helps for "Delhi, NCR").
  const matchKey = Object.keys(LOCATION_COORDS).find((k) => text.includes(k));
  return matchKey ? LOCATION_COORDS[matchKey] : null;
};

export const haversineKm = (a: LatLng, b: LatLng): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const h = s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export const distanceKmBetweenLocations = (from: string, to: string): number | null => {
  const a = getLocationCoords(from);
  const b = getLocationCoords(to);
  if (!a || !b) return null;
  return haversineKm(a, b);
};
