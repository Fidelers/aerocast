import { vi } from 'vitest';

globalThis.Live2DCubismCore = {};
if (typeof window !== 'undefined') {
  window.Live2DCubismCore = globalThis.Live2DCubismCore;
}

vi.mock('pixi.js', async (importOriginal) => {
  const actual = await importOriginal();
  class MockApplication {
    constructor() {
      this.stage = {
        addChild: vi.fn(),
        removeChild: vi.fn(),
      };
      this.renderer = {
        resize: vi.fn(),
      };
    }
    destroy() {}
  }
  return {
    ...actual,
    Application: MockApplication,
  };
});

vi.mock('pixi-live2d-display/cubism4', () => {
  class MockLive2DModel {
    static registerTicker() {}
    static async from() {
      return {
        anchor: { set: vi.fn() },
        scale: { set: vi.fn() },
        x: 0,
        y: 0,
        height: 750,
        destroy: vi.fn(),
        motion: vi.fn(),
        internalModel: {
          motionManager: {
            loadMotion: vi.fn().mockResolvedValue({
              setIsLoop: vi.fn(),
              setIsLoopFadeIn: vi.fn(),
            }),
            stopAllMotions: vi.fn(),
          },
          coreModel: {
            saveParameters: vi.fn(),
          },
        },
      };
    }
  }
  return {
    Live2DModel: MockLive2DModel,
  };
});
