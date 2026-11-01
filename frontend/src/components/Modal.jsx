import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
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

// Centered modal: overlay + titled panel with a close button
export default function Modal({ title, onClose, className = '', children }) {
  const ref = useRef(null);
  const titleId = useId();
  useDialog(ref, { onClose });
  return (
    <div className="overlay" onClick={onClose}>
      <div ref={ref} className={`modal ${className}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="modal-head">
          <h2 id={titleId} className="modal-title">{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} aria-hidden="true" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
