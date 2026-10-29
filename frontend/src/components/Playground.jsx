import { useState } from 'react';
import { X, Zap } from 'lucide-react';

// Simulated x402 playground. Not linked to the escrow: it sends a mock payment reference to the
// local gateway demo (scripts/x402_simulator.js) or, if that is not running, simulates in the browser.
const GATEWAY_URL = 'localhost:3000/api/summarize';
const MOCK_REFERENCE = 'MOCK_TX_XLM';
const DEFAULT_INPUT = 'Stellar is an open-source blockchain designed to accelerate cross-border payments cheaply and in a decentralized manner using stablecoins.';

export default function Playground({ job, onClose }) {
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

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

  const colorFor = (log) => {
    if (log.startsWith('[sim]')) return 'var(--amber)';
    if (log.startsWith('[CLIENT]')) return 'var(--blue)';
    if (log.startsWith('[HTTP]')) return 'var(--lavender)';
    if (log.startsWith('[x402]')) return 'var(--amber)';
    if (log.startsWith('[GATEWAY] API Response Error') || log.startsWith('[WARNING]')) return 'var(--red)';
    if (log.startsWith('[GATEWAY]')) return 'var(--text)';
    return 'var(--text-secondary)';
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal playground-modal" style={{ maxWidth: '780px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="terminal-dots"><span className="dot dot-red" /><span className="dot dot-yellow" /><span className="dot dot-green" /></div>
            <h3 className="modal-title" style={{ margin: 0, fontSize: '14px', fontFamily: 'monospace' }}>
              x402_playground_console (simulated): ~/{job.agentName.toLowerCase().replace(/ /g, '_')}
            </h3>
          </div>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="sample-note">Simulated: no AI agent is called and no payment is checked. This console is not connected to the escrow contract.</p>

        <div className="playground-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="form-label" style={{ fontFamily: 'monospace', fontSize: '11px' }}>HTTP ENDPOINT (local gateway demo)</label>
              <div className="mono-box">POST http://{GATEWAY_URL}</div>
            </div>
            <div>
              <label className="form-label" style={{ fontFamily: 'monospace', fontSize: '11px' }}>HEADER: X-Stellar-Payment-Tx (mock reference)</label>
              <div className="mono-box" style={{ color: 'var(--accent)' }}>{MOCK_REFERENCE}</div>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Input Text (AI Task)</label>
              <textarea className="form-input" style={{ minHeight: '100px', fontSize: '13px', resize: 'none' }} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Enter articles or long text to analyze/process..." />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', fontFamily: 'monospace' }} onClick={execute} disabled={loading}>
              {loading ? 'PROCESSING...' : 'EXECUTE TASK (SIMULATED X402)'}
            </button>
          </div>

          <div className="playground-console">
            <div className="console-header">Console Output</div>
            <div className="console-body">
              {logs.length === 0 ? (
                <div className="console-empty">
                  <Zap size={20} className="glow-pulse" style={{ color: 'var(--text-dim)', marginBottom: '8px' }} />
                  <span style={{ fontSize: '11px' }}>Console ready. Click Execute Task to run the simulation.</span>
                </div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} style={{ color: colorFor(log), marginBottom: '6px', fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{log}</div>
                ))
              )}
              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', marginTop: '8px', fontFamily: 'monospace', fontSize: '11px' }}>
                  <span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '1.5px', margin: 0 }} />
                  <span>Waiting for API response...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
