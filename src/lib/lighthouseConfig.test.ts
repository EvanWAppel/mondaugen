// QA-02: Lighthouse CI config guard. Lighthouse itself runs only in CI (no
// local browser runs); this test pins the config so the job stays warn-level,
// keyless and unpublished (reports go to the filesystem + a CI artifact).
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Vitest runs from the repo root (where vitest.config.mts lives).
const root = process.cwd();
const rcPath = resolve(root, "lighthouserc.json");
const ciPath = resolve(root, ".github/workflows/ci.yml");

describe("lighthouserc.json", () => {
  it("exists and is valid JSON", () => {
    expect(existsSync(rcPath)).toBe(true);
    expect(() => JSON.parse(readFileSync(rcPath, "utf8"))).not.toThrow();
  });

  const rc = () => JSON.parse(readFileSync(rcPath, "utf8"));

  it("collects against the production server started by `npm run start`", () => {
    const collect = rc().ci.collect;
    expect(collect.startServerCommand).toBe("npm run start");
    expect(collect.url).toEqual(["http://localhost:3000/"]);
  });

  it("asserts performance and accessibility >= 0.9 at warn level only", () => {
    const assertions = rc().ci.assert.assertions;
    expect(assertions["categories:performance"]).toEqual(["warn", { minScore: 0.9 }]);
    expect(assertions["categories:accessibility"]).toEqual(["warn", { minScore: 0.9 }]);
    for (const value of Object.values(assertions)) {
      const level = Array.isArray(value) ? value[0] : value;
      expect(level).not.toBe("error");
    }
  });

  it("writes reports to the filesystem and never publishes them", () => {
    const upload = rc().ci.upload;
    expect(upload.target).toBe("filesystem");
    expect(upload.outputDir).toBe(".lighthouseci");
    expect(JSON.stringify(rc())).not.toContain("temporary-public-storage");
  });
});

describe("CI workflow lighthouse job", () => {
  const ci = () => readFileSync(ciPath, "utf8");

  it("defines a lighthouse job that builds then runs pinned lhci autorun", () => {
    const yml = ci();
    expect(yml).toMatch(/^ {2}lighthouse:$/m);
    const job = yml.slice(yml.search(/^ {2}lighthouse:$/m));
    expect(job).toContain("run: npm ci");
    expect(job).toContain("run: npm run build");
    expect(job).toMatch(/npx (--yes )?@lhci\/cli@0\.14\.\d+ autorun/);
  });

  it("uploads the report as a workflow artifact even when assertions warn", () => {
    const job = ci().slice(ci().search(/^ {2}lighthouse:$/m));
    expect(job).toContain("uses: actions/upload-artifact@v4");
    expect(job).toContain("path: .lighthouseci");
    expect(job).toContain("if: always()");
  });
});
