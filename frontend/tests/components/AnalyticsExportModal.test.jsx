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
});
