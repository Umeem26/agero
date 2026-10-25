import React, { useState, useEffect, useRef } from 'react';
import { Star, CheckCircle, AlertCircle, X, ChevronDown, ArrowLeft, ExternalLink, Shield, Zap, Clock } from 'lucide-react';
import { connectWallet } from './utils/wallet';

/* ── Data ── */
/* ── Data ── */
const MOCK_REVIEWS = {
  'Summarizer Bot': [
    { user: 'alice_dev.xlm', date: '10 Jul 2026', text: 'Highly accurate and fast. Even a 20-page document is summarized in seconds.', stars: 5 },
    { user: 'reza.agent', date: '8 Jul 2026', text: 'Great output, but sometimes misses context on the final paragraph. Still worth it.', stars: 4 },
    { user: 'dwi_pm', date: '5 Jul 2026', text: 'Extremely helpful for summarizing meeting notes. Saved us hours of manual work.', stars: 5 },
  ],
  'Image Generator Pro': [
    { user: 'studio_creative', date: '11 Jul 2026', text: 'Amazing image quality. Used it for client Instagram assets and it looks top tier.', stars: 5 },
    { user: 'maya_design', date: '9 Jul 2026', text: 'Prompt understanding is excellent. Fast and consistent generation.', stars: 5 },
    { user: 'john_marketer', date: '6 Jul 2026', text: 'Good output quality. Recommended for branding and marketing materials.', stars: 4 },
  ],
  'Translation Bot XL': [
    { user: 'travel_glob.xlm', date: '7 Jul 2026', text: 'Very natural translations, especially with local Southeast Asian slangs. Love it.', stars: 5 },
    { user: 'nomad_writer', date: '4 Jul 2026', text: 'Good for formal translations. Casual tone can feel a bit rigid but understandable.', stars: 4 },
  ],
  'Code Auditor AI': [
    { user: 'sec_team.xlm', date: '12 Jul 2026', text: 'Found 3 critical vulnerabilities in our smart contracts that we missed in manual review. Excellent!', stars: 5 },
    { user: 'blockchain_dev', date: '10 Jul 2026', text: 'Very detailed and actionable audit report. Worth every cent.', stars: 5 },
  ],
  'Data Analyst Bot': [
    { user: 'startup_cfo', date: '9 Jul 2026', text: 'Processed a 50k-row CSV in under 10 seconds. The generated charts are highly clear.', stars: 5 },
  ],
  'Voice Cloner AI': [
    { user: 'podcast_host', date: '11 Jul 2026', text: 'Incredible voice cloning quality. Perfect for multi-language podcast dubbing.', stars: 5 },
    { user: 'content_studio', date: '8 Jul 2026', text: 'Needs clean audio samples for optimal results, but output sounds fully human.', stars: 4 },
  ],
  'Music Composer AI': [
    { user: 'indie_dev.xlm', date: '12 Jul 2026', text: 'Created a perfect retro synth soundtrack for my game in just a few minutes.', stars: 5 },
  ],
  'SEO Optimizer Bot': [
    { user: 'growth_hack', date: '10 Jul 2026', text: 'Helped our blog posts rank on page 1 within two weeks. Excellent keywords suggestion.', stars: 5 },
  ],
  'Chatbot Assistant': [
    { user: 'ecom_shop', date: '8 Jul 2026', text: 'Handles 80% of our customer queries automatically. Integrates seamlessly.', stars: 5 },
  ],
  'Sentiment Analyst': [
    { user: 'brand_manager', date: '11 Jul 2026', text: 'Perfect for tracking Twitter mentions. Real-time dashboards are accurate.', stars: 4 },
  ],
  'Video Generator AI': [
    { user: 'tube_creator', date: '12 Jul 2026', text: 'Created beautiful short videos from my scripts. Saved a lot of time on B-roll.', stars: 5 },
  ]
};

const INITIAL_AGENTS = [
  {
    owner: 'GBBB5678...AGENT1', name: 'Summarizer Bot',
    description: 'AI agent to instantly summarize long documents, research articles, and PDFs. Supports files up to 100 pages with structured bullet-point output.',
    api_url: 'localhost:3000/api/summarize', price: 100, rating_sum: 28, rating_count: 6, total_jobs: 14, category: 'Text AI',
    features: ['Multi-language support', 'PDF & DOCX input', 'Structured output', 'Batch processing'],
    created: '15 Jun 2026', response_time: '~2s', image: '/agent_summarizer.png'
  },
  {
    owner: 'GBAA1234...AGENT2', name: 'Image Generator Pro',
    description: 'AI image generator for creative media assets, graphic illustrations, and marketing layouts. Supports various artistic styles and resolutions up to 4K.',
    api_url: 'api.imagegen.ai/v1', price: 500, rating_sum: 45, rating_count: 9, total_jobs: 22, category: 'Creative AI',
    features: ['4K resolution', 'Multiple art styles', 'Batch generation', 'Custom dimensions'],
    created: '20 Jun 2026', response_time: '~5s', image: '/agent_imagegen.png'
  },
  {
    owner: 'GBCC9012...AGENT3', name: 'Translation Bot XL',
    description: 'Ultra-fast machine translation engine optimized for Southeast Asian slang and colloquial dialects. Supports 10+ global languages.',
    api_url: 'api.translator.ai/translate', price: 50, rating_sum: 9, rating_count: 2, total_jobs: 5, category: 'Utility',
    features: ['10+ languages', 'Slang detection', 'Context-aware', 'Real-time API'],
    created: '1 Jul 2026', response_time: '~1s', image: '/agent_translator.png'
  },
  {
    owner: 'GBDD3456...AGENT4', name: 'Code Auditor AI',
    description: 'Automatically scan and audit Soroban Rust and Solidity smart contracts. Detects reentrancy, overflows, and prints professional PDF vulnerability reports.',
    api_url: 'api.sorobanaudit.ai/scan', price: 800, rating_sum: 25, rating_count: 5, total_jobs: 8, category: 'Utility',
    features: ['Soroban & Solidity', 'Vulnerability scanning', 'PDF audit reports', 'CI/CD integration'],
    created: '5 Jul 2026', response_time: '~15s', image: '/agent_auditor.png'
  },
  {
    owner: 'GBEE7890...AGENT5', name: 'Data Analyst Bot',
    description: 'Analyze CSV, JSON, and Excel spreadsheets using natural language search. Generates instant statistical insights, custom graphs, and CSV summaries.',
    api_url: 'api.databot.ai/analyze', price: 300, rating_sum: 14, rating_count: 3, total_jobs: 11, category: 'Text AI',
    features: ['Natural language search', 'Auto-visualizations', 'CSV/JSON/Excel import', 'Statistical reports'],
    created: '28 Jun 2026', response_time: '~8s', image: '/agent_data.png'
  },
  {
    owner: 'GBFF2345...AGENT6', name: 'Voice Cloner AI',
    description: 'High-quality voice cloning for audio dubbing, narration, and localized sound clips. Requires only a 30-second clean voice audio sample.',
    api_url: 'api.voiceclone.ai/generate', price: 600, rating_sum: 18, rating_count: 4, total_jobs: 9, category: 'Creative AI',
    features: ['30s voice sample', 'Studio quality', 'Multi-language TTS', 'Emotion sliders'],
    created: '3 Jul 2026', response_time: '~10s', image: '/agent_voice.png'
  },
  {
    owner: 'GBGG3456...AGENT7', name: 'Music Composer AI',
    description: 'Generate customized, royalty-free audio tracks and atmospheric background loops based on text descriptions, genre filters, and tempo parameters.',
    api_url: 'api.musicgen.ai/compose', price: 400, rating_sum: 5, rating_count: 1, total_jobs: 1, category: 'Creative AI',
    features: ['Prompt to audio', 'Royalty-free licensing', 'MIDI export', 'Multi-instrumental'],
    created: '6 Jul 2026', response_time: '~12s', image: '/agent_music.png'
  },
  {
    owner: 'GBHH4567...AGENT8', name: 'SEO Optimizer Bot',
    description: 'Scan URLs to analyze search rankings, generate high-intent metadata tags, and optimize content structure to improve organic traffic.',
    api_url: 'api.seobot.ai/optimize', price: 200, rating_sum: 5, rating_count: 1, total_jobs: 3, category: 'Utility',
    features: ['Page ranking audit', 'Metadata generator', 'Keyword tracking', 'Competitor insights'],
    created: '8 Jul 2026', response_time: '~4s', image: '/agent_seo.png'
  },
  {
    owner: 'GBII5678...AGENT9', name: 'Chatbot Assistant',
    description: 'Deploy smart conversational support agents pre-trained on your specific product manuals or business knowledge base.',
    api_url: 'api.chathelper.ai/v1', price: 250, rating_sum: 5, rating_count: 1, total_jobs: 2, category: 'Text AI',
    features: ['Custom knowledge base', 'Multi-channel support', 'Auto fallback to human', 'Leads capture'],
    created: '9 Jul 2026', response_time: '~1s', image: '/agent_chatbot.png'
  },
  {
    owner: 'GBJJ6789...AGENT10', name: 'Sentiment Analyst',
    description: 'Analyze social media streams, customer reviews, and survey feedback in real-time to track customer emotions and sentiment indexes.',
    api_url: 'api.sentiment.ai/analyze', price: 150, rating_sum: 4, rating_count: 1, total_jobs: 4, category: 'Text AI',
    features: ['Real-time streams', 'Multi-language NLP', 'Emotion categories', 'Webhook alerts'],
    created: '10 Jul 2026', response_time: '~3s', image: '/agent_sentiment.png'
  },
  {
    owner: 'GBKK7890...AGENT11', name: 'Video Generator AI',
    description: 'Generate dynamic video clips from scripts with automated B-roll footage selection, AI narration, and perfectly aligned captions.',
    api_url: 'api.videopro.ai/render', price: 700, rating_sum: 5, rating_count: 1, total_jobs: 1, category: 'Creative AI',
    features: ['Script to video', 'Realistic narrations', 'Captions generator', 'Stock video library'],
    created: '11 Jul 2026', response_time: '~20s', image: '/agent_video.png'
  }
];

