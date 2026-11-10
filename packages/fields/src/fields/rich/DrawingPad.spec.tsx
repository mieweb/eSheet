import { act, cleanup, render } from '@testing-library/react';
import { DrawingPad } from './DrawingPad.js';

const images: HTMLImageElement[] = [];

beforeEach(() => {
  images.length = 0;
  vi.stubGlobal(
    'Image',
    vi.fn(function () {
      const image = document.createElement('img');
      images.push(image);
      return image;
    })
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    setTransform: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
    'data:image/png;base64,composite'
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('DrawingPad background loads', () => {
  it('repaints using the current canvas dimensions after resizing during a load', () => {
    const onChange = vi.fn();
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(2);
    const { container } = render(
      <DrawingPad
        backgroundImage="first.png"
        emitOnBackgroundLoad
        onChange={onChange}
      />
    );
    const canvas = container.querySelector('canvas')!;
    canvas.width = 1600;
    canvas.height = 800;
    const context = canvas.getContext('2d')!;
    vi.mocked(context.clearRect).mockClear();

    act(() => images[0].onload?.call(images[0], new Event('load')));

    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 800, 400);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('detaches obsolete handlers and ignores queued loads after replacement', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <DrawingPad
        backgroundImage="first.png"
        emitOnBackgroundLoad
        onChange={onChange}
      />
    );
    const first = images[0];
    const staleLoad = first.onload!;

    rerender(
      <DrawingPad
        backgroundImage="second.png"
        emitOnBackgroundLoad
        onChange={onChange}
      />
    );
    expect(first.onload).toBeNull();
    expect(first.onerror).toBeNull();
    act(() => staleLoad.call(first, new Event('load')));
    expect(onChange).not.toHaveBeenCalled();

    act(() => images[1].onload?.call(images[1], new Event('load')));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ image: 'data:image/png;base64,composite' })
    );
  });

  it('does not emit for a load completed after unmount', () => {
    const onChange = vi.fn();
    const { unmount } = render(
      <DrawingPad
        backgroundImage="first.png"
        emitOnBackgroundLoad
        onChange={onChange}
      />
    );
    const image = images[0];
    const staleLoad = image.onload!;
    unmount();

    act(() => staleLoad.call(image, new Event('load')));
    expect(image.onload).toBeNull();
    expect(image.onerror).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
