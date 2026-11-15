import React, { useState, useMemo, useEffect, useRef } from 'react';
import DynamicsChart from './DynamicsChart';
import {
  AVAILABLE_METRICS,
  buildExportDataset,
  formatIsoToReadable,
  generateCsv,
  generateJson,
  formatExportFilename,
  downloadBlob,
  copyTextToClipboard,
  renderMultiChartPngBlob,
  calculateMetricStats,
} from '../utils/exportUtils';
import '../styles/AnalyticsExportModal.css';

export default function AnalyticsExportModal({
  isOpen = false,
  onClose,
  allRecords = [],
  finalDayData = [],
  customRange = null,
  activeMetricKey = 'aqi',
  stepHours = 1,
  rangePreset = 'day',
  selectedDateStr = '',
  locationName = 'Новокузнецк, Россия',
  coords = null,
  isColorBlind = false,
  colorBlindType = 'okabe',
  theme = 'light',
}) {
  const [scope, setScope] = useState('as_configured');
  const [metricMode, setMetricMode] = useState('all');
  const [selectedMetricKeys, setSelectedMetricKeys] = useState(() =>
    AVAILABLE_METRICS.map((m) => m.key)
  );
  const [exportFormat, setExportFormat] = useState('csv');
  const [includeStats, setIncludeStats] = useState(true);
  const [includeMeta, setIncludeMeta] = useState(true);

  const [copyStatus, setCopyStatus] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const copyTimerRef = useRef(null);
  const errorTimerRef = useRef(null);
  const pngPreviewContainerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setScope(customRange ? 'selection_only' : 'as_configured');
      setCopyStatus(null);
      setErrorMessage(null);
    }
  }, [isOpen, customRange]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  const hasCustomRange = customRange !== null;

  const { records, metrics } = useMemo(() => {
    return buildExportDataset({
      allRecords,
      finalDayData,
      customRange,
      selectedDateStr,
      scope,
      stepHours,
      metricMode,
      activeMetricKey,
      selectedMetricKeys,
    });
  }, [
    allRecords,
    finalDayData,
    customRange,
    selectedDateStr,
    scope,
    stepHours,
    metricMode,
    activeMetricKey,
    selectedMetricKeys,
  ]);

  const periodStart = records[0]?.time ? formatIsoToReadable(records[0].time) : '';
  const periodEnd = records[records.length - 1]?.time ? formatIsoToReadable(records[records.length - 1].time) : '';

  const metadata = useMemo(() => ({
    locationName,
    lat: coords?.lat,
    lon: coords?.lon,
    periodStart,
    periodEnd,
    exportedAt: new Date().toISOString(),
  }), [locationName, coords, periodStart, periodEnd]);

  if (!isOpen) {
    return null;
  }

  const handleMetricToggle = (key) => {
    setSelectedMetricKeys((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev;
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  };

  const activeMetricObj = AVAILABLE_METRICS.find((m) => m.key === activeMetricKey) || AVAILABLE_METRICS[0];

  const collectChartItemsForExport = () => {
    const container = pngPreviewContainerRef.current;
    if (!container) return [];

    return Array.from(container.querySelectorAll('.export-png-chart-card')).map((card) => {
      const key = card.getAttribute('data-metric');
      const m = metrics.find((item) => item.key === key) || metrics[0];
      const svgElement = card.querySelector('svg');
      const stats = calculateMetricStats(records, m.key);
      const statsText = stats.min !== null
        ? `Мин: ${stats.min.toFixed(m.decimals)} | Ср: ${stats.avg.toFixed(m.decimals)} | Макс: ${stats.max.toFixed(m.decimals)}`
        : '';

      return {
        svgElement,
        label: m.label,
        unit: m.unit,
        color: m.color,
        statsText,
      };
    });
  };

  const handleDownload = async () => {
    try {
      setIsExporting(true);
      setErrorMessage(null);

      if (exportFormat === 'csv') {
        const csvString = generateCsv({
          records,
          metrics,
          metadata,
          includeStats,
          includeMeta,
          delimiter: ';',
        });
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const filename = formatExportFilename({
          locationName,
          dateStr: selectedDateStr,
          scope,
          ext: 'csv',
        });
        downloadBlob(blob, filename);
      } else if (exportFormat === 'json') {
        const jsonString = generateJson({
          records,
          metrics,
          metadata,
          includeStats,
          includeMeta,
        });
        const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
        const filename = formatExportFilename({
          locationName,
          dateStr: selectedDateStr,
          scope,
          ext: 'json',
        });
        downloadBlob(blob, filename);
      } else if (exportFormat === 'png') {
        const chartCards = collectChartItemsForExport();
        if (chartCards.length === 0) {
          throw new Error('Графики не найдены для экспорта изображения');
        }

        const title = chartCards.length === 1
          ? `Aerocast – Динамика ${chartCards[0].label} (${chartCards[0].unit})`
          : 'Aerocast – Комплексная динамика качества воздуха';

        const subtitle = `${locationName}  •  ${periodStart || selectedDateStr} – ${periodEnd || selectedDateStr}`;

        const pngBlob = await renderMultiChartPngBlob(chartCards, {
          title,
          subtitle,
          includeStats,
          theme,
        });

        const filename = formatExportFilename({
          locationName,
          dateStr: selectedDateStr,
          scope,
          ext: 'png',
        });
        downloadBlob(pngBlob, filename);
      }
    } catch (err) {
      console.error('Ошибка экспорта аналитики:', err);
      setErrorMessage(err.message || 'Не удалось выполнить экспорт');
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopy = async () => {
    try {
      setErrorMessage(null);

      if (exportFormat === 'csv') {
        const csvString = generateCsv({
          records,
          metrics,
          metadata,
          includeStats,
          includeMeta,
          delimiter: '\t',
        }).replace(/^\uFEFF/, '');

        const success = await copyTextToClipboard(csvString);
        if (success) {
          setCopyStatus('copied');
        } else {
          throw new Error('Буфер обмена недоступен');
        }
      } else if (exportFormat === 'json') {
        const jsonString = generateJson({
          records,
          metrics,
          metadata,
          includeStats,
          includeMeta,
        });
        const success = await copyTextToClipboard(jsonString);
        if (success) {
          setCopyStatus('copied');
        } else {
          throw new Error('Буфер обмена недоступен');
        }
      } else if (exportFormat === 'png') {
        const chartCards = collectChartItemsForExport();
        if (chartCards.length === 0) throw new Error('Графики не найдены');

        const title = chartCards.length === 1
          ? `Aerocast – Динамика ${chartCards[0].label} (${chartCards[0].unit})`
          : 'Aerocast – Комплексная динамика качества воздуха';

        const subtitle = `${locationName} • ${periodStart} – ${periodEnd}`;

        const pngBlob = await renderMultiChartPngBlob(chartCards, {
          title,
          subtitle,
          includeStats,
          theme,
        });

        if (navigator?.clipboard?.write && typeof ClipboardItem !== 'undefined') {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': pngBlob }),
          ]);
          setCopyStatus('copied');
        } else {
          throw new Error('Прямое копирование PNG не поддерживается вашим браузером. Используйте «Скачать»');
        }
      }

      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopyStatus(null), 3000);
    } catch (err) {
      setErrorMessage(err.message || 'Не удалось скопировать в буфер');
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setErrorMessage(null), 4000);
    }
  };

  const previewRecords = records.slice(0, 4);

  return (
    <div
      className="export-modal-overlay"
      data-testid="export-modal-overlay"
      onClick={onClose}
    >
      <div
        className="export-modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
        data-colorblind={isColorBlind ? 'true' : 'false'}
        data-colorblind-type={colorBlindType}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="export-modal-header">
          <div className="export-modal-header-text">
            <h2 id="export-modal-title">Экспорт аналитики качества воздуха</h2>
            <div className="export-modal-meta">
              <span className="export-meta-badge">📍 {locationName}</span>
              {coords?.lat != null && coords?.lon != null && (
                <span className="export-meta-badge">
                  {Number(coords.lat).toFixed(4)}, {Number(coords.lon).toFixed(4)}
                </span>
              )}
              {periodStart && periodEnd && (
                <span className="export-meta-badge export-meta-badge--period">
                  📅 {periodStart} – {periodEnd}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            className="export-modal-close"
            onClick={onClose}
            aria-label="Закрыть окно экспорта"
            data-testid="export-modal-close-btn"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="export-modal-body">
          <div className="export-section">
            <h3 className="export-section-title">1. Диапазон данных для экспорта</h3>
            <div className="export-radio-grid">
              <label className="export-radio-card">
                <input
                  type="radio"
                  name="export-scope"
                  value="as_configured"
                  checked={scope === 'as_configured'}
                  onChange={() => setScope('as_configured')}
                  data-testid="scope-as-configured"
                />
                <div className="export-radio-content">
                  <strong>Как настроено на экране</strong>
                  <span>Текущий период и шаг ({stepHours} ч)</span>
                </div>
              </label>

              <label
                className={`export-radio-card ${!hasCustomRange ? 'export-radio-card--disabled' : ''}`}
                title={!hasCustomRange ? 'Выделите фрагмент графика курсором мыши' : ''}
              >
                <input
                  type="radio"
                  name="export-scope"
                  value="selection_only"
                  checked={scope === 'selection_only'}
                  disabled={!hasCustomRange}
                  onChange={() => setScope('selection_only')}
                  data-testid="scope-selection-only"
                />
                <div className="export-radio-content">
                  <strong>Только выделенный интервал</strong>
                  <span>
                    {hasCustomRange
                      ? 'Отрезок, выбранный курсором мыши'
                      : 'Не выделен (зажмите мышь на графике)'}
                  </span>
                </div>
              </label>

              <label className="export-radio-card">
                <input
                  type="radio"
                  name="export-scope"
                  value="all_raw"
                  checked={scope === 'all_raw'}
                  onChange={() => setScope('all_raw')}
                  data-testid="scope-all-raw"
                />
                <div className="export-radio-content">
                  <strong>Все доступные дни (без прореживания)</strong>
                  <span>Полный почасовой ряд (шаг 1 ч)</span>
                </div>
              </label>

              <label className="export-radio-card">
                <input
                  type="radio"
                  name="export-scope"
                  value="selected_day"
                  checked={scope === 'selected_day'}
                  onChange={() => setScope('selected_day')}
                  data-testid="scope-selected-day"
                />
                <div className="export-radio-content">
                  <strong>Только выбранные сутки</strong>
                  <span>24 часа выбранного дня</span>
                </div>
              </label>
            </div>
          </div>

          <div className="export-section">
            <h3 className="export-section-title">2. Набор показателей</h3>
            <div className="export-metric-modes">
              <label className="export-mode-label">
                <input
                  type="radio"
                  name="export-metric-mode"
                  value="all"
                  checked={metricMode === 'all'}
                  onChange={() => setMetricMode('all')}
                  data-testid="metric-mode-all"
                />
                <span>Все показатели (AQI + 6 загрязнителей)</span>
              </label>

              <label className="export-mode-label">
                <input
                  type="radio"
                  name="export-metric-mode"
                  value="active_only"
                  checked={metricMode === 'active_only'}
                  onChange={() => setMetricMode('active_only')}
                  data-testid="metric-mode-active"
                />
                <span>Только текущий показатель ({activeMetricObj.label})</span>
              </label>

              <label className="export-mode-label">
                <input
                  type="radio"
                  name="export-metric-mode"
                  value="custom"
                  checked={metricMode === 'custom'}
                  onChange={() => setMetricMode('custom')}
                  data-testid="metric-mode-custom"
                />
                <span>Выбрать вручную</span>
              </label>
            </div>

            {metricMode === 'custom' && (
              <div className="export-checkbox-list" data-testid="export-metric-checkboxes">
                {AVAILABLE_METRICS.map((m) => (
                  <label key={m.key} className="export-checkbox-pill">
                    <input
                      type="checkbox"
                      checked={selectedMetricKeys.includes(m.key)}
                      onChange={() => handleMetricToggle(m.key)}
                      data-testid={`checkbox-metric-${m.key}`}
                    />
                    <span>{m.label} ({m.unit})</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="export-section">
            <h3 className="export-section-title">3. Формат файла</h3>
            <div className="export-format-buttons" role="group" aria-label="Формат экспорта">
              <button
                type="button"
                className={`export-format-btn ${exportFormat === 'csv' ? 'export-format-btn--active' : ''}`}
                onClick={() => setExportFormat('csv')}
                data-testid="format-btn-csv"
              >
                <span className="export-format-icon">📊</span>
                <span className="export-format-name">CSV (Excel)</span>
                <span className="export-format-hint">UTF-8 с BOM, таблица</span>
              </button>

              <button
                type="button"
                className={`export-format-btn ${exportFormat === 'json' ? 'export-format-btn--active' : ''}`}
                onClick={() => setExportFormat('json')}
                data-testid="format-btn-json"
              >
                <span className="export-format-icon">⚙️</span>
                <span className="export-format-name">JSON</span>
                <span className="export-format-hint">Структурированные данные</span>
              </button>

              <button
                type="button"
                className={`export-format-btn ${exportFormat === 'png' ? 'export-format-btn--active' : ''}`}
                onClick={() => setExportFormat('png')}
                data-testid="format-btn-png"
              >
                <span className="export-format-icon">🖼️</span>
                <span className="export-format-name">График (PNG)</span>
                <span className="export-format-hint">Изображение высокой четкости</span>
              </button>
            </div>
          </div>

          <div className="export-section">
            <h3 className="export-section-title">4. Дополнительные параметры</h3>
            <div className="export-options-grid">
              <label className="export-option-toggle">
                <input
                  type="checkbox"
                  checked={includeStats}
                  onChange={(e) => setIncludeStats(e.target.checked)}
                  data-testid="include-stats-checkbox"
                />
                <span>Включить расчетную статистику (Минимум, Среднее, Максимум)</span>
              </label>

              <label className="export-option-toggle">
                <input
                  type="checkbox"
                  checked={includeMeta}
                  onChange={(e) => setIncludeMeta(e.target.checked)}
                  data-testid="include-meta-checkbox"
                />
                <span>Включить метаданные локации и временной метки выгрузки</span>
              </label>
            </div>
          </div>

          <div className="export-section export-section--preview">
            <div className="export-preview-header">
              <h3 className="export-section-title">Предпросмотр данных</h3>
              <span className="export-preview-badge" data-testid="preview-count-badge">
                Точек: {records.length} {stepHours > 1 && scope === 'as_configured' ? `(шаг ${stepHours} ч)` : ''}
              </span>
            </div>

            {exportFormat === 'png' ? (
              <div
                className="export-png-preview-wrapper"
                data-testid="png-preview-card"
              >
                <div className="export-png-preview-banner">
                  <div className="png-preview-title">
                    <strong>
                      {metrics.length === 1
                        ? `Aerocast – Динамика ${metrics[0].label} (${metrics[0].unit})`
                        : `Aerocast – Комплексная динамика качества воздуха (${metrics.length} показателей)`}
                    </strong>
                  </div>
                  <div className="png-preview-sub">
                    {locationName} • {periodStart || 'Начало'} – {periodEnd || 'Конец'}
                  </div>
                </div>

                <div
                  className="export-png-preview-container"
                  ref={pngPreviewContainerRef}
                  data-testid="png-preview-container"
                >
                  {metrics.map((m) => {
                    const stats = calculateMetricStats(records, m.key);
                    const statsText = stats.min !== null
                      ? `Мин: ${stats.min.toFixed(m.decimals)} | Ср: ${stats.avg.toFixed(m.decimals)} | Макс: ${stats.max.toFixed(m.decimals)}`
                      : '';
                    return (
                      <div
                        key={m.key}
                        className="export-png-chart-card"
                        data-testid={`export-png-chart-${m.key}`}
                        data-metric={m.key}
                      >
                        <div className="export-png-chart-card__header">
                          <span className="export-png-metric-tag">
                            <span className="export-png-metric-dot" style={{ backgroundColor: m.color }} />
                            <strong>{m.label}</strong> ({m.unit})
                          </span>
                          {includeStats && statsText && (
                            <span className="export-png-chart-stats">{statsText}</span>
                          )}
                        </div>
                        <DynamicsChart
                          mode={m.key === 'aqi' ? 'aqi' : 'pollutant'}
                          data={records}
                          valueKey={m.key}
                          unit={m.unit}
                          color={m.color}
                          isColorBlind={isColorBlind}
                          colorBlindType={colorBlindType}
                          height={metrics.length === 1 ? 180 : 90}
                          isMain={metrics.length === 1}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="export-preview-table-container">
                <table className="export-preview-table" data-testid="preview-table">
                  <thead>
                    <tr>
                      <th>Время</th>
                      {metrics.map((m) => (
                        <th key={m.key}>{m.label} ({m.unit})</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRecords.map((row, idx) => (
                      <tr key={idx}>
                        <td className="cell-time">{formatIsoToReadable(row.time)}</td>
                        {metrics.map((m) => {
                          const val = row[m.key];
                          return (
                            <td key={m.key}>
                              {val !== null && val !== undefined ? Number(val).toFixed(m.decimals) : '–'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {records.length > previewRecords.length && (
                      <tr className="preview-more-row">
                        <td colSpan={metrics.length + 1}>
                          ... и еще {records.length - previewRecords.length} записей
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="export-modal-error" role="alert" data-testid="export-error-message">
            ⚠️ {errorMessage}
          </div>
        )}

        <div className="export-modal-footer">
          <div className="export-footer-status">
            {copyStatus === 'copied' && (
              <span className="export-status-badge export-status-badge--success" data-testid="copy-success-badge">
                ✓ Скопировано в буфер обмена!
              </span>
            )}
          </div>

          <div className="export-footer-actions">
            <button
              type="button"
              className="export-btn export-btn--secondary"
              onClick={handleCopy}
              disabled={isExporting || records.length === 0}
              data-testid="copy-to-clipboard-btn"
              title="Скопировать данные для вставки по Ctrl+V"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>Скопировать</span>
            </button>

            <button
              type="button"
              className="export-btn export-btn--primary"
              onClick={handleDownload}
              disabled={isExporting || records.length === 0}
              data-testid="download-export-btn"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>{isExporting ? 'Формирование...' : `Скачать файл (.${exportFormat})`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
