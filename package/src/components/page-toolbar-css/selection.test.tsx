import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PageFeedbackToolbarCSS } from "./index";
import { StrictMode } from "react";
import { generateOutput } from "../../utils/generate-output";

const originalPoint = document.elementFromPoint;
const originalStack = document.elementsFromPoint;
const root = () => document.querySelector('agentation-toolbar')!.shadowRoot! as unknown as HTMLElement;
const popup = () => root().querySelector('[data-annotation-popup]');
const outlineCount = () => root().querySelectorAll('[class*="SelectOutline"]').length;
const activate = () => fireEvent.keyDown(document, { key: 'f', ctrlKey: true, shiftKey: true });
function point(element: HTMLElement) {
  document.elementFromPoint = () => element;
  document.elementsFromPoint = () => [element, document.body];
}
function rect(element: Element, x: number, y: number, w = 80, h = 30) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(x, y, w, h));
}
function fixture() {
  const onHostClick = vi.fn();
  const onAnnotationAdd = vi.fn();
  render(<><div onClick={onHostClick}><p>Alpha</p><p>Beta</p><p>Gamma</p><div data-testid="empty" /></div><PageFeedbackToolbarCSS onAnnotationAdd={onAnnotationAdd} /></>);
  const alpha = screen.getByText('Alpha');
  const beta = screen.getByText('Beta');
  const gamma = screen.getByText('Gamma');
  rect(alpha, 10, 10); rect(beta, 110, 10); rect(gamma, 210, 10);
  return { alpha, beta, gamma, onHostClick, onAnnotationAdd };
}
function select(element: HTMLElement, flags = { metaKey: true }) {
  point(element); fireEvent.click(element, { ...flags, clientX: 15, clientY: 15 });
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn() }, userAgent: 'test-agent' });
});
afterEach(() => {
  cleanup(); document.elementFromPoint = originalPoint; document.elementsFromPoint = originalStack;
  vi.unstubAllGlobals(); vi.restoreAllMocks();
});

