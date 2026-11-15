import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import AnalyticsExportModal from '../../src/components/AnalyticsExportModal';
import * as exportUtils from '../../src/utils/exportUtils';

describe('AnalyticsExportModal component', () => {
  const mockRecords = [
    {
      time: '2026-10-22T00:00',
      aqi: 20,
      pm2_5: 8.0,
      pm10: 15.0,
      nitrogen_dioxide: 10.0,
      sulphur_dioxide: 2.0,
      ozone: 25.0,
      carbon_monoxide: 100.0,
    },
    {
      time: '2026-10-22T01:00',
      aqi: 25,
      pm2_5: 10.0,
      pm10: 18.0,
      nitrogen_dioxide: 12.0,
      sulphur_dioxide: 2.5,
      ozone: 28.0,
      carbon_monoxide: 120.0,
    },
    {
      time: '2026-10-23T00:00',
      aqi: 30,
      pm2_5: 12.0,
      pm10: 20.0,
      nitrogen_dioxide: 14.0,
      sulphur_dioxide: 3.0,
      ozone: 30.0,
      carbon_monoxide: 130.0,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <AnalyticsExportModal
        isOpen={false}
        allRecords={mockRecords}
        finalDayData={mockRecords}
      />
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('export-modal-overlay')).toBeNull();
  });

  it('renders modal dialog when isOpen is true', () => {
    render(
      <AnalyticsExportModal
        isOpen={true}
        onClose={vi.fn()}
        allRecords={mockRecords}
        finalDayData={mockRecords}
        locationName="Новокузнецк"
        coords={{ lat: 53.7596, lon: 87.1467 }}
      />
    );

    expect(screen.getByTestId('export-modal-overlay')).toBeTruthy();
    expect(screen.getByText('Экспорт аналитики качества воздуха')).toBeTruthy();
    expect(screen.getByText(/Новокузнецк/)).toBeTruthy();
    expect(screen.getByTestId('download-export-btn')).toBeTruthy();
    expect(screen.getByTestId('copy-to-clipboard-btn')).toBeTruthy();
  });

  it('calls onClose when close button or Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(
      <AnalyticsExportModal
        isOpen={true}
        onClose={handleClose}
        allRecords={mockRecords}
        finalDayData={mockRecords}
      />
    );

    const closeBtn = screen.getByTestId('export-modal-close-btn');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('toggles metric modes: all, active_only, and custom selection', () => {
    render(
      <AnalyticsExportModal
        isOpen={true}
        onClose={vi.fn()}
        allRecords={mockRecords}
        finalDayData={mockRecords}
        activeMetricKey="pm2_5"
      />
    );

    const allRadio = screen.getByTestId('metric-mode-all');
    expect(allRadio.checked).toBe(true);

    const activeRadio = screen.getByTestId('metric-mode-active');
    fireEvent.click(activeRadio);
    expect(activeRadio.checked).toBe(true);

    const customRadio = screen.getByTestId('metric-mode-custom');
    fireEvent.click(customRadio);
    expect(customRadio.checked).toBe(true);
    expect(screen.getByTestId('export-metric-checkboxes')).toBeTruthy();

    const aqiCheckbox = screen.getByTestId('checkbox-metric-aqi');
    expect(aqiCheckbox.checked).toBe(true);
    fireEvent.click(aqiCheckbox);
    expect(aqiCheckbox.checked).toBe(false);
  });

  it('disables selection_only radio if customRange is null, and enables it if present', () => {
    const { rerender } = render(
      <AnalyticsExportModal
        isOpen={true}
        onClose={vi.fn()}
        allRecords={mockRecords}
        finalDayData={mockRecords}
        customRange={null}
      />
    );

    const selectionOnlyRadio = screen.getByTestId('scope-selection-only');
    expect(selectionOnlyRadio.disabled).toBe(true);

    rerender(
      <AnalyticsExportModal
        isOpen={true}
        onClose={vi.fn()}
        allRecords={mockRecords}
        finalDayData={mockRecords}
        customRange={{ startGlobal: 0, endGlobal: 1 }}
      />
    );

    const enabledRadio = screen.getByTestId('scope-selection-only');
    expect(enabledRadio.disabled).toBe(false);
    expect(enabledRadio.checked).toBe(true);
  });

  it('switches export formats (CSV, JSON, PNG) and shows corresponding preview', () => {
    render(
      <AnalyticsExportModal
        isOpen={true}
        onClose={vi.fn()}
        allRecords={mockRecords}
        finalDayData={mockRecords}
      />
    );

    expect(screen.getByTestId('preview-table')).toBeTruthy();

    const jsonBtn = screen.getByTestId('format-btn-json');
    fireEvent.click(jsonBtn);
    expect(screen.getByTestId('download-export-btn').textContent).toContain('.json');

    const pngBtn = screen.getByTestId('format-btn-png');
    fireEvent.click(pngBtn);
    expect(screen.getByTestId('png-preview-card')).toBeTruthy();
    expect(screen.getByTestId('download-export-btn').textContent).toContain('.png');
  });

  it('renders all selected metric charts in PNG preview for all metrics and custom selection', () => {
    render(
      <AnalyticsExportModal
        isOpen={true}
        onClose={vi.fn()}
        allRecords={mockRecords}
        finalDayData={mockRecords}
      />
    );

    const pngBtn = screen.getByTestId('format-btn-png');
    fireEvent.click(pngBtn);

    expect(screen.getByTestId('export-png-chart-aqi')).toBeTruthy();
    expect(screen.getByTestId('export-png-chart-pm2_5')).toBeTruthy();
    expect(screen.getByTestId('export-png-chart-pm10')).toBeTruthy();
    expect(screen.getByTestId('export-png-chart-nitrogen_dioxide')).toBeTruthy();
    expect(screen.getByTestId('export-png-chart-sulphur_dioxide')).toBeTruthy();
    expect(screen.getByTestId('export-png-chart-ozone')).toBeTruthy();
    expect(screen.getByTestId('export-png-chart-carbon_monoxide')).toBeTruthy();

    const customRadio = screen.getByTestId('metric-mode-custom');
    fireEvent.click(customRadio);

    const aqiCheckbox = screen.getByTestId('checkbox-metric-aqi');
    fireEvent.click(aqiCheckbox);

    expect(screen.queryByTestId('export-png-chart-aqi')).toBeNull();
    expect(screen.getByTestId('export-png-chart-pm2_5')).toBeTruthy();
  });

  it('triggers download when download button is clicked', async () => {
    const downloadBlobSpy = vi.spyOn(exportUtils, 'downloadBlob').mockImplementation(() => {});

    render(
      <AnalyticsExportModal
        isOpen={true}
        onClose={vi.fn()}
        allRecords={mockRecords}
        finalDayData={mockRecords}
      />
    );

    const downloadBtn = screen.getByTestId('download-export-btn');
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(downloadBlobSpy).toHaveBeenCalled();
    });
  });

  it('triggers copy to clipboard and displays success badge', async () => {
    const copySpy = vi.spyOn(exportUtils, 'copyTextToClipboard').mockResolvedValue(true);

    render(
      <AnalyticsExportModal
        isOpen={true}
        onClose={vi.fn()}
        allRecords={mockRecords}
        finalDayData={mockRecords}
      />
    );

    const copyBtn = screen.getByTestId('copy-to-clipboard-btn');
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(copySpy).toHaveBeenCalled();
      expect(screen.getByTestId('copy-success-badge')).toBeTruthy();
    });
  });

  it('triggers download and copy for JSON format', async () => {
    const downloadBlobSpy = vi.spyOn(exportUtils, 'downloadBlob').mockImplementation(() => {});
    const copySpy = vi.spyOn(exportUtils, 'copyTextToClipboard').mockResolvedValue(true);

    render(
      <AnalyticsExportModal
        isOpen={true}
        onClose={vi.fn()}
        allRecords={mockRecords}
        finalDayData={mockRecords}
      />
    );

    const jsonBtn = screen.getByTestId('format-btn-json');
    fireEvent.click(jsonBtn);

    const downloadBtn = screen.getByTestId('download-export-btn');
    fireEvent.click(downloadBtn);
    await waitFor(() => {
      expect(downloadBlobSpy).toHaveBeenCalled();
    });

    const copyBtn = screen.getByTestId('copy-to-clipboard-btn');
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(copySpy).toHaveBeenCalled();
    });
  });

  it('handles PNG copy and download with mocked canvas', async () => {
    const fakeBlob = new Blob(['png'], { type: 'image/png' });
    vi.spyOn(exportUtils, 'renderMultiChartPngBlob').mockResolvedValue(fakeBlob);
    const downloadBlobSpy = vi.spyOn(exportUtils, 'downloadBlob').mockImplementation(() => {});

    global.ClipboardItem = class {
      constructor(data) {
        this.data = data;
      }
    };
    const clipboardWriteMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { write: clipboardWriteMock },
    });

    render(
      <AnalyticsExportModal
        isOpen={true}
        onClose={vi.fn()}
        allRecords={mockRecords}
        finalDayData={mockRecords}
      />
    );

    const pngBtn = screen.getByTestId('format-btn-png');
    fireEvent.click(pngBtn);

    const downloadBtn = screen.getByTestId('download-export-btn');
    fireEvent.click(downloadBtn);
    await waitFor(() => {
      expect(downloadBlobSpy).toHaveBeenCalledWith(fakeBlob, expect.stringContaining('.png'));
    });

    const copyBtn = screen.getByTestId('copy-to-clipboard-btn');
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(clipboardWriteMock).toHaveBeenCalled();
      expect(screen.getByTestId('copy-success-badge')).toBeTruthy();
    });
  });

  it('displays error banner when download or copy fails', async () => {
    vi.spyOn(exportUtils, 'copyTextToClipboard').mockResolvedValue(false);

    render(
      <AnalyticsExportModal
        isOpen={true}
        onClose={vi.fn()}
        allRecords={mockRecords}
        finalDayData={mockRecords}
      />
    );

    const copyBtn = screen.getByTestId('copy-to-clipboard-btn');
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(screen.getByTestId('export-error-message')).toBeTruthy();
    });

    const jsonBtn = screen.getByTestId('format-btn-json');
    fireEvent.click(jsonBtn);
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(screen.getByTestId('export-error-message')).toBeTruthy();
    });
  });

  it('displays error banner when download fails', async () => {
    vi.spyOn(exportUtils, 'downloadBlob').mockImplementation(() => {
      throw new Error('Download failed');
    });

    render(
      <AnalyticsExportModal
        isOpen={true}
        onClose={vi.fn()}
        allRecords={mockRecords}
        finalDayData={mockRecords}
      />
    );

    const downloadBtn = screen.getByTestId('download-export-btn');
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(screen.getByTestId('export-error-message')).toBeTruthy();
      expect(screen.getByText(/Download failed/)).toBeTruthy();
    });
  });

  it('handles PNG copy unsupported browser fallback', async () => {
    vi.spyOn(exportUtils, 'renderMultiChartPngBlob').mockResolvedValue(new Blob(['fake'], { type: 'image/png' }));
    const origClipboardItem = global.ClipboardItem;
    delete global.ClipboardItem;

    render(
      <AnalyticsExportModal
        isOpen={true}
        onClose={vi.fn()}
        allRecords={mockRecords}
        finalDayData={mockRecords}
      />
    );

    const pngBtn = screen.getByTestId('format-btn-png');
    fireEvent.click(pngBtn);

    const copyBtn = screen.getByTestId('copy-to-clipboard-btn');
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(screen.getByTestId('export-error-message')).toBeTruthy();
      expect(screen.getByText(/Прямое копирование PNG не поддерживается/)).toBeTruthy();
    });

    global.ClipboardItem = origClipboardItem;
  });

  it('handles single metric PNG download and copy with stepHours badge', async () => {
    const fakeBlob = new Blob(['single-png'], { type: 'image/png' });
    vi.spyOn(exportUtils, 'renderMultiChartPngBlob').mockResolvedValue(fakeBlob);
    const downloadSpy = vi.spyOn(exportUtils, 'downloadBlob').mockImplementation(() => {});

    global.ClipboardItem = class {
      constructor(data) {
        this.data = data;
      }
    };
    const clipboardWriteMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { write: clipboardWriteMock },
    });

    render(
      <AnalyticsExportModal
        isOpen={true}
        onClose={vi.fn()}
        allRecords={mockRecords}
        finalDayData={mockRecords}
        stepHours={3}
        activeMetricKey="pm2_5"
      />
    );

    expect(screen.getByTestId('preview-count-badge').textContent).toContain('(шаг 3 ч)');

    fireEvent.keyDown(window, { key: 'Enter' });

    const activeRadio = screen.getByTestId('metric-mode-active');
    fireEvent.click(activeRadio);

    const pngBtn = screen.getByTestId('format-btn-png');
    fireEvent.click(pngBtn);

    const downloadBtn = screen.getByTestId('download-export-btn');
    fireEvent.click(downloadBtn);
    await waitFor(() => {
      expect(downloadSpy).toHaveBeenCalled();
    });

    const copyBtn = screen.getByTestId('copy-to-clipboard-btn');
    fireEvent.click(copyBtn);
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(clipboardWriteMock).toHaveBeenCalled();
    });
  });

  it('renders correctly with empty records and unknown active metric key', () => {
    render(
      <AnalyticsExportModal
        isOpen={true}
        onClose={vi.fn()}
        allRecords={[]}
        finalDayData={[]}
        activeMetricKey="unknown_metric"
      />
    );

    expect(screen.getByTestId('preview-count-badge').textContent).toContain('Точек: 0');
  });

  it('handles PNG download when no charts are found', async () => {
    const { container } = render(
      <AnalyticsExportModal
        isOpen={true}
        onClose={vi.fn()}
        allRecords={mockRecords}
        finalDayData={mockRecords}
      />
    );

    const pngBtn = screen.getByTestId('format-btn-png');
    fireEvent.click(pngBtn);

    const chartCards = container.querySelectorAll('.export-png-chart-card');
    chartCards.forEach((c) => c.remove());

    const downloadBtn = screen.getByTestId('download-export-btn');
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(screen.getByTestId('export-error-message')).toBeTruthy();
    });
  });

  it('toggles metric off and back on in custom mode, and prevents deselecting the last metric', () => {
    render(
      <AnalyticsExportModal
        isOpen={true}
        onClose={vi.fn()}
        allRecords={mockRecords}
        finalDayData={mockRecords}
      />
    );

    const customRadio = screen.getByTestId('metric-mode-custom');
    fireEvent.click(customRadio);

    const pm25Checkbox = screen.getByTestId('checkbox-metric-pm2_5');
    expect(pm25Checkbox.checked).toBe(true);
    fireEvent.click(pm25Checkbox);
    expect(pm25Checkbox.checked).toBe(false);
    fireEvent.click(pm25Checkbox);
    expect(pm25Checkbox.checked).toBe(true);

    const allCheckboxes = [
      'checkbox-metric-pm2_5',
      'checkbox-metric-pm10',
      'checkbox-metric-nitrogen_dioxide',
      'checkbox-metric-sulphur_dioxide',
      'checkbox-metric-ozone',
      'checkbox-metric-carbon_monoxide',
    ];
    allCheckboxes.forEach((id) => {
      fireEvent.click(screen.getByTestId(id));
    });

    const lastCheckbox = screen.getByTestId('checkbox-metric-aqi');
    expect(lastCheckbox.checked).toBe(true);
    fireEvent.click(lastCheckbox);
    expect(lastCheckbox.checked).toBe(true);
  });

  it('switches scopes and option checkboxes', () => {
    render(
      <AnalyticsExportModal
        isOpen={true}
        onClose={vi.fn()}
        allRecords={mockRecords}
        finalDayData={mockRecords}
        selectedDateStr="2026-10-22"
        customRange={{ startGlobal: 0, endGlobal: 1 }}
      />
    );

    const rawRadio = screen.getByTestId('scope-all-raw');
    fireEvent.click(rawRadio);
    expect(rawRadio.checked).toBe(true);

    const dayRadio = screen.getByTestId('scope-selected-day');
    fireEvent.click(dayRadio);
    expect(dayRadio.checked).toBe(true);

    const selRadio = screen.getByTestId('scope-selection-only');
    fireEvent.click(selRadio);
    expect(selRadio.checked).toBe(true);

    const asConfigRadio = screen.getByTestId('scope-as-configured');
    fireEvent.click(asConfigRadio);
    expect(asConfigRadio.checked).toBe(true);

    const customRadio = screen.getByTestId('metric-mode-custom');
    fireEvent.click(customRadio);
    const allRadio = screen.getByTestId('metric-mode-all');
    fireEvent.click(allRadio);
    expect(allRadio.checked).toBe(true);

    const jsonBtn = screen.getByTestId('format-btn-json');
    fireEvent.click(jsonBtn);
    const csvBtn = screen.getByTestId('format-btn-csv');
    fireEvent.click(csvBtn);
    expect(csvBtn.className).toContain('export-format-btn--active');

    const statsCheck = screen.getByTestId('include-stats-checkbox');
    fireEvent.click(statsCheck);
    expect(statsCheck.checked).toBe(false);

    const metaCheck = screen.getByTestId('include-meta-checkbox');
    fireEvent.click(metaCheck);
    expect(metaCheck.checked).toBe(false);
  });

  it('closes on overlay click', () => {
    const handleClose = vi.fn();
    render(
      <AnalyticsExportModal
        isOpen={true}
        onClose={handleClose}
        allRecords={mockRecords}
        finalDayData={mockRecords}
      />
    );

    const overlay = screen.getByTestId('export-modal-overlay');
    fireEvent.click(overlay);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('renders preview table with >4 records and null metric values', () => {
    const recordsWithNulls = [
      ...mockRecords,
      { time: '2026-10-24T00:00', aqi: null, pm2_5: undefined },
      { time: '2026-10-25T00:00', aqi: 15, pm2_5: 5.0 },
    ];
    render(
      <AnalyticsExportModal
        isOpen={true}
        onClose={vi.fn()}
        allRecords={recordsWithNulls}
        finalDayData={recordsWithNulls}
      />
    );
    expect(screen.getByText(/и еще 1 записей/)).toBeTruthy();
    expect(screen.getAllByText('–').length).toBeGreaterThan(0);
  });

  it('renders PNG preview banner with empty records', () => {
    render(
      <AnalyticsExportModal
        isOpen={true}
        onClose={vi.fn()}
        allRecords={[]}
        finalDayData={[]}
      />
    );
    const pngBtn = screen.getByTestId('format-btn-png');
    fireEvent.click(pngBtn);
    expect(screen.getByText(/Начало/)).toBeTruthy();
    expect(screen.getByText(/Конец/)).toBeTruthy();
  });

  it('handles PNG copy when no charts are found and tests isColorBlind true', async () => {
    const { container } = render(
      <AnalyticsExportModal
        isOpen={true}
        onClose={vi.fn()}
        allRecords={mockRecords}
        finalDayData={mockRecords}
        isColorBlind={true}
      />
    );

    const modalContent = container.querySelector('.export-modal-content');
    expect(modalContent.getAttribute('data-colorblind')).toBe('true');

    const pngBtn = screen.getByTestId('format-btn-png');
    fireEvent.click(pngBtn);

    const chartCards = container.querySelectorAll('.export-png-chart-card');
    chartCards.forEach((c) => c.remove());

    const copyBtn = screen.getByTestId('copy-to-clipboard-btn');
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(screen.getByTestId('export-error-message')).toBeTruthy();
      expect(screen.getByText(/Графики не найдены/)).toBeTruthy();
    });
  });
});
