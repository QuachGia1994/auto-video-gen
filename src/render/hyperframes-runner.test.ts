import { describe, expect, it } from "vitest";
import { parseHyperframesProgressLine } from "./hyperframes-runner.js";

describe("parseHyperframesProgressLine", () => {
  it("parses ANSI-decorated HyperFrames progress lines", () => {
    expect(parseHyperframesProgressLine("\u001b[2K  ██████████████████░░░░░░░  75%  Encoding video")).toEqual({
      percent: 75,
      message: "Encoding video",
    });
  });

  it("parses frame capture progress", () => {
    expect(parseHyperframesProgressLine("  64%  Capturing frame 903/1055")).toEqual({
      percent: 64,
      message: "Capturing frame 903/1055",
    });
  });

  it("ignores non-progress and out-of-range lines", () => {
    expect(parseHyperframesProgressLine("Rendering composition")).toBeNull();
    expect(parseHyperframesProgressLine("101% impossible")).toBeNull();
  });
});
