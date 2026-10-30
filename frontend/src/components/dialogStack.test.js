import { describe, expect, it } from 'vitest';
import { createDialogStack, trapIndex } from './dialogStack';

describe('trapIndex', () => {
  it('wraps Tab from the last element to the first and Shift+Tab from the first to the last', () => {
    expect(trapIndex(2, 3, false)).toBe(0);
    expect(trapIndex(0, 3, true)).toBe(2);
  });

  it('lets the browser move focus between inner elements', () => {
    expect(trapIndex(0, 3, false)).toBeNull();
    expect(trapIndex(2, 3, true)).toBeNull();
  });

  it('pulls focus from outside (or the dialog itself) back in', () => {
    expect(trapIndex(-1, 3, false)).toBe(0);
    expect(trapIndex(-1, 3, true)).toBe(2);
  });

  it('handles one and zero focusable elements', () => {
    expect(trapIndex(0, 1, false)).toBe(0);
    expect(trapIndex(0, 1, true)).toBe(0);
    expect(trapIndex(-1, 0, false)).toBeNull();
  });
});

// Nodes are plain objects; `contains` follows a parent chain like the DOM
const node = (name, parent = null) => ({ name, parent });
const contains = (a, b) => { for (let n = b; n; n = n.parent) if (n === a) return true; return false; };

describe('createDialogStack', () => {
  it('only the newest dialog is on top', () => {
    const s = createDialogStack();
    const a = { node: node('a'), returnTo: node('trigger') };
    const b = { node: node('b'), returnTo: node('x') };
    s.push(a);
    expect(s.isTop(a)).toBe(true);
    s.push(b);
    expect(s.isTop(a)).toBe(false);
    expect(s.isTop(b)).toBe(true);
  });

  it('returns focus to the trigger when the top dialog closes', () => {
    const s = createDialogStack();
    const trigger = node('hire button');
    const a = { node: node('hire modal'), returnTo: trigger };
    s.push(a);
    expect(s.remove(a, contains)).toBe(trigger);
    expect(s.size()).toBe(0);
  });

  it('a dialog opened from inside a lower dialog inherits its target when the lower one closes first', () => {
    // Hire modal opens the progress drawer from its "Sign" button, then closes on success
    const s = createDialogStack();
    const hireButton = node('hire button');
    const hireModal = node('hire modal');
    const signButton = node('sign button', hireModal);
    const hire = { node: hireModal, returnTo: hireButton };
    const drawer = { node: node('drawer'), returnTo: signButton };
    s.push(hire);
    s.push(drawer);
    expect(s.remove(hire, contains)).toBeNull();
    expect(s.isTop(drawer)).toBe(true);
    expect(s.remove(drawer, contains)).toBe(hireButton);
  });

  it('keeps the top dialog target when it was not opened from the closed one', () => {
    const s = createDialogStack();
    const lower = { node: node('lower'), returnTo: node('t1') };
    const ownTarget = node('t2');
    const top = { node: node('top'), returnTo: ownTarget };
    s.push(lower);
    s.push(top);
    s.remove(lower, contains);
    expect(s.remove(top, contains)).toBe(ownTarget);
  });

  it('ignores entries that are not open', () => {
    const s = createDialogStack();
    expect(s.remove({ node: node('a'), returnTo: null }, contains)).toBeNull();
    expect(s.isTop({})).toBe(false);
  });
});
