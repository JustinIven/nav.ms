# Navigate the Microsoft portal jungle

This repository powers nav.ms — a tiny redirection service that maps short slugs to Microsoft navigation URLs and supports multi-cloud/tenant-aware targets (global, GCC, DOD, China, etc.). It is implemented as a Cloudflare Worker written in TypeScript.

## How to Use

The nav.ms service provides quick access to Microsoft portals and services using short, memorable URLs. Here's how to use it:

### Basic Usage

Navigate to any Microsoft service using the format:
```
https://nav.ms/<short>
```

**Examples:**
- `https://nav.ms/en` → Microsoft Entra admin center
- `https://nav.ms/admin` → Microsoft 365 admin center
- `https://nav.ms/az` → Azure portal

### Tenant-Specific Navigation

For tenant-specific URLs, include your tenant domain:
```
https://nav.ms/<short>/<tenant>
```

**Examples:**
- `https://nav.ms/en/contoso.com` → Entra portal for Contoso tenant
- `https://nav.ms/admin/fabrikam.onmicrosoft.com` → M365 Admin center for Fabrikam tenant

### Cloud Environment Support

Specify the cloud environment explicitly (useful for government or sovereign clouds):
```
https://nav.ms/<short>/<tenant>/<cloud>
```

**Supported clouds:**
- `ww` - Global (default)
- `gcc` - Government Community Cloud
- `dod` - Department of Defense
- `cn` - China

**Examples:**
- `https://nav.ms/office/contoso.com/gcc` → Office portal in of Contoso in GCC
- `https://nav.ms/admin//dod` → Admin center in DOD cloud

### Subdomain Format (Alternative)

You can also use the subdomain format:
```
https://<short>.nav.ms/<tenant>/<cloud>
```

**Examples:**
- `https://office.nav.ms/contoso.com`
- `https://admin.nav.ms/contoso.com/gcc`

### Smart Cloud Detection

When you don't specify a cloud environment, nav.ms automatically detects the appropriate cloud for your tenant by querying Microsoft's federation provider. This ensures you're always directed to the correct environment for your organization.

## Contents

- `src/index.ts` — Worker entry point and redirect logic.
- `redirects.json` — Mapping of short slugs and aliases to per-cloud target URLs.
- `wrangler.jsonc` — Cloudflare Worker configuration.

## Contract (inputs / outputs)

- Input: HTTP request to `https://nav.ms/<short>/<tenant?>/<cloud?>`.
- Output: 302 redirect to a resolved URL from `redirects.json`, or a redirect to the project page with an error code when not resolvable.
- Error modes: missing short, missing redirect, unknown cloud mapping, failed tenant lookup.

## How it works (high level)

1. Parse incoming request URL. The code supports two URL forms:
    - Hostname-based short: `https://<short>.nav.ms/<tenant?>/<cloud?>`
    - Path-based short: `https://nav.ms/<short>/<tenant?>/<cloud?>`
2. Resolve the short slug to a redirect object using `redirects.json` (supports `alias` -> canonical redirect mapping).
3. If `cloud` is omitted, call Microsoft's federation provider (`https://odc.officeapps.live.com/odc/v2.1/federationprovider?domain=<tenant>`) to detect the cloud and tenantId. If the `tenant` path is omitted, the worker will not perform tenant or tenantId substitutions and will instead redirect to the default (first) URL for the specified cloud.
4. Choose the appropriate target URL array for the cloud and perform tenant/tenantId substitution when required.
5. Respond with a 302 redirect to the selected target URL.

## Redirects format (`redirects.json`)

The Worker expects a JSON file shaped like:

```json
{
  "redirects": {
    "<short>": {
      "ww": ["https://global-fallback.example","https://global.example/{tenant}"],
      "gcc": ["https://gcc-fallback.example","https://gcc.example/{tenantId}"],
      "dod": ["..."],
      "cn": ["..."]
    }
  },
  "alias": {
    "<alias>": "<short>"
  }
}
```

Notes:
- The array for each cloud should contain at least one URL (the default/first URL used when no tenant is specified). An optional second URL may be a templated URL containing either `{tenant}` or `{tenantId}` for tenant-specific redirects.
- The worker will use the first URL as the default when the `tenant` path is omitted. If a templated second URL is present but requires `{tenant}` or `{tenantId}` and the required value cannot be obtained, the worker will fall back to the first (default) URL.

Example snippet:
```json
{
  "redirects": {
    "office": {
      "ww": ["https://portal.office.com/","https://portal.office.com/{tenant}"],
      "cn": ["https://portal.office.cn/"]
    }
  },
  "alias": {
    "o": "office"
  }
}
```
