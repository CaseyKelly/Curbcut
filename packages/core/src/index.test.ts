import { describe, expect, it } from "vitest";
import * as core from "./index";

// Placeholder so the unit-test step has something to run until the schemas land (#2).
describe("@a11y-fixer/core", () => {
  it("loads", () => {
    expect(core).toBeDefined();
  });
});
