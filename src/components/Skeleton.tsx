/** Blocos de carregamento no formato do conteúdo (substituem o texto "Carregando..."). */

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <section className="summary-grid skeleton-grid" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
      {Array.from({ length: count }, (_, index) => (
        <div className="stat-card skeleton-card" key={index}>
          <span className="skeleton-line short" />
          <span className="skeleton-line tall" />
          <span className="skeleton-line medium" />
        </div>
      ))}
    </section>
  )
}

export function SkeletonPanel({ lines = 4, chart = false }: { lines?: number; chart?: boolean }) {
  return (
    <section className="panel skeleton-panel" aria-hidden="true">
      <span className="skeleton-line short" />
      <span className="skeleton-line title" />
      {chart ? (
        <span className="skeleton-block" />
      ) : (
        Array.from({ length: lines }, (_, index) => <span className="skeleton-row" key={index} />)
      )}
    </section>
  )
}
