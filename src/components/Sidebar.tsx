import type { Circuit } from '../types'

type Props = {
  circuits: Circuit[]
  selectedId: string
  isHome: boolean
  onHome: () => void
  onSelectCircuit: (id: string) => void
}

export function Sidebar({ circuits, selectedId, isHome, onHome, onSelectCircuit }: Props) {
  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-zinc-200 bg-white">
      <div className="flex items-center justify-center border-b border-zinc-100 px-4 py-4">
        <img
          src="/f1_logo.png"
          alt="Formula 1"
          width={3840}
          height={2160}
          className="h-auto max-h-8 w-auto max-w-full object-contain"
        />
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2" aria-label="Main">
        <button
          type="button"
          onClick={onHome}
          className={[
            'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-medium text-white transition-[filter,box-shadow] border-[#c41200]/50 bg-[#FF1801]',
            isHome
              ? 'shadow-inner ring-2 ring-zinc-900 ring-offset-2 ring-offset-white'
              : 'hover:brightness-110',
          ].join(' ')}
        >
          Home
        </button>
        <div className="px-1 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Tracks
        </div>
        {circuits.map((c) => {
          const active = !isHome && c.id === selectedId
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelectCircuit(c.id)}
              className={[
                'flex w-full items-center gap-3 rounded-lg border px-2 py-2.5 text-left transition-colors',
                active
                  ? 'border-[#c41200]/50 bg-[#FF1801]/12'
                  : 'border-transparent hover:bg-zinc-50',
              ].join(' ')}
            >
              <svg
                className="size-12 shrink-0 rounded-md border border-zinc-200/80 bg-zinc-50"
                viewBox="-4 -4 88 68"
                preserveAspectRatio="xMidYMid meet"
                aria-hidden
              >
                {c.thumbSectors?.length ? (
                  c.thumbSectors.map((seg, i) => (
                    <path
                      key={i}
                      d={seg.d}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))
                ) : c.thumbPath ? (
                  <path
                    d={c.thumbPath}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
              </svg>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-zinc-900">
                  {c.sidebarLabel ?? c.name}
                </div>
                <div className="truncate text-xs text-zinc-500">{c.country}</div>
              </div>
            </button>
          )
        })}
        <div className="mt-2 space-y-2 border-t border-zinc-100 px-1 pt-3 pb-1 text-[11px] leading-snug text-zinc-500">
          <p>All data was collected from the FastF1 API and the official Formula 1 website.</p>
          <p>The dashboard updates every Monday at 6:00 UTC.</p>
        </div>
      </nav>
    </aside>
  )
}
