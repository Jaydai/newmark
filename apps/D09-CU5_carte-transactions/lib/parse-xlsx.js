const XLSX = require("xlsx");
const crypto = require("crypto");
const fs = require("fs");
const { computeFields } = require("../public/transaction-fields");

const COL_MAP = [
  { field: "year", patterns: ["year", "annee", "année", "date", "ann"] },
  { field: "type", patterns: ["type", "nature", "operation"] },
  { field: "landlord", patterns: ["landlord", "bailleur", "proprietaire", "propriétaire", "owner"] },
  { field: "previousTenant", patterns: ["previous tenant", "preneur sortant", "ancien locataire", "locataire sortant", "sortant"] },
  { field: "newTenant", patterns: ["new tenant", "preneur entrant", "nouveau locataire", "locataire entrant", "entrant", "preneur"] },
  { field: "enseigne", patterns: ["enseigne", "ngel", "marque", "brand", "sign"] },
  { field: "streetNumber", patterns: ["street number", "numero", "numéro", "n°", "no", "num"] },
  { field: "street", patterns: ["street", "rue", "voie", "adresse", "address"] },
  { field: "zipCode", patterns: ["zip code", "zip", "code postal", "cp", "code"] },
  { field: "city", patterns: ["city", "ville", "commune"] },
  { field: "area", patterns: ["area", "quartier", "zone", "secteur", "arrondissement", "arr"] },
  { field: "surfaces.r2", patterns: ["surface (r-2)", "r-2", "r2", "sous-sol"] },
  { field: "surfaces.r1Storage", patterns: ["surface (r-1 - storage)", "r-1 - storage", "r-1 stock", "stockage", "reserve"] },
  { field: "surfaces.r1SalesArea", patterns: ["surface (r-1 -  sales area)", "surface (r-1 - sales area)", "r-1 - sales", "r-1 vente", "sales area"] },
  { field: "surfaces.rdc", patterns: ["surface (rdc)", "rdc", "rez-de-chaussée", "ground"] },
  { field: "surfaces.r1Plus", patterns: ["surface (r+1)", "r+1", "r1+", "1er"] },
  { field: "surfaces.r2Plus", patterns: ["surface (r+2)", "r+2", "r2+", "2eme"] },
  { field: "surfaces.otherSpaces", patterns: ["other spaces", "other spaces / offices", "autres", "other", "divers", "annexe"] },
  { field: "totalSurfaceSqm", patterns: ["total surface sqm", "surface totale", "total surface", "total m2"] },
  { field: "weightedSurfaceSqm", patterns: ["weighted surface sqm", "surface ponderée", "weighted surface", "ponderee"] },
  { field: "annualHeadlineRent", patterns: ["annual headline rent", "loyer facial", "loyer annuel", "headline rent"] },
  { field: "keyMoney", patterns: ["key money", "pas de porte", "droit au bail"] },
  { field: "rentSqmWeighted", patterns: ["rent / sqm weighted", "rent/sqm weighted", "loyer/m2 pondere", "rent sqm weighted"] },
  { field: "rentSqmTotal", patterns: ["rent / sqm total", "rent/sqm total", "loyer/m2 total", "rent sqm total"] },
  { field: "annualRentReviewed", patterns: ["annual rent reviewed", "loyer révisé", "loyer revise", "revised rent"] },
  { field: "latestRentKnown", patterns: ["latest rent known", "dernier loyer", "latest rent", "loyer connu"] },
  { field: "leaseDuration", patterns: ["lease duration", "duree bail", "durée bail", "lease", "duree"] },
  { field: "breakOptions", patterns: ["break options", "break option", "option sortie", "break"] },
  { field: "source", patterns: ["source", "origine", "reference"] },
];

const NUMERIC_FIELDS = new Set([
  "surfaces.r2",
  "surfaces.r1Storage",
  "surfaces.r1SalesArea",
  "surfaces.rdc",
  "surfaces.r1Plus",
  "surfaces.r2Plus",
  "surfaces.otherSpaces",
  "totalSurfaceSqm",
  "weightedSurfaceSqm",
  "annualHeadlineRent",
  "keyMoney",
  "rentSqmWeighted",
  "rentSqmTotal",
  "annualRentReviewed",
  "latestRentKnown",
]);

const FILE_CACHE = new Map();

function normalizeHeader(h) {
  return String(h).toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s+\-/]/g, "").replace(/\s+/g, " ");
}

function matchColumn(header) {
  const norm = normalizeHeader(header);
  let bestMatch = null;
  let bestScore = 0;

  for (const col of COL_MAP) {
    for (const pat of col.patterns) {
      const normPat = normalizeHeader(pat);
      if (norm === normPat) return col.field;
      if (norm.includes(normPat) || normPat.includes(norm)) {
        const score = normPat.length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = col.field;
        }
      }
    }
  }

  return bestMatch;
}

function setNestedField(obj, path, value) {
  const parts = path.split(".");
  if (parts.length === 1) {
    obj[parts[0]] = value;
    return;
  }
  if (!obj[parts[0]]) obj[parts[0]] = {};
  obj[parts[0]][parts[1]] = value;
}

