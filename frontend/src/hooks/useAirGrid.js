import { useState, useEffect, useRef, useCallback } from 'react';

export function getMicroGridCacheKey(lat, lon, step = 0.2) {
    if (typeof lat !== 'number' || typeof lon !== 'number' || Number.isNaN(lat) || Number.isNaN(lon)) {
        throw new Error('getMicroGridCacheKey: lat and lon must be valid numbers');
    }
    
    const qLatRaw = Math.round(lat / step) * step;
    const qLonRaw = Math.round(lon / step) * step;

    const qLatNum = Math.round(qLatRaw * 100) / 100;
    const qLonNum = Math.round(qLonRaw * 100) / 100;

    const qLat = Object.is(qLatNum, -0) ? '0.00' : qLatNum.toFixed(2);
    const qLon = Object.is(qLonNum, -0) ? '0.00' : qLonNum.toFixed(2);

    return `grid_micro_${qLat}_${qLon}`;
}

const LRU_MAX_SIZE = 20;

export function useAirGrid(options = {}) {
    const { baseUrl = '', autoLoadMacro = true } = options;

    const [macroGrid, setMacroGrid] = useState(null);
    const [microGrid, setMicroGrid] = useState(null);
    const [isLoadingGrid, setIsLoadingGrid] = useState(autoLoadMacro);
    const [gridError, setGridError] = useState(null);

    
    const lruGridCacheRef = useRef(new Map());
    const abortControllerRef = useRef(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const loadMacroGrid = useCallback(async () => {
        try {
            const response = await globalThis.fetch(`${baseUrl}/api/air-quality/grid/macro`, {});
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            
            if (mountedRef.current) {
                setMacroGrid(data);
                setGridError(null);
                setIsLoadingGrid(false);
            }
        } catch (err) {
            if (mountedRef.current) {
                setGridError(err.message);
                setIsLoadingGrid(false);
            }
        }
    }, [baseUrl]);

    useEffect(() => {
        if (autoLoadMacro) {
            loadMacroGrid();
        } else {
            setIsLoadingGrid(false);
        }
    }, [autoLoadMacro, loadMacroGrid]);

    const clearExpiredLRU = useCallback(() => {
        const cache = lruGridCacheRef.current;
        while (cache.size > LRU_MAX_SIZE) {
            const oldestKey = cache.keys().next().value;
            if (oldestKey !== undefined) {
                cache.delete(oldestKey);
            } else {
                break;
            }
        }
    }, []);

    const loadMicroGrid = useCallback(async (lat, lon) => {
        let cacheKey;
        
        // Генерация ключа кэша с обработкой ошибок ввода
        try {
            cacheKey = getMicroGridCacheKey(lat, lon);
        } catch (e) {
            if (mountedRef.current) setGridError(e.message);
            return;
        }

        const cache = lruGridCacheRef.current;

        // Проверка наличия данных в кэше 
        if (cache.has(cacheKey)) {
            const cachedData = cache.get(cacheKey);
            
            cache.delete(cacheKey);
            cache.set(cacheKey, cachedData); 
            
            if (mountedRef.current) {
                setMicroGrid(cachedData);
                setGridError(null);
                setIsLoadingGrid(false);
            }
            return;
        }

        
        // Отменяем предыдущий незавершенный запрос микро-сетки, если он есть
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;


        if (mountedRef.current) {
            setIsLoadingGrid(true);
        }

        try {
            const url = `${baseUrl}/api/air-quality/grid/micro?lat=${lat}&lon=${lon}`;
            
            const response = await globalThis.fetch(url, { 
                signal: controller.signal 
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            
            if (!mountedRef.current) {
                return;
            }

            cache.set(cacheKey, data);
            clearExpiredLRU();

            setMicroGrid(data);
            setGridError(null);
            setIsLoadingGrid(false);

        } catch (err) {
            if (err.name === 'AbortError') {
                return;
            }

            if (mountedRef.current) {
                setIsLoadingGrid(false);
                setGridError(err.message);
            }
        }
    }, [baseUrl, clearExpiredLRU]);


    return {
        macroGrid,
        microGrid,
        lruGridCache: lruGridCacheRef.current,
        isLoadingGrid,
        gridError,
        loadMacroGrid,
        loadMicroGrid,
        clearExpiredLRU
    };

    
}

export default useAirGrid;
