import { useState, type ReactNode } from 'react'
import { FuelEraBars } from './FuelEraBars'
import { PowerUnitEnginePies } from './PowerUnitEnginePies'

const INTRO =
  "This dashboard explores the major technical and sporting changes introduced by Formula 1's 2026 regulations. The new era brings redesigned power units, active aerodynamics, revised chassis dimensions, electrical engine updates, and sustainability-focused fuel changes. Through interactive visualizations and race data analysis, this project examines how these changes may affect car performance and on-track competition compared to the 2022–2025 ground effect era."

/** Served from `public/car_comparison.png` (Car Dimensions topic panel). */
const CAR_COMPARISON_SRC = '/car_comparison.png'
const CAR_COMPARISON_WIDTH = 1200
const CAR_COMPARISON_HEIGHT = 900

/** Served from `public/redcar_side.png` (Active Aero / Aerodynamics panel). */
const CAR_SIDE_SRC = '/redcar_side.png'
const CAR_SIDE_WIDTH = 1000
const CAR_SIDE_HEIGHT = 667

/** Served from `public/f126_car2.png`. */
const F126_CAR2_SRC = '/f126_car2.png'
const F126_CAR2_WIDTH = 1920
const F126_CAR2_HEIGHT = 667

type EnergyOptionId = 'boost' | 'overtake' | 'recharge'

/** Same reds / blues / yellows as lap-time track sector strokes in `data/circuits.ts`. */
const ENERGY_WHEEL_STYLE: Record<
  EnergyOptionId,
  { fill: string; labelClass: string }
> = {
  boost: { fill: '#E10600', labelClass: 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]' },
  overtake: { fill: '#FFD200', labelClass: 'text-zinc-900' },
  recharge: { fill: '#00A3E0', labelClass: 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]' },
}

const ENERGY_OPTIONS: { id: EnergyOptionId; label: string; description: string }[] = [
  {
    id: 'boost',
    label: 'Boost',
    description:
      'Boost: Boost Mode allows drivers to activate energy deployment at any point in the lap. When engaged, it will trigger a change in power unit power settings, either returning to maximum power or a profile configured by the team as per their personal choice. The boost could, in theory, either help them defend from a car behind or attack a car ahead providing they have saved enough charge. It can be used all at once or spread across the lap, depending on when they have the best chance to attack or where they are most vulnerable.',
  },
  {
    id: 'overtake',
    label: 'Overtake',
    description:
      'Overtake: Overtake Mode allows a driver to recharge an extra +0.5MJ (megajoules) and generate an additional electrical power profile to allow them to sustain a higher speed for a longer period. It can only be activated when a driver is within a second of the car in front at the detection point, which is nominally the final corner. It can only be used on the following lap. Its use will be most effective on longer straights as the delta speed it will deliver should have a greater effect on closing the distance between the two competing cars.',
  },
  {
    id: 'recharge',
    label: 'Recharge',
    description:
      "Recharge: Recharge Mode will be automated by use of selectable recharge maps and targets. Cars will harvest energy to charge the battery when braking, on part throttle, when lifting off (when a driver lifts off the throttle early) or when 'super clipping' (when some harvesting happens at the end of the straight when a car is still at full throttle). The only Recharge mode the driver will have direct control of will be lift-off regen, whereby if the driver lifts off, then they can recharge their battery. However, doing this will disable the Active devices as well.",
  },
]

const ENERGY_OPTIONS_PLACEHOLDER = 'Click on a button to learn more about the feature'

/** Numbered goals under “Why?” (rendered as an ordered list). */
const WHY_BODY_SENTENCES: string[] = [
  'Create smaller, more agile cars that will suffer less from safety risks that come with the high speeds and massive cars',
  'Make overtaking more accessible to drivers, in turn improving race quality and making races more entertaining for views',
  'Increase the use of electrical energy and battery deployment to improve energy efficiency throughout a race weekend',
  'Expand the role of hybrid power units to balance performance with more modern and sustainable engine technology',
  "Introduce fully sustainable fuels to support Formula 1's goal of becoming net zero carbon by 2030",
]

type HomeTopicStripId =
  | 'car-dimensions'
  | 'aerodynamics'
  | 'energy-options'
  | 'power-units'
  | 'fuel'

