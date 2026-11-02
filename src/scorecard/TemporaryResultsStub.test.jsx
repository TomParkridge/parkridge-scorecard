import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { computeScorecard } from "./engine/index.ts";
import { PATH_A, PATH_B, PATH_C } from "./testScriptPaths.ts";
import TemporaryResultsStub from "./TemporaryResultsStub.jsx";

const BANNER = "Temporary preview results. Replaced by the AI Revenue Snapshot in M2.";
const render = (answers) => renderToStaticMarkup(<TemporaryResultsStub result={computeScorecard(answers, "general")} />);

describe("TemporaryResultsStub", () => {
  it("shows a dollar result", () => {
    const html = render(PATH_A);
    expect(html).toContain(BANNER);
    expect(html).toContain("$2,600–$5,200");
    expect(html).toContain("$31,200–$62,400");
    expect(html).toContain("slow_response");
    expect(html).not.toContain("would hide");
    expect(html).not.toContain("hours a week");
  });

  it("shows the hours fallback with no dollar figures", () => {
    const html = render(PATH_B);
    expect(html).toContain(BANNER);
    expect(html).toContain("6–10 hours a week");
    expect(html).toContain("none");
    expect(html).not.toContain("$");
  });

  it("labels a hidden result and still shows the stored numbers", () => {
    const html = render(PATH_C);
    expect(html).toContain(BANNER);
    expect(html).toContain("$200–$500");
    expect(html).toContain("The real page would hide this figure.");
    expect(html).toContain("short_follow_up");
  });

  it.each([["A", PATH_A], ["B", PATH_B], ["C", PATH_C]])("never shows the score, band or sub-scores on path %s", (_, answers) => {
    const r = computeScorecard(answers, "general");
    const html = render(answers).toLowerCase();
    for (const word of ["score", "band", "pipeline", r.band]) expect(html).not.toContain(word);
    expect(html).not.toMatch(new RegExp(`\\b${r.overallScore}\\b`));
  });

  it("explains a failed calculation instead of crashing", () => {
    const html = renderToStaticMarkup(<TemporaryResultsStub result={null} />);
    expect(html).toContain(BANNER);
    expect(html).toContain("could not be calculated");
  });

  it("uses no em-dashes in its copy", () => {
    for (const answers of [PATH_A, PATH_B, PATH_C]) expect(render(answers)).not.toContain("—");
  });
});
