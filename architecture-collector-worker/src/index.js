const MAX_BODY_BYTES = 700_000;
const API_KEY_VALUE_RE = /\bsk-[A-Za-z0-9_-]{12,}\b/;
const SENSITIVE_KEY_RE = /(api[_-]?key|openai[_-]?key|authorization|bearer|token|secret|password|credential)/i;

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const allowOrigin = allowed.includes("*") || allowed.includes(origin) ? (origin || "*") : "null";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function safeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "unknown";
}

function base64EncodeUtf8(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
  }
  return btoa(binary);
}

function containsSensitiveShape(value, depth = 0) {
  if (depth > 10 || value == null) return false;
  if (typeof value === "string") return API_KEY_VALUE_RE.test(value);
  if (Array.isArray(value)) return value.some((item) => containsSensitiveShape(item, depth + 1));
  if (typeof value === "object") {
    return Object.entries(value).some(([key, item]) => {
      if (SENSITIVE_KEY_RE.test(key)) {
        // Allow explicit negative privacy flags, but reject actual secret-shaped fields.
        if (item === false || item == null || item === "[REDACTED_SENSITIVE_FIELD]") return false;
        return true;
      }
      return containsSensitiveShape(item, depth + 1);
    });
  }
  return false;
}

function validateFossil(fossil) {
  if (!fossil || typeof fossil !== "object") return "JSON body must be an object.";
  if (fossil.schemaVersion !== 1) return "Unsupported fossil schemaVersion.";
  if (!fossil.exportId || typeof fossil.exportId !== "string") return "Missing exportId.";
  if (!fossil.createdAt || typeof fossil.createdAt !== "string") return "Missing createdAt.";
  if (!fossil.architecture || typeof fossil.architecture !== "object") return "Missing architecture.";
  if (!Array.isArray(fossil.architecture.arms)) return "architecture.arms must be an array.";
  if (!Array.isArray(fossil.architecture.committees)) return "architecture.committees must be an array.";
  if (fossil.privacy?.openaiApiKeyIncluded !== false) return "Privacy flag openaiApiKeyIncluded must be false.";
  if (fossil.privacy?.seedTextIncluded !== false) return "Privacy flag seedTextIncluded must be false.";
  if (fossil.privacy?.transcriptIncluded !== false) return "Privacy flag transcriptIncluded must be false.";
  if (containsSensitiveShape(fossil)) return "Payload appears to contain a secret/API-key-shaped field.";
  return null;
}

async function writeFossilToGitHub(fossil, env) {
  if (!env.GITHUB_TOKEN) throw new Error("Missing GITHUB_TOKEN secret.");
  if (!env.GITHUB_REPO) throw new Error("Missing GITHUB_REPO var.");

  const repo = env.GITHUB_REPO;
  const branch = env.GITHUB_BRANCH || "main";
  const date = new Date(fossil.createdAt);
  const yyyyMmDd = Number.isFinite(date.valueOf())
    ? date.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const safeExportId = safeSlug(fossil.exportId);
  const round = safeSlug(`r${fossil.export?.round ?? "unknown"}`);
  const path = `collected-architectures/${yyyyMmDd}/${round}_${safeExportId}.json`;
  const content = JSON.stringify(fossil, null, 2) + "\n";

  const response = await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path).replaceAll("%2F", "/")}`, {
    method: "PUT",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "solasterid-architecture-collector",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      message: `Archive Solasterid architecture ${safeExportId}`,
      content: base64EncodeUtf8(content),
      branch,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = data?.message || `GitHub returned ${response.status}`;
    throw new Error(msg);
  }

  return {
    archivePath: path,
    commitSha: data?.commit?.sha,
    htmlUrl: data?.content?.html_url,
  };
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== "POST") {
      return json({ error: "Use POST with a sanitized architecture fossil JSON body." }, 405, cors);
    }

    const length = Number(request.headers.get("Content-Length") || "0");
    if (length > MAX_BODY_BYTES) {
      return json({ error: "Payload too large." }, 413, cors);
    }

    let fossil;
    try {
      fossil = await request.json();
    } catch {
      return json({ error: "Invalid JSON." }, 400, cors);
    }

    const validationError = validateFossil(fossil);
    if (validationError) return json({ error: validationError }, 400, cors);

    try {
      const result = await writeFossilToGitHub(fossil, env);
      return json({ ok: true, ...result }, 200, cors);
    } catch (err) {
      return json({ error: String(err?.message || err) }, 500, cors);
    }
  },
};
