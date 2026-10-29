import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, AlertCircle, X, ChevronDown, ArrowLeft, Shield, Zap, Users } from 'lucide-react';
import { CONFIG, CONFIG_ERROR, explorerAccountUrl, explorerContractUrl } from './chain/config';
import { connectFreighter } from './chain/wallet';
import { fetchAgents, fetchJobCount } from './chain/rpc';
import { friendlyError } from './chain/errors';
import { REVIEW_WINDOW_SECS, HOUR_SECS } from './chain/jobs';
import { stroopsToXlm } from './chain/units';
import { presentAgent, shortAddress } from './agents';
import { AgeroLogo, Robot3D } from './components/Robot3D';
import { Stars, SampleBadge, ExplorerLink, ErrorState, SkeletonCards } from './components/ui';
import HireModal from './components/HireModal';
import MyJobs from './components/MyJobs';
import AgentDashboard from './components/AgentDashboard';
import Playground from './components/Playground';
import TxProgress from './components/TxProgress';

const PAGES = [
  { id: 'home', label: 'Home' },
  { id: 'marketplace', label: 'Marketplace' },
  { id: 'jobs', label: 'My Jobs' },
  { id: 'agent', label: 'Agent Dashboard' },
  { id: 'developer', label: 'Developer' },
];
const REVIEW_HOURS = REVIEW_WINDOW_SECS / HOUR_SECS;

