import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, AlertCircle, X, ChevronDown, ArrowLeft, Users, Menu } from 'lucide-react';
import { CONFIG, CONFIG_ERROR, explorerAccountUrl, explorerContractUrl } from './chain/config';
import { connectFreighter } from './chain/wallet';
import { fetchAgents, fetchJobCount } from './chain/rpc';
import { friendlyError } from './chain/errors';
import { REVIEW_WINDOW_SECS, HOUR_SECS } from './chain/jobs';
import { stroopsToXlm } from './chain/units';
import { presentAgent, shortAddress } from './agents';
import AgeroLogo from './components/AgeroLogo';
import { Stars, SampleBadge, CategoryChip, ContractMark, ListSourceNote, ExplorerLink, EmptyState, ErrorState, SkeletonCards, StatCard } from './components/ui';
import AgentCard from './components/AgentCard';
import AddressGlyph from './components/AddressGlyph';
import ContractPulse from './components/ContractPulse';
import EscrowTimeline from './components/EscrowTimeline';
import StatusFlow from './components/StatusFlow';
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
];
// The Developer page was merged into the Agent dashboard (phase 4c)
const PAGE_ALIASES = { developer: 'agent' };
const REVIEW_HOURS = REVIEW_WINDOW_SECS / HOUR_SECS;

