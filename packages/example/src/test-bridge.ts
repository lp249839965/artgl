import { Framer, Observable, Nullable } from "artgl";
import { RenderConfig } from '../../viewer/src/components/conf/interface';
import { Size } from 'artgl/src/engine/render-engine';

export class TestBridge implements TestBridge {
  async screenShotCompareElement(element: HTMLElement, goldenPath: string) {
    if (window.screenShotCompareElement) {
      await window.screenShotCompareElement(element, goldenPath);
    }
  }

  private canvas: Nullable<HTMLCanvasElement> = null;
  requestCanvas() {
    if (this.canvas === null) {
      throw `test is not prepared`
    }
    return this.canvas
  }

  // /img/demo.jpg
  getResourceURL(url: string) {
    return this.resourceBaseURL + url;
  }

  resourceBaseURL: string = "http://localhost:3001/"
  framer: Framer = new Framer();
  testConfig?: RenderConfig | RenderConfig[];

  resizeObserver: Observable<Size> = new Observable()

  constructor() {
    window.addEventListener("resize", this.onResize)
  }

  reset(canvas: HTMLCanvasElement) {
    this.framer = new Framer();
    this.testConfig = undefined;
    this.resizeObserver.clear();
    this.canvas = canvas;
  }

  private onResize = () => {
    if (this.canvas === null) {
      return
    }
    this.resizeObserver.notifyObservers({
      width: this.canvas.offsetWidth,
      height: this.canvas.offsetHeight,
    })
  }

  dispose() {
    window.removeEventListener("resize", this.onResize)
  }
}

window.artglTestBridge = TestBridge
