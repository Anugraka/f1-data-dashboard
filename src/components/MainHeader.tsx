type Props = {
  title: string
  subtitle: string
}

export function MainHeader({ title, subtitle }: Props) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-100 bg-white px-6 py-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 md:text-2xl">
          {title}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      </div>
    </header>
  )
}
