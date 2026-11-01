import { useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useDialog } from './useDialog';

// Simulated x402 playground. Not linked to the escrow: it sends a mock payment reference to the
// local gateway demo (scripts/x402_simulator.js) or, if that is not running, simulates in the browser.
const GATEWAY_URL = 'localhost:3000/api/summarize';
const MOCK_REFERENCE = 'MOCK_TX_XLM';
const DEFAULT_INPUT = 'Stellar is an open-source blockchain designed to accelerate cross-border payments cheaply and in a decentralized manner using stablecoins.';

export default function Playground({ job, onClose }) {
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);
  const titleId = useId();
  const inputId = useId();
  useDialog(panelRef, { onClose });

  const execute = async () => {
    setLoading(true);
    const out = [];
    const push = (...lines) => { out.push(...lines); setLogs([...out]); };
    push(
      `[sim] Agent execution is simulated in this prototype. The escrow for job #${String(job.id)} is not used here.`,
      `[CLIENT] Preparing task payload for: ${job.agentName}`,
      `[HTTP] POST http://${GATEWAY_URL} HTTP/1.1`,
      `[HTTP] Headers: { "Content-Type": "application/json", "X-Stellar-Payment-Tx": "${MOCK_REFERENCE}" } (mock reference, not a transaction)`,
      `[HTTP] Body: { "text": "${input.slice(0, 45)}..." }`,
      '[x402] Contacting the local gateway demo...',
    );
    await new Promise((r) => setTimeout(r, 1200));

    try {
      const response = await fetch(`http://${GATEWAY_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Stellar-Payment-Tx': MOCK_REFERENCE },
        body: JSON.stringify({ text: input }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        push(
          `[sim] [x402] Gateway accepted a mock payment reference (method: ${data.payment?.method || 'unknown'}). No ledger check was made.`,
          `[sim] [GATEWAY] API Response: ${response.status} OK`,
          `[sim] [GATEWAY] Data: ${JSON.stringify(data, null, 2)}`,
        );
      } else {
        push(`[GATEWAY] API Response Error: ${response.status} ${response.statusText}`, `[GATEWAY] Error Detail: ${JSON.stringify(data, null, 2)}`);
      }
    } catch (err) {
      push(`[WARNING] Local gateway not reachable (${err.message}).`, '[CLIENT] Switching to in-browser simulation...');
      await new Promise((r) => setTimeout(r, 1500));
      const summary = `[SIMULATION SUMMARY] Your text summary: "${input.substring(0, 50)}..." (Original text length was ${input.length} characters). No payment or contract call was made.`;
      push(
        '[sim] [x402] Payment step simulated in the browser. No contract or Horizon call was made.',
        '[sim] [GATEWAY] API Response: 200 OK (Simulated)',
        `[sim] [GATEWAY] Data: {\n  "success": true,\n  "summary": "${summary}"\n}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const toneFor = (log) => {
    if (log.startsWith('[sim]') || log.startsWith('[x402]')) return 'log-sim';
    if (log.startsWith('[GATEWAY] API Response Error') || log.startsWith('[WARNING]')) return 'log-error';
    if (log.startsWith('[GATEWAY]')) return 'log-strong';
    return '';
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div ref={panelRef} className="modal modal-wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="modal-head">
          <h2 id={titleId} className="modal-title">x402 playground [sim]: {job.agentName}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} aria-hidden="true" /></button>
        </div>
        <p className="sample-note">Simulated: no agent is called and no payment is checked. This console is not connected to the escrow contract.</p>

        <div className="playground-grid">
          <div className="playground-form">
            <div>
              <div className="field-caption">HTTP endpoint (local gateway demo)</div>
              <div className="mono-box">POST http://{GATEWAY_URL}</div>
            </div>
            <div>
              <div className="field-caption">Header X-Stellar-Payment-Tx (mock reference)</div>
              <div className="mono-box">{MOCK_REFERENCE}</div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor={inputId}>Input text</label>
              <textarea id={inputId} className="form-input" rows={5} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Text to send to the local gateway demo" />
            </div>
            <button className="btn btn-primary btn-block" onClick={execute} disabled={loading}>
              {loading ? 'Running simulation…' : 'Run simulated x402 call'}
            </button>
          </div>

          <div className="console" aria-live="polite">
            <div className="console-header">Console output</div>
            <div className="console-body">
              {logs.length === 0 ? (
                <p className="console-empty">Ready. Run the simulated call to see the request and the simulated response.</p>
              ) : (
                logs.map((log, i) => <div key={i} className={`console-line ${toneFor(log)}`}>{log}</div>)
              )}
              {loading && <div className="console-line log-wait"><span className="spinner" aria-hidden="true" /> Waiting for the response…</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
