const cacheService = require('../services/cacheService');
const geocodingService = require('../services/geocodingService');

async function search(req, res) {
  try {
    const { q } = req.query || {};

    if (!q || typeof q !== 'string' || !q.trim()) {
      return res.status(400).json({ error: 'Missing query parameter q' });
    }

    const trimmed = q.trim();
    if (trimmed.length > 100) {
      return res.status(400).json({ error: 'Query parameter q is too long (maximum 100 characters)' });
    }

    const query = trimmed.toLowerCase();
    const cacheKey = `search_${query}`;

    const cachedResults = await cacheService.getCache(cacheKey, false);
    if (cachedResults) {
      return res.json(cachedResults);
    }

    const results = await geocodingService.search(query);

    try {
      await cacheService.setCache(cacheKey, results, 86400);
    } catch (cacheError) {
      console.error('Failed to save search results to cache:', cacheError);
    }

    return res.json(results);
  } catch (error) {
    console.error('Search controller error:', error);
    return res.status(500).json({ error: 'Failed to search location' });
  }
}

module.exports = {
  search
};
