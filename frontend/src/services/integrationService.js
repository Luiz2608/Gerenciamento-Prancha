// Service to handle external API integrations (Maps, Fuel, Tolls)
// Using OpenStreetMap (Nominatim) and OSRM for real data

/**
 * Helper to get coordinates from an address using Nominatim
 * @param {string} address 
 * @returns {Promise<{lat: number, lon: number} | null>}
 */
const getCoordinates = async (address) => {
  if (!address) return null;
  
  // Check if it's already "lat,lon"
  const coordMatch = address.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
  if (coordMatch) {
    return { lat: parseFloat(coordMatch[1]), lon: parseFloat(coordMatch[3]) };
  }

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.error("Geocoding error", e);
  }
  return null;
};

/**
 * Calculates distance, duration and geometry between two locations using OSRM.
 * @param {string} origin - Origin address
 * @param {string} destination - Destination address
 * @returns {Promise<{distanceKm: number, durationMinutes: number, geometry: object, waypoints: array, source: string}>}
 */
export const getRouteData = async (origin, destination) => {
  console.log(`[Integration] Fetching route from ${origin} to ${destination}`);
  
  try {
    const start = await getCoordinates(origin);
    const end = await getCoordinates(destination);

    if (!start || !end) {
      console.warn("Could not geocode origin or destination - using fallback");
      throw new Error("Geocoding failed - falling back to mock");
    }

    // OSRM requires lon,lat;lon,lat
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson&alternatives=true`;
    
    const res = await fetch(url);
    const data = await res.json();

    if (data.code === "Ok" && data.routes && data.routes.length > 0) {
      const routes = data.routes.map((r, index) => ({
        id: index,
        distanceKm: parseFloat((r.distance / 1000).toFixed(1)),
        durationMinutes: Math.round(r.duration / 60),
        geometry: r.geometry,
        summary: r.legs && r.legs[0] ? r.legs[0].summary : `Rota ${index + 1}`,
        weight: r.weight,
        weight_name: r.weight_name
      }));

      // Sort by duration/distance logic if needed, but OSRM usually puts best first
      const best = routes[0];

      return {
        distanceKm: best.distanceKm,
        durationMinutes: best.durationMinutes,
        geometry: best.geometry,
        waypoints: data.waypoints,
        source: "OSRM",
        alternatives: routes
      };
    }
  } catch (e) {
    // Only log actual errors, not expected geocoding failures
    if (e.message && e.message.includes("Geocoding failed")) {
        console.warn("Route fetch: " + e.message);
    } else {
        console.error("Route fetch error", e);
    }
  }

  // Fallback to mock if API fails
  console.warn("Falling back to mock route data");
  
  // Try to recover coordinates if they were fetched before the error
  let startCoords = null, endCoords = null;
  try {
     startCoords = await getCoordinates(origin);
     endCoords = await getCoordinates(destination);
  } catch (err) { console.warn("Fallback geocode failed", err); }

  const seed = (origin.length + destination.length) * 123;
  const mockDist = 50 + (seed % 800);
  
  // Create a straight line geometry if coordinates are available
  let fallbackGeometry = null;
  if (startCoords && endCoords) {
      fallbackGeometry = {
          type: "LineString",
          coordinates: [
              [startCoords.lon, startCoords.lat],
              [endCoords.lon, endCoords.lat]
          ]
      };
  }

  const mockRoute = {
    distanceKm: Math.round(mockDist),
    durationMinutes: Math.round((mockDist / 60) * 60),
    geometry: fallbackGeometry,
  };

  return {
    ...mockRoute,
    source: "MOCK_FALLBACK",
    alternatives: [ { ...mockRoute, id: 0, summary: "Rota Estimada (Linha Reta)" } ]
  };
};

/**
 * Fetches average diesel price for a given state/region.
 * @param {string} state - UF (e.g., 'SP', 'MG')
 * @returns {Promise<{price: number, lastUpdate: string, source: string}>}
 */
export const getDieselPrice = async (state = "SP") => {
  const mockPrices = {
    "SP": 6.10, "MG": 6.25, "RJ": 6.30, "PR": 6.05, "SC": 6.15, "RS": 6.20
  };
  return {
    price: mockPrices[state] || 6.15,
    lastUpdate: new Date().toISOString().split('T')[0],
    source: "ANP_MOCK"
  };
};

/**
 * Estimates toll costs for a route.
 * @param {string} origin 
 * @param {string} destination 
 * @param {number} axles 
 * @returns {Promise<{cost: number, plazas: number, source: string}>}
 */
export const getTollCost = async (origin, destination, axles = 6) => {
  const routeData = await getRouteData(origin, destination);
  const km = routeData.distanceKm;
  const numPlazas = Math.floor(km / 100); // 1 toll every 100km approx
  const costPerPlaza = 11.0 * (axles / 2); // Est R$ 11.00 per axle pair
  const estimatedCost = numPlazas * costPerPlaza;

  return {
    cost: Math.round(estimatedCost * 100) / 100,
    plazas: numPlazas,
    source: "ESTIMATED_MOCK"
  };
};