/* ── Sample-data markers (seed agents & reviews are hardcoded, not read from chain) ── */
const SAMPLE_AGENT_OWNERS = new Set(INITIAL_AGENTS.map(a => a.owner));
const isSampleAgent = (agent) => SAMPLE_AGENT_OWNERS.has(agent.owner);
const isSampleReview = (agentName, r) => (MOCK_REVIEWS[agentName] || []).some(m => m.user === r.user && m.text === r.text);

function SampleBadge({ style }) {
  return (
    <span className="sample-badge" title="Sample data: hardcoded for this prototype, not read from the Stellar network" style={style}>Sample</span>
  );
}

/* ── Logo SVG Component ── */
function AgeroLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* Hexagonal wire with inner node connections */}
      <path d="M20 4 L34 12 L34 28 L20 36 L6 28 L6 12 Z" stroke="var(--accent)" strokeWidth="1.8" fill="none" />
      <path d="M20 4 L20 36 M6 12 L34 28 M34 12 L6 28" stroke="var(--accent)" strokeWidth="0.8" opacity="0.4" />
      <circle cx="20" cy="4" r="2.5" fill="var(--accent)" />
      <circle cx="34" cy="12" r="2" fill="var(--text-dim)" />
      <circle cx="34" cy="28" r="2" fill="var(--text-dim)" />
      <circle cx="20" cy="36" r="2.5" fill="var(--rose)" />
      <circle cx="6" cy="28" r="2" fill="var(--text-dim)" />
      <circle cx="6" cy="12" r="2" fill="var(--text-dim)" />
      <circle cx="20" cy="20" r="3.5" fill="var(--accent)" />
    </svg>
  );
}
function Robot3D() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Set high-DPI scaling
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 500 * dpr;
    canvas.height = 500 * dpr;
    canvas.style.width = '500px';
    canvas.style.height = '500px';
    ctx.scale(dpr, dpr);

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      mouseRef.current = {
        x: (e.clientX - cx) / (rect.width / 2),
        y: (e.clientY - cy) / (rect.height / 2)
      };
    };

    window.addEventListener('mousemove', handleMouseMove);

    // 3D wireframe head coordinates (scaled up by 1.5x for larger display)
    const baseVertices = [
      // Outer Ring / Shield
      { x: -75, y: -90, z: -30 }, { x: 75, y: -90, z: -30 },
      { x: 90, y: 45, z: -30 }, { x: 0, y: 105, z: -30 }, { x: -90, y: 45, z: -30 },
      // Inner face plate
      { x: -52, y: -52, z: 45 }, { x: 52, y: -52, z: 45 },
      { x: 60, y: 22, z: 52 }, { x: 0, y: 75, z: 60 }, { x: -60, y: 22, z: 52 },
      // Glowing Eye Nodes
      { x: -24, y: -18, z: 54 }, { x: 24, y: -18, z: 54 },
      // Top antenna / core transmitter
      { x: 0, y: -120, z: 0 }, { x: 0, y: -90, z: 0 }
    ];

    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 0], // Outer head loop
      [5, 6], [6, 7], [7, 8], [8, 9], [9, 5], // Inner face loop
      [0, 5], [1, 6], [2, 7], [3, 8], [4, 9], // Connection struts
      [12, 13] // Antenna
    ];

    // Orbiting particles (scaled outer orbit)
    const particles = Array.from({ length: 55 }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: 110 + Math.random() * 40,
      speed: 0.006 + Math.random() * 0.01,
      yOffset: -80 + Math.random() * 160,
      size: 1.2 + Math.random() * 2.0
    }));

    let rotX = 0;
    let rotY = 0;
    let animFrame;

    const render = () => {
      ctx.clearRect(0, 0, 500, 500);

      // Smoothly interpolate rotation to target mouse coordinates
      rotY += (mouseRef.current.x * 0.45 - rotY) * 0.08;
      rotX += (mouseRef.current.y * -0.45 - rotX) * 0.08;

      // Base auto-rotation offset
      const autoRot = Date.now() * 0.0003;
      const angleY = rotY + autoRot;
      const angleX = rotX;

      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);
      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);

      const project = (v) => {
        // Rotate Y
        let x1 = v.x * cosY - v.z * sinY;
        let z1 = v.x * sinY + v.z * cosY;
        // Rotate X
        let y2 = v.y * cosX - z1 * sinX;
        let z2 = v.y * sinX + z1 * cosX;

        // Perspective projection
        const dist = 320;
        const scale = dist / (dist + z2);
        return {
          x: 250 + x1 * scale,
          y: 250 + y2 * scale,
          depth: z2
        };
      };

      // Draw Orbiting Torus Rings
      ctx.strokeStyle = 'rgba(17, 100, 102, 0.22)';
      ctx.lineWidth = 1;
      for (let r = 0; r < 2; r++) {
        ctx.beginPath();
        const tilt = r === 0 ? 0.35 : -0.35;
        for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.15) {
          const pt = project({
            x: Math.cos(a) * 140,
            y: Math.sin(a) * tilt * 140,
            z: Math.sin(a) * 140
          });
          if (a === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }

      // Draw projected edges
      edges.forEach(([u, v]) => {
        const p1 = project(baseVertices[u]);
        const p2 = project(baseVertices[v]);
        
        // Depth-aware coloring (Teal and warm peach highlights)
        const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
        grad.addColorStop(0, p1.depth > 0 ? 'rgba(17, 100, 102, 0.35)' : 'rgba(255, 203, 154, 0.7)');
        grad.addColorStop(1, p2.depth > 0 ? 'rgba(17, 100, 102, 0.35)' : 'rgba(255, 203, 154, 0.7)');
        
        ctx.strokeStyle = grad;
        ctx.lineWidth = p1.depth > 0 ? 1.0 : 1.8;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      });

      // Draw Face polygon sheets (semitransparent glass fill)
      ctx.fillStyle = 'rgba(17, 100, 102, 0.08)';
      ctx.beginPath();
      const faceVerts = [5, 6, 7, 8, 9].map(i => project(baseVertices[i]));
      ctx.moveTo(faceVerts[0].x, faceVerts[0].y);
      for (let i = 1; i < faceVerts.length; i++) ctx.lineTo(faceVerts[i].x, faceVerts[i].y);
      ctx.closePath();
      ctx.fill();

      // Draw Eyes (Glowing Core nodes)
      [10, 11].forEach(i => {
        const pt = project(baseVertices[i]);
        // Glow layer
        const glow = ctx.createRadialGradient(pt.x, pt.y, 1, pt.x, pt.y, 14);
        glow.addColorStop(0, '#FFCB9A');
        glow.addColorStop(0.3, 'rgba(255, 203, 154, 0.8)');
        glow.addColorStop(1, 'rgba(255, 203, 154, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 14, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Top Antenna Core node
      const ant = project(baseVertices[12]);
      const glowAnt = ctx.createRadialGradient(ant.x, ant.y, 1, ant.x, ant.y, 16);
      glowAnt.addColorStop(0, '#D1E8E2');
      glowAnt.addColorStop(0.4, 'rgba(209, 232, 226, 0.7)');
      glowAnt.addColorStop(1, 'rgba(209, 232, 226, 0)');
      ctx.fillStyle = glowAnt;
      ctx.beginPath();
      ctx.arc(ant.x, ant.y, 16, 0, Math.PI * 2);
      ctx.fill();

      // Update and Draw revolving digital particles
      particles.forEach(p => {
        p.angle += p.speed;
        const pt = project({
          x: Math.cos(p.angle) * p.radius,
          y: p.yOffset,
          z: Math.sin(p.angle) * p.radius
        });

        ctx.fillStyle = pt.depth > 0 ? 'rgba(17, 100, 102, 0.35)' : 'rgba(209, 232, 226, 0.85)';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Holographic scanlines overlay
      ctx.strokeStyle = 'rgba(23, 29, 27, 0.12)';
      ctx.lineWidth = 1;
      for (let y = 6; y < 500; y += 8) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(500, y);
        ctx.stroke();
      }

      animFrame = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animFrame);
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '500px', height: '500px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ position: 'absolute', width: '350px', height: '350px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(17, 100, 102, 0.15) 0%, transparent 70%)', filter: 'blur(16px)', pointerEvents: 'none' }} />
      <canvas ref={canvasRef} style={{ display: 'block', pointerEvents: 'auto' }} />
    </div>
  );
}

/* ── Stars ── */
function Stars({ sum, count, size = 13 }) {
  const r = count > 0 ? Math.round(sum / count) : 0;
  return (
    <div className="star-row">
      {[...Array(5)].map((_, i) => (
        <Star key={i} size={size} className={i < r ? 'star-filled' : 'star-empty'} style={{ fill: i < r ? '#fcd34d' : 'none' }} />
      ))}
      <span style={{ fontSize: '12px', color: 'var(--text-dim)', marginLeft: '5px' }}>
        {count > 0 ? `${(sum / count).toFixed(1)}` : '—'}
      </span>
      <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginLeft: '2px' }}>({count})</span>
    </div>
  );
}

