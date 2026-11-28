#!/usr/bin/env node
/**
 * Spec matrix check (SRS §17, agent rule 3).
 *
 * Asserts that every functional requirement (FR-*) in the specification is
 * claimed by at least one test scenario (TS-*). CI fails if an FR has no
 * scenario.
 *
 * LIMIT: this checks PRESENCE of a traceability link, not correctness of the
 * test that implements it. A green matrix means "no FR is untested on paper".
 *
 * Usage: node src/scripts/spec-matrix.mjs [--verbose]
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const specsDir = join(repoRoot, 'src', 'speckit', 'specs')
const srsPath = join(specsDir, 'SHELFHELP_FULLSPEC.md')

const verbose = process.argv.includes('--verbose')

/** Collect every .md file under a directory (recursive). */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (entry.endsWith('.md')) out.push(full)
  }
  return out
}

const SRS = readFileSync(srsPath, 'utf8')

// --- 1. All FRs defined in the SRS -------------------------------------------------
// A definition line looks like:  - **FR-AUTH-01** `[PA1 §3.1]` **Register.** ...
const frDefRe = /^[-|]\s*\*{0,2}(FR-[A-Z]+-\d{2})\*{0,2}/gm
const definedFrs = new Set()
for (const m of SRS.matchAll(frDefRe)) definedFrs.add(m[1])

// --- 2. FR -> TS coverage from the traceability matrix (SRS §17.2) -----------------
// Row shape: | FR-AUTH-01 | Register | §3.1 | R-01 | TS-01 |
const coverage = new Map()
for (const line of SRS.split('\n')) {
  const m = /^\|\s*(FR-[A-Z]+-\d{2})\s*\|[^|]*\|[^|]*\|[^|]*\|([^|]*)\|/.exec(line)
  if (!m) continue
  const [, fr, tsCell] = m
  const scenarios = [...(tsCell ?? '').matchAll(/TS-\d+/g)].map((x) => x[0])
  if (scenarios.length) coverage.set(fr, (coverage.get(fr) ?? new Set()).add(...scenarios))
}

// --- 3. TS scenarios that actually exist -------------------------------------------
const existingTs = new Set([...SRS.matchAll(/^\|\s*(TS-\d{2})\s*\|/gm)].map((m) => m[1]))

// --- 4. Report ---------------------------------------------------------------------
const uncovered = [...definedFrs].filter((fr) => !coverage.has(fr)).sort()
const danglingTs = []
for (const [fr, set] of coverage) {
  for (const ts of set) if (!existingTs.has(ts)) danglingTs.push(`${fr} -> ${ts}`)
}

// Feature specs must not define an FR that the SRS does not know about.
const unknownInSpecs = new Set()
for (const file of walk(specsDir)) {
  if (file === srsPath) continue
  const text = readFileSync(file, 'utf8')
  for (const m of text.matchAll(/^-\s*\*\*(FR-[A-Z]+-\d{2})\*\*/gm)) {
    if (!definedFrs.has(m[1])) unknownInSpecs.add(`${m[1]} (${file.slice(specsDir.length + 1)})`)
  }
}

console.log('Spec matrix')
console.log(`  FRs defined in SRS : ${definedFrs.size}`)
console.log(`  FRs with TS        : ${coverage.size}`)
console.log(`  TS scenarios       : ${existingTs.size}`)

if (verbose) {
  for (const fr of [...definedFrs].sort()) {
    const ts = [...(coverage.get(fr) ?? [])].join(', ') || 'MISSING'
    console.log(`    ${fr.padEnd(16)} ${ts}`)
  }
}

let failed = false

if (uncovered.length) {
  failed = true
  console.log(`\n✗ ${uncovered.length} FR(s) have no test scenario:`)
  for (const fr of uncovered) console.log(`    ${fr}`)
}

if (danglingTs.length) {
  failed = true
  console.log(`\n✗ ${danglingTs.length} reference(s) point at a non-existent TS scenario:`)
  for (const d of danglingTs) console.log(`    ${d}`)
}

if (unknownInSpecs.size) {
  failed = true
  console.log(`\n✗ ${unknownInSpecs.size} FR(s) appear in a feature spec but not in the SRS:`)
  for (const u of unknownInSpecs) console.log(`    ${u}`)
}

if (failed) {
  process.exit(1)
}

console.log('\n✓ every FR is claimed by at least one test scenario')
