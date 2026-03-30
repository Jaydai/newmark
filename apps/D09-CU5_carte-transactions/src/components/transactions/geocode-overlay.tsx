"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { Transaction } from "@/lib/types";
import { hasCoords, geocode } from "@/lib/geocode";

interface GeocodeOverlayProps {
  open: boolean;
  onClose: () => void;
  transactions: Transaction[];
  onGeocoded: (id: string, lat: number, lng: number) => void;
}

export default function GeocodeOverlay({ open, onClose, transactions, onGeocoded }: GeocodeOverlayProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [total, setTotal] = useState(0);
  const [running, setRunning] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setProgress(0);
    setStatus("");
    setTotal(0);
    setRunning(false);
    cancelRef.current = false;
  }, [open]);

  const start = useCallback(async () => {
    cancelRef.current = false;
    setRunning(true);

    const unlocated = transactions.filter((tx) => !hasCoords(tx.lat, tx.lng));
    // Group by unique address
    const addrMap = new Map<string, Transaction[]>();
    unlocated.forEach((tx) => {
      const parts = [tx.streetNumber, tx.street, tx.zipCode, tx.city].filter(Boolean);
      if (parts.length < 2) return;
      const key = parts.join(" ").toLowerCase();
      if (!addrMap.has(key)) addrMap.set(key, []);
      addrMap.get(key)!.push(tx);
    });

    const uniqueAddrs = [...addrMap.entries()];
    setTotal(uniqueAddrs.length);
    let success = 0;

    for (let i = 0; i < uniqueAddrs.length; i++) {
      if (cancelRef.current) break;
      const [addr, txs] = uniqueAddrs[i];
      setProgress(i + 1);
      setStatus(`Géocodage ${i + 1}/${uniqueAddrs.length}…`);

      try {
        const r = await geocode(addr);
        txs.forEach((tx) => onGeocoded(tx.id, r.lat, r.lng));
        success++;
      } catch {}

      // Rate limit: 1.1s between requests
      if (i < uniqueAddrs.length - 1 && !cancelRef.current) {
        for (let w = 0; w < 11; w++) {
          if (cancelRef.current) break;
          await new Promise((r) => setTimeout(r, 100));
        }
      }
    }

    setStatus(cancelRef.current
      ? `Annulé — ${success} adresses localisées`
      : `✓ ${success}/${uniqueAddrs.length} adresses localisées`
    );
    setRunning(false);
    setTimeout(onClose, cancelRef.current ? 900 : 2000);
  }, [transactions, onGeocoded, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[3000] bg-black/60 backdrop-blur-[4px] flex items-center justify-center">
      <div className="bg-white rounded-xl p-8 max-w-md w-full shadow-2xl text-center">
        <h3 className="text-sm font-bold mb-4">Géocodage des transactions</h3>

        {!running && !status && (
          <button onClick={start}
            className="px-6 py-2.5 bg-accent text-white border-none rounded-lg text-xs font-semibold cursor-pointer hover:bg-accent/90 transition-colors">
            Démarrer le géocodage
          </button>
        )}

        {running && (
          <>
            <div className="text-xs text-text-secondary mb-3">{status}</div>
            <div className="w-full h-2 bg-surface-alt rounded-full overflow-hidden mb-4">
              <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${total ? (progress / total) * 100 : 0}%` }} />
            </div>
            <button onClick={() => { cancelRef.current = true; }}
              className="px-5 py-2 border-[1.5px] border-border-input rounded-lg text-xs font-semibold cursor-pointer hover:bg-surface-hover transition-colors">
              Annuler
            </button>
          </>
        )}

        {!running && status && (
          <div className="text-xs text-text-secondary">{status}</div>
        )}
      </div>
    </div>
  );
}
