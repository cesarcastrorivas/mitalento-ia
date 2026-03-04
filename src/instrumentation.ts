/**
 * Next.js instrumentation hook — runs once when the server starts.
 *
 * Turbopack (Next.js ≥16) appends a content hash to external package names
 * when the package is listed in `serverExternalPackages`, producing calls like:
 *
 *   require("firebase-admin-e80223cff3f2baca")
 *
 * At Cloud Run runtime there is no such package in node_modules, so every
 * dynamic route returns 500 before any user code runs.
 *
 * We fix this by patching Node's Module._load to redirect any
 * `firebase-admin-<hex16>` require to the real `firebase-admin` package.
 * The patch is applied once here, before any request is processed.
 */
export async function register() {
  // Only run on the server (not in the browser / edge runtime).
  if (process.env.NEXT_RUNTIME === 'edge') return;

  try {
    // Node.js built-in — never hashed by Turbopack.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Module = require('module') as typeof import('module') & {
      _load: (request: string, parent: unknown, isMain: boolean) => unknown;
    };

    const original = Module._load.bind(Module);

    Module._load = function patchedLoad(request, parent, isMain) {
      // Redirect any Turbopack-hashed require for Next.js external packages to the real package
      const match = /^(firebase-admin|google-auth-library|google-gax|@grpc\/grpc-js|@grpc\/proto-loader)-[0-9a-f]{16}(\/.*)?$/.exec(request);
      if (match) {
        const pkg = match[1];
        const subpath = match[2] || '';
        return original(`${pkg}${subpath}`, parent, isMain);
      }
      return original(request, parent, isMain);
    };
  } catch {
    // If Module._load patching isn't available (e.g. edge runtime), do nothing.
  }
}
