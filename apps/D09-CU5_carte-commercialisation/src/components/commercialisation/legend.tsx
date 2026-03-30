"use client";

export default function Legend() {
  return (
    <div className="fixed left-3 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-[900] flex items-center gap-3 rounded-[var(--radius)] border border-border bg-white/95 px-3 py-2 text-[9px] shadow-sm backdrop-blur-sm sm:left-5 sm:bottom-5 sm:block sm:p-3 sm:text-[10px]">
      <div className="flex items-center gap-2 sm:mb-1.5">
        <div className="w-3 h-3 rounded-full bg-map-green border-[1.5px] border-white shadow-sm" />
        <span className="font-medium sm:hidden">Actif</span>
        <span className="hidden font-medium sm:inline">Actif a commercialiser</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-map-blue border-[1.5px] border-white shadow-sm" />
        <span className="font-medium sm:hidden">Comp.</span>
        <span className="hidden font-medium sm:inline">Comparable</span>
      </div>
    </div>
  );
}
