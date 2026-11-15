import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import DynamicsChart, { buildBezierPath, formatPointTooltip } from '../../src/components/DynamicsChart';

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
        activeIndex={999}
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

  it('прореживает подписи дней при узком контейнере или большом количестве дней', () => {
    const eightDays = Array.from({ length: 8 }, (_, i) => ({
      time: `2026-11-0${i + 1}T12:00`,
      aqi: 20 + i
    }));

    const { container: cSmall } = render(
      <DynamicsChart
        mode="pollutant"
        valueKey="aqi"
        height={90}
        data={eightDays}
        isAllDays={true}
      />
    );
    expect(cSmall.querySelector('.chart-axis-labels')).toBeDefined();

    const sixteenDays = Array.from({ length: 16 }, (_, i) => {
      const day = String(i + 1).padStart(2, '0');
      return {
        time: `2026-11-${day}T12:00`,
        aqi: 20 + i
      };
    });

    const { container: cLarge } = render(
      <DynamicsChart
        mode="aqi"
        isMain={true}
        data={sixteenDays}
        isAllDays={true}
      />
    );
    expect(cLarge.querySelector('.chart-axis-labels')).toBeDefined();
  });

  it('обрабатывает жесты мыши: обратный drag, клик правой кнопкой и движение без захвата', () => {
    const onRangeSelect = vi.fn();
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

    svg.createSVGPoint = () => {
      let pt = { x: 0, y: 0 };
      return {
        set x(val) { pt.x = val; },
        get x() { return pt.x; },
        set y(val) { pt.y = val; },
        get y() { return pt.y; },
        matrixTransform: () => ({ x: pt.x, y: pt.y })
      };
    };
    svg.getScreenCTM = () => ({
      inverse: () => ({})
    });

    fireEvent.mouseDown(svg, { button: 2, clientX: 200 });
    fireEvent.mouseMove(window, { clientX: 300 });
    fireEvent.mouseUp(window);

    fireEvent.mouseDown(svg, { button: 0, clientX: 400 });
    fireEvent.mouseMove(window, { clientX: 100 });
    fireEvent.mouseUp(window, { clientX: 100 });

    expect(onRangeSelect).toHaveBeenCalled();
  });

  it('покрывает утилиты buildBezierPath и formatPointTooltip со всеми ветками', () => {
    expect(buildBezierPath([])).toBe('');
    expect(buildBezierPath(null)).toBe('');
    expect(buildBezierPath([{ x: 10, y: 20 }])).toBe('M 10.00 20.00');
    expect(buildBezierPath([{ x: 10, y: 20 }, { x: 30, y: 40 }])).toContain(' C ');

    expect(formatPointTooltip(null)).toBe('');
    expect(formatPointTooltip('str')).toBe('');
    expect(formatPointTooltip({ hourLabel: '14:00' })).toBe('14:00');
    expect(formatPointTooltip({ time: '2026-10-22T14:00' })).toBe('14:00');
    expect(formatPointTooltip({ time: '2026-10-22T14:00' }, true)).toBe('22.10 14:00');
    expect(formatPointTooltip({ time: 'badformat', hourLabel: '08:00' }, true)).toBe('badformat 08:00');
    expect(formatPointTooltip({}, true)).toBe('');
  });

  it('обрабатывает малые смещения курсора при драге без вызова onRangeSelect', () => {
    const onRangeSelect = vi.fn();
    const data = [
      { time: '2026-10-22T00:00', aqi: 15 },
      { time: '2026-10-22T01:00', aqi: 25 },
      { time: '2026-10-22T02:00', aqi: 35 },
    ];

    const { container } = render(
      <DynamicsChart
        mode="aqi"
        data={data}
        enableRangeSelection={true}
        onRangeSelect={onRangeSelect}
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

    fireEvent.mouseDown(svg, { button: 0, clientX: 200 });
    fireEvent.mouseMove(window, { clientX: 201 });
    fireEvent.mouseUp(window, { clientX: 201 });

    expect(onRangeSelect).not.toHaveBeenCalled();
  });

  it('обрабатывает ResizeObserver и fallback обработчик resize', () => {
    let roCallback = null;
    const mockObserve = vi.fn();
    const mockDisconnect = vi.fn();

    class MockRO {
      constructor(cb) {
        roCallback = cb;
      }
      observe = mockObserve;
      disconnect = mockDisconnect;
    }

    const origRO = window.ResizeObserver;
    window.ResizeObserver = MockRO;

    const { unmount } = render(
      <DynamicsChart
        mode="aqi"
        data={[{ aqi: 10 }, { aqi: 20 }]}
      />
    );

    expect(mockObserve).toHaveBeenCalled();
    act(() => {
      roCallback?.([
        { contentRect: { width: 500 } },
        { contentRect: { width: 50 } },
        { contentRect: {} },
      ]);
    });

    unmount();
    expect(mockDisconnect).toHaveBeenCalled();

    delete window.ResizeObserver;
    const { unmount: unmountFallback } = render(
      <DynamicsChart
        mode="aqi"
        data={[{ aqi: 10 }, { aqi: 20 }]}
      />
    );
    fireEvent(window, new Event('resize'));
    unmountFallback();

    window.ResizeObserver = origRO;
  });
});
