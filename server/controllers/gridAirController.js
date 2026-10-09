const batchAirService = require('../services/batchAirService');
const spatialCacheService = require('../services/spatialCacheService');


async function getGridAirQuality(req, res) {
    throw new Error('Not implemented: getGridAirQuality');
}


async function getMacroGrid(req, res) {
    throw new Error('Not implemented: getMacroGrid');
}


async function getMicroGrid(req, res) {
    throw new Error('Not implemented: getMicroGrid');
}


async function clearGridCache(req, res) {
    throw new Error('Not implemented: clearGridCache');
}

module.exports = {
    getGridAirQuality,
    getMacroGrid,
    getMicroGrid,
    clearGridCache
};
