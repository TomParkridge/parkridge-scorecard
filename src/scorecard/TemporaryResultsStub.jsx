// TEMPORARY (M1 only): plain results for testing on preview. App.jsx never shows it on production.
// Delete this file when the AI Revenue Snapshot is built in M2. Score, band and sub-scores are
// stored but never shown to visitors, so they stay off this screen too.

const dollars = (n) => `$${n.toLocaleString("en-US")}`;

function Line({ label, value }) {
  return (
    <p style={{ fontSize: 18, marginBottom: 12 }}>
      <strong>{label}:</strong> {value}
    </p>
  );
}

export default function TemporaryResultsStub({ result }) {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "100px 24px 80px" }}>
      <p style={{ padding: 12, marginBottom: 32, border: "1px solid currentColor", borderRadius: 4, fontSize: 14 }}>
        Temporary preview results. Replaced by the AI Revenue Snapshot in M2.
      </p>
      {result === null ? (
        <p style={{ fontSize: 18 }}>The estimate could not be calculated from these answers.</p>
      ) : (
        <>
          {result.estimate.kind === "hours" ? (
            <Line label="Estimate" value={`${result.estimate.hoursLow}–${result.estimate.hoursHigh} hours a week`} />
          ) : (
            <>
              <Line label="Monthly" value={`${dollars(result.estimate.monthlyLow)}–${dollars(result.estimate.monthlyHigh)}`} />
              <Line label="Yearly" value={`${dollars(result.estimate.yearlyLow)}–${dollars(result.estimate.yearlyHigh)}`} />
            </>
          )}
          {result.estimate.kind === "hidden" && <p style={{ fontSize: 18, marginBottom: 12 }}>The real page would hide this figure.</p>}
          <Line label="Top leak" value={result.topLeak} />
        </>
      )}
    </div>
  );
}
