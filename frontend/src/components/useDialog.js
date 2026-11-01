import { useEffect, useRef } from 'react';
import { createDialogStack, trapIndex } from './dialogStack';

const stack = createDialogStack();
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Dialog behaviour for every modal and drawer: focus moves inside on open ([data-autofocus],
// else the first control, else the dialog itself), Tab stays inside, Escape closes unless
// canClose is false, and focus returns to the element that opened it.
export function useDialog(ref, { onClose, canClose = true }) {
  const opts = useRef({ onClose, canClose });
  useEffect(() => { opts.current = { onClose, canClose }; });

  useEffect(() => {
    const node = ref.current;
    const entry = { node, returnTo: document.activeElement };
    stack.push(entry);
    (node.querySelector('[data-autofocus]') || node.querySelector(FOCUSABLE) || node).focus();

    const onKey = (e) => {
      if (!stack.isTop(entry)) return;
      if (e.key === 'Escape') {
        if (opts.current.canClose) { e.preventDefault(); opts.current.onClose(); }
        return;
      }
      if (e.key !== 'Tab') return;
      const items = [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
      if (items.length === 0) { e.preventDefault(); node.focus(); return; }
      const i = trapIndex(items.indexOf(document.activeElement), items.length, e.shiftKey);
      if (i !== null) { e.preventDefault(); items[i].focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const target = stack.remove(entry, (a, b) => a.contains(b));
      if (target?.isConnected) target.focus();
    };
  }, [ref]);
}
