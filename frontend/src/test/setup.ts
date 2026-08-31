import "@testing-library/jest-dom/vitest";

if (typeof window !== "undefined") {
  // Mock matchMedia
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });

  // Mock ResizeObserver
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as any;

  // Mock IntersectionObserver
  class IntersectionObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.IntersectionObserver = IntersectionObserverMock as any;

  // Mock HTMLCanvasElement getContext
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    contextType: string,
    ...args: any[]
  ) {
    if (contextType === "webgl" || contextType === "webgl2" || contextType === "experimental-webgl") {
      return {
        canvas: this,
        drawingBufferWidth: 800,
        drawingBufferHeight: 600,
        getExtension: () => null,
        getParameter: () => 0,
        createTexture: () => ({}),
        bindTexture: () => {},
        texParameteri: () => {},
        texImage2D: () => {},
        clearColor: () => {},
        clearDepth: () => {},
        clear: () => {},
        enable: () => {},
        disable: () => {},
        depthFunc: () => {},
        viewport: () => {},
        createProgram: () => ({}),
        createShader: () => ({}),
        shaderSource: () => {},
        compileShader: () => {},
        attachShader: () => {},
        linkProgram: () => {},
        getProgramParameter: () => true,
        getShaderParameter: () => true,
        useProgram: () => {},
        createBuffer: () => ({}),
        bindBuffer: () => {},
        bufferData: () => {},
        createFramebuffer: () => ({}),
        bindFramebuffer: () => {},
        framebufferTexture2D: () => {},
        createRenderbuffer: () => ({}),
        bindRenderbuffer: () => {},
        renderbufferStorage: () => {},
        framebufferRenderbuffer: () => {},
        checkFramebufferStatus: () => 36053,
      } as any;
    }
    if (contextType === "2d") {
      return {
        canvas: this,
        clearRect: () => {},
        fillRect: () => {},
        strokeRect: () => {},
        fillText: () => {},
        measureText: () => ({ width: 0 }),
        drawImage: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        fill: () => {},
        save: () => {},
        restore: () => {},
      } as any;
    }
    return originalGetContext.apply(this, [contextType, ...args] as any);
  } as any;

  // Mock AudioContext
  class AudioContextMock {
    state = "running";
    currentTime = 0;
    destination = {};
    createOscillator() {
      return {
        type: "sine",
        frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        connect: () => {},
        start: () => {},
        stop: () => {},
        disconnect: () => {},
      };
    }
    createGain() {
      return {
        gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        connect: () => {},
        disconnect: () => {},
      };
    }
    resume() {
      return Promise.resolve();
    }
  }
  (window as any).AudioContext = AudioContextMock;
  (window as any).webkitAudioContext = AudioContextMock;
}
