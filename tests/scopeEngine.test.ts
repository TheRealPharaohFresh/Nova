import { describe, expect, it } from "vitest";
import { checkScope, type ResearchScope } from "../src/shared/scopeEngine";

const scope: ResearchScope = {
  programName: "Example",
  inScope: [{ kind: "domain", value: "example.com" }],
  outOfScope: [{ kind: "domain", value: "blog.example.com" }],
  allowedMethods: ["GET", "HEAD"],
  rateLimitPerMinute: 2
};

describe("scope engine", () => {
  it("blocks when scope is missing", () => {
    const r = checkScope({ target: "example.com", scope: null, requestsInLastMinute: 0 });
    expect(r.decision).toBe("block");
  });

  it("allows an in-scope host", () => {
    const r = checkScope({ target: "https://app.example.com/x", method: "GET", scope, requestsInLastMinute: 0 });
    expect(r.decision).toBe("allow");
  });

  it("blocks out-of-scope subdomains", () => {
    const r = checkScope({ target: "blog.example.com", method: "GET", scope, requestsInLastMinute: 0 });
    expect(r.decision).toBe("block");
  });

  it("blocks unknown hosts instead of guessing", () => {
    const r = checkScope({ target: "evil.tld", method: "GET", scope, requestsInLastMinute: 0 });
    expect(r.decision).toBe("block");
  });

  it("blocks disallowed methods and rate limits", () => {
    expect(checkScope({ target: "example.com", method: "POST", scope, requestsInLastMinute: 0 }).decision).toBe(
      "block"
    );
    expect(checkScope({ target: "example.com", method: "GET", scope, requestsInLastMinute: 2 }).decision).toBe(
      "block"
    );
  });
});
