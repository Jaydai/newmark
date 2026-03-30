const express = require("express");
const path = require("path");
const { createTransactionStore } = require("./lib/transaction-store");

const app = express();
const PORT = process.env.PORT || 3333;
const XLSX_PATH = path.join(__dirname, "infos.xlsx");
const transactionStore = createTransactionStore(XLSX_PATH);

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/transactions", (_req, res) => {
  try {
    res.json(transactionStore.getSnapshot());
  } catch (err) {
    console.error("Error parsing xlsx:", err.message);
    res.status(500).json({ error: "Failed to parse Excel file" });
  }
});

app.get("/api/transactions/hash", (_req, res) => {
  try {
    res.json({ hash: transactionStore.getHash() });
  } catch (err) {
    console.error("Error reading xlsx:", err.message);
    res.status(500).json({ error: "Failed to read Excel file" });
  }
});

app.listen(PORT, () => {
  console.log(`Newmark Maps server running on http://localhost:${PORT}`);
});
