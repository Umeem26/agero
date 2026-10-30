// DOM-free logic behind useDialog (Modal.jsx), kept separate so it can be unit-tested.

// Where Tab should move inside a dialog. `index` is the focused element among the dialog's
// `count` focusable elements (-1 = focus is outside them, e.g. on the dialog itself).
// Returns the index to focus, or null to let the browser move focus normally.
export function trapIndex(index, count, shift) {
  if (count === 0) return null;
  if (index === -1) return shift ? count - 1 : 0;
  if (shift && index === 0) return count - 1;
  if (!shift && index === count - 1) return 0;
  return null;
}

// Open dialogs, newest last. Only the top one handles keys. Each entry is
// { node, returnTo }: the dialog element and what was focused when it opened.
export function createDialogStack() {
  const entries = [];
  return {
    push(entry) { entries.push(entry); },
    isTop(entry) { return entries.length > 0 && entries[entries.length - 1] === entry; },
    size() { return entries.length; },
    // Removes a closed dialog and returns the element to focus (null when another dialog is
    // still on top). If a dialog below the top closes first and the top one was opened from
    // inside it, the top one inherits its return target, so focus never goes to a removed node.
    remove(entry, contains) {
      const i = entries.indexOf(entry);
      if (i === -1) return null;
      const wasTop = i === entries.length - 1;
      entries.splice(i, 1);
      if (wasTop) return entry.returnTo ?? null;
      const above = entries[i];
      if (above && above.returnTo && contains(entry.node, above.returnTo)) above.returnTo = entry.returnTo;
      return null;
    },
  };
}
