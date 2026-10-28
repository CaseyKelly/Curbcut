// Schema for sample-site/issues.manifest.json, the answer key for the
// Fernleaf fixture. It lives here rather than in fixtures/sample-site so the
// agent never sees it when that folder is used as the repo-mode test repo.
import { RelativePath, Slug } from '@curbcut/core';
import { z } from 'zod';

const Entry = z.strictObject({
  id: Slug,
  category: z.string().min(1),
  /** Relative to fixtures/sample-site. */
  file: RelativePath,
  component: z.string().min(1).nullable(),
  relatedFiles: z.array(RelativePath).optional(),
  selector: z.string().min(1),
  description: z.string().min(1),
});

export const SeededIssue = Entry.extend({
  ruleId: z.string().min(1),
  // How many elements axe flags for the issue, so a fix that resolves only
  // some of them still fails.
  nodes: z.int().positive(),
});
export type SeededIssue = z.infer<typeof SeededIssue>;

export const CorrectPattern = Entry.extend({
  // Seeded container issues this pattern sits inside by design, such as the
  // product photos inside the broken product list. Any other container
  // violation around the pattern counts against it.
  insideIssues: z.array(Slug).min(1).optional(),
});
export type CorrectPattern = z.infer<typeof CorrectPattern>;

export const SampleSiteManifest = z
  .strictObject({
    manifestVersion: z.literal(1),
    page: z.string().startsWith('/'),
    issues: z.array(SeededIssue),
    correctPatterns: z.array(CorrectPattern),
  })
  .superRefine((m, ctx) => {
    const ids = [...m.issues, ...m.correctPatterns].map((e) => e.id);
    const dupes = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
    if (dupes.length > 0) {
      ctx.addIssue({ code: 'custom', message: `Duplicate ids: ${dupes.join(', ')}` });
    }
    const issueIds = new Set(m.issues.map((i) => i.id));
    for (const p of m.correctPatterns) {
      const unknown = (p.insideIssues ?? []).filter((id) => !issueIds.has(id));
      if (unknown.length > 0) {
        ctx.addIssue({
          code: 'custom',
          message: `${p.id}: insideIssues names unknown issues: ${unknown.join(', ')}`,
        });
      }
    }
  });
export type SampleSiteManifest = z.infer<typeof SampleSiteManifest>;
