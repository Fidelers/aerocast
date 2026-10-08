export const SATELLITE_MAX_ZOOM = 17;
export const OSM_MAX_ZOOM = 19;

export const osmStyle = {
  version: 8,
  sources: {
    // базовый слой схемы OpenStreetMap
    osm: {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxzoom: OSM_MAX_ZOOM,
    },
    // растровый источник для спутниковых снимков ESRI (ограничен maxzoom: 17)
    'esri-satellite': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxzoom: SATELLITE_MAX_ZOOM,
    },
  },
  layers: [
    // слой схемы (включен по умолчанию)
    {
      id: 'osm-layer',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
    },
    // спутниковый слой (выключен по умолчанию: visibility: 'none')
    {
      id: 'satellite-layer',
      type: 'raster',
      source: 'esri-satellite',
      minzoom: 0,
      layout: {
        visibility: 'none',
      },
    },
  ],
};

export const mapStyle = osmStyle;
export default osmStyle;