"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Chip, IconTile, Panel } from "@/components/ui/primitives";
import { useDictionary } from "@/components/providers/preferences-provider";
import { difficulty as difficultyStyle } from "@/lib/accents";
import { pluralNoun } from "@/lib/i18n/dictionary";
import type { PathSummary } from "@/lib/queries/paths";
import { cn } from "@/lib/utils";

const ROLES = [
  { id: "engineer", label: "Engineer", hint: "I ship product", categories: ["Engineering", "Foundations", "Agents"] },
  { id: "researcher", label: "Researcher", hint: "I read papers", categories: ["Research", "Foundations"] },
  { id: "pm", label: "PM / founder", hint: "I decide what to build", categories: ["Career", "Engineering"] },
  { id: "student", label: "Student", hint: "I am starting out", categories: ["Foundations", "Career"] },
] as const;

const LEVELS = [
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
] as const;

const INTERESTS = [
  { id: "llm", label: "LLMs", categories: ["Engineering", "Foundations"] },
  { id: "agents", label: "Agents", categories: ["Agents"] },
  { id: "rag", label: "RAG", categories: ["Engineering"] },
  { id: "research", label: "Research", categories: ["Research"] },
  { id: "product", label: "AI Product", categories: ["Career"] },
] as const;

type RoleId = (typeof ROLES)[number]["id"];
type LevelId = (typeof LEVELS)[number]["id"];
type InterestId = (typeof INTERESTS)[number]["id"];

function scorePath(
  path: PathSummary,
  role: RoleId,
  level: LevelId,
  interest: InterestId,
): number {
  const roleCats = ROLES.find((item) => item.id === role)?.categories ?? [];
  const interestCats = INTERESTS.find((item) => item.id === interest)?.categories ?? [];
  let score = 0;
  if (path.difficulty === level) score += 4;
  else if (
    (level === "beginner" && path.difficulty === "intermediate") ||
    (level === "advanced" && path.difficulty === "intermediate")
  ) {
    score += 1;
  }
  if ((roleCats as readonly string[]).includes(path.category)) score += 3;
  if ((interestCats as readonly string[]).includes(path.category)) score += 3;
  if (path.isPopular) score += 1;
  return score;
}

export function PathFinder({ paths }: { paths: PathSummary[] }) {
  const dict = useDictionary();
  const [role, setRole] = useState<RoleId | null>(null);
  const [level, setLevel] = useState<LevelId | null>(null);
  const [interest, setInterest] = useState<InterestId | null>(null);

  const roleLabels: Record<RoleId, { label: string; hint: string }> = {
    engineer: { label: dict.pathFinder.engineer, hint: dict.pathFinder.engineerHint },
    researcher: { label: dict.pathFinder.researcher, hint: dict.pathFinder.researcherHint },
    pm: { label: dict.pathFinder.pm, hint: dict.pathFinder.pmHint },
    student: { label: dict.pathFinder.student, hint: dict.pathFinder.studentHint },
  };
  const interestLabels: Record<InterestId, string> = {
    llm: dict.pathFinder.llm,
    agents: dict.pathFinder.agents,
    rag: dict.pathFinder.rag,
    research: dict.pathFinder.research,
    product: dict.pathFinder.product,
  };

  const matches = useMemo(() => {
    if (!role || !level || !interest) return [];
    return [...paths]
      .map((path) => ({ path, score: scorePath(path, role, level, interest) }))
      .sort((a, b) => b.score - a.score || b.path.learnersCount - a.path.learnersCount)
      .slice(0, 2)
      .map((item) => item.path);
  }, [paths, role, level, interest]);

  const complete = Boolean(role && level && interest);

  function reset() {
    setRole(null);
    setLevel(null);
    setInterest(null);
  }

  return (
    <Panel className="overflow-hidden bg-hero-mesh p-5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] text-brand-600 uppercase">
        <Icon name="wand" className="size-3.5" />
        {dict.pathFinder.title}
      </p>
      <h2 className="mt-1.5 text-[15px] font-semibold tracking-[-0.01em] text-ink">{dict.pathFinder.heading}</h2>
      <p className="mt-1 text-[12px] leading-relaxed text-muted">{dict.pathFinder.blurb}</p>

      <fieldset className="mt-4">
        <legend className="text-[11px] font-semibold tracking-[0.1em] text-ink uppercase">{dict.pathFinder.who}</legend>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {ROLES.map((option) => (
            <Choice
              key={option.id}
              active={role === option.id}
              label={roleLabels[option.id].label}
              hint={roleLabels[option.id].hint}
              onClick={() => setRole(option.id)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-[11px] font-semibold tracking-[0.1em] text-ink uppercase">{dict.pathFinder.level}</legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {LEVELS.map((option) => (
            <Choice
              key={option.id}
              active={level === option.id}
              label={dict.difficulty[option.id]}
              onClick={() => setLevel(option.id)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-[11px] font-semibold tracking-[0.1em] text-ink uppercase">{dict.pathFinder.what}</legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {INTERESTS.map((option) => (
            <Choice
              key={option.id}
              active={interest === option.id}
              label={interestLabels[option.id]}
              onClick={() => setInterest(option.id)}
            />
          ))}
        </div>
      </fieldset>

      {complete ? (
        <div className="mt-5 space-y-2.5 border-t border-hairline pt-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold tracking-[0.1em] text-ink uppercase">{dict.pathFinder.suggested}</p>
            <button type="button" onClick={reset} className="text-[11px] font-medium text-brand-600 hover:text-brand-700">
              {dict.pathFinder.startOver}
            </button>
          </div>
          {matches.map((path) => {
            const levelStyle = difficultyStyle(path.difficulty);
            return (
              <Link
                key={path.slug}
                href={`/paths/${path.slug}`}
                className="flex items-start gap-3 rounded-xl border border-hairline bg-surface p-3 transition-shadow hover:shadow-lift"
              >
                <IconTile icon={path.icon} accent={path.accent} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] leading-snug font-semibold text-ink">{path.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                    <Chip className={levelStyle.chip}>
                      {dict.difficulty[path.difficulty as keyof typeof dict.difficulty] ?? levelStyle.label}
                    </Chip>
                    <span>
                      {path.resourceCount} {pluralNoun(dict, path.resourceCount, "resource")}
                    </span>
                    {path.estimatedWeeks ? (
                      <span>
                        · {path.estimatedWeeks} {pluralNoun(dict, path.estimatedWeeks, "week")}
                      </span>
                    ) : null}
                  </span>
                </span>
                <Icon name="arrow-right" className="mt-1 size-3.5 text-slate-400" />
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-[11px] text-muted">{dict.pathFinder.pickAll}</p>
      )}
    </Panel>
  );
}

function Choice({
  active,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2.5 py-1.5 text-left transition-colors",
        active
          ? "border-brand-300 bg-brand-50 text-brand-800"
          : "border-hairline bg-surface text-ink hover:border-brand-200",
      )}
    >
      <span className="block text-[12px] font-medium">{label}</span>
      {hint ? <span className="mt-0.5 block text-[10px] text-muted">{hint}</span> : null}
    </button>
  );
}
