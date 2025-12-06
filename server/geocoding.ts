interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

interface GoogleGeocodingResponse {
  results: Array<{
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
    formatted_address: string;
  }>;
  status: string;
  error_message?: string;
}

export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.warn('[Geocoding] No Google Maps API key found - using Australian suburb fallback');
    return geocodeAustralianSuburb(address);
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}&region=au`;
    
    const response = await fetch(url);
    const data: GoogleGeocodingResponse = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const result = data.results[0];
      return {
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
      };
    } else if (data.status === 'REQUEST_DENIED') {
      console.warn('[Geocoding] API request denied:', data.error_message);
      return geocodeAustralianSuburb(address);
    } else {
      console.warn('[Geocoding] No results for address:', address, 'Status:', data.status);
      return geocodeAustralianSuburb(address);
    }
  } catch (error) {
    console.error('[Geocoding] Error geocoding address:', error);
    return geocodeAustralianSuburb(address);
  }
}

const AUSTRALIAN_SUBURBS: Record<string, { lat: number; lng: number }> = {
  'cairns': { lat: -16.9186, lng: 145.7781 },
  'brisbane': { lat: -27.4698, lng: 153.0251 },
  'sydney': { lat: -33.8688, lng: 151.2093 },
  'melbourne': { lat: -37.8136, lng: 144.9631 },
  'perth': { lat: -31.9505, lng: 115.8605 },
  'adelaide': { lat: -34.9285, lng: 138.6007 },
  'darwin': { lat: -12.4634, lng: 130.8456 },
  'hobart': { lat: -42.8821, lng: 147.3272 },
  'gold coast': { lat: -28.0167, lng: 153.4000 },
  'newcastle': { lat: -32.9283, lng: 151.7817 },
  'townsville': { lat: -19.2590, lng: 146.8169 },
  'wollongong': { lat: -34.4278, lng: 150.8931 },
  'geelong': { lat: -38.1499, lng: 144.3617 },
  'sunshine coast': { lat: -26.6500, lng: 153.0667 },
  'canberra': { lat: -35.2809, lng: 149.1300 },
  'smithfield': { lat: -16.8494, lng: 145.7094 },
  'edge hill': { lat: -16.9019, lng: 145.7478 },
  'whitfield': { lat: -16.8903, lng: 145.7328 },
  'manoora': { lat: -16.9025, lng: 145.7389 },
  'westcourt': { lat: -16.9244, lng: 145.7467 },
  'parramatta': { lat: -33.8150, lng: 151.0031 },
  'bondi': { lat: -33.8914, lng: 151.2744 },
  'st kilda': { lat: -37.8571, lng: 144.9856 },
  'surfers paradise': { lat: -28.0023, lng: 153.4296 },
  'manly': { lat: -33.7969, lng: 151.2886 },
  'fremantle': { lat: -32.0569, lng: 115.7439 },
};

function geocodeAustralianSuburb(address: string): GeocodingResult | null {
  const lowerAddress = address.toLowerCase();
  
  // Round to 7 decimal places to match schema precision
  const roundCoord = (val: number) => Math.round(val * 10000000) / 10000000;
  
  for (const [suburb, coords] of Object.entries(AUSTRALIAN_SUBURBS)) {
    if (lowerAddress.includes(suburb)) {
      const jitter = {
        lat: (Math.random() - 0.5) * 0.01,
        lng: (Math.random() - 0.5) * 0.01,
      };
      
      return {
        latitude: roundCoord(coords.lat + jitter.lat),
        longitude: roundCoord(coords.lng + jitter.lng),
        formattedAddress: address,
      };
    }
  }
  
  const defaultCoords = AUSTRALIAN_SUBURBS['cairns'];
  const jitter = {
    lat: (Math.random() - 0.5) * 0.05,
    lng: (Math.random() - 0.5) * 0.05,
  };
  
  return {
    latitude: roundCoord(defaultCoords.lat + jitter.lat),
    longitude: roundCoord(defaultCoords.lng + jitter.lng),
    formattedAddress: address,
  };
}