const HOME_TOPIC_STRIP: {
  id: HomeTopicStripId
  label: string
  fill: string
  labelClass: string
}[] = [
  { id: 'car-dimensions', label: 'Car Dimensions', fill: '#780116', labelClass: 'text-white' },
  { id: 'aerodynamics', label: 'Aerodynamics', fill: '#F7B538', labelClass: 'text-zinc-900' },
  { id: 'energy-options', label: 'Energy Options', fill: '#DB7C26', labelClass: 'text-white' },
  { id: 'power-units', label: 'Power Units', fill: '#D8572A', labelClass: 'text-white' },
  { id: 'fuel', label: 'Fuel', fill: '#C32F27', labelClass: 'text-white' },
]

function hasAeroAsideContent(value: ReactNode | undefined): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

function hasTopicBodyAfter(value: ReactNode | undefined): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

type HomeTopicPanelEntry = {
  title: string
  body: string
  /** Optional second paragraph (e.g. Power Units) shown after `body`. */
  bodyAfter?: ReactNode
  image?: { src: string; width: number; height: number; alt: string }
  /** Side-view + column layout from the former Active Aero home section. */
  activeAeroLayout?: boolean
  /** Copy beside the side-view image when `activeAeroLayout` is set. */
  aeroAsideLeft?: ReactNode
  aeroAsideRight?: ReactNode
  /** Wheel controls + dynamic copy from the former Energy Options home section. */
  energyOptionsLayout?: boolean
}

/** Shown under the colored strip when that row is selected; replace copy as needed. */
const HOME_TOPIC_PANEL: Record<HomeTopicStripId, HomeTopicPanelEntry> = {
  'car-dimensions': {
    title: 'Car Dimensions',
    body: 'Changing car dimensions and weight in the 2026 regulations is important because it directly affects how the car behaves on track and how closely cars can race each other. Smaller and lighter cars improve agility, making them easier to handle in corners and on tight circuits. Reducing weight also improves braking, acceleration, and energy efficiency, which ties into the hybrid and sustainability goals.',
    image: {
      src: CAR_COMPARISON_SRC,
      width: CAR_COMPARISON_WIDTH,
      height: CAR_COMPARISON_HEIGHT,
      alt: 'Comparison of Formula 1 car dimensions between the prior regulations era and the 2026 regulations era',
    },
  },
  aerodynamics: {
    title: 'Aerodynamics',
    body: '',
    activeAeroLayout: true,
    aeroAsideLeft: (
      <>
        <strong className="font-semibold text-zinc-900">Active Aero:</strong>{' '}
        In 2026 Formula 1 cars, both the front and rear wings can actively change their angle while driving. This is
        a major shift from the ground-effect era (2022–2025), where aerodynamic settings were fixed during a lap, and
        downforce changes mainly came from airflow under the car rather than moving bodywork.
      </>
    ),
    aeroAsideRight: (
      <>
        <strong className="font-semibold text-zinc-900">X-mode</strong> is used on straights, where the front
        and rear wings flatten to reduce drag and allow higher top speeds.{' '}
        <strong className="font-semibold text-zinc-900">Z-mode</strong> is used in corners, where the wings tilt
        to create more downforce, improving grip and stability. This system replaces the fixed-aero setup of the 
        ground-effect era, resulting in active aerodynamics.
      </>
    ),
  },
  'energy-options': {
    title: 'Energy Options',
    body: '',
    energyOptionsLayout: true,
  },
  'power-units': {
    title: 'Power Units',
    body: 'The 2026 Formula 1 regulations keep the 1.6-litre V6 hybrid engine from the ground effect era, but shift from the previous roughly 80/20 internal combustion-to-electric power split to a near 50/50 balance by significantly increasing battery deployment and electrical power output. This change was made to improve energy efficiency, make the technology more relevant to modern road cars, and support the sport’s long-term sustainability and net zero carbon goals while still maintaining high performance.',
    bodyAfter:
      'Between the ground-effect era and 2026, engine supply in Formula 1 shifted while still retaining some continuity among top manufacturers. Mercedes and Ferrari remained key suppliers, Honda continued through new partnerships, and new manufacturers like Ford and Audi entered the sport, while Renault withdrew as a power unit supplier under the updated 2026 regulations.',
  },
  fuel: {
    title: 'Fuel',
    body:
      'In the ground-effect era (2022–2025), Formula 1 fuel was already partly sustainable, using bio-components blended with conventional fuel, but it was not fully decarbonised and still relied on traditional fuel production methods.',
    bodyAfter: (
      <>
        In 2026, F1 switches to{' '}
        <strong className="font-semibold text-zinc-900">100% advanced sustainable fuel</strong>, which is fully
        synthetic and derived from non-food waste, municipal waste, or carbon capture technologies. This marks a major
        step toward the sport’s goal of net zero carbon by 2030 and is designed to work alongside the increased
        electrical contribution in the hybrid power units.
      </>
    ),
  },
}

