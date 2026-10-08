// frontend/tests/styles/mapStyle.test.js
import { describe, it, expect } from 'vitest';
import * as mapStyleModule from '../../src/styles/mapStyle';

describe('mapStyle configuration (Интеграция спутника в карту)', () => {
    // В зависимости от реализации разработчик может экспортировать osmStyle, mapStyle или default
    const style = mapStyleModule.mapStyle || mapStyleModule.osmStyle || mapStyleModule.default;

    it('1. Экспортирует валидный объект конфигурации стиля MapLibre с версией 8', () => {
        expect(style).toBeDefined();
        expect(typeof style).toBe('object');
        expect(style.version).toBe(8);
        expect(style.sources).toBeDefined();
        expect(Array.isArray(style.layers)).toBe(true);
    });

    it('2. Содержит растровый источник данных "esri-satellite" для снимков ESRI World Imagery', () => {
        const esriSource = style.sources['esri-satellite'];
        expect(esriSource, 'Источник "esri-satellite" должен быть объявлен в style.sources').toBeDefined();
        expect(esriSource.type).toBe('raster');
        expect(Array.isArray(esriSource.tiles)).toBe(true);
        expect(esriSource.tiles.length).toBeGreaterThan(0);

        // URL тайлов должен ссылаться на сервис ESRI World Imagery
        const tileUrl = esriSource.tiles[0];
        expect(tileUrl).toMatch(/arcgisonline(\.com|\/rest)/i);
        expect(tileUrl).toMatch(/World_Imagery/i);

        // Размер тайлов должен быть 256px
        expect(esriSource.tileSize).toBe(256);
    });

    it('3. Содержит слой "satellite-layer" с видимостью "none" по умолчанию', () => {
        const satelliteLayer = style.layers.find((layer) => layer.id === 'satellite-layer');
        expect(satelliteLayer, 'Слой "satellite-layer" должен присутствовать в style.layers').toBeDefined();
        expect(satelliteLayer.type).toBe('raster');
        expect(satelliteLayer.source).toBe('esri-satellite');

        // Свойство visibility должно быть обязательно установлено в 'none' по умолчанию
        expect(satelliteLayer.layout).toBeDefined();
        expect(satelliteLayer.layout.visibility).toBe('none');
    });

    it('4. Сохраняет базовый векторный/растровый слой "osm-layer" и источник "osm"', () => {
        const osmSource = style.sources['osm'];
        expect(osmSource, 'Источник "osm" должен присутствовать в style.sources').toBeDefined();
        expect(osmSource.type).toBe('raster');

        const osmLayer = style.layers.find((layer) => layer.id === 'osm-layer');
        expect(osmLayer, 'Слой "osm-layer" должен присутствовать в style.layers').toBeDefined();
        expect(osmLayer.source).toBe('osm');
    });

    it('5. Ограничивает maxzoom для источника "esri-satellite" значением 17, сохраняя maxzoom 19 для "osm"', () => {
        expect(style.sources['esri-satellite'].maxzoom).toBe(17);
        expect(style.sources['osm'].maxzoom).toBe(19);
        expect(mapStyleModule.SATELLITE_MAX_ZOOM).toBe(17);
        expect(mapStyleModule.OSM_MAX_ZOOM).toBe(19);
    });
});

