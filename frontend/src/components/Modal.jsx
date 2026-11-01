import { useId, useRef } from 'react';
import { X } from 'lucide-react';
import { useDialog } from './useDialog';

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
