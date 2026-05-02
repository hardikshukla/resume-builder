export function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? 'score-green' : score >= 50 ? 'score-yellow' : 'score-red';
  const label =
    score >= 70 ? 'Strong Match' : score >= 50 ? 'Partial Match' : 'Weak Match';

  return (
    <div className={`score-badge ${color}`}>
      <div className="score-number">{score}%</div>
      <div className="score-label">{label}</div>
      <div className="score-bar">
        <div className="score-fill" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
