/**
 * Fail-closed authorization for security-research actions.
 * Uncertain or missing scope always blocks.
 */

export interface ScopeAsset {
  kind: "domain" | "ip" | "url";
  value: string;
}

export interface ResearchScope {
  programName: string;
  inScope: ScopeAsset[];
  outOfScope: ScopeAsset[];
  allowedMethods: string[];
  rateLimitPerMinute: number;
}

export type ScopeDecision = "allow" | "block";

export interface ScopeCheckInput {
  target: string;
  method?: string;
  scope: ResearchScope | null;
  requestsInLastMinute: number;
}

export interface ScopeCheckResult {
  decision: ScopeDecision;
  reason: string;
}

function normalizeHost(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  try {
    const withScheme = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    const url = new URL(withScheme);
    return url.hostname.replace(/\.$/, "");
  } catch {
    if (/^[a-z0-9.-]+$/.test(trimmed)) {
      return trimmed;
    }
    return null;
  }
}

function hostMatches(assetValue: string, host: string): boolean {
  const assetHost = normalizeHost(assetValue);
  if (!assetHost) {
    return false;
  }
  return host === assetHost || host.endsWith(`.${assetHost}`);
}

export function checkScope(input: ScopeCheckInput): ScopeCheckResult {
  const { target, method, scope, requestsInLastMinute } = input;

  if (!scope) {
    return { decision: "block", reason: "SCOPE NOT CONFIGURED" };
  }

  const host = normalizeHost(target);
  if (!host) {
    return { decision: "block", reason: "Target could not be resolved with certainty" };
  }

  const excluded = scope.outOfScope.some((asset) => hostMatches(asset.value, host));
  if (excluded) {
    return { decision: "block", reason: "Target is explicitly out of scope" };
  }

  const included = scope.inScope.some((asset) => hostMatches(asset.value, host));
  if (!included) {
    return { decision: "block", reason: "Target is not on the in-scope allowlist" };
  }

  if (method && scope.allowedMethods.length > 0) {
    const allowed = scope.allowedMethods.map((m) => m.toUpperCase());
    if (!allowed.includes(method.toUpperCase())) {
      return { decision: "block", reason: `Method ${method} is not allowed` };
    }
  }

  if (requestsInLastMinute >= scope.rateLimitPerMinute) {
    return { decision: "block", reason: "Rate limit exceeded" };
  }

  return { decision: "allow", reason: "Target is in authorized scope" };
}