function parseNumberLike(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") return null;

  let cleaned = value.trim();
  if (!cleaned || !/\d/.test(cleaned)) return null;

  cleaned = cleaned
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(/[^0-9,.\-]/g, "");

  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === ",") return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const decimalPos = Math.max(lastComma, lastDot);

  if (decimalPos >= 0) {
    const intPart = cleaned.slice(0, decimalPos).replace(/[.,]/g, "");
    const fracPart = cleaned.slice(decimalPos + 1).replace(/[.,]/g, "");
    cleaned = fracPart ? `${intPart}.${fracPart}` : intPart;
  } else {
    cleaned = cleaned.replace(/[.,]/g, "");
  }

  if (!cleaned || cleaned === "-") return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCellValue(field, value) {
  if (value === "" || value == null) return null;

  if (NUMERIC_FIELDS.has(field)) {
    return parseNumberLike(value);
  }

  if ((field === "streetNumber" || field === "zipCode" || field === "year") && typeof value === "number") {
    return String(Math.round(value));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  return value;
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function buildTransactionSignature(tx) {
  return stableSerialize({
    year: tx.year || "",
    type: tx.type || "",
    landlord: tx.landlord || "",
    previousTenant: tx.previousTenant || "",
    newTenant: tx.newTenant || "",
    enseigne: tx.enseigne || "",
    streetNumber: tx.streetNumber || "",
    street: tx.street || "",
    zipCode: tx.zipCode || "",
    city: tx.city || "",
    area: tx.area || "",
    surfaces: tx.surfaces || {},
    totalSurfaceSqm: tx.totalSurfaceSqm ?? null,
    weightedSurfaceSqm: tx.weightedSurfaceSqm ?? null,
    annualHeadlineRent: tx.annualHeadlineRent ?? null,
    keyMoney: tx.keyMoney ?? null,
    rentSqmWeighted: tx.rentSqmWeighted ?? null,
    rentSqmTotal: tx.rentSqmTotal ?? null,
    annualRentReviewed: tx.annualRentReviewed ?? null,
    latestRentKnown: tx.latestRentKnown ?? null,
    leaseDuration: tx.leaseDuration || "",
    breakOptions: tx.breakOptions || "",
    source: tx.source || "",
  });
}

function buildTransactionId(signature, occurrence) {
  return crypto.createHash("md5").update(`${signature}:${occurrence}`).digest("hex").slice(0, 16);
}

function hasMeaningfulTransactionData(tx) {
  if (tx.year || tx.type || tx.landlord || tx.previousTenant || tx.newTenant || tx.enseigne) return true;
  if (tx.streetNumber || tx.street || tx.zipCode || tx.city || tx.area) return true;
  if (tx.leaseDuration || tx.breakOptions || tx.source) return true;

  const surfaces = tx.surfaces || {};
  const numericValues = [
    tx.totalSurfaceSqm,
    tx.weightedSurfaceSqm,
    tx.annualHeadlineRent,
    tx.keyMoney,
    tx.annualRentReviewed,
    tx.latestRentKnown,
    tx.rentSqmWeighted,
    tx.rentSqmTotal,
    tx.lat,
    tx.lng,
    surfaces.r2,
    surfaces.r1Storage,
    surfaces.r1SalesArea,
    surfaces.rdc,
    surfaces.r1Plus,
    surfaces.r2Plus,
    surfaces.otherSpaces,
  ];

  return numericValues.some((value) => value != null && Number.isFinite(Number(value)));
}

function readFileEntry(filePath) {
  const stat = fs.statSync(filePath);
  const cached = FILE_CACHE.get(filePath);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached;
  }

  const buf = fs.readFileSync(filePath);
  const hash = crypto.createHash("md5").update(buf).digest("hex");
  const next = { mtimeMs: stat.mtimeMs, size: stat.size, hash, buf, transactions: null };
  FILE_CACHE.set(filePath, next);
  return next;
}

function getCachedFileData(filePath) {
  const entry = readFileEntry(filePath);
  if (!entry.transactions) {
    const wb = XLSX.read(entry.buf, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
    entry.transactions = parseRows(rows);
    entry.buf = null;
  }

  return { hash: entry.hash, transactions: entry.transactions };
}

function parseRows(rows) {
  if (!rows.length) return [];

  const headers = Object.keys(rows[0]);
  const colMapping = {};

  headers.forEach((h) => {
    const field = matchColumn(h);
    if (field) colMapping[h] = field;
  });

  // Column without matching header just before "Street" -> streetNumber
  if (!Object.values(colMapping).includes("streetNumber")) {
    const streetHeader = headers.find((h) => colMapping[h] === "street");
    if (streetHeader) {
      const streetIndex = headers.indexOf(streetHeader);
      if (streetIndex > 0) {
        const prev = headers[streetIndex - 1];
        if (!colMapping[prev]) colMapping[prev] = "streetNumber";
      }
    }
  }

  const seenSignatures = new Map();

  return rows.flatMap((row) => {
    const tx = { surfaces: {}, lat: null, lng: null, visible: true };

    for (const [header, field] of Object.entries(colMapping)) {
      const value = normalizeCellValue(field, row[header]);
      if (value == null) continue;
      setNestedField(tx, field, value);
    }

    if (!hasMeaningfulTransactionData(tx)) return [];

    computeFields(tx);
    const signature = buildTransactionSignature(tx);
    const occurrence = seenSignatures.get(signature) || 0;
    seenSignatures.set(signature, occurrence + 1);
    tx.id = buildTransactionId(signature, occurrence);
    return [tx];
  });
}

function parseTransactions(filePath) {
  const { transactions, hash } = getCachedFileData(filePath);
  return { transactions, hash };
}

function getFileHash(filePath) {
  return readFileEntry(filePath).hash;
}

module.exports = { parseTransactions, getFileHash, computeFields, parseNumberLike };
