"use client";

export default function Legend() {
  return (
    <div className="fixed bottom-6 left-6 max-h-[calc(100vh-200px)] bg-white border border-border rounded-[var(--radius)] px-4 py-3.5 shadow-sm z-[900] text-[11px]">
      <h4 className="mb-2 text-[8px] uppercase tracking-[1.5px] text-black/45 font-semibold">
        Légende
      </h4>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-3 h-3 rounded-full shrink-0 shadow-[0_0_8px_rgba(0,0,0,.2)] bg-map-green border-2 border-white/30" />
        Adresse de référence
      </div>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-3 h-3 rounded-full shrink-0 shadow-[0_0_8px_rgba(0,0,0,.2)] bg-map-blue border-2 border-white/20" />
        Comparable
      </div>
    </div>
  );
}
