const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { parseTransactions } = require("../lib/parse-xlsx");

const ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const DIST_DIR = path.join(ROOT, "dist");
const DATA_DIR = path.join(DIST_DIR, "data");
const XLSX_PATH = path.join(ROOT, "infos.xlsx");
const PUBLIC_JSON_PATH = path.join(PUBLIC_DIR, "data", "transactions.json");

function hasMeaningfulTransactionData(tx) {
  if (!tx || typeof tx !== "object") return false;
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

function writePayload(payload) {
  fs.writeFileSync(path.join(DATA_DIR, "transactions.json"), JSON.stringify(payload));
  fs.writeFileSync(path.join(DATA_DIR, "transactions-hash.json"), JSON.stringify({ hash: payload.hash || "" }));
}

function computeHash(transactions) {
  return crypto.createHash("md5").update(JSON.stringify(transactions)).digest("hex");
}

function buildStaticSite() {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.cpSync(PUBLIC_DIR, DIST_DIR, { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (fs.existsSync(XLSX_PATH)) {
    const parsed = parseTransactions(XLSX_PATH);
    writePayload(parsed);
    console.log("Transactions:", Array.isArray(parsed.transactions) ? parsed.transactions.length : 0);
    console.log("Hash:", parsed.hash);
  } else if (fs.existsSync(PUBLIC_JSON_PATH)) {
    const existing = JSON.parse(fs.readFileSync(PUBLIC_JSON_PATH, "utf8"));
    const transactions = Array.isArray(existing?.transactions)
      ? existing.transactions.filter(hasMeaningfulTransactionData)
      : [];
    const hash = computeHash(transactions);
    writePayload({ transactions, hash });
    console.log("No infos.xlsx — using existing public/data/transactions.json");
    console.log("Transactions:", transactions.length);
    console.log("Hash:", hash);
  } else {
    writePayload({ transactions: [], hash: "" });
    console.log("No infos.xlsx found — built with empty transaction data");
  }

  console.log("Static build ready:", DIST_DIR);
}

buildStaticSite();
