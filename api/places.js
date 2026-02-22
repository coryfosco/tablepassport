module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GOOGLE_KEY = process.env.GOOGLE_PLACES_KEY;

  try {
    const { lat, lng, radius, keyword } = req.body;

    const params = new URLSearchParams({
      location: `${lat},${lng}`,
      radius: radius || 400,
      type: 'restaurant',
      key: GOOGLE_KEY
    });

    if (keyword) params.append('keyword', keyword);

    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`
    );
    const searchData = await searchRes.json();

    if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
      return res.status(400).json({ error: searchData.status, message: searchData.error_message });
    }

    // Filter results to strictly enforce radius using Haversine distance
    function haversineDistance(lat1, lng1, lat2, lng2) {
      const R = 6371000; // meters
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    // Filter to only restaurants within the requested radius
    const withinRadius = searchData.results.filter(place => {
      const dist = haversineDistance(
        lat, lng,
        place.geometry.location.lat,
        place.geometry.location.lng
      );
      return dist <= (radius || 400);
    });

    const places = withinRadius.slice(0, 10);

    // Get details for each place
    const detailed = await Promise.all(places.map(async (place) => {
      const detailParams = new URLSearchParams({
        place_id: place.place_id,
        fields: 'name,formatted_address,formatted_phone_number,website,opening_hours,price_level,rating,user_ratings_total,geometry',
        key: GOOGLE_KEY
      });

      const detailRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?${detailParams}`
      );
      const detailData = await detailRes.json();
      const d = detailData.result || {};

      return {
        name: place.name,
        address: d.formatted_address || place.vicinity,
        phone: d.formatted_phone_number || null,
        website: d.website || null,
        rating: place.rating,
        reviewCount: place.user_ratings_total,
        priceLevel: place.price_level,
        openNow: place.opening_hours?.open_now,
        types: place.types,
        placeId: place.place_id
      };
    }));

    res.status(200).json({ places: detailed, total: withinRadius.length });

  } catch (err) {
    console.error('Places error:', err);
    res.status(500).json({ error: err.message });
  }
}
