"use client";

import PromptsList from "@/components/sections/prompts-list";

export default function PromptsPage() {
  return (
    <>
      <div className="bg-white border-b border-border">
        <div className="max-w-6xl mx-auto px-6 pb-10 pt-8 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Prompts Copilot
          </h1>
          <p className="text-text-secondary text-base max-w-2xl mx-auto">
            Bibliotheque de prompts specialises immobilier — cliquez pour voir
            le contenu, copiez d&apos;un clic.
          </p>
        </div>
      </div>
      <PromptsList />
    </>
  );
}
