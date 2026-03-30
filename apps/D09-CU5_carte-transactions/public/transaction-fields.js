(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.NewmarkTransactionFields = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function toFiniteNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function computeFields(tx) {
    const s = tx.surfaces || {};
    const parts = [s.r2, s.r1Storage, s.r1SalesArea, s.rdc, s.r1Plus, s.r2Plus, s.otherSpaces];
    const sum = parts.reduce(function (acc, value) {
      return acc + (toFiniteNumber(value) || 0);
    }, 0);
    if (toFiniteNumber(tx.totalSurfaceSqm) == null && sum > 0) tx.totalSurfaceSqm = sum;

    const rent = toFiniteNumber(tx.annualHeadlineRent);
    const weighted = toFiniteNumber(tx.weightedSurfaceSqm);
    const total = toFiniteNumber(tx.totalSurfaceSqm);
    const weightedRate = toFiniteNumber(tx.rentSqmWeighted);
    const totalRate = toFiniteNumber(tx.rentSqmTotal);

    if (rent != null && weighted != null && weighted > 0 && weightedRate == null) {
      tx.rentSqmWeighted = Math.round(rent / weighted);
    }
    if (rent != null && total != null && total > 0 && totalRate == null) {
      tx.rentSqmTotal = Math.round(rent / total);
    }
  }

  return {
    toFiniteNumber: toFiniteNumber,
    computeFields: computeFields
  };
});
