/**
 * schemaTypes.test.ts — keeps the Zod schemas and the hand-written types in
 * types/index.ts in agreement.
 *
 * The real check happens at compile time (`npx tsc --noEmit`, which also
 * type-checks this file): if a schema and its type drift apart, the
 * assignments below stop compiling. The runtime test only documents that.
 */
import { z } from 'zod';
import { JDExtractionResultSchema, RefineOutputSchema, ResumeBuilderOutputSchema } from '@/lib/llm/schema';
import { JDExtractionResult, ResumeBuilderOutput } from '@/types';

/** Compiles only when A and B are mutually assignable. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// What the schema accepts is exactly the type the app works with. The
// hallucination report is added by the route after validation.
const outputMatches: Same<z.infer<typeof ResumeBuilderOutputSchema>, Omit<ResumeBuilderOutput, 'hallucinationReport'>> = true;
const refineResumeMatches: Same<z.infer<typeof RefineOutputSchema>['resume'], ResumeBuilderOutput['resume']> = true;
const jdMatches: Same<z.infer<typeof JDExtractionResultSchema>, JDExtractionResult> = true;

it('schemas and types agree (enforced by tsc)', () => {
  expect([outputMatches, refineResumeMatches, jdMatches]).toEqual([true, true, true]);
});
