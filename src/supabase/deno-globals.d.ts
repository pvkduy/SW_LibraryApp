/**
 * Minimal ambient declarations so `tsc --noEmit` can check the Edge Functions.
 *
 * The Supabase Edge Runtime is Deno. `tsc` is used only as a fast static check
 * (NFR-14); Deno itself resolves and type-checks the remote imports at run time.
 *
 * Deliberately dependency-free: the declarations below cover exactly the Zod
 * surface the functions use. Pulling the real `zod` package in as an npm
 * devDependency was rejected because:
 *   * the runtime pin is v3.23.8 (a URL), while npm would resolve v3.25.x — the
 *     types would describe a different version than the code ships;
 *   * npm's v4 branch reports a high-severity advisory that does not apply here
 *     and would break the v3 module declaration.
 * If a function needs more of Zod, extend the interface below rather than
 * importing the package.
 */

/** Deno's `serve` entry point (supabase-edge-runtime). */
declare namespace Deno {
  interface ServeOptions {
    port?: number
    hostname?: string
    onListen?: (params: { hostname: string; port: number }) => void
  }

  function serve(
    handler: (request: Request) => Response | Promise<Response>,
  ): void
  function serve(
    options: ServeOptions,
    handler: (request: Request) => Response | Promise<Response>,
  ): void

  const env: {
    get(key: string): string | undefined
  }
}

/** Remote Zod pinned by URL in the Edge Functions (Deno resolves it at run time). */
declare module 'https://deno.land/x/zod@v3.23.8/mod.ts' {
  export interface ZodErrorIssue {
    path: (string | number)[]
    message: string
    code: string
  }

  export interface ZodError {
    issues: ZodErrorIssue[]
    /** `{ fieldErrors, formErrors }`, as returned to clients in `error.details`. */
    flatten(): {
      formErrors: string[]
      fieldErrors: Record<string, string[] | undefined>
    }
  }

  export type SafeParseResult<T> =
    | { success: true; data: T }
    | { success: false; error: ZodError }

  export interface ZodType<T = unknown> {
    safeParse(input: unknown): SafeParseResult<T>
  }

  export interface ZodString extends ZodType<string> {
    min(length: number): ZodString
    max(length: number): ZodString
  }

  /**
   * Only the shapes used by the functions: `z.object({...})` and the string
   * refinements. The inferred output type is derived from the schema literal by
   * `z.infer`-like inference below.
   */
  export interface ZodObjectShape {
    [key: string]: ZodString | ZodType<unknown>
  }

  export interface ZodObject<S extends ZodObjectShape>
    extends ZodType<{ [K in keyof S]: S[K] extends ZodType<infer U> ? U : never }> {}

  export function object<S extends ZodObjectShape>(shape: S): ZodObject<S>
  export function string(): ZodString

  /** The `z` namespace, as used by `import { z } from ...`. */
  export const z: {
    object: typeof object
    string: typeof string
  }
}