describe('rectangle mode', () => {
  const toggle = () => within(root()).getByRole('button', { name: 'Rectangle mode' });

  it('uses the existing comment popup and saves just the reverse-drag rectangle over elements', async () => {
    const { alpha, beta, onAnnotationAdd, onHostClick } = fixture();
    activate();
    const hitTest = vi.fn(() => [alpha, beta]);
    const onHostMouseDown = vi.fn((event: MouseEvent) => event.stopPropagation());
    beta.addEventListener('mousedown', onHostMouseDown);
    document.elementsFromPoint = hitTest;
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    vi.stubGlobal('scrollY', 240);
    fireEvent.scroll(document);
    fireEvent.mouseDown(beta, { clientX: 145, clientY: 36, ctrlKey: true });
    fireEvent.mouseMove(alpha, { clientX: 35, clientY: 14, ctrlKey: true });
    expect(root().querySelector<HTMLElement>('[class*="dragSelection"]')?.style.width).toBe('110px');
    fireEvent.mouseMove(alpha, { clientX: 30, clientY: 12, ctrlKey: true });
    expect(hitTest).not.toHaveBeenCalled();
    expect(onHostMouseDown).not.toHaveBeenCalled();
    expect(root().querySelector('[class*="selectedElementHighlight"]')).toBeNull();
    fireEvent.mouseUp(alpha, { clientX: 30, clientY: 12, ctrlKey: true });
    // A drag across elements may not generate a click; Add must still work immediately.
    expect(onHostClick).not.toHaveBeenCalled();
    expect(popup()?.textContent).toContain('Area selection');
    const input = within(root()).getByPlaceholderText('What should change in this area?');
    fireEvent.change(input, { target: { value: 'Check spacing in this rectangle' } });
    fireEvent.click(within(root()).getByRole('button', { name: 'Add' }));
    expect(onAnnotationAdd).toHaveBeenCalledOnce();
    const annotation = onAnnotationAdd.mock.calls[0][0];
    expect(annotation).toMatchObject({
      element: 'Area selection',
      elementPath: 'region at (30, 252) (115×24px)',
      boundingBox: { x: 30, y: 252, width: 115, height: 24 },
      comment: 'Check spacing in this rectangle',
    });
    expect(generateOutput([annotation], '/')).toContain('**Location:** region at (30, 252) (115×24px)');
    for (const key of ['elementBoundingBoxes', 'selectedText', 'nearbyText', 'cssClasses', 'fullPath', 'attributes', 'sourceFile']) {
      expect(annotation[key]).toBeUndefined();
    }
    await act(async () => {});
  });

  it('ignores clicks and lets Escape cancel a drag without exiting normal feedback mode', () => {
    const { alpha, onHostClick } = fixture();
    activate(); point(alpha);
    fireEvent.click(toggle());
    fireEvent.mouseDown(alpha, { clientX: 15, clientY: 15 });
    fireEvent.mouseUp(alpha, { clientX: 15, clientY: 15 });
    fireEvent.click(alpha, { clientX: 15, clientY: 15 });
    expect(popup()).toBeNull();
    expect(onHostClick).not.toHaveBeenCalled();
    fireEvent.mouseDown(alpha, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(alpha, { clientX: 40, clientY: 25 });
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.mouseUp(alpha, { clientX: 40, clientY: 25 });
    fireEvent.click(alpha, { clientX: 40, clientY: 25 });
    expect(popup()).toBeNull();
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    fireEvent.mouseDown(alpha, { clientX: 15, clientY: 15 });
    fireEvent.click(alpha, { clientX: 15, clientY: 15 });
    expect(popup()?.textContent).toContain('Alpha');
  });

  it('resets when entering Layout mode or closing the feedback toolbar', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    fixture(); activate();
    fireEvent.click(toggle());
    fireEvent.keyDown(document, { key: 'L' });
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect((toggle() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(toggle());
    fireEvent.click(within(root()).getByRole('button', { name: 'Exit', exact: true }));
    activate();
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
  });
});

describe('combined selection', () => {
  it('keeps a text selection marker beside the selection after document scrolling in Strict Mode', () => {
    render(<StrictMode><p>Hover over elements</p><PageFeedbackToolbarCSS /></StrictMode>);
    const target = screen.getByText('Hover over elements');
    rect(target, 100, 200, 200, 25);
    point(target);
    activate();
    vi.stubGlobal('scrollY', 350);
    fireEvent.scroll(document);
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'over elements' } as Selection);
    fireEvent.click(target, { clientX: 250, clientY: 210 });
    expect(popup()?.textContent).toContain('over elements');
    const marker = root().querySelector<HTMLElement>('[class*="pending"]')!;
    expect(Number.parseFloat(marker.style.top) - window.scrollY).toBe(210);
    vi.stubGlobal('scrollY', 400);
    fireEvent.scroll(document);
    expect(Number.parseFloat(marker.style.top) - window.scrollY).toBe(160);
  });

  it('keeps measured hover labels inside both viewport axes', () => {
    const {alpha} = fixture();
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.className?.includes('hoverTooltip') ? 280 : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.className?.includes('hoverTooltip') ? 44 : 0;
    });
    activate(); point(alpha);
    for (const [x,y] of [[window.innerWidth-1, 20], [1,1], [window.innerWidth-1,window.innerHeight-1]]) {
      fireEvent.mouseMove(alpha,{clientX:x,clientY:y});
      const tooltip = root().querySelector('[class*="hoverTooltip"]') as HTMLElement;
      expect(Number.parseFloat(tooltip.style.left)).toBeGreaterThanOrEqual(8);
      expect(Number.parseFloat(tooltip.style.left)+280).toBeLessThanOrEqual(window.innerWidth-8);
      expect(Number.parseFloat(tooltip.style.top)).toBeGreaterThanOrEqual(8);
      expect(Number.parseFloat(tooltip.style.top)+44).toBeLessThanOrEqual(window.innerHeight-8);
    }
  });

  it('repositions a visible hover label when the viewport shrinks without pointer movement', () => {
    const {alpha} = fixture();
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(280);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(44);
    activate(); point(alpha);
    fireEvent.mouseMove(alpha,{clientX:window.innerWidth-1,clientY:window.innerHeight-1});
    vi.stubGlobal('innerWidth',480);vi.stubGlobal('innerHeight',400);
    fireEvent.resize(window);
    const tooltip = root().querySelector('[class*="hoverTooltip"]') as HTMLElement;
    expect(Number.parseFloat(tooltip.style.left)+280).toBeLessThanOrEqual(472);
    expect(Number.parseFloat(tooltip.style.top)+44).toBeLessThanOrEqual(392);
  });

  it.each(['Meta', 'Control'])('accumulates with %s held before activation and opens on release', async key => {
    const { alpha, beta, onHostClick, onAnnotationAdd } = fixture();
    activate();
    const flags = key === 'Meta' ? { metaKey: true } : { ctrlKey: true };
    point(alpha); fireEvent.click(alpha, flags);
    point(beta); fireEvent.click(beta, flags);
    expect(popup()).toBeNull();
    expect(outlineCount()).toBe(2);
    expect(onHostClick).not.toHaveBeenCalled();
    fireEvent.keyUp(document, { key });
    expect(popup()).not.toBeNull();
    expect(popup()!.textContent).toContain('2 elements');
    fireEvent.change(within(root()).getByRole('textbox'), { target: { value: 'Group feedback' } });
    fireEvent.click(within(root()).getByRole('button', { name: 'Add' }));
    expect(onAnnotationAdd).toHaveBeenCalledOnce();
    expect(onAnnotationAdd.mock.calls[0][0]).toMatchObject({ isMultiSelect: true, comment: 'Group feedback' });
    expect(onAnnotationAdd.mock.calls[0][0].elementBoundingBoxes).toHaveLength(2);
    await act(async () => {});
  });

  it('deselects an element and leaves the remaining element as an ordinary annotation', () => {
    const { alpha, beta } = fixture(); activate();
    select(alpha); select(beta); select(alpha);
    expect(outlineCount()).toBe(1);
    fireEvent.keyUp(document, { key: 'Meta' });
    expect(popup()!.textContent).toContain('Beta');
    expect(popup()!.textContent).not.toContain('2 elements');
  });

  it.each(['Escape', 'blur'])('cancels selection on %s without a popup on later key release', cancellation => {
    const { alpha } = fixture(); activate(); select(alpha);
    if (cancellation === 'blur') fireEvent.blur(window);
    else fireEvent.keyDown(document, { key: 'Escape', metaKey: true });
    fireEvent.keyUp(document, { key: 'Meta' });
    expect(popup()).toBeNull(); expect(outlineCount()).toBe(0);
  });

  it('waits for both primary modifiers to be released', () => {
    const { alpha } = fixture(); activate();
    point(alpha); fireEvent.click(alpha, { metaKey: true, ctrlKey: true });
    fireEvent.keyUp(document, { key: 'Control', metaKey: true });
    expect(popup()).toBeNull();
    fireEvent.keyUp(document, { key: 'Meta' });
    expect(popup()).not.toBeNull();
  });

  it.each([false, true])('adds a drag group without losing clicked elements (release during drag: %s)', releaseDuringDrag => {
    const { alpha, beta } = fixture(); activate(); select(alpha);
    point(beta);
    fireEvent.mouseDown(screen.getByTestId('empty'), { clientX: 100, clientY: 5, metaKey: true });
    fireEvent.mouseMove(beta, { clientX: 195, clientY: 50, metaKey: true });
    if (releaseDuringDrag) fireEvent.keyUp(document, { key: 'Meta' });
    expect(popup()).toBeNull();
    fireEvent.mouseUp(beta, { clientX: 195, clientY: 50, metaKey: !releaseDuringDrag });
    if (!releaseDuringDrag) {
      expect(popup()).toBeNull(); expect(outlineCount()).toBe(2);
      fireEvent.keyUp(document, { key: 'Meta' });
    }
    expect(popup()!.textContent).toContain('2 elements');
    expect(popup()!.textContent).toContain('Alpha');
    expect(popup()!.textContent).toContain('Beta');
  });

  it('keeps selected elements inside a web component highlighted', async () => {
    fixture();
    const host = document.body.appendChild(document.createElement('aside'));
    const shadow = host.attachShadow({ mode: 'open' });
    const button = shadow.appendChild(document.createElement('button')); button.textContent = 'Shadow button';
    rect(button, 10, 10);
    activate();
    document.elementFromPoint = () => host; document.elementsFromPoint = () => [host];
    Object.defineProperty(shadow, 'elementFromPoint', { value: () => button });
    Object.defineProperty(shadow, 'elementsFromPoint', { value: () => [button, host] });
    fireEvent.click(host, { metaKey: true });
    expect(outlineCount()).toBe(1);
    fireEvent.keyUp(document, { key: 'Meta' });
    expect(popup()!.textContent).toContain('Shadow button');
    await act(async () => { host.remove(); });
  });

  it('does not send the release click of a selection drag to the host', () => {
    const { beta, onHostClick } = fixture(); activate(); point(beta);
    fireEvent.mouseDown(screen.getByTestId('empty'), { clientX: 100, clientY: 5, metaKey: true });
    fireEvent.mouseMove(beta, { clientX: 195, clientY: 50, metaKey: true });
    fireEvent.mouseUp(beta, { clientX: 195, clientY: 50, metaKey: true });
    fireEvent.click(beta, { metaKey: true });
    expect(onHostClick).not.toHaveBeenCalled();
    expect(outlineCount()).toBe(1);
  });

  it('cancels a drag on Escape without creating feedback on mouse release', () => {
    const { beta } = fixture(); activate(); point(beta);
    fireEvent.mouseDown(screen.getByTestId('empty'), { clientX: 100, clientY: 5, metaKey: true });
    fireEvent.mouseMove(beta, { clientX: 195, clientY: 50, metaKey: true });
    fireEvent.keyDown(document, { key: 'Escape', metaKey: true });
    fireEvent.mouseUp(beta, { clientX: 195, clientY: 50 });
    expect(popup()).toBeNull();
    expect(outlineCount()).toBe(0);
  });

  it('changes the highlighted and picked target together when the modifier changes', () => {
    const { alpha } = fixture();
    const overlay = screen.getByTestId('empty'); rect(overlay, 0, 0, 500, 200);
    document.elementFromPoint = () => overlay; document.elementsFromPoint = () => [overlay, alpha];
    activate();
    fireEvent.mouseMove(overlay, { clientX: 20, clientY: 20 });
    const highlight = () => root().querySelector('[class*="hoverHighlight"]') as HTMLElement;
    expect(highlight().style.width).toBe('500px');
    fireEvent.keyDown(document, { key: 'Meta', metaKey: true });
    expect(highlight().style.width).toBe('80px');
    expect(highlight().style.borderStyle).toBe('dashed');
    fireEvent.keyUp(document, { key: 'Meta' });
    expect(highlight().style.width).toBe('500px');
    fireEvent.click(overlay, { metaKey: true, clientX: 20, clientY: 20 });
    fireEvent.keyUp(document, { key: 'Meta' });
    expect(popup()!.textContent).toContain('Alpha');
  });

  it('does not resurrect the previous page hover while the pointer is over the toolbar', () => {
    const { alpha } = fixture(); activate(); point(alpha);
    fireEvent.mouseMove(alpha, { clientX: 20, clientY: 20 });
    const settings = within(root()).getByRole('button', { name: 'Settings' });
    fireEvent.mouseMove(settings, { composed: true });
    fireEvent.keyDown(document, { key: 'Meta', metaKey: true });
    expect(root().querySelector('[class*="hoverHighlight"]')).toBeNull();
  });

  it('filters detached elements before opening the popup', () => {
    const { alpha, beta } = fixture(); activate(); select(alpha); select(beta);
    // Host removal is independent of React here; restore for React cleanup.
    const parent = alpha.parentNode!; const next = alpha.nextSibling;
    alpha.remove();
    fireEvent.keyUp(document, { key: 'Meta' });
    expect(popup()!.textContent).toContain('Beta');
    expect(popup()!.textContent).not.toContain('2 elements');
    parent.insertBefore(alpha, next);
  });
});
