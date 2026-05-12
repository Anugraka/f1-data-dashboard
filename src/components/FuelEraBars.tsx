import type { ReactNode } from 'react'
import { DRS_STATUS_COLORS } from '../data/telemetry'

const DARK_GREEN = DRS_STATUS_COLORS.on

function FuelBarTooltip({ pct, children }: { pct: number; children: ReactNode }) {
  const label = `${pct}% sustainable fuel`
  return (
    <div
      className="group relative min-w-0 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-zinc-400"
      tabIndex={0}
      aria-label={label}
    >
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </div>
  )
}

export function FuelEraBars() {
  return (
    <div className="mx-auto mt-8 w-full max-w-xl md:max-w-2xl">
      <h5 className="m-0 mb-3 text-center text-sm font-semibold tracking-tight text-zinc-900 md:mb-4 md:text-base">
        % Sustainable Fuel
      </h5>
      <div className="flex flex-col gap-4 md:gap-5">
        <div className="flex min-w-0 items-center gap-3 md:gap-4">
          <span className="w-[6.75rem] shrink-0 text-left text-xs font-semibold text-zinc-700 md:w-[7.5rem] md:text-sm">
            2022–2025
          </span>
          <FuelBarTooltip pct={10}>
            <div className="flex h-10 min-w-0 w-full overflow-hidden rounded-lg border border-zinc-300 shadow-sm md:h-11">
              <div className="min-w-0 flex-[1] shrink-0" style={{ backgroundColor: DARK_GREEN }} />
              <div className="min-w-0 flex-[9] bg-zinc-300" />
            </div>
          </FuelBarTooltip>
        </div>
        <div className="flex min-w-0 items-center gap-3 md:gap-4">
          <span className="w-[6.75rem] shrink-0 text-left text-xs font-semibold text-zinc-700 md:w-[7.5rem] md:text-sm">
            2026
          </span>
          <FuelBarTooltip pct={100}>
            <div
              className="h-10 min-w-0 w-full rounded-lg border border-zinc-300 shadow-sm md:h-11"
              style={{ backgroundColor: DARK_GREEN }}
            />
          </FuelBarTooltip>
        </div>
      </div>
    </div>
  )
}
