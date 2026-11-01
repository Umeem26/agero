import { stroopsToXlm } from '../chain/units';
import { CategoryChip, SampleBadge, Stars } from './ui';
import AddressGlyph from './AddressGlyph';

// One registry agent. Name, price, rating and completed jobs come from the contract (the list header
// says so once); the category exists only in this frontend and is flagged UI-only. The footer is a
// fixed two-row grid so its divider lines up across a row of cards. The name is the card's real
// control (keyboard: Tab, Enter/Space); .card-link stretches its click area over the whole card.
export default function AgentCard({ agent, onOpen }) {
  return (
    <article className="card agent-card">
      <div className="agent-card-head">
        <AddressGlyph address={agent.owner} />
        <div className="agent-card-title">
          <h3 className="agent-name"><button type="button" className="card-link" onClick={onOpen}>{agent.name}</button></h3>
          <div className="agent-tags">
            {agent.isSample && <SampleBadge />}
            <CategoryChip category={agent.category} />
          </div>
        </div>
      </div>
      <p className="agent-desc">{agent.summary}</p>
      <div className="agent-card-foot">
        <span className="agent-price">{stroopsToXlm(agent.price)}<span className="price-unit"> XLM</span></span>
        <span className="agent-jobs">{agent.totalJobs} completed</span>
        <span className="agent-rating"><Stars average={agent.averageRating} count={agent.ratingCount} /></span>
      </div>
    </article>
  );
}
