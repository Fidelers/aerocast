const axios = require('axios');

const TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS) || 1000;

async function search(query) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return [];
  }

  const normalizedQuery = query.trim().toLowerCase();
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(normalizedQuery)}&count=5&language=ru&format=json`;
  try {
    const response = await axios.get(url, { timeout: TIMEOUT_MS });

    if (!response.data || !Array.isArray(response.data.results)) {
      return [];
    }

    return response.data.results.map((item) => {
      const parts = [item.name, item.admin1, item.country].filter(Boolean);

      return {
        lat: String(item.latitude),
        lon: String(item.longitude),
        display_name: parts.join(', ')
      };
    });
  } catch (error) {
    throw error;
  }
}

module.exports = {
  search
};