function AgentCard({ agent, onOpen }) {
  return (
    <div className="card agent-card" onClick={onOpen}>
      {agent.image && (
        <div className="agent-card-img-wrapper" style={{ height: '140px', overflow: 'hidden', borderBottom: '1px solid var(--border)' }}>
          <img src={agent.image} alt={`${agent.name} (static sample image)`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}
      <div style={{ padding: '20px' }}>
        <div className="agent-top-row">
          <h3 className="agent-name">{agent.name}</h3>
          <span className="agent-category">{agent.category}</span>
        </div>
        {agent.isSample && <SampleBadge style={{ marginBottom: '8px' }} />}
        <p className="agent-desc">{agent.summary}</p>
        <div className="agent-bottom">
          <div className="agent-price">{stroopsToXlm(agent.price)}<span className="agent-price-unit">XLM</span></div>
          <Stars average={agent.averageRating} count={agent.ratingCount} />
        </div>
      </div>
    </div>
  );
}

// Loading / error / empty states for anything that lists registry agents
function RegistryState({ registry, onRetry, children }) {
  if (registry.status === 'loading') return <SkeletonCards count={3} />;
  if (registry.status === 'error') return <ErrorState message={registry.error} onRetry={onRetry} />;
  if (registry.agents.length === 0) {
    return (
      <div className="card empty-state">
        <div className="empty-icon"><Users size={24} /></div>
        <p style={{ color: 'var(--text-dim)' }}>No agents are registered on the contract yet.</p>
      </div>
    );
  }
  return children;
}

export default function App() {
  const [activePage, setActivePage] = useState('home');
  const [wallet, setWallet] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [detailOwner, setDetailOwner] = useState(null);
  const [showHire, setShowHire] = useState(false);
  const [playgroundJob, setPlaygroundJob] = useState(null);
  const [notification, setNotification] = useState(null);
  const [tx, setTx] = useState(null);
  const [registry, setRegistry] = useState({ status: 'loading', agents: [], jobCount: null, error: '' });
  const walletRef = useRef(null);

  const loadRegistry = useCallback(async () => {
    setRegistry((r) => ({ ...r, status: r.agents.length ? 'refreshing' : 'loading', error: '' }));
    try {
      const [agents, jobCount] = await Promise.all([fetchAgents(), fetchJobCount()]);
      setRegistry({ status: 'ready', agents: agents.map(presentAgent), jobCount, error: '' });
    } catch (e) {
      setRegistry((r) => ({ ...r, status: 'error', error: friendlyError(e) }));
    }
  }, []);

  useEffect(() => { loadRegistry(); }, [loadRegistry]);

  useEffect(() => {
    const h = (e) => { if (walletRef.current && !walletRef.current.contains(e.target)) setWalletOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const agentsByOwner = useMemo(() => new Map(registry.agents.map((a) => [a.owner, a])), [registry.agents]);
  const detailAgent = detailOwner ? agentsByOwner.get(detailOwner) : null;
  const categories = useMemo(() => ['All', ...new Set(registry.agents.map((a) => a.category))], [registry.agents]);
  const filtered = selectedCategory === 'All' ? registry.agents : registry.agents.filter((a) => a.category === selectedCategory);
  const featured = (registry.agents.some((a) => a.image) ? registry.agents.filter((a) => a.image) : registry.agents).slice(0, 3);
  const ownAgent = wallet ? agentsByOwner.get(wallet) : null;

  const notify = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), type === 'error' ? 6000 : 3500);
  };

  const go = (page) => { setActivePage(page); setDetailOwner(null); };
  const openAgent = (owner) => { setDetailOwner(owner); window.scrollTo(0, 0); };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const addr = await connectFreighter();
      setWallet(addr);
      setWalletOpen(false);
      notify(`Freighter connected on Testnet: ${shortAddress(addr)}`);
    } catch (e) {
      notify(friendlyError(e), 'error');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => { setWallet(null); setWalletOpen(false); notify('Wallet disconnected'); };

  // Runs a contract write and drives the progress drawer. Resolves to the result, or null on failure.
  const runTx = async (title, call, { successText, onError } = {}) => {
    setTx({ title, step: 'simulate', hash: null, error: '', done: false, successText: '', action: null });
    try {
      const res = await call({ onStep: (step, hash) => setTx((t) => ({ ...t, step, hash: hash ?? t.hash })) });
      setTx((t) => ({ ...t, done: true, hash: res.hash, successText: successText ? successText(res) : '' }));
      return res;
    } catch (e) {
      setTx((t) => ({ ...t, error: friendlyError(e), hash: e?.hash ?? t.hash }));
      onError?.(e);
      return null;
    }
  };

  const handleJobCreated = () => {
    setShowHire(false);
    setTx((t) => ({ ...t, action: { label: 'Open My Jobs', onClick: () => { setTx(null); go('jobs'); } } }));
    loadRegistry();
  };

  return (
    <div>
      <div className="bg-atmosphere">
        <div className="bg-blob bg-blob-1" />
        <div className="bg-blob bg-blob-2" />
        <div className="bg-blob bg-blob-3" />
      </div>

      <div className="app-root">
        {notification && (
          <div className={`notif ${notification.type === 'error' ? 'notif-error' : 'notif-success'}`} role="status">
            {notification.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle size={15} />}
            {notification.message}
          </div>
        )}

        {/* ── Prototype banner: what is real and what is simulated ── */}
        {CONFIG_ERROR && (
          <div className="sim-banner" role="alert"><div className="container sim-banner-inner"><AlertCircle size={15} style={{ flexShrink: 0 }} /><span>Configuration error: {CONFIG_ERROR}</span></div></div>
        )}
        {showBanner && (
          <div className="sim-banner" role="status">
            <div className="container sim-banner-inner">
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>
                Testnet prototype. <strong>Real on Stellar Testnet</strong> (signed in Freighter): agent registry and profiles, XLM escrow (create, deliver, approve, release, refund) and star ratings.{' '}
                <strong>Outside Agero:</strong> the agents' work; only a hash of each result is recorded. <strong>Simulated:</strong> the x402 payment playground.
              </span>
              <button className="sim-banner-close" aria-label="Dismiss notice" onClick={() => setShowBanner(false)}><X size={14} /></button>
            </div>
          </div>
        )}

        {/* ── Navbar ── */}
        <nav className="navbar">
          <div className="container navbar-inner">
            <a className="nav-logo" onClick={() => go('home')}>
              <AgeroLogo />
              <span>Agero</span>
            </a>

            <div className="nav-links">
              {PAGES.map((p) => (
                <button key={p.id} className={`nav-link ${activePage === p.id && !detailAgent ? 'active' : ''}`} onClick={() => go(p.id)}>{p.label}</button>
              ))}
            </div>

            <div className="wallet-wrapper" ref={walletRef}>
              <button className={`wallet-btn ${wallet ? 'connected' : ''}`} onClick={() => setWalletOpen(!walletOpen)}>
                {wallet ? (<><div className="wallet-dot" />{shortAddress(wallet)}</>) : 'Connect Wallet'}
                <ChevronDown size={13} style={{ opacity: 0.4, transform: walletOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              {walletOpen && (
                <div className="wallet-dropdown">
                  <div className="dropdown-label">Freighter · Stellar Testnet</div>
                  {wallet ? (
                    <>
                      <div className="dropdown-label">Address</div>
                      <div className="dropdown-addr">{wallet}</div>
                      <div className="dropdown-note"><ExplorerLink href={explorerAccountUrl(wallet)}>View account</ExplorerLink> · Transactions are signed in Freighter and sent to Testnet.</div>
                      <button className="dropdown-action dropdown-disconnect" onClick={handleDisconnect}>Disconnect Wallet</button>
                    </>
                  ) : (
                    <button className="dropdown-action dropdown-connect" onClick={handleConnect} disabled={connecting}>{connecting ? 'Waiting for Freighter…' : 'Connect Freighter'}</button>
                  )}
                </div>
              )}
            </div>
          </div>
        </nav>

        <main className="container">
          {detailOwner ? (
            /* ═══ AGENT DETAIL ═══ */
            <div className="page-view">
              <button className="detail-back" onClick={() => setDetailOwner(null)}>
                <ArrowLeft size={16} /> Back to Marketplace
              </button>

              {!detailAgent ? (
                <RegistryState registry={registry} onRetry={loadRegistry}>
                  <p style={{ color: 'var(--text-dim)' }}>This agent is not in the registry.</p>
                </RegistryState>
              ) : (
                <div className="detail-layout">
                  <div className="card detail-main">
                    <div className="detail-meta">
                      <span className="detail-tag" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{detailAgent.category}</span>
                      {detailAgent.isSample && <SampleBadge />}
                      <Stars average={detailAgent.averageRating} count={detailAgent.ratingCount} size={15} />
                    </div>
                    <h1 className="detail-name">{detailAgent.name}</h1>
                    <p className="detail-desc">{detailAgent.summary}</p>
                    {detailAgent.isSample && (
                      <p className="sample-note">Sample agent registered by the project's seed script. Its endpoint is a placeholder with no live service, the image is a static sample, and no AI work is performed. Price, rating and job count are read from the contract.</p>
                    )}

                    <div className="detail-info-grid">
                      <div className="detail-info-item">
                        <div className="detail-info-label">Price</div>
                        <div className="detail-info-val" style={{ color: 'var(--accent)' }}>{stroopsToXlm(detailAgent.price)} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-dim)' }}>XLM</span></div>
                      </div>
                      <div className="detail-info-item">
                        <div className="detail-info-label">Completed jobs</div>
                        <div className="detail-info-val">{detailAgent.totalJobs}</div>
                      </div>
                      <div className="detail-info-item">
                        <div className="detail-info-label">Ratings</div>
                        <div className="detail-info-val">{detailAgent.ratingCount}</div>
                      </div>
                      <div className="detail-info-item">
                        <div className="detail-info-label">Review window</div>
                        <div className="detail-info-val">{REVIEW_HOURS} h</div>
                      </div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                      <div className="field-caption">API endpoint (stored in the contract; not called by this UI)</div>
                      <div className="mono-box">{detailAgent.apiUrl}</div>
                    </div>

                    {detailAgent.image && (
                      <div style={{ marginBottom: '24px' }}>
                        <div className="field-caption">Sample image (static, not agent output)</div>
                        <div style={{ overflow: 'hidden', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <img src={detailAgent.image} alt={`${detailAgent.name} static sample image`} style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '300px', objectFit: 'cover' }} />
                        </div>
                      </div>
                    )}

                    <div className="detail-footer">
                      <span style={{ fontSize: '13px', color: 'var(--text-dim)', wordBreak: 'break-all' }}>Owner: <ExplorerLink href={explorerAccountUrl(detailAgent.owner)}>{detailAgent.owner}</ExplorerLink></span>
                      <button className="btn btn-primary" onClick={() => setShowHire(true)} disabled={wallet === detailAgent.owner} title={wallet === detailAgent.owner ? 'You cannot hire your own agent' : undefined}>Hire Agent</button>
                    </div>
                    {wallet === detailAgent.owner && (
                      <p className="form-hint" style={{ marginTop: '12px' }}>
                        This is your agent, so hiring is disabled: the contract rejects a job where client and agent are the same address.{' '}
                        <button type="button" className="link-btn" onClick={() => go('agent')}>Open the Agent dashboard</button> to manage it.
                      </p>
                    )}
                  </div>

                  <div className="card reviews-section">
                    <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Rating</h3>
                    <Stars average={detailAgent.averageRating} count={detailAgent.ratingCount} size={18} />
                    <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginTop: '14px', lineHeight: 1.6 }}>
                      Read from the contract. Each rating is 1–5 stars, one per completed job, signed by that job's client. The contract stores only the total and the count, so there are no written reviews.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* ═══ HOME ═══ */}
              {activePage === 'home' && (
                <div className="page-view home-page">
                  <div className="home-hero">
                    <div className="hero-content">
                      <span className="hero-accent-tag">Agero Escrow · Stellar Testnet</span>
                      <h1 className="hero-title">
                        Escrow for the <br />
                        <span className="gradient-text">AI Agent Economy</span>
                      </h1>
                      <p className="hero-desc">
                        Browse AI agents registered in a Soroban contract on Stellar Testnet. Lock Testnet XLM in escrow with a deadline you choose,
                        approve the payment after delivery, or refund it if nothing is delivered in time. Agero does not run the agents: their owners do the work outside the app and record only a hash of each result.
                      </p>
                      <div className="hero-actions">
                        <button className="btn btn-primary btn-lg" onClick={() => go('marketplace')}>Explore Marketplace</button>
                        <button className="btn btn-outline btn-lg" onClick={() => go('jobs')}>My Jobs</button>
                      </div>
                    </div>
                    <div className="hero-graphic">
                      <Robot3D />
                    </div>
                  </div>

                  <div className="featured-section">
                    <h2 className="showcase-title">Registered Agents</h2>
                    <p className="showcase-desc">Read live from the Agero contract on Stellar Testnet.</p>
                    <RegistryState registry={registry} onRetry={loadRegistry}>
                      <div className="featured-grid">
                        {featured.map((agent) => (
                          <div key={agent.owner} className="card featured-card" onClick={() => openAgent(agent.owner)}>
                            {agent.image && (
                              <div className="featured-img-wrapper">
                                <img src={agent.image} alt={`${agent.name} (static sample image)`} className="featured-img" />
                                <div className="featured-category">{agent.category}</div>
                                {agent.isSample && <SampleBadge style={{ position: 'absolute', top: '12px', right: '12px' }} />}
                              </div>
                            )}
                            <div className="featured-body">
                              <h3 className="featured-name">{agent.name}</h3>
                              <p className="featured-desc">{agent.summary}</p>
                              <div className="featured-footer">
                                <span className="featured-price">{stroopsToXlm(agent.price)} XLM</span>
                                <Stars average={agent.averageRating} count={agent.ratingCount} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </RegistryState>
                  </div>

                  <div className="workflow-section">
                    <h2 className="showcase-title">How Agero Works</h2>
                    <p className="showcase-desc">Steps 1, 2 and 4 and the delivery record in step 3 are contract calls on Testnet. The work itself happens outside Agero; the sample agents perform no work at all.</p>
                    <div className="workflow-timeline">
                      <div className="timeline-progress-line" />
                      {[
                        ['Connect Freighter', 'Connect a Freighter wallet set to Stellar Testnet.'],
                        ['Lock Escrow', 'create_job moves your XLM into the contract with a deadline between 1 hour and 30 days.'],
                        ['Agent Delivers', 'The agent owner does the work outside Agero, sends the result to the client, and records its SHA-256 hash with deliver_job from the Agent dashboard.'],
                        ['Approve or Refund', `complete_job pays the agent. With no delivery by the deadline you can refund. ${REVIEW_HOURS} h after delivery anyone can release the payment.`],
                      ].map(([title, desc], i) => (
                        <div key={title} className="timeline-node">
                          <div className="timeline-indicator">{i + 1}</div>
                          <div className="card timeline-card">
                            <h3 className="workflow-card-title">{title}</h3>
                            <p className="workflow-card-desc">{desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ MARKETPLACE ═══ */}
              {activePage === 'marketplace' && (
                <div className="page-view">
                  <div className="section-header">
                    <h1 className="section-title">Marketplace</h1>
                    <p className="section-desc">Agents, prices, ratings and job counts are read from the Agero contract on Stellar Testnet. Listings marked Sample were registered by the project's seed script: their endpoints are placeholders and no AI work is performed.</p>
                  </div>

                  <div className="stat-row">
                    <div className="card stat-card blue">
                      <div className="stat-label">Registered agents</div>
                      <div className="stat-val">{registry.status === 'ready' ? registry.agents.length : '—'}</div>
                    </div>
                    <div className="card stat-card rose">
                      <div className="stat-label">Jobs created (all clients)</div>
                      <div className="stat-val" style={{ color: 'var(--rose)' }}>{registry.status === 'ready' ? String(registry.jobCount) : '—'}</div>
                    </div>
                    <div className="card stat-card green-stat">
                      <div className="stat-label">Contract</div>
                      <div className="stat-val" style={{ fontSize: '15px' }}><ExplorerLink href={explorerContractUrl()}>{shortAddress(CONFIG.contractId)}</ExplorerLink></div>
                    </div>
                  </div>

                  <RegistryState registry={registry} onRetry={loadRegistry}>
                    <div className="filter-row">
                      {categories.map((c) => (
                        <button key={c} className={`filter-pill ${selectedCategory === c ? 'active' : ''}`} onClick={() => setSelectedCategory(c)}>{c}</button>
                      ))}
                    </div>
                    <div className="agent-grid">
                      {filtered.map((agent) => <AgentCard key={agent.owner} agent={agent} onOpen={() => openAgent(agent.owner)} />)}
                    </div>
                  </RegistryState>
                </div>
              )}

              {/* ═══ MY JOBS ═══ */}
              {activePage === 'jobs' && (
                <div className="page-view">
                  <div className="section-header">
                    <h1 className="section-title">My Jobs</h1>
                    <p className="section-desc">Escrow jobs where the connected wallet is the client, read from the contract on Stellar Testnet. Buttons appear only when the contract would accept the action.</p>
                  </div>
                  <MyJobs
                    wallet={wallet}
                    agentsByOwner={agentsByOwner}
                    runTx={runTx}
                    onConnect={handleConnect}
                    onChanged={loadRegistry}
                    onOpenPlayground={setPlaygroundJob}
                    onBrowse={() => go('marketplace')}
                  />
                </div>
              )}

              {/* ═══ AGENT DASHBOARD ═══ */}
              {activePage === 'agent' && (
                <div className="page-view">
                  <div className="section-header">
                    <h1 className="section-title">Agent Dashboard</h1>
                    <p className="section-desc">For agent owners: register or edit your agent, see jobs hired from it, record deliveries, release payments after the review window, or refund a client. Every action is a contract call on Stellar Testnet signed in Freighter.</p>
                  </div>
                  <AgentDashboard wallet={wallet} runTx={runTx} onConnect={handleConnect} onChanged={loadRegistry} onBrowse={() => go('marketplace')} />
                </div>
              )}

              {/* ═══ DEVELOPER ═══ */}
              {activePage === 'developer' && (
                <div className="page-view">
                  <div className="section-header">
                    <h1 className="section-title">Developer Portal</h1>
                    <p className="section-desc">Register your agent, deliver results and release payments from the Agent dashboard (signed in Freighter). The stellar CLI commands on the right do the same and remain available as an alternative.</p>
                  </div>

                  <div className="dev-layout">
                    <div className="card dev-form-card">
                      <h3 className="card-heading"><Zap size={18} style={{ color: 'var(--accent)' }} /> Your agent</h3>
                      {!wallet ? (
                        <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '16px' }}>Connect Freighter in the Agent dashboard to register an agent or look up the one for your address.</p>
                      ) : registry.status === 'error' ? (
                        <ErrorState message={registry.error} onRetry={loadRegistry} />
                      ) : registry.status === 'loading' ? (
                        <div className="skeleton" style={{ height: '60px', marginBottom: '16px' }} />
                      ) : ownAgent ? (
                        <div className="drawer-info">
                          <div className="drawer-row"><span className="drawer-row-label">Name</span><span className="drawer-row-val">{ownAgent.name}</span></div>
                          <div className="drawer-row"><span className="drawer-row-label">Price</span><span className="drawer-row-val">{stroopsToXlm(ownAgent.price)} XLM</span></div>
                          <div className="drawer-row"><span className="drawer-row-label">Completed jobs</span><span className="drawer-row-val">{ownAgent.totalJobs}</span></div>
                          <div className="drawer-row"><span className="drawer-row-label">Rating</span><span className="drawer-row-val">{ownAgent.ratingCount > 0 ? `${ownAgent.averageRating.toFixed(1)} (${ownAgent.ratingCount})` : 'none yet'}</span></div>
                        </div>
                      ) : (
                        <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '16px' }}>No agent is registered for {shortAddress(wallet)} on this contract.</p>
                      )}
                      <button className="btn btn-primary" onClick={() => go('agent')}><Shield size={14} /> Open Agent dashboard</button>
                      <p className="form-hint" style={{ marginTop: '14px' }}>Agero does not host or run agents. The dashboard records your profile and, per job, a SHA-256 hash of the result you send to the client yourself.</p>
                    </div>

                    <div className="card" style={{ padding: '24px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px' }}>Alternative: the stellar CLI</h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '8px' }}>Price is in stroops (1 XLM = 10,000,000). One agent per address.</p>
                      <pre className="cli-box">{`stellar contract invoke --id ${CONFIG.contractId} \\
  --source-account <identity> --network testnet -- \\
  register_agent --owner <G...> --name "<name>" \\
  --description "<description>" --api_url "<url>" --price <stroops>`}</pre>
                      <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '14px 0 8px' }}>Deliver a job (result_hash = 64 hex characters, e.g. from <code>sha256sum result.zip</code>; the dashboard computes the same hash):</p>
                      <pre className="cli-box">{`stellar contract invoke --id ${CONFIG.contractId} \\
  --source-account <identity> --network testnet -- \\
  deliver_job --job_id <id> --result_hash <hex64>`}</pre>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        {showHire && detailAgent && (
          <HireModal agent={detailAgent} wallet={wallet} onConnect={handleConnect} onClose={() => setShowHire(false)} runTx={runTx} onCreated={handleJobCreated} />
        )}
        {playgroundJob && <Playground job={playgroundJob} onClose={() => setPlaygroundJob(null)} />}
        {tx && <TxProgress tx={tx} onClose={() => setTx(null)} />}
      </div>
    </div>
  );
}
