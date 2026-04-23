// src/stores.js
// Store database and geo-search within 3km radius.

const axios = require('axios');

// ─── Static fallback store list (replace / extend with your real data) ─────────
// Each store needs: id, name, address, lat, lng, hours, photoUrl, reviewUrl
const STORES = [
  {
    id: 'bkk-01',
    name: 'WeedeN Sukhumvit',
    address: '123 Sukhumvit Rd, Khlong Toei, Bangkok 10110',
    lat: 13.7320,
    lng: 100.5674,
    hours: 'Mon–Sun 10:00–21:00',
    photoUrl: 'https://your-cdn.com/stores/bkk-01.jpg',
    reviewUrl: 'https://g.page/r/your-review-link-bkk01',
  },
  {
    id: 'bkk-02',
    name: 'WeedeN Silom',
    address: '456 Silom Rd, Bang Rak, Bangkok 10500',
    lat: 13.7270,
    lng: 100.5220,
    hours: 'Mon–Sun 10:00–21:00',
    photoUrl: 'https://your-cdn.com/stores/bkk-02.jpg',
    reviewUrl: 'https://g.page/r/your-review-link-bkk02',
  },
  {
    id: 'cnx-01',
    name: 'WeedeN Chiang Mai',
    address: '789 Nimman Rd, Suthep, Chiang Mai 50200',
    lat: 18.7978,
    lng: 98.9741,
    hours: 'Mon–Sun 10:00–20:00',
    photoUrl: 'https://your-cdn.com/stores/cnx-01.jpg',
    reviewUrl: 'https://g.page/r/your-review-link-cnx01',
  },
  {
    id: 'pkt-01',
    name: 'WeedeN Phuket',
    address: '321 Patong Beach Rd, Kathu, Phuket 83150',
    lat: 7.8981,
    lng: 98.2965,
    hours: 'Mon–Sun 10:00–22:00',
    photoUrl: 'https://your-cdn.com/stores/pkt-01.jpg',
    reviewUrl: 'https://g.page/r/your-review-link-pkt01',
  },
];

// Region → representative lat/lng for manual selection
const REGIONS = {
  'Bangkok': { lat: 13.7563, lng: 100.5018 },
  'Chiang Mai': { lat: 18.7883, lng: 98.9853 },
  'Phuket': { lat: 7.9519, lng: 98.3381 },
  'Pattaya': { lat: 12.9236, lng: 100.8825 },
  'Koh Samui': { lat: 9.5120, lng: 100.0136 },
};

// ─── Haversine distance (km) ──────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Load stores (from API or static) ────────────────────────────────────────
async function getAllStores() {
  if (process.env.STORES_API_URL) {
    try {
      const res = await axios.get(process.env.STORES_API_URL, { timeout: 4000 });
      return res.data;
    } catch (e) {
      console.error('[stores] API failed, using static list:', e.message);
    }
  }
  return STORES;
}

// ─── Find stores within 3km ───────────────────────────────────────────────────
async function findNearby(lat, lng, radiusKm = 3) {
  const all = await getAllStores();
  return all
    .map(s => ({ ...s, distance: haversine(lat, lng, s.lat, s.lng) }))
    .filter(s => s.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
}

// ─── Get store by id ──────────────────────────────────────────────────────────
async function getStoreById(id) {
  const all = await getAllStores();
  return all.find(s => s.id === id) || null;
}

// ─── Google Maps directions URL ───────────────────────────────────────────────
function mapsUrl(store) {
  const base = process.env.GOOGLE_MAPS_BASE || 'https://www.google.com/maps/dir/?api=1&destination=';
  return `${base}${store.lat},${store.lng}`;
}

module.exports = { findNearby, getStoreById, mapsUrl, REGIONS, getAllStores };