/* ── Main ── */
export default function App() {
  const [activePage, setActivePage] = useState('home');
  const [wallet, setWallet] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [walletOpen, setWalletOpen] = useState(false);
  const [showSimBanner, setShowSimBanner] = useState(true);
  const walletRef = useRef(null);

  const [detailAgent, setDetailAgent] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [notification, setNotification] = useState(null);

  const [agents, setAgents] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [newAgent, setNewAgent] = useState({ name: '', description: '', apiUrl: '', price: '', category: 'Text AI' });
  const [jobAmount, setJobAmount] = useState('');
  const [simTx, setSimTx] = useState(null);
  const [simStep, setSimStep] = useState('idle');

  // Dynamic reviews state
  const [reviews, setReviews] = useState({});

  // Playground Console states
  const [activePlaygroundJob, setActivePlaygroundJob] = useState(null);
  const [playgroundInput, setPlaygroundInput] = useState('');
  const [playgroundConsoleLogs, setPlaygroundConsoleLogs] = useState([]);
  const [playgroundStatus, setPlaygroundStatus] = useState('idle');
  const [playgroundLoading, setPlaygroundLoading] = useState(false);

  // Rating & Review modal states
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingJob, setRatingJob] = useState(null);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingReviewText, setRatingReviewText] = useState('');

  useEffect(() => {
    const sa = localStorage.getItem('agero_v5_agents');
    const sj = localStorage.getItem('agero_v5_jobs');
    const sw = localStorage.getItem('agero_wallet');
    const sr = localStorage.getItem('agero_v5_reviews');
    if (sa) setAgents(JSON.parse(sa)); else { setAgents(INITIAL_AGENTS); localStorage.setItem('agero_v5_agents', JSON.stringify(INITIAL_AGENTS)); }
    if (sj) setJobs(JSON.parse(sj));
    if (sw) setWallet(sw);
    if (sr) setReviews(JSON.parse(sr)); else { setReviews(MOCK_REVIEWS); localStorage.setItem('agero_v5_reviews', JSON.stringify(MOCK_REVIEWS)); }
  }, []);

  useEffect(() => {
    const h = (e) => { if (walletRef.current && !walletRef.current.contains(e.target)) setWalletOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const notify = (msg, type = 'success') => { setNotification({ message: msg, type }); setTimeout(() => setNotification(null), 3500); };

  const handleConnect = async () => {
    try {
      const addr = await connectWallet(isDemoMode);
      setWallet(addr); localStorage.setItem('agero_wallet', addr); setWalletOpen(false);
      notify(isDemoMode
        ? `Demo address connected: ${addr.slice(0,4)}...${addr.slice(-4)}`
        : 'Wallet connected (address only). Transactions are not signed or sent yet.');
    } catch (e) { notify(e.message, 'error'); }
  };

  const handleDisconnect = () => { setWallet(null); localStorage.removeItem('agero_wallet'); setWalletOpen(false); notify('Wallet disconnected'); };

  const launchTx = (txDetails, cb) => {
    setSimTx(txDetails); setSimStep('signing'); setShowDrawer(true);
    window._cb = () => { cb(); setSimStep('complete'); setTimeout(() => { setShowDrawer(false); setSimStep('idle'); }, 1400); };
  };

  const txNetwork = isDemoMode ? 'Simulated (Demo)' : 'Simulated (Freighter address)';

  const handleRegister = (e) => {
    e.preventDefault();
    if (!wallet) return notify('Please connect wallet first', 'error');
    const { name, description, apiUrl, price, category } = newAgent;
    launchTx({ title: 'AI Agent Registration', operation: 'register_agent', network: txNetwork, fee: 'None (simulated)', details: [{ label: 'Name', val: name }, { label: 'Price', val: `${price} XLM` }, { label: 'Endpoint', val: apiUrl }] }, () => {
      const obj = { owner: wallet, name, description, api_url: apiUrl, price: Number(price), rating_sum: 0, rating_count: 0, total_jobs: 0, category, features: [], created: new Date().toLocaleDateString(), response_time: '—' };
      const updated = [obj, ...agents]; setAgents(updated); localStorage.setItem('agero_v5_agents', JSON.stringify(updated));
      setNewAgent({ name: '', description: '', apiUrl: '', price: '', category: 'Text AI' });
      notify(`"${name}" registered (simulated, saved in this browser only)`);
    });
  };

  const handleHire = (e) => {
    e.preventDefault();
    if (!wallet) return notify('Please connect wallet first', 'error');
    const amount = Number(jobAmount);
    if (amount < detailAgent.price) return notify('Amount is below minimum price', 'error');
    launchTx({ title: 'Lock Escrow Funds', operation: 'create_job', network: txNetwork, fee: 'None (simulated)', details: [{ label: 'Agent', val: detailAgent.name }, { label: 'Amount', val: `${amount} XLM` }, { label: 'Client', val: wallet.slice(0,8)+'...' }] }, () => {
      // Simulated reference ID, not an on-chain transaction hash
      const generatedTxHash = isDemoMode ? 'MOCK_TX_XLM' : 'SIM-' + Array.from({length: 16}, () => Math.floor(Math.random()*16).toString(16)).join('');
      const job = { id: jobs.length + 1, client: wallet, agent: detailAgent.owner, agentName: detailAgent.name, agentApiUrl: detailAgent.api_url || 'localhost:3000/api/summarize', txHash: generatedTxHash, amount, status: 'PENDING', timestamp: new Date().toLocaleDateString() };
      const uj = [job, ...jobs]; setJobs(uj); localStorage.setItem('agero_v5_jobs', JSON.stringify(uj));
      setJobAmount(''); setShowOrderModal(false); setDetailAgent(null);
      notify(`Simulated escrow #${job.id} created`); setActivePage('workspace');
    });
  };

  const handleComplete = (job) => {
    launchTx({ title: 'Release Escrow Funds', operation: 'complete_job', network: txNetwork, fee: 'None (simulated)', details: [{ label: 'Job', val: `#${job.id}` }, { label: 'Amount', val: `${job.amount} XLM` }] }, () => {
      const uj = jobs.map(j => j.id === job.id ? { ...j, status: 'COMPLETED' } : j); setJobs(uj); localStorage.setItem('agero_v5_jobs', JSON.stringify(uj));
      const ua = agents.map(a => a.owner === job.agent ? { ...a, total_jobs: a.total_jobs + 1 } : a); setAgents(ua); localStorage.setItem('agero_v5_agents', JSON.stringify(ua));
      notify(`Simulated escrow #${job.id} released`);
      
      // Trigger rating modal
      setRatingJob(job);
      setRatingStars(5);
      setRatingReviewText('');
      setShowRatingModal(true);
    });
  };

  const handleRefund = (job) => {
    launchTx({ title: 'Refund Escrow', operation: 'refund_job', network: txNetwork, fee: 'None (simulated)', details: [{ label: 'Job', val: `#${job.id}` }, { label: 'Refund', val: `${job.amount} XLM` }] }, () => {
      const uj = jobs.map(j => j.id === job.id ? { ...j, status: 'REFUNDED' } : j); setJobs(uj); localStorage.setItem('agero_v5_jobs', JSON.stringify(uj));
      notify(`Simulated escrow #${job.id} refunded`);
    });
  };

  const handleRatingSubmit = (e) => {
    e.preventDefault();
    if (!ratingJob) return;

    const updatedAgents = agents.map(a => {
      if (a.name === ratingJob.agentName) {
        return {
          ...a,
          rating_sum: a.rating_sum + ratingStars,
          rating_count: a.rating_count + 1
        };
      }
      return a;
    });
    setAgents(updatedAgents);
    localStorage.setItem('agero_v5_agents', JSON.stringify(updatedAgents));

    const newReview = {
      user: ratingJob.client.slice(0, 8) + '...' + ratingJob.client.slice(-4),
      date: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
      text: ratingReviewText || 'Job completed successfully.',
      stars: ratingStars
    };

    const updatedReviews = { ...reviews };
    if (!updatedReviews[ratingJob.agentName]) {
      updatedReviews[ratingJob.agentName] = [];
    }
    updatedReviews[ratingJob.agentName] = [newReview, ...updatedReviews[ratingJob.agentName]];
    setReviews(updatedReviews);
    localStorage.setItem('agero_v5_reviews', JSON.stringify(updatedReviews));

    setShowRatingModal(false);
    setRatingJob(null);
    notify(`Rating & review for "${ratingJob.agentName}" saved in this browser (simulated)`);
  };

  const executePlaygroundTask = async () => {
    if (!activePlaygroundJob) return;
    setPlaygroundLoading(true);
    setPlaygroundStatus('running');

    const logs = [];
    logs.push(`[CLIENT] Preparing task payload for: ${activePlaygroundJob.agentName}`);
    logs.push(`[CLIENT] Target endpoint: http://${activePlaygroundJob.agentApiUrl || 'localhost:3000/api/summarize'}`);
    logs.push(`[CLIENT] Using X-Stellar-Payment-Tx: ${activePlaygroundJob.txHash || 'MOCK_TX_XLM'} (simulated reference ID)`);
    logs.push(`[HTTP] POST http://${activePlaygroundJob.agentApiUrl || 'localhost:3000/api/summarize'} HTTP/1.1`);
    logs.push(`[HTTP] Headers: { "Content-Type": "application/json", "X-Stellar-Payment-Tx": "${activePlaygroundJob.txHash || 'MOCK_TX_XLM'}" }`);
    logs.push(`[HTTP] Body: { "text": "${playgroundInput.slice(0, 45)}..." }`);
    logs.push(`[x402] Contacting autonomous payment gateway...`);
    setPlaygroundConsoleLogs([...logs]);

    await new Promise(r => setTimeout(r, 1200));

    try {
      const response = await fetch(`http://${activePlaygroundJob.agentApiUrl || 'localhost:3000/api/summarize'}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Stellar-Payment-Tx': activePlaygroundJob.txHash || 'MOCK_TX_XLM'
        },
        body: JSON.stringify({ text: playgroundInput })
      });

      if (response.ok) {
        const data = await response.json();
        // Only the gateway's HORIZON_LIVE path actually checks the ledger; MOCK is a bypass
        if (data.payment?.method === 'HORIZON_LIVE') {
          logs.push(`[x402] Payment VERIFIED by ledger via Horizon.`);
          logs.push(`[GATEWAY] API Response: ${response.status} OK`);
          logs.push(`[GATEWAY] Data: ${JSON.stringify(data, null, 2)}`);
        } else {
          logs.push(`[sim] [x402] Gateway accepted a mock payment reference (method: ${data.payment?.method || 'unknown'}). No ledger check was made.`);
          logs.push(`[sim] [GATEWAY] API Response: ${response.status} OK`);
          logs.push(`[sim] [GATEWAY] Data: ${JSON.stringify(data, null, 2)}`);
        }
        setPlaygroundConsoleLogs([...logs]);
        setPlaygroundStatus('success');
      } else {
        const errData = await response.json().catch(() => ({}));
        logs.push(`[GATEWAY] API Response Error: ${response.status} ${response.statusText}`);
        logs.push(`[GATEWAY] Error Detail: ${JSON.stringify(errData, null, 2)}`);
        setPlaygroundConsoleLogs([...logs]);
        setPlaygroundStatus('error');
      }
    } catch (err) {
      logs.push(`[WARNING] Failed to connect to local gateway (${err.message}).`);
      logs.push(`[CLIENT] Switching to sandbox visual simulation...`);
      setPlaygroundConsoleLogs([...logs]);

      await new Promise(r => setTimeout(r, 1500));

      const simulatedSummary = `[SIMULATION SUMMARY] Your text summary: "${playgroundInput.substring(0, 50)}..." (Original text length was ${playgroundInput.length} characters). No payment or contract call was made.`;

      logs.push(`[sim] [x402] Payment step simulated in the browser. No contract or Horizon call was made.`);
      logs.push(`[sim] [GATEWAY] API Response: 200 OK (Simulated)`);
      logs.push(`[sim] [GATEWAY] Data: {\n  "success": true,\n  "summary": "${simulatedSummary}"\n}`);
      setPlaygroundConsoleLogs([...logs]);
      setPlaygroundStatus('success');
    } finally {
      setPlaygroundLoading(false);
    }
  };

  const totalLocked = jobs.filter(j => j.status === 'PENDING').reduce((s, j) => s + j.amount, 0);
  const totalCompleted = jobs.filter(j => j.status === 'COMPLETED').length;
  const devEarnings = jobs.filter(j => j.status === 'COMPLETED' && j.agent === wallet).reduce((s, j) => s + j.amount, 0);
  const devJobs = jobs.filter(j => j.status === 'COMPLETED' && j.agent === wallet).length;
  const filtered = selectedCategory === 'All' ? agents : agents.filter(a => a.category === selectedCategory);

  const progressColors = (status) => {
    if (status === 'COMPLETED') return ['var(--blue)', 'var(--lavender)', 'var(--green)'];
    if (status === 'REFUNDED') return ['var(--rose)', 'var(--red)', 'transparent'];
    return ['var(--blue)', 'transparent', 'transparent'];
  };

  return (
    <div>
      {/* Background Blobs */}
      <div className="bg-atmosphere">
        <div className="bg-blob bg-blob-1" />
        <div className="bg-blob bg-blob-2" />
        <div className="bg-blob bg-blob-3" />
      </div>

      <div className="app-root">
        {/* Notification */}
        {notification && (
          <div className={`notif ${notification.type === 'error' ? 'notif-error' : 'notif-success'}`}>
            {notification.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle size={15} />}
            {notification.message}
          </div>
        )}

        {/* ── Prototype banner (dismissible until reload) ── */}
        {showSimBanner && (
          <div className="sim-banner" role="status">
            <div className="container sim-banner-inner">
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>Prototype: transactions in this app are simulated. The escrow contract is deployed on Stellar Testnet but is not connected to this UI yet.</span>
              <button className="sim-banner-close" aria-label="Dismiss notice" onClick={() => setShowSimBanner(false)}><X size={14} /></button>
            </div>
          </div>
        )}

        {/* ── Navbar ── */}
        <nav className="navbar">
          <div className="container navbar-inner">
            <a className="nav-logo" onClick={() => { setActivePage('home'); setDetailAgent(null); }}>
              <AgeroLogo />
              <span>Agero</span>
            </a>

            <div className="nav-links">
              {[
                { id: 'home', label: 'Home' },
                { id: 'marketplace', label: 'Marketplace' },
                { id: 'developer', label: 'Developer' },
                { id: 'workspace', label: 'Workspace' }
              ].map(p => (
                <button key={p.id} className={`nav-link ${activePage === p.id && !detailAgent ? 'active' : ''}`} onClick={() => { setActivePage(p.id); setDetailAgent(null); }}>{p.label}</button>
              ))}
            </div>

            <div className="wallet-wrapper" ref={walletRef}>
              <button className={`wallet-btn ${wallet ? 'connected' : ''}`} onClick={() => setWalletOpen(!walletOpen)}>
                {wallet ? (<><div className="wallet-dot" />{wallet.slice(0,4)}...{wallet.slice(-4)}</>) : 'Connect Wallet'}
                <ChevronDown size={13} style={{ opacity: 0.4, transform: walletOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              {walletOpen && (
                <div className="wallet-dropdown">
                  <div className="dropdown-label">Network Mode</div>
                  <div className="mode-toggle">
                    <button className={`mode-option ${isDemoMode ? 'active' : ''}`} onClick={() => { setIsDemoMode(true); if (wallet) handleDisconnect(); }}>Demo</button>
                    <button className={`mode-option ${!isDemoMode ? 'active' : ''}`} onClick={() => { setIsDemoMode(false); if (wallet) handleDisconnect(); }}>Freighter</button>
                  </div>
                  {wallet ? (<><div className="dropdown-label">Address</div><div className="dropdown-addr">{wallet}</div><div className="dropdown-note">{isDemoMode ? 'Demo address. All transactions are simulated.' : 'Wallet connected (address only). Transactions are not signed or sent yet.'}</div><button className="dropdown-action dropdown-disconnect" onClick={handleDisconnect}>Disconnect Wallet</button></>) : (
                    <button className="dropdown-action dropdown-connect" onClick={handleConnect}>Connect Wallet</button>
                  )}
                </div>
              )}
            </div>
          </div>
        </nav>

        <main className="container">

          {/* ═══ AGENT DETAIL ═══ */}
          {detailAgent ? (
            <div className="page-view">
              <button className="detail-back" onClick={() => setDetailAgent(null)}>
                <ArrowLeft size={16} /> Back to Marketplace
              </button>

              <div className="detail-layout">
                <div className="card detail-main">
                  <div className="detail-meta">
                    <span className="detail-tag" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{detailAgent.category}</span>
                    {isSampleAgent(detailAgent) && <SampleBadge />}
                    <Stars sum={detailAgent.rating_sum} count={detailAgent.rating_count} size={15} />
                  </div>
                  <h1 className="detail-name">{detailAgent.name}</h1>
                  <p className="detail-desc">{detailAgent.description}</p>
                  {isSampleAgent(detailAgent) && (
                    <p className="sample-note">Sample listing: profile, rating, job count, endpoint, and reviews are hardcoded for this prototype and are not read from the Stellar network.</p>
                  )}

                  <div className="detail-info-grid">
                    <div className="detail-info-item">
                      <div className="detail-info-label">Price</div>
                      <div className="detail-info-val" style={{ color: 'var(--accent)' }}>{detailAgent.price} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-dim)' }}>XLM/USDC</span></div>
                    </div>
                    <div className="detail-info-item">
                      <div className="detail-info-label">Response Time</div>
                      <div className="detail-info-val">{detailAgent.response_time || '—'}</div>
                    </div>
                    <div className="detail-info-item">
                      <div className="detail-info-label">Completed Jobs</div>
                      <div className="detail-info-val">{detailAgent.total_jobs}</div>
                    </div>
                    <div className="detail-info-item">
                      <div className="detail-info-label">Created At</div>
                      <div className="detail-info-val" style={{ fontSize: '13px' }}>{detailAgent.created || '—'}</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>API Endpoint</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-secondary)', background: 'rgba(37,99,235,0.03)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>{detailAgent.api_url}</span>
                      <ExternalLink size={14} style={{ color: 'var(--text-dim)' }} />
                    </div>
                  </div>

                  {detailAgent.image && (
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sample output (static image)</div>
                      <div className="detail-showcase-img-container" style={{ overflow: 'hidden', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <img src={detailAgent.image} alt={`${detailAgent.name} sample output (static image)`} style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '300px', objectFit: 'cover' }} />
                      </div>
                    </div>
                  )}

                  {detailAgent.features && detailAgent.features.length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Features</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {detailAgent.features.map((f, i) => (
                          <span key={i} style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', background: 'rgba(37,99,235,0.04)', border: '1px solid var(--border)', padding: '5px 12px', borderRadius: '100px' }}>{f}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Owner: {detailAgent.owner}</span>
                    <button className="btn btn-primary" onClick={() => setShowOrderModal(true)}>Hire Agent</button>
                  </div>
                </div>

                {/* Reviews Column */}
                <div className="card reviews-section">
                  <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>User Reviews</h3>
                  {reviews[detailAgent.name] ? (
                    reviews[detailAgent.name].map((r, i) => (
                      <div key={i} className="review-item">
                        <div className="review-header">
                          <span className="review-user">{r.user}{isSampleReview(detailAgent.name, r) && <SampleBadge style={{ marginLeft: '8px' }} />}</span>
                          <span className="review-date">{r.date}</span>
                        </div>
                        <Stars sum={r.stars} count={1} size={12} />
                        <p className="review-text">{r.text}</p>
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: '13px', color: 'var(--text-dim)', padding: '20px 0' }}>No reviews yet for this agent.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* ═══ HOME PAGE ═══ */}
              {activePage === 'home' && (
                <div className="page-view home-page">
                  {/* Hero Section */}
                  <div className="home-hero">
                    <div className="hero-content">
                      <span className="hero-accent-tag">Agero Escrow Protocol</span>
                      <h1 className="hero-title">
                        Secure M2M <br />
                        <span className="gradient-text">AI Agent Economy</span>
                      </h1>
                      <p className="hero-desc">
                        Hire autonomous AI Agents for text, creative media, and smart contract audits. 
                        Secure your jobs with Soroban escrow contracts and pay-per-use microtransactions.
                      </p>
                      <div className="hero-actions">
                        <button className="btn btn-primary btn-lg" onClick={() => setActivePage('marketplace')}>
                          Explore Marketplace
                        </button>
                        <button className="btn btn-outline btn-lg" onClick={() => setActivePage('developer')}>
                          Register AI Agent
                        </button>
                      </div>
                    </div>
                    <div className="hero-graphic">
                      <Robot3D />
                    </div>
                  </div>

                  {/* Featured Agents Showcase */}
                  <div className="featured-section">
                    <h2 className="showcase-title">Featured Autonomous Agents</h2>
                    <p className="showcase-desc">Explore sample outputs from our state-of-the-art AI Freelancers.</p>
                    
                    <div className="featured-grid">
                      {agents.slice(0, 3).map((agent, i) => (
                        <div key={i} className="card featured-card" onClick={() => { setDetailAgent(agent); window.scrollTo(0, 0); }}>
                          <div className="featured-img-wrapper">
                            <img src={agent.image} alt={agent.name} className="featured-img" />
                            <div className="featured-category">{agent.category}</div>
                            {isSampleAgent(agent) && <SampleBadge style={{ position: 'absolute', top: '12px', right: '12px' }} />}
                          </div>
                          <div className="featured-body">
                            <h3 className="featured-name">{agent.name}</h3>
                            <p className="featured-desc">{agent.description}</p>
                            <div className="featured-footer">
                              <span className="featured-price">{agent.price} XLM</span>
                              <Stars sum={agent.rating_sum} count={agent.rating_count} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Workflow Steps Section */}
                  <div className="workflow-section">
                    <h2 className="showcase-title">How Agero Works</h2>
                    <p className="showcase-desc">The intended M2M escrow workflow. In this prototype every step is simulated in the browser.</p>
                    
                    <div className="workflow-timeline">
                      <div className="timeline-progress-line" />
                      
                      <div className="timeline-node">
                        <div className="timeline-indicator">1</div>
                        <div className="card timeline-card">
                          <h3 className="workflow-card-title">Connect Wallet</h3>
                          <p className="workflow-card-desc">Initialize your secure account via Freighter or Demo wallet.</p>
                        </div>
                      </div>

                      <div className="timeline-node">
                        <div className="timeline-indicator">2</div>
                        <div className="card timeline-card">
                          <h3 className="workflow-card-title">Lock Escrow</h3>
                          <p className="workflow-card-desc">Lock the job price in escrow (simulated here; the Soroban contract is not connected yet).</p>
                        </div>
                      </div>

                      <div className="timeline-node">
                        <div className="timeline-indicator">3</div>
                        <div className="card timeline-card">
                          <h3 className="workflow-card-title">Execute Playground</h3>
                          <p className="workflow-card-desc">Call the x402 gateway demo with a simulated reference ID.</p>
                        </div>
                      </div>

                      <div className="timeline-node">
                        <div className="timeline-indicator">4</div>
                        <div className="card timeline-card">
                          <h3 className="workflow-card-title">Release Funds</h3>
                          <p className="workflow-card-desc">Release escrow to the developer wallet (simulated in this prototype).</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ MARKETPLACE ═══ */}
              {activePage === 'marketplace' && (
                <div className="page-view">
                  <div className="section-header">
                    <h1 className="section-title">Marketplace</h1>
                    <p className="section-desc">Explore AI Agents and simulate hiring them. Listings marked Sample are hardcoded demo data, not read from the Stellar network. Click an agent to view complete details.</p>
                  </div>

                  <div className="stat-row">
                    <div className="card stat-card blue">
                      <div className="stat-label">Total Agents</div>
                      <div className="stat-val">{agents.length}</div>
                    </div>
                    <div className="card stat-card rose">
                      <div className="stat-label">Escrow Locked</div>
                      <div className="stat-val" style={{ color: 'var(--rose)' }}>{totalLocked} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-dim)' }}>XLM</span></div>
                    </div>
                    <div className="card stat-card green-stat">
                      <div className="stat-label">Completed Tasks</div>
                      <div className="stat-val" style={{ color: 'var(--green)' }}>{totalCompleted}</div>
                    </div>
                  </div>

                  <div className="filter-row">
                    {['All', 'Text AI', 'Creative AI', 'Utility'].map(c => (
                      <button key={c} className={`filter-pill ${selectedCategory === c ? 'active' : ''}`} onClick={() => setSelectedCategory(c)}>{c}</button>
                    ))}
                  </div>

                  <div className="agent-grid">
                    {filtered.map((agent, i) => (
                      <div key={i} className="card agent-card" onClick={() => { setDetailAgent(agent); window.scrollTo(0,0); }}>
                        {agent.image && (
                          <div className="agent-card-img-wrapper" style={{ height: '140px', overflow: 'hidden', borderBottom: '1px solid var(--border)' }}>
                            <img src={agent.image} alt={agent.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        )}
                        <div style={{ padding: '20px' }}>
                          <div className="agent-top-row">
                            <h3 className="agent-name">{agent.name}</h3>
                            <span className="agent-category">{agent.category}</span>
                          </div>
                          {isSampleAgent(agent) && <SampleBadge style={{ marginBottom: '8px' }} />}
                          <p className="agent-desc">{agent.description}</p>
                          <div className="agent-bottom">
                            <div className="agent-price">{agent.price}<span className="agent-price-unit">XLM</span></div>
                            <Stars sum={agent.rating_sum} count={agent.rating_count} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ═══ DEVELOPER ═══ */}
              {activePage === 'developer' && (
                <div className="page-view">
                  <div className="section-header">
                    <h1 className="section-title">Developer Portal</h1>
                    <p className="section-desc">Register your AI Agent and track your performance and earnings. Registration is simulated and saved in this browser only.</p>
                  </div>

                  <div className="stat-row">
                    <div className="card stat-card green-stat">
                      <div className="stat-label">Total Earnings</div>
                      <div className="stat-val" style={{ color: 'var(--green)' }}>{devEarnings} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-dim)' }}>XLM</span></div>
                    </div>
                    <div className="card stat-card blue">
                      <div className="stat-label">Completed Jobs</div>
                      <div className="stat-val">{devJobs}</div>
                    </div>
                    <div className="card stat-card lavender">
                      <div className="stat-label">Registered Agents</div>
                      <div className="stat-val">{wallet ? agents.filter(a => a.owner === wallet).length : 0}</div>
                    </div>
                  </div>

                  <div className="dev-layout">
                    <div className="card dev-form-card">
                      <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Zap size={18} style={{ color: 'var(--accent)' }} /> Register New Agent
                      </h3>
                      {!wallet ? (
                        <div className="empty-state">
                          <div className="empty-icon"><Shield size={24} /></div>
                          <p style={{ color: 'var(--text-dim)', marginBottom: '16px' }}>Connect your wallet to register an agent.</p>
                          <button className="btn btn-primary" onClick={() => setWalletOpen(true)}>Connect Wallet</button>
                        </div>
                      ) : (
                        <form onSubmit={handleRegister}>
                          <div className="form-group"><label className="form-label">Agent Name</label><input className="form-input" placeholder="e.g. Logo Creator Bot" value={newAgent.name} onChange={e => setNewAgent({...newAgent, name: e.target.value})} required /></div>
                          <div className="form-group"><label className="form-label">Category</label><select className="form-input" value={newAgent.category} onChange={e => setNewAgent({...newAgent, category: e.target.value})}><option>Text AI</option><option>Creative AI</option><option>Utility</option></select></div>
                          <div className="form-group"><label className="form-label">Description</label><textarea className="form-input" style={{ minHeight: '80px', resize: 'vertical' }} placeholder="Describe your agent's capabilities..." value={newAgent.description} onChange={e => setNewAgent({...newAgent, description: e.target.value})} required /></div>
                          <div className="form-group"><label className="form-label">API Endpoint</label><input className="form-input" placeholder="api.domain.com/v1/task" value={newAgent.apiUrl} onChange={e => setNewAgent({...newAgent, apiUrl: e.target.value})} required /></div>
                          <div className="form-group"><label className="form-label">Price (XLM/USDC)</label><input type="number" className="form-input" placeholder="100" value={newAgent.price} onChange={e => setNewAgent({...newAgent, price: e.target.value})} required /></div>
                          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Register Agent (Simulated)</button>
                        </form>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="card" style={{ padding: '24px' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px' }}>Your AI Agents</h4>
                        {wallet ? (
                          agents.filter(a => a.owner === wallet).length === 0
                            ? <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>No registered agents yet.</p>
                            : agents.filter(a => a.owner === wallet).map((a, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < agents.filter(x => x.owner === wallet).length - 1 ? '1px solid var(--border)' : 'none' }}>
                                  <div>
                                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{a.name}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{a.category}</div>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent)' }}>{a.price} XLM</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{a.total_jobs} jobs</div>
                                  </div>
                                </div>
                              ))
                        ) : <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Please connect your wallet first.</p>}
                      </div>

                      <div className="card" style={{ padding: '24px' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px' }}>Recent Activity</h4>
                        {jobs.filter(j => j.agent === wallet).length === 0 ? (
                          <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>No recent activity.</p>
                        ) : (
                          jobs.filter(j => j.agent === wallet).slice(0, 5).map((j, i) => (
                            <div key={i} className="activity-item">
                              <div className="activity-dot" style={{ background: j.status === 'COMPLETED' ? 'var(--green)' : j.status === 'REFUNDED' ? 'var(--red)' : 'var(--amber)' }} />
                              <span className="activity-text">Job #{j.id} — {j.amount} XLM</span>
                              <span className="activity-time">{j.status}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ WORKSPACE ═══ */}
              {activePage === 'workspace' && (
                <div className="page-view">
                  <div className="section-header">
                    <h1 className="section-title">Client Workspace</h1>
                    <p className="section-desc">Manage your job escrows. Escrows here are simulated and stored in this browser only; no funds are locked on-chain.</p>
                  </div>

                  <div className="stat-row">
                    <div className="card stat-card blue">
                      <div className="stat-label">Total Escrows</div>
                      <div className="stat-val">{jobs.length}</div>
                    </div>
                    <div className="card stat-card rose">
                      <div className="stat-label">Escrow Locked</div>
                      <div className="stat-val" style={{ color: 'var(--rose)' }}>{totalLocked} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-dim)' }}>XLM</span></div>
                    </div>
                    <div className="card stat-card green-stat">
                      <div className="stat-label">Completed</div>
                      <div className="stat-val" style={{ color: 'var(--green)' }}>{totalCompleted}</div>
                    </div>
                  </div>

                  <div className="flow-legend">
                    <div className="flow-legend-item"><div className="flow-dot" style={{ background: 'var(--blue)' }} /> Escrow Locked</div>
                    <div className="flow-legend-item"><div className="flow-dot" style={{ background: 'var(--lavender)' }} /> Execution</div>
                    <div className="flow-legend-item"><div className="flow-dot" style={{ background: 'var(--green)' }} /> Completed</div>
                  </div>

                  {jobs.length === 0 ? (
                    <div className="card empty-state">
                      <div className="empty-icon"><Clock size={24} /></div>
                      <p style={{ color: 'var(--text-dim)', marginBottom: '16px' }}>No escrow history found.</p>
                      <button className="btn btn-outline" onClick={() => setActivePage('marketplace')}>Explore AI Agents</button>
                    </div>
                  ) : (
                    <div className="escrow-list">
                      {jobs.map(job => {
                        const colors = progressColors(job.status);
                        return (
                          <div key={job.id} className="card escrow-card">
                            <div className="escrow-progress">
                              {colors.map((c, i) => <div key={i} className="escrow-progress-seg" style={{ background: c }} />)}
                            </div>
                            <div className="escrow-body">
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                  <span className="escrow-title">Escrow #{job.id}</span>
                                  <span className={`badge badge-${job.status.toLowerCase()}`}><span className="badge-dot" />{job.status}</span>
                                </div>
                                <div className="escrow-meta">
                                  <span>Agent: {job.agentName}</span>
                                  <span>{job.amount} XLM/USDC</span>
                                  <span>{job.timestamp}</span>
                                </div>
                              </div>
                              {job.status === 'PENDING' && (
                                <div className="escrow-actions">
                                  <button className="btn btn-playground" onClick={() => {
                                    setActivePlaygroundJob(job);
                                    setPlaygroundInput('Stellar is an open-source blockchain designed to accelerate cross-border payments cheaply and in a decentralized manner using stablecoins.');
                                    setPlaygroundConsoleLogs([]);
                                    setPlaygroundStatus('idle');
                                  }}>Test API</button>
                                  <button className="btn btn-green" onClick={() => handleComplete(job)}>Release</button>
                                  <button className="btn btn-red" onClick={() => handleRefund(job)}>Refund</button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>

        {/* ── Order Modal ── */}
        {showOrderModal && detailAgent && (
          <div className="overlay" onClick={() => setShowOrderModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 className="modal-title" style={{ margin: 0 }}>Hire {detailAgent.name}</h3>
                <button style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }} onClick={() => setShowOrderModal(false)}><X size={18} /></button>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Minimum price: <strong style={{ color: 'var(--text)' }}>{detailAgent.price} XLM/USDC</strong></p>
              <form onSubmit={handleHire}>
                <div className="form-group"><label className="form-label">Escrow Amount</label><input type="number" className="form-input" placeholder={`Min. ${detailAgent.price}`} value={jobAmount} onChange={e => setJobAmount(e.target.value)} min={detailAgent.price} required /></div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Lock Funds (Simulated)</button>
              </form>
            </div>
          </div>
        )}

        {/* ── Freighter Drawer ── */}
        {showDrawer && simTx && (
          <div className="drawer-bg" onClick={() => { if (simStep !== 'submitting') { setShowDrawer(false); setSimStep('idle'); } }}>
            <div className="drawer" onClick={e => e.stopPropagation()}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <span className="drawer-title">Confirm Simulated Transaction</span>
                  {simStep === 'signing' && <button style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }} onClick={() => { setShowDrawer(false); setSimStep('idle'); notify('Rejected', 'error'); }}><X size={18} /></button>}
                </div>
                {simStep === 'signing' && (
                  <>
                    <div className="drawer-info">
                      <div className="drawer-row"><span className="drawer-row-label">Operation</span><span className="drawer-row-val" style={{ color: 'var(--accent)' }}>{simTx.operation}</span></div>
                      <div className="drawer-row"><span className="drawer-row-label">Network</span><span className="drawer-row-val">{simTx.network}</span></div>
                      <div className="drawer-row"><span className="drawer-row-label">Fee</span><span className="drawer-row-val">{simTx.fee}</span></div>
                    </div>
                    <p className="sample-note">Simulated: nothing is signed or submitted to the Stellar network. The result is saved in this browser only.</p>
                    <div className="drawer-info">
                      {simTx.details.map((d, i) => <div key={i} className="drawer-row"><span className="drawer-row-label">{d.label}</span><span className="drawer-row-val" style={{ wordBreak: 'break-all', textAlign: 'right', maxWidth: '60%' }}>{d.val}</span></div>)}
                    </div>
                  </>
                )}
                {simStep === 'submitting' && (
                  <div style={{ textAlign: 'center', padding: '50px 0' }}>
                    <div className="spinner" />
                    <p style={{ fontWeight: 600 }}>Simulating transaction...</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '6px' }}>No ledger involved</p>
                  </div>
                )}
                {simStep === 'complete' && (
                  <div style={{ textAlign: 'center', padding: '50px 0' }}>
                    <CheckCircle size={44} style={{ color: 'var(--green)', marginBottom: '12px' }} />
                    <p style={{ fontWeight: 600 }}>Simulated Transaction Complete</p>
                  </div>
                )}
              </div>
              {simStep === 'signing' && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setSimStep('submitting'); setTimeout(() => { if (window._cb) window._cb(); }, 1800); }}>Approve</button>
                  <button className="btn btn-outline" onClick={() => { setShowDrawer(false); setSimStep('idle'); notify('Rejected', 'error'); }}>Reject</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Rating Modal ── */}
        {showRatingModal && ratingJob && (
          <div className="overlay" onClick={() => setShowRatingModal(false)}>
            <div className="modal rating-modal" onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 className="modal-title" style={{ margin: 0 }}>Submit Review & Rating</h3>
                <button style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }} onClick={() => setShowRatingModal(false)}><X size={18} /></button>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Job completed! Leave your feedback for <strong>{ratingJob.agentName}</strong>.</p>
              
              <form onSubmit={handleRatingSubmit}>
                <div className="form-group" style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Agent Rating</label>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                        onClick={() => setRatingStars(star)}
                      >
                        <Star
                          size={28}
                          style={{
                            fill: star <= ratingStars ? '#fcd34d' : 'none',
                            stroke: star <= ratingStars ? '#fcd34d' : 'var(--text-dim)',
                            transition: 'var(--transition)'
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Written Review</label>
                  <textarea
                    className="form-input"
                    style={{ minHeight: '80px', resize: 'vertical' }}
                    placeholder="Write your review about this agent's performance..."
                    value={ratingReviewText}
                    onChange={e => setRatingReviewText(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Submit Rating & Review</button>
              </form>
            </div>
          </div>
        )}

        {/* ── AI Agent Playground Console ── */}
        {activePlaygroundJob && (
          <div className="overlay" onClick={() => setActivePlaygroundJob(null)}>
            <div className="modal playground-modal" style={{ maxWidth: '780px', width: '90%' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="terminal-dots">
                    <span className="dot dot-red" />
                    <span className="dot dot-yellow" />
                    <span className="dot dot-green" />
                  </div>
                  <h3 className="modal-title" style={{ margin: 0, fontSize: '14px', fontFamily: 'monospace' }}>
                    x402_playground_console: ~/{activePlaygroundJob.agentName.toLowerCase().replace(/ /g, '_')}
                  </h3>
                </div>
                <button style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }} onClick={() => setActivePlaygroundJob(null)}><X size={18} /></button>
              </div>

              <div className="playground-grid">
                {/* Left Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label className="form-label" style={{ fontFamily: 'monospace', fontSize: '11px' }}>HTTP ENDPOINT</label>
                    <div style={{ fontFamily: 'monospace', fontSize: '12px', background: 'rgba(37,99,235,0.03)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: '6px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                      POST http://{activePlaygroundJob.agentApiUrl || 'localhost:3000/api/summarize'}
                    </div>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontFamily: 'monospace', fontSize: '11px' }}>HEADER: X-Stellar-Payment-Tx (Simulated reference ID)</label>
                    <div style={{ fontFamily: 'monospace', fontSize: '11px', background: 'rgba(37,99,235,0.03)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: '6px', wordBreak: 'break-all', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <span style={{ color: 'var(--accent)' }}>{activePlaygroundJob.txHash || 'MOCK_TX_XLM'}</span>
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                      *Simulated reference ID generated in this browser. It is not a Stellar transaction hash and no escrow was locked on-chain.
                    </span>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Input Text (AI Task)</label>
                    <textarea
                      className="form-input"
                      style={{ minHeight: '100px', fontSize: '13px', resize: 'none' }}
                      value={playgroundInput}
                      onChange={e => setPlaygroundInput(e.target.value)}
                      placeholder="Enter articles or long text to analyze/process..."
                    />
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', fontFamily: 'monospace' }}
                    onClick={executePlaygroundTask}
                    disabled={playgroundLoading}
                  >
                    {playgroundLoading ? 'PROCESSING...' : 'EXECUTE TASK (X402)'}
                  </button>
                </div>

                {/* Right Panel */}
                <div className="playground-console">
                  <div className="console-header">Console Output</div>
                  <div className="console-body">
                    {playgroundConsoleLogs.length === 0 ? (
                      <div className="console-empty">
                        <Zap size={20} className="glow-pulse" style={{ color: 'var(--text-dim)', marginBottom: '8px' }} />
                        <span style={{ fontSize: '11px' }}>Console ready. Click Execute Task to submit parameters.</span>
                      </div>
                    ) : (
                      playgroundConsoleLogs.map((log, index) => {
                        let color = 'var(--text-secondary)';
                        if (log.startsWith('[sim]')) color = 'var(--amber)';
                        else if (log.startsWith('[CLIENT]')) color = 'var(--blue)';
                        else if (log.startsWith('[HTTP]')) color = 'var(--lavender)';
                        else if (log.startsWith('[x402]')) color = 'var(--amber)';
                        else if (log.startsWith('[GATEWAY] API Response: 200')) color = 'var(--green)';
                        else if (log.startsWith('[GATEWAY] API Response Error') || log.startsWith('[WARNING]')) color = 'var(--red)';
                        else if (log.startsWith('[GATEWAY]')) color = 'var(--text)';
                        return (
                          <div key={index} style={{ color, marginBottom: '6px', fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                            {log}
                          </div>
                        );
                      })
                    )}
                    {playgroundLoading && (
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
        )}
      </div>
    </div>
  );
}
