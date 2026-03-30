"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Copy, Check } from "lucide-react";
import clsx from "clsx";

interface Prompt {
  id: string;
  direction: string;
  use_case: string;
  title: string;
  type: string;
  content: string;
}

interface PromptGroup {
  direction: string;
  prompts: Prompt[];
}

const directionNames: Record<string, string> = {
  D02: "Expertise Immobiliere",
  D03: "Capital Markets",
  D04: "Office Leasing",
  D05: "Retail Leasing",
  D06: "Marketing & Communication",
  D07: "Research",
  D08: "Data & Gestion des Offres",
  D09: "Analystes",
};

function PromptCard({ prompt }: { prompt: Prompt }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(prompt.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-surface-hover/50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-text-tertiary">
              {prompt.id}
            </span>
            <span className="text-sm font-semibold text-foreground">
              {prompt.title}
            </span>
          </div>
          <span className="text-[10px] font-medium text-text-tertiary px-1.5 py-0.5 rounded bg-surface-alt mt-1 inline-block">
            {prompt.type}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className={clsx(
            "p-2 rounded-lg transition-colors shrink-0",
            copied
              ? "text-success bg-success/10"
              : "text-text-tertiary hover:text-foreground hover:bg-surface-hover"
          )}
          title="Copier le prompt"
        >
          {copied ? (
            <Check className="w-4 h-4" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
        <ChevronDown
          className={clsx(
            "w-4 h-4 text-text-tertiary shrink-0 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="border-t border-border px-5 py-4">
          <pre className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap font-sans">
            {prompt.content}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function PromptsList() {
  const [groups, setGroups] = useState<PromptGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/data/prompts.json")
      .then((r) => r.json())
      .then((prompts: Prompt[]) => {
        const map = new Map<string, Prompt[]>();
        prompts.forEach((p) => {
          const list = map.get(p.direction) || [];
          list.push(p);
          map.set(p.direction, list);
        });
        const sorted = Array.from(map.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([direction, prompts]) => ({ direction, prompts }));
        setGroups(sorted);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-sm text-text-secondary">
          Chargement des prompts...
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <div className="space-y-8">
        {groups.map((group) => (
          <div key={group.direction}>
            <h3 className="text-xs font-bold text-text-tertiary uppercase tracking-wider mb-3">
              {group.direction} — {directionNames[group.direction] ?? ""}
            </h3>
            <div className="space-y-2">
              {group.prompts.map((prompt) => (
                <PromptCard key={prompt.id} prompt={prompt} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
