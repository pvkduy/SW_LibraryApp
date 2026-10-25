/**
 * hello — M0 smoke function (SRS §19 M0 exit criteria).
 *
 * Proves the Edge Function deploy path and the §12.5 error contract work.
 * Not a product feature.
 */

import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts'
import { fail, handleOptions, json } from '../_shared/http.ts'

const RequestSchema = z.object({
  name: z.string().min(1).max(100),
})

Deno.serve((req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions()

  if (req.method !== 'POST') {
    return fail('VALIDATION_FAILED', 'Use POST with a JSON body: { "name": "..." }')
  }

  return (async () => {
    let raw: unknown
    try {
      raw = await req.json()
    } catch {
      return fail('VALIDATION_FAILED', 'Body must be valid JSON')
    }

    const parsed = RequestSchema.safeParse(raw)
    if (!parsed.success) {
      return fail('VALIDATION_FAILED', 'Invalid request body', parsed.error.flatten())
    }

    return json({
      message: `Hello, ${parsed.data.name}`,
      service: 'shelfhelp',
      milestone: 'M0',
    })
  })()
})
