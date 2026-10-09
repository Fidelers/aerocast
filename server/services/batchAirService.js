const axios = require('axios');

function generateMacroGridCoordinates() {
    throw new Error('Not implemented: generateMacroGridCoordinates');
}

function generateMicroGridCoordinates(centerLat, centerLon) {
    throw new Error('Not implemented: generateMicroGridCoordinates');
}

async function fetchBatchAirQuality(coordinates) {
    throw new Error('Not implemented: fetchBatchAirQuality');
}

function normalizeBatchResponse(rawArray, coordinates) {
    throw new Error('Not implemented: normalizeBatchResponse');
}

module.exports = {
    generateMacroGridCoordinates,
    generateMicroGridCoordinates,
    fetchBatchAirQuality,
    normalizeBatchResponse
};
