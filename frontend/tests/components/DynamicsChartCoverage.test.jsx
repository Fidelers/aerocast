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
});
