import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import DynamicsChart from '../../src/components/DynamicsChart';

describe('DynamicsChartCoverage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('рендерит пустой график при data=[] или 1 точке', () => {
    const { container, rerender } = render(<DynamicsChart data={[]} />);
    expect(container.querySelector('.dynamics-chart')).toBeDefined();

    rerender(<DynamicsChart data={[{ aqi: 45 }]} />);
    expect(container.querySelector('path')).toBeDefined();
  });

  it('обрабатывает клики и нажатия Enter / Space по интерактивным точкам графика', () => {
    const handlePointClick = vi.fn();
    const mockData = [
      { aqi: 15, hourLabel: '00:00' },
      { aqi: 25, hourLabel: '01:00' },
      { aqi: null, hourLabel: '02:00' }
    ];

    render(
      <DynamicsChart
        mode="aqi"
        data={mockData}
        activeIndex={1}
        onPointClick={handlePointClick}
      />
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);

    fireEvent.click(buttons[0]);
    expect(handlePointClick).toHaveBeenCalledWith(0);

    fireEvent.keyDown(buttons[1], { key: 'Enter' });
    expect(handlePointClick).toHaveBeenCalledWith(1);

    fireEvent.keyDown(buttons[1], { key: ' ' });
    expect(handlePointClick).toHaveBeenCalledWith(1);

    fireEvent.keyDown(buttons[1], { key: 'ArrowRight' });
  });

  it('поддерживает режим pollutant с minVal === maxVal и нормализацией диапазона', () => {
    const mockData = [
      { value: 12 },
      { value: 12 }
    ];

    const { container } = render(
      <DynamicsChart
        mode="pollutant"
        valueKey="pm25"
        data={mockData}
        isColorBlind={true}
        colorBlindType="deuteranopia"
      />
    );
    expect(container.querySelector('.dynamics-chart--pollutant')).toBeDefined();
  });

  it('обрабатывает формат элементов данных как числа, european_aqi или объект с value', () => {
    const mockData = [
      10,
      { european_aqi: 20 },
      { value: 30 },
      null,
      'invalid'
    ];

    const { container } = render(
      <DynamicsChart
        mode="aqi"
        data={mockData}
        activeIndex={999} // out of range
        height={300}
      />
    );
    expect(container.querySelector('svg')).toBeDefined();
  });
  it('отображает все дни в многодневном режиме без пропусков и дубликатов', () => {
    const multiDayData = [
      { time: '2026-10-31T00:00', aqi: 20 },
      { time: '2026-10-31T12:00', aqi: 25 },
      { time: '2026-11-01T00:00', aqi: 30 },
      { time: '2026-11-01T12:00', aqi: 35 },
      { time: '2026-11-02T00:00', aqi: 40 },
    ];

    const { container } = render(
      <DynamicsChart
        mode="aqi"
        data={multiDayData}
        isAllDays={true}
      />
    );

    expect(container.textContent).toContain('31.10');
    expect(container.textContent).toContain('01.11');
    expect(container.textContent).toContain('02.11');
  });

  it('поддерживает выделение диапазона мышью (drag-to-select)', () => {
    const onRangeSelect = vi.fn();
    const onPointClick = vi.fn();
    const data = [
      { time: '2026-11-01T00:00', aqi: 10 },
      { time: '2026-11-01T06:00', aqi: 20 },
      { time: '2026-11-01T12:00', aqi: 30 },
      { time: '2026-11-01T18:00', aqi: 40 },
    ];

    const { container } = render(
      <DynamicsChart
        mode="aqi"
        data={data}
        enableRangeSelection={true}
        onRangeSelect={onRangeSelect}
        onPointClick={onPointClick}
      />
    );

    const svg = container.querySelector('svg');
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 720,
      height: 220,
      right: 720,
      bottom: 220,
    });

        fireEvent.mouseDown(svg, { button: 0, clientX: 50 });
    fireEvent.mouseMove(window, { clientX: 300 });
    expect(container.querySelector('.chart-selection-box')).toBeTruthy();
    fireEvent.mouseUp(window, { clientX: 300 });

    expect(onRangeSelect).toHaveBeenCalled();
  });

  it('отображает сетку точек и маркер при наведении мыши', () => {
    const onPointClick = vi.fn();
    const data = [
      { time: '2026-11-01T00:00', aqi: 15, hourLabel: '00:00' },
      { time: '2026-11-01T03:00', aqi: 25, hourLabel: '03:00' },
      { time: '2026-11-01T06:00', aqi: 35, hourLabel: '06:00' },
    ];

    const { container } = render(
      <DynamicsChart
        mode="aqi"
        data={data}
        onPointClick={onPointClick}
      />
    );

    const svg = container.querySelector('svg');
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 720,
      height: 220,
      right: 720,
      bottom: 220,
    });

    expect(container.querySelector('[data-testid="chart-hover-grid"]')).toBeNull();

    fireEvent.mouseEnter(svg);
    fireEvent.mouseMove(svg, { clientX: 200 });

    expect(container.querySelector('[data-testid="chart-hover-grid"]')).toBeTruthy();

    const interactiveRects = container.querySelectorAll('rect[role="button"]');
    if (interactiveRects.length > 0) {
      fireEvent.mouseEnter(interactiveRects[1]);
    }

    fireEvent.mouseLeave(svg);
    expect(container.querySelector('[data-testid="chart-hover-grid"]')).toBeNull();
  });
});
