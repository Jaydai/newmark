"use client";

import AgentsGrid from "@/components/sections/agents-grid";

export default function AgentsPage() {
  return (
    <>
      <div className="bg-white border-b border-border">
        <div className="max-w-6xl mx-auto px-6 pb-10 pt-8 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Agents IA
          </h1>
          <p className="text-text-secondary text-base max-w-2xl mx-auto">
            Agents autonomes deployes sur Azure Functions — scraping, analyse et
            generation de rapports.
          </p>
        </div>
      </div>
      <AgentsGrid />
    </>
  );
}
