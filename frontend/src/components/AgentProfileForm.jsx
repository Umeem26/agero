import { useState } from 'react';
import { registerAgent, updateAgent } from '../chain/rpc';
import { friendlyError } from '../chain/errors';
import { API_URL_MAX, DESCRIPTION_MAX, NAME_MAX, parseAgentInput } from '../chain/profile';
import { stroopsToXlm } from '../chain/units';

// register_agent (no agent yet) or update_agent (agent exists), signed in Freighter
export default function AgentProfileForm({ mode, wallet, agent, runTx, onSaved, onAlreadyRegistered, onCancel }) {
  const isUpdate = mode === 'update';
  const [form, setForm] = useState(() => ({
    name: agent?.name ?? '',
    description: agent?.description ?? '',
    apiUrl: agent?.apiUrl ?? '',
    priceXlm: agent ? stroopsToXlm(agent.price) : '',
  }));
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    let profile;
    try {
      profile = { owner: wallet, ...parseAgentInput(form) };
    } catch (err) {
      return setError(friendlyError(err));
    }
    const call = isUpdate ? updateAgent : registerAgent;
    const res = await runTx(isUpdate ? 'Update agent profile (update_agent)' : 'Register agent (register_agent)', (opts) => call(profile, opts), {
      successText: () => `${profile.name} ${isUpdate ? 'updated' : 'registered'} at ${stroopsToXlm(profile.price)} XLM per job.`,
      // AlreadyRegistered: the wallet has an agent the dashboard did not see yet; reload shows the update form
      onError: (err) => { if (!isUpdate && err?.kind === 'contract' && err.code === 3) onAlreadyRegistered?.(); },
    });
    if (res) onSaved();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label" htmlFor="agent-name">Name</label>
        <input id="agent-name" className="form-input" value={form.name} onChange={set('name')} maxLength={NAME_MAX} required />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="agent-desc">Description</label>
        <textarea id="agent-desc" className="form-input" rows={3} value={form.description} onChange={set('description')} maxLength={DESCRIPTION_MAX} placeholder="What your agent does and how you deliver results" />
        <div className="form-hint">{form.description.length}/{DESCRIPTION_MAX}</div>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="agent-url">API URL (optional)</label>
        <input id="agent-url" className="form-input" value={form.apiUrl} onChange={set('apiUrl')} maxLength={API_URL_MAX} placeholder="https://your-agent.example.com/api (optional)" inputMode="url" />
        <div className="form-hint">Stored in the contract as a public label for clients. Agero never calls this URL and does not check that a service runs there.</div>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="agent-price">Price per job (XLM)</label>
        <input id="agent-price" className="form-input" inputMode="decimal" value={form.priceXlm} onChange={set('priceXlm')} placeholder="e.g. 25" required />
        <div className="form-hint">Must be greater than 0. Clients lock at least this amount in escrow.{isUpdate && ' A new price applies to new jobs only.'}</div>
      </div>
      <p className="form-hint" style={{ marginBottom: '14px' }}>Everything in this profile is public on Stellar Testnet. One agent per wallet address; agents cannot be deleted.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{isUpdate ? 'Sign update in Freighter' : 'Sign registration in Freighter'}</button>
        {onCancel && <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
