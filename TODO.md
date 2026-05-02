# TODO

## Add a `study` step before `rewrite`

**Why.** Today the rewriter does extraction + structuring + augmentation + writing in a single Claude call. For long vlogs this is too much in one shot — the auditor also re-extracts facts from the transcript at audit time, which is part of why scores plateau.

**Proposed flow:**

```
transcript → study → rewrite → audit → correct (loop)
```

The `study` step produces a structured Source Brief that the rewriter consumes as input:

```jsonc
{
  "topic": "...",
  "leadEvent": "...",
  "keyMetrics": ["..."],
  "namedEntities": ["..."],
  "dateAndTimeline": [{ "event": "...", "year": "..." }],
  "personaToStrip": ["Kevin", "I spoke to Elon"],
  "augmentationCandidates": [
    { "class": "physics" | "historical" | "rivalry", "claim": "...", "verification": "high" | "medium" | "low" }
  ],
  "structureOutline": ["lead: ...", "report: ...", "implications: ...", "closer: ..."]
}
```

Augmentation-candidate research goes through Perplexity (real research role, not just audit). Claude does the extraction + brief assembly.

**Implementation sketch:**
- New file `lib/study.ts` exposing `studySource(transcript, title): Promise<SourceBrief>`.
- New `study` PipelineStep in `types/pipeline.ts`; emit started/completed events with the brief in event data.
- Add `study_brief_json TEXT` column to `pipeline_runs` (idempotent migration). Save it in the `finally` block of `runPipeline`.
- Update `lib/rewrite.ts` to take an optional `SourceBrief` and feed it into `buildRewritePrompt` as a structured input, not a free-text section. Keep current behavior as fallback if brief is null.
- Auditor scores the rewrite against the brief (stable ground truth) instead of re-extracting from the transcript.
- UI: collapsible "Source brief" panel in the live job view and in expanded run rows, similar to the SEO panel.

**Tradeoffs:**
- +1 Claude call + 1 Perplexity research call per run (~15–30s extra latency, modest cost).
- More state to plumb and persist.
- Better writing, better-grounded augmentations, more diagnosable failures (we can see what the brief said vs. what the rewrite did).
