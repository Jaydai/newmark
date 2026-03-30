const fs = require("fs");
const { parseTransactions } = require("./parse-xlsx");

function createTransactionStore(filePath, options = {}) {
  const interval = options.interval || 1000;
  let snapshot = parseTransactions(filePath);
  let lastError = null;

  function refresh() {
    try {
      snapshot = parseTransactions(filePath);
      lastError = null;
    } catch (error) {
      lastError = error;
      console.error("Transaction store refresh failed:", error.message);
    }
  }

  fs.watchFile(filePath, { interval }, (curr, prev) => {
    if (curr.mtimeMs === prev.mtimeMs && curr.size === prev.size) return;
    refresh();
  });

  return {
    getSnapshot() {
      if (lastError) throw lastError;
      return snapshot;
    },
    getHash() {
      if (lastError) throw lastError;
      return snapshot.hash;
    },
    close() {
      fs.unwatchFile(filePath);
    },
  };
}

module.exports = { createTransactionStore };
