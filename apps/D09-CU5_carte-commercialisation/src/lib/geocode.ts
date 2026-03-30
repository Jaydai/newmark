export async function geocode(
  address: string
): Promise<{ lat: number; lng: number }> {
  const r = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
    {
      headers: {
        "Accept-Language": "fr",
        "User-Agent": "Newmark-Cartes/2.0",
      },
    }
  );
  if (!r.ok) throw new Error(`Erreur réseau (${r.status})`);
  const d = await r.json();
  if (!d.length) throw new Error("Adresse introuvable");
  return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
}

export function hasCoords(
  lat: number | null | undefined,
  lng: number | null | undefined
): lat is number {
  return (
    lat != null &&
    lng != null &&
    String(lat).trim() !== "" &&
    String(lng).trim() !== "" &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng))
  );
}
