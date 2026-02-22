module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { lat, lng } = req.body;

    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'User-Agent': 'TablePassport/1.0' } }
    );
    const geoData = await geoRes.json();

    const address = geoData.address || {};
    const city = address.city || address.town || address.village || address.suburb || 'Current Location';
    const state = address.state || '';
    const neighborhood = address.neighbourhood || address.suburb || '';

    res.status(200).json({ city, state, neighborhood });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