// Loading / error / empty states for anything that lists registry agents
function RegistryState({ registry, onRetry, children }) {
  if (registry.status === 'loading') return <SkeletonCards count={3} />;
  if (registry.status === 'error') return <ErrorState message={registry.error} onRetry={onRetry} />;
  if (registry.agents.length === 0) {
    return <EmptyState icon={Users}>No agents are registered on the contract yet.</EmptyState>;
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
  const [menuOpen, setMenuOpen] = useState(false);
  const walletRef = useRef(null);
  const menuBtnRef = useRef(null);
  const walletBtnRef = useRef(null);

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

  // Escape closes the nav menu / wallet dropdown and returns focus to its button
  useEffect(() => {
    if (!menuOpen && !walletOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (walletOpen) { setWalletOpen(false); walletBtnRef.current?.focus(); }
      else { setMenuOpen(false); menuBtnRef.current?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen, walletOpen]);

  const agentsByOwner = useMemo(() => new Map(registry.agents.map((a) => [a.owner, a])), [registry.agents]);
  const detailAgent = detailOwner ? agentsByOwner.get(detailOwner) : null;
  const categories = useMemo(() => ['All', ...new Set(registry.agents.map((a) => a.category))], [registry.agents]);
  const filtered = selectedCategory === 'All' ? registry.agents : registry.agents.filter((a) => a.category === selectedCategory);
  const featured = registry.agents.slice(0, 3);
  // Keep the last numbers on screen while refreshing
  const hasRegistry = registry.status === 'ready' || registry.status === 'refreshing';

  // Success toasts close themselves; errors stay until dismissed
  const notify = (message, type = 'success') => {
    setNotification({ message, type });
    if (type !== 'error') setTimeout(() => setNotification((n) => (n?.message === message ? null : n)), 3500);
  };

  const go = (page) => { setActivePage(PAGE_ALIASES[page] ?? page); setDetailOwner(null); setMenuOpen(false); };
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
      <div className="app-root">
        {notification && (
          <div className={`notif ${notification.type === 'error' ? 'notif-error' : 'notif-success'}`} role={notification.type === 'error' ? 'alert' : 'status'}>
            {notification.type === 'error' ? <AlertCircle size={16} aria-hidden="true" /> : <CheckCircle size={16} aria-hidden="true" />}
            <span>{notification.message}</span>
            {notification.type === 'error' && <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => setNotification(null)}><X size={16} aria-hidden="true" /></button>}
          </div>
        )}

        {/* ── Prototype banner: what is real and what is simulated ── */}
        {CONFIG_ERROR && (
          <div className="sim-banner" role="alert"><div className="container sim-banner-inner"><AlertCircle size={16} aria-hidden="true" /><span>Configuration error: {CONFIG_ERROR}</span></div></div>
        )}
        {showBanner && (
          <div className="sim-banner" role="status">
            <div className="container sim-banner-inner">
              <AlertCircle size={16} aria-hidden="true" />
              <span>
                Testnet prototype. <strong>Tested by hand with Freighter (2026-11-01):</strong> register and update an agent, create, deliver, approve and rate a job.{' '}
                <strong>Implemented, not yet tested by hand:</strong> refunds (client and agent) and release after the review window.{' '}
                <strong>Outside Agero:</strong> the agents' work; only a hash of each result is recorded. <strong>Simulated:</strong> the x402 payment playground.
              </span>
              <button className="icon-btn sim-banner-close" aria-label="Dismiss notice" onClick={() => setShowBanner(false)}><X size={16} aria-hidden="true" /></button>
            </div>
          </div>
        )}

        {/* ── Navbar ── */}
        <nav className="navbar">
          <div className="container navbar-inner">
            <button type="button" className="nav-logo" aria-label="Agero home" onClick={() => go('home')}>
              <AgeroLogo />
              <span>Agero</span>
            </button>

            {/* Below 900 px the links collapse behind this button (see .nav-menu-btn) */}
            <button
              type="button"
              className="nav-menu-btn"
              ref={menuBtnRef}
              aria-expanded={menuOpen}
              aria-controls="nav-links"
              aria-label="Menu"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            <div id="nav-links" className={`nav-links ${menuOpen ? 'open' : ''}`}>
              {PAGES.map((p) => {
                const current = activePage === p.id && !detailAgent;
                return <button key={p.id} className={`nav-link ${current ? 'active' : ''}`} aria-current={current ? 'page' : undefined} onClick={() => go(p.id)}>{p.label}</button>;
              })}
            </div>

            <div className="wallet-wrapper" ref={walletRef}>
              <button ref={walletBtnRef} className={`wallet-btn ${wallet ? 'connected' : ''}`} aria-expanded={walletOpen} aria-controls="wallet-dropdown" onClick={() => setWalletOpen(!walletOpen)}>
                {wallet ? (<><span className="wallet-dot" aria-hidden="true" />{shortAddress(wallet)}</>) : 'Connect Freighter'}
                <ChevronDown size={14} aria-hidden="true" className={`wallet-chevron ${walletOpen ? 'open' : ''}`} />
              </button>
              {walletOpen && (
                <div className="wallet-dropdown" id="wallet-dropdown">
                  <div className="dropdown-label">Freighter · Stellar Testnet</div>
                  {wallet ? (
                    <>
                      <div className="dropdown-label">Address</div>
                      <div className="dropdown-addr">{wallet}</div>
                      <div className="dropdown-note"><ExplorerLink href={explorerAccountUrl(wallet)}>View account</ExplorerLink> · Transactions are signed in Freighter and sent to Testnet.</div>
                      <button className="dropdown-action dropdown-disconnect" onClick={handleDisconnect}>Disconnect</button>
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
                <ArrowLeft size={16} aria-hidden="true" /> Back to Marketplace
              </button>

              {!detailAgent ? (
                <RegistryState registry={registry} onRetry={loadRegistry}>
                  <EmptyState>This agent is not in the registry.</EmptyState>
                </RegistryState>
              ) : (
                <div className="detail-layout">
                  <section className="card card-pad detail-main">
                    <div className="detail-title">
                      <AddressGlyph address={detailAgent.owner} size={56} />
                      <div>
                        <h1 className="detail-name">{detailAgent.name}</h1>
                        <div className="detail-meta">
                          {detailAgent.isSample && <SampleBadge />}
                          <CategoryChip category={detailAgent.category} />
                        </div>
                      </div>
                    </div>
                    <p className="detail-desc">{detailAgent.summary}</p>
                    {detailAgent.isSample && (
                      <p className="sample-note">Sample agent registered by the project's seed script. Its endpoint is a placeholder with no service behind it, and no AI work is performed. The description is illustrative text kept in this frontend; the contract still stores the original seed text. Price, rating and job count are read from the contract.</p>
                    )}

                    <div className="stat-row stat-row-4">
                      <StatCard label="Price" value={stroopsToXlm(detailAgent.price)} unit="XLM" mark={<ContractMark />} />
                      <StatCard label="Completed jobs" value={detailAgent.totalJobs} mark={<ContractMark />} />
                      <StatCard label="Ratings" value={detailAgent.ratingCount} mark={<ContractMark />} />
                      <StatCard label="Review window" value={REVIEW_HOURS} unit="h" mark={<ContractMark />} />
                    </div>

                    <div className="field-caption">API endpoint (stored in the contract; not called by this UI)</div>
                    {detailAgent.endpoint ? <div className="mono-box">{detailAgent.endpoint}</div> : <p className="value-unset">Not set</p>}

                    <div className="detail-footer">
                      <span className="detail-owner">Owner: <ExplorerLink href={explorerAccountUrl(detailAgent.owner)}>{detailAgent.owner}</ExplorerLink></span>
                      <button className="btn btn-primary" onClick={() => setShowHire(true)} disabled={wallet === detailAgent.owner} title={wallet === detailAgent.owner ? 'You cannot hire your own agent' : undefined}>Hire agent</button>
                    </div>
                    {wallet === detailAgent.owner && (
                      <p className="form-hint">
                        This is your agent, so hiring is disabled: the contract rejects a job where client and agent are the same address.{' '}
                        <button type="button" className="link-btn" onClick={() => go('agent')}>Open the Agent dashboard</button> to manage it.
                      </p>
                    )}
                  </section>

                  <aside className="card card-pad rating-card">
                    <h2 className="card-heading">Rating</h2>
                    <Stars average={detailAgent.averageRating} count={detailAgent.ratingCount} size={18} />
                    <p className="card-lead">
                      Read from the contract. Each rating is 1–5 stars, one per completed job, signed by that job's client. The contract stores only the total and the count, so there are no written reviews.
                    </p>
                  </aside>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* ═══ HOME ═══ */}
              {activePage === 'home' && (
                <div className="page-view">
                  <section className="home-hero">
                    <div className="hero-content">
                      <h1 className="hero-title">Escrow for agent jobs on Stellar Testnet</h1>
                      <p className="hero-desc">
                        Lock Testnet XLM in a Soroban contract with a deadline you choose. The agent records a SHA-256 of the result; you approve within {REVIEW_HOURS} h or the payment can be released.
                        Nothing delivered in time? You refund. Agero does not run the agents: their owners do the work outside the app.
                      </p>
                      <div className="btn-row">
                        <button className="btn btn-primary btn-lg" onClick={() => go('marketplace')}>Explore marketplace</button>
                        <button className="btn btn-outline btn-lg" onClick={() => go('jobs')}>My Jobs</button>
                      </div>
                      <ContractPulse />
                    </div>
                    <EscrowTimeline />
                  </section>

                  <section className="home-section">
                    <h2 className="section-title">Registered agents</h2>
                    <p className="section-desc">Read from the Agero contract on Stellar Testnet when the page loads.</p>
                    <RegistryState registry={registry} onRetry={loadRegistry}>
                      <ListSourceNote />
                      <div className="agent-grid">
                        {featured.map((agent) => <AgentCard key={agent.owner} agent={agent} onOpen={() => openAgent(agent.owner)} />)}
                      </div>
                    </RegistryState>
                  </section>

                  <section className="home-section">
                    <h2 className="section-title">How it works</h2>
                    <p className="section-desc">Every status change is a contract call on Stellar Testnet. The work itself happens outside Agero; the sample agents perform no work at all.</p>
                    <StatusFlow />
                  </section>
                </div>
              )}

              {/* ═══ MARKETPLACE ═══ */}
              {activePage === 'marketplace' && (
                <div className="page-view">
                  <header className="section-header">
                    <h1 className="page-title">Marketplace</h1>
                    <p className="section-desc">Agents, prices, ratings and job counts are read from the Agero contract on Stellar Testnet. Listings marked Sample were registered by the project's seed script: their endpoints are placeholders and no AI work is performed.</p>
                  </header>

                  <div className="stat-row">
                    <StatCard label="Registered agents" value={hasRegistry ? registry.agents.length : '—'} mark={<ContractMark />} />
                    <StatCard label="Jobs created (all clients)" value={hasRegistry ? String(registry.jobCount) : '—'} mark={<ContractMark />} />
                    <StatCard label="Contract" value={<ExplorerLink href={explorerContractUrl()}>{shortAddress(CONFIG.contractId)}</ExplorerLink>} />
                  </div>

                  <RegistryState registry={registry} onRetry={loadRegistry}>
                    <div className="filter-row" role="group" aria-label="Filter by category (set in this frontend)">
                      {categories.map((c) => (
                        <button key={c} className={`filter-pill ${selectedCategory === c ? 'active' : ''}`} aria-pressed={selectedCategory === c} onClick={() => setSelectedCategory(c)}>{c}</button>
                      ))}
                    </div>
                    <ListSourceNote />
                    <div className="agent-grid">
                      {filtered.map((agent) => <AgentCard key={agent.owner} agent={agent} onOpen={() => openAgent(agent.owner)} />)}
                    </div>
                  </RegistryState>
                </div>
              )}

              {/* ═══ MY JOBS ═══ */}
              {activePage === 'jobs' && (
                <div className="page-view">
                  <header className="section-header">
                    <h1 className="page-title">My Jobs</h1>
                    <p className="section-desc">Escrow jobs where the connected wallet is the client, read from the contract on Stellar Testnet. Buttons appear only when the contract would accept the action.</p>
                  </header>
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
                  <header className="section-header">
                    <h1 className="page-title">Agent Dashboard</h1>
                    <p className="section-desc">For agent owners: register or edit your agent, see jobs hired from it, record deliveries, release payments after the review window, or refund a client. Every action is a contract call on Stellar Testnet signed in Freighter.</p>
                  </header>
                  <AgentDashboard wallet={wallet} runTx={runTx} onConnect={handleConnect} onChanged={loadRegistry} onBrowse={() => go('marketplace')} />
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
  );
}
