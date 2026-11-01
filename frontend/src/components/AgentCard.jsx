import { stroopsToXlm } from '../chain/units';
import { ContractMark, SampleBadge, Stars } from './ui';
import AddressGlyph from './AddressGlyph';

// One registry agent. Name, price, rating and completed jobs come from the contract; the category
// exists only in this frontend and is shown dimmed. The name is the card's real control
// (keyboard: Tab, Enter/Space); .card-link stretches its click area over the whole card.
export default function AgentCard({ agent, onOpen }) {
  return (
    <article className="card agent-card">
      <div className="agent-card-head">
        <AddressGlyph address={agent.owner} />
        <div className="agent-card-title">
          <h3 className="agent-name"><button type="button" className="card-link" onClick={onOpen}>{agent.name}</button></h3>
          <div className="agent-tags">
            {agent.isSample && <SampleBadge />}
            <span className="src-ui" title="Category is set in this frontend; the contract does not store it">{agent.category}</span>
          </div>
        </div>
      </div>
      <p className="agent-desc">{agent.summary}</p>
      <div className="agent-card-foot">
        <div className="agent-figures">
          <span className="agent-price">{stroopsToXlm(agent.price)}<span className="price-unit"> XLM</span></span>
          <Stars average={agent.averageRating} count={agent.ratingCount} />
          <span className="agent-jobs">{agent.totalJobs} completed</span>
        </div>
        <ContractMark />
      </div>
    </article>
  );
}
