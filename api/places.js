module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GOOGLE_KEY = process.env.GOOGLE_PLACES_KEY;

  try {
    const { lat, lng, radius, keyword, type } = req.body;

    // Search nearby restaurants using Google Places Nearby Search
    const params = new URLSearchParams({
      location: `${lat},${lng}`,
      radius: radius || 400, // default ~5 min walk = 400 meters
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

    // Get details for top results
    const places = searchData.results.slice(0, 10);
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
        priceLevel: place.price_level, // 0-4
        openNow: place.opening_hours?.open_now,
        types: place.types,
        placeId: place.place_id
      };
    }));

    res.status(200).json({ places: detailed });

  } catch (err) {
    console.error('Places error:', err);
    res.status(500).json({ error: err.message });
  }
}
