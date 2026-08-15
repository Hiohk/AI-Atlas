/**
 * Accent tokens are stored as names in the database (`topics.accent`,
 * `resource_types.accent`), so the class strings have to be statically listed
 * here for Tailwind to emit them.
 */
export type Accent = keyof typeof ACCENTS;

export const ACCENTS = {
  indigo: { tile: "bg-indigo-50 text-indigo-600", text: "text-indigo-600", chip: "bg-indigo-50 text-indigo-700 ring-indigo-100", bar: "bg-indigo-500", ring: "ring-indigo-200", glow: "from-indigo-500/12" },
  violet: { tile: "bg-violet-50 text-violet-600", text: "text-violet-600", chip: "bg-violet-50 text-violet-700 ring-violet-100", bar: "bg-violet-500", ring: "ring-violet-200", glow: "from-violet-500/12" },
  purple: { tile: "bg-purple-50 text-purple-600", text: "text-purple-600", chip: "bg-purple-50 text-purple-700 ring-purple-100", bar: "bg-purple-500", ring: "ring-purple-200", glow: "from-purple-500/12" },
  fuchsia: { tile: "bg-fuchsia-50 text-fuchsia-600", text: "text-fuchsia-600", chip: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-100", bar: "bg-fuchsia-500", ring: "ring-fuchsia-200", glow: "from-fuchsia-500/12" },
  rose: { tile: "bg-rose-50 text-rose-600", text: "text-rose-600", chip: "bg-rose-50 text-rose-700 ring-rose-100", bar: "bg-rose-500", ring: "ring-rose-200", glow: "from-rose-500/12" },
  red: { tile: "bg-red-50 text-red-600", text: "text-red-600", chip: "bg-red-50 text-red-700 ring-red-100", bar: "bg-red-500", ring: "ring-red-200", glow: "from-red-500/12" },
  orange: { tile: "bg-orange-50 text-orange-600", text: "text-orange-600", chip: "bg-orange-50 text-orange-700 ring-orange-100", bar: "bg-orange-500", ring: "ring-orange-200", glow: "from-orange-500/12" },
  amber: { tile: "bg-amber-50 text-amber-600", text: "text-amber-600", chip: "bg-amber-50 text-amber-700 ring-amber-100", bar: "bg-amber-500", ring: "ring-amber-200", glow: "from-amber-500/12" },
  lime: { tile: "bg-lime-50 text-lime-600", text: "text-lime-600", chip: "bg-lime-50 text-lime-700 ring-lime-100", bar: "bg-lime-500", ring: "ring-lime-200", glow: "from-lime-500/12" },
  emerald: { tile: "bg-emerald-50 text-emerald-600", text: "text-emerald-600", chip: "bg-emerald-50 text-emerald-700 ring-emerald-100", bar: "bg-emerald-500", ring: "ring-emerald-200", glow: "from-emerald-500/12" },
  teal: { tile: "bg-teal-50 text-teal-600", text: "text-teal-600", chip: "bg-teal-50 text-teal-700 ring-teal-100", bar: "bg-teal-500", ring: "ring-teal-200", glow: "from-teal-500/12" },
  cyan: { tile: "bg-cyan-50 text-cyan-600", text: "text-cyan-600", chip: "bg-cyan-50 text-cyan-700 ring-cyan-100", bar: "bg-cyan-500", ring: "ring-cyan-200", glow: "from-cyan-500/12" },
  sky: { tile: "bg-sky-50 text-sky-600", text: "text-sky-600", chip: "bg-sky-50 text-sky-700 ring-sky-100", bar: "bg-sky-500", ring: "ring-sky-200", glow: "from-sky-500/12" },
  blue: { tile: "bg-blue-50 text-blue-600", text: "text-blue-600", chip: "bg-blue-50 text-blue-700 ring-blue-100", bar: "bg-blue-500", ring: "ring-blue-200", glow: "from-blue-500/12" },
  slate: { tile: "bg-slate-100 text-slate-700", text: "text-slate-700", chip: "bg-slate-100 text-slate-700 ring-slate-200", bar: "bg-slate-600", ring: "ring-slate-200", glow: "from-slate-500/12" },
} as const;

export function accent(name: string | null | undefined) {
  return ACCENTS[(name ?? "indigo") as Accent] ?? ACCENTS.indigo;
}

export const DIFFICULTY_STYLES = {
  beginner: { label: "Beginner", chip: "bg-emerald-50 text-emerald-700 ring-emerald-100", bar: "bg-emerald-500", steps: 1 },
  intermediate: { label: "Intermediate", chip: "bg-amber-50 text-amber-700 ring-amber-100", bar: "bg-amber-500", steps: 2 },
  advanced: { label: "Advanced", chip: "bg-rose-50 text-rose-700 ring-rose-100", bar: "bg-rose-500", steps: 3 },
} as const;

export function difficulty(name: string | null | undefined) {
  return DIFFICULTY_STYLES[(name ?? "intermediate") as keyof typeof DIFFICULTY_STYLES] ?? DIFFICULTY_STYLES.intermediate;
}

export const STATE_STYLES = {
  saved: { label: "Saved", chip: "bg-brand-50 text-brand-700 ring-brand-100", icon: "bookmark" },
  in_progress: { label: "In progress", chip: "bg-amber-50 text-amber-700 ring-amber-100", icon: "circle-dashed" },
  completed: { label: "Completed", chip: "bg-emerald-50 text-emerald-700 ring-emerald-100", icon: "check-circle" },
} as const;