/** Landing view; additional sections can stack below the intro. */
export function HomePage() {
  const [energySelection, setEnergySelection] = useState<EnergyOptionId | null>(null)
  const [topicStripId, setTopicStripId] = useState<HomeTopicStripId>('car-dimensions')
  const energyBody =
    energySelection === null
      ? ENERGY_OPTIONS_PLACEHOLDER
      : (ENERGY_OPTIONS.find((o) => o.id === energySelection)?.description ?? ENERGY_OPTIONS_PLACEHOLDER)

  const topicPanel = HOME_TOPIC_PANEL[topicStripId]

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-6" aria-label="Home">
      <section
        className="w-full rounded-xl px-6 py-8 text-center shadow-sm md:px-8 md:py-10"
        style={{ backgroundColor: '#FF1801' }}
        aria-labelledby="home-hero-heading"
      >
        <h2
          id="home-hero-heading"
          className="m-0 text-2xl font-bold leading-tight tracking-tight text-white md:text-4xl lg:text-5xl"
        >
          Formula 1 2026 Regulations: The New Era
        </h2>
      </section>
      <section className="w-full rounded-xl border border-zinc-200 bg-white p-6 shadow-sm md:p-8">
        <p className="w-full text-base leading-relaxed text-zinc-700 md:text-lg">
          {INTRO}
        </p>
      </section>
      <div className="w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <img
          src={F126_CAR2_SRC}
          alt="2026 Formula 1 car concept illustration"
          width={F126_CAR2_WIDTH}
          height={F126_CAR2_HEIGHT}
          className="block h-auto w-full"
          loading="lazy"
          decoding="async"
        />
      </div>
      <section
        className="w-full rounded-xl border border-zinc-200 bg-white p-6 shadow-sm md:p-8"
        aria-labelledby="home-why-heading"
      >
        <h3
          id="home-why-heading"
          className="m-0 text-center text-xl font-bold leading-tight tracking-tight md:text-2xl lg:text-3xl"
          style={{ color: '#FF1801' }}
        >
          Why?
        </h3>
        <ol className="mt-6 list-decimal space-y-3 border-t border-zinc-200 pt-6 pl-6 text-left text-base leading-relaxed text-zinc-700 marker:font-medium marker:text-zinc-800 md:pl-8 md:text-lg">
          {WHY_BODY_SENTENCES.map((sentence, index) => (
            <li key={index} className="pl-2 leading-relaxed">
              {sentence}
            </li>
          ))}
        </ol>
      </section>
      <section
        className="flex w-full justify-center rounded-xl border border-zinc-200 bg-white px-6 py-4 shadow-sm md:px-8 md:py-5"
        aria-labelledby="home-whats-changing-heading"
      >
        <h3
          id="home-whats-changing-heading"
          className="m-0 text-center text-xl font-bold leading-tight tracking-tight md:text-2xl lg:text-3xl"
          style={{ color: '#FF1801' }}
        >
          What's Changing?
        </h3>
      </section>
      <div className="flex w-full flex-col gap-4">
        <div
          className="grid h-[240px] w-full grid-cols-5 overflow-hidden rounded-xl border border-zinc-200 shadow-sm md:h-[300px]"
          role="group"
          aria-label="Regulation topics"
        >
          {HOME_TOPIC_STRIP.map((row) => {
            const selected = topicStripId === row.id
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => setTopicStripId(row.id)}
                aria-pressed={selected}
                style={{ backgroundColor: row.fill }}
                className={[
                  'flex min-h-0 min-w-0 flex-col items-center justify-center border-r border-black/15 px-1 py-3 text-center transition-[filter,box-shadow] last:border-r-0 md:px-2',
                  row.labelClass,
                  selected
                    ? 'z-10 shadow-[inset_0_0_0_2px_rgba(24,24,27,0.85)]'
                    : 'hover:brightness-[1.08]',
                ].join(' ')}
              >
                <span className="block max-w-full px-0.5 text-center text-sm leading-snug font-semibold tracking-tight sm:text-base md:text-lg lg:text-xl">
                  {row.label}
                </span>
              </button>
            )
          })}
        </div>
        <section
          className="w-full rounded-xl border border-zinc-200 bg-white p-6 shadow-sm md:p-8"
          aria-labelledby="home-topic-panel-heading"
          aria-live="polite"
        >
          <h4
            id="home-topic-panel-heading"
            className="m-0 text-lg font-semibold tracking-tight text-zinc-900 md:text-xl"
          >
            {topicPanel.title}
          </h4>
          {topicPanel.body.trim() ? (
            <p
              className={[
                'text-base leading-relaxed text-zinc-700 md:text-lg',
                'mt-3',
              ].join(' ')}
            >
              {topicPanel.body}
            </p>
          ) : null}
          {hasTopicBodyAfter(topicPanel.bodyAfter) ? (
            <p className="mt-4 text-base leading-relaxed text-zinc-700 md:text-lg">{topicPanel.bodyAfter}</p>
          ) : null}
          {topicPanel.image ? (
            <div className="mx-auto mt-4 w-1/2 min-w-0 max-w-full overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <img
                src={topicPanel.image.src}
                alt={topicPanel.image.alt}
                width={topicPanel.image.width}
                height={topicPanel.image.height}
                className="block h-auto w-full"
                loading="lazy"
                decoding="async"
              />
            </div>
          ) : null}
          {topicPanel.energyOptionsLayout ? (
            <>
              <div
                className="mt-6 flex flex-wrap items-center justify-center gap-6 md:gap-10"
                role="group"
                aria-label="Energy mode"
              >
                {ENERGY_OPTIONS.map((opt) => {
                  const active = energySelection === opt.id
                  const wheel = ENERGY_WHEEL_STYLE[opt.id]
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setEnergySelection(opt.id)}
                      aria-pressed={active}
                      style={{ backgroundColor: wheel.fill }}
                      className={[
                        'flex size-28 shrink-0 items-center justify-center rounded-full border-2 border-black/25 text-center text-xs font-bold uppercase leading-tight tracking-wide shadow-[inset_0_3px_6px_rgba(255,255,255,0.35),inset_0_-4px_10px_rgba(0,0,0,0.22),0_6px_14px_rgba(0,0,0,0.18)] transition-[transform,box-shadow,filter] duration-150 md:size-32 md:text-sm',
                        wheel.labelClass,
                        active
                          ? 'z-10 scale-105 ring-[3px] ring-zinc-900 ring-offset-[3px] ring-offset-white brightness-105'
                          : 'hover:brightness-110 active:scale-95',
                      ].join(' ')}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              <p
                className={[
                  'mt-10 text-[15px] leading-relaxed md:mt-12 md:text-base',
                  energySelection === null ? 'text-zinc-500' : 'text-zinc-700',
                ].join(' ')}
                aria-live="polite"
              >
                {energyBody}
              </p>
            </>
          ) : null}
          {topicPanel.activeAeroLayout ? (
            <div className="mt-4 flex min-w-0 flex-col items-stretch gap-6 md:flex-row md:items-start md:gap-6 lg:gap-8">
              <aside
                className="order-2 min-w-0 md:order-1 md:w-1/4 md:shrink-0"
                aria-label="Active aero — left column"
              >
                {hasAeroAsideContent(topicPanel.aeroAsideLeft) ? (
                  <p className="m-0 text-sm leading-relaxed text-zinc-700 md:text-base">
                    {topicPanel.aeroAsideLeft}
                  </p>
                ) : (
                  <span className="sr-only">Reserved for left-side copy</span>
                )}
              </aside>
              <div className="order-1 min-w-0 md:order-2 md:flex-1">
                <img
                  src={CAR_SIDE_SRC}
                  alt="Side view of a Formula 1 car in red livery, illustrating active aerodynamics and bodywork"
                  width={CAR_SIDE_WIDTH}
                  height={CAR_SIDE_HEIGHT}
                  className="m-0 block h-auto w-full border-0 p-0"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <aside
                className="order-3 min-w-0 md:w-1/4 md:shrink-0"
                aria-label="Active aero — right column"
              >
                {hasAeroAsideContent(topicPanel.aeroAsideRight) ? (
                  <p className="m-0 text-sm leading-relaxed text-zinc-700 md:text-base">
                    {topicPanel.aeroAsideRight}
                  </p>
                ) : (
                  <span className="sr-only">Reserved for right-side copy</span>
                )}
              </aside>
            </div>
          ) : null}
          {topicStripId === 'power-units' ? <PowerUnitEnginePies /> : null}
          {topicStripId === 'fuel' ? <FuelEraBars /> : null}
        </section>
      </div>
    </div>
  )
}
