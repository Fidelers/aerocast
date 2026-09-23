// беру файлы из других папок
const cacheService = require('../services/cacheService');
const geocodingService = require('../services/geocodingService');

async function search(req, res) {
  try {
    const { q } = req.query || {};

    // проверка на мусор или пустоту, если да то ошибка 400
    if (!q || typeof q !== 'string' || !q.trim()) {
      return res.status(400).json({ error: 'Missing query parameter q' });
    }

    // чтобы запрос МОСКВА или москва считались за одно и тоже
    const query = q.trim().toLowerCase();
    const cacheKey = `search_${query}`;

    // проверка, что запрос попал в кэш чтобы не гуглился один и тот же запрос несколько раз
    const cachedResults = await cacheService.getCache(cacheKey, false);
    if (cachedResults) {
      return res.json(cachedResults);
    }

    // если кэш пустой тогда обращаемся к геокодеру
    const results = await geocodingService.search(query);

    // сохранка на 24 часа и делаем отдельный try и catch на случай, если кэш сломается, то клиент всё равно получит результат
    try {
      await cacheService.setCache(cacheKey, results, 86400);
    } catch (cacheError) {
      console.error('Failed to save search results to cache:', cacheError);
    }

    // возврат найденных результатов со статусом 200
    return res.json(results);
  } catch (error) {
    // если просто ошибка неизвестно откуда то ошибка 500
    console.error('Search controller error:', error);
    return res.status(500).json({ error: 'Failed to search location' });
  }
}

module.exports = {
  search
};
