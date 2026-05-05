# AWS Resources Manifest

Account: `664991373499` · Region: `us-west-2` · Billing: pay-as-you-go.
Update this file whenever a resource is created, renamed, or deleted.

## Naming convention

`yt-space-news-<purpose>-<env>` for owned resources. Names are immutable, so always use the `lib/storage/aws.ts` constants from app code rather than hardcoded strings.

## Owned resources

### S3 bucket — `yt-space-news-media-prod`
- Region: `us-west-2`
- Created: 2026-05-04
- Public read (`s3:GetObject` for `*`); writes via signed creds only.
- Object Ownership: `BucketOwnerEnforced` (no ACLs).
- Versioning: off (cost).
- CORS: `GET HEAD PUT POST` from `*` for browser uploads.
- Tags: `Project=yt-space-news`, `Env=prod`, `CostCenter=video-pipeline`, `ManagedBy=cli`.

Prefixes:
| Prefix | Purpose | Lifecycle |
| --- | --- | --- |
| `sources/` | Uploaded raw videos (B-roll pool) | → STANDARD_IA at 30d → GLACIER_IR at 120d |
| `keyframes/` | Extracted JPGs for vision tagging | expire 30d |
| `bureau/` | Curated fallback images (Ken Burns) | retain (no rule) |
| `audio/` | TTS outputs | expire 60d |
| `renders/` | Final MP4s | → STANDARD_IA at 60d |
| `manifests/` | Visual manifest JSONs | expire 90d |

Global rule: incomplete multipart uploads abort at 3 days.

### Remotion Lambda site (managed by Remotion CLI)
- Render bucket: `remotionlambda-uswest2-wwdsm4roaj` (auto-named, do not rename).
- Function: `remotion-render-4-0-451-mem10240mb-disk10240mb-900sec`.
- Site: `remotion-test-2` at `https://remotionlambda-uswest2-wwdsm4roaj.s3.us-west-2.amazonaws.com/sites/remotion-test-2/index.html`.
- Composition id: `Main`.

These come from `.env.local` (`REMOTION_*`). Do not delete the render bucket — Remotion Lambda needs it.

## Cost model (pay-as-you-go)

| Resource | Charge | Notes |
| --- | --- | --- |
| S3 Standard storage | ~$0.023/GB-month | sources first 30d, all writes initially |
| S3 Standard-IA | ~$0.0125/GB-month + $0.01/GB retrieval | sources after 30d, renders after 60d |
| S3 Glacier IR | ~$0.004/GB-month + retrieval fee | sources after 120d |
| S3 PUT/COPY/POST | $0.005 / 1k requests | uploads, keyframe writes |
| S3 GET | $0.0004 / 1k requests | public reads |
| S3 egress | $0.09/GB after 100GB free | viewer plays come from CloudFront eventually, not S3 directly — TODO |
| Remotion Lambda render | Lambda compute + ephemeral storage | per-render, scales to zero |
| Lambda egress | same S3 egress | renders written to render bucket |

No fixed/provisioned costs. Scale-to-zero on everything.

## Cost-saving rules in effect
- Lifecycle expirations on `keyframes/`, `audio/`, `manifests/`.
- IA / Glacier transitions on `sources/`, `renders/`.
- Versioning disabled.
- `BucketOwnerEnforced` (no ACL accounting overhead).
- Cost-allocation tags applied — enable in Billing → Cost Allocation Tags to filter by `Project=yt-space-news`.

## TODO (followups)
- Add CloudFront in front of `renders/` to cut egress costs once we serve to real viewers.
- Add a billing alarm at $25/mo as a tripwire.
- Create a scoped IAM user (currently using root keys — replace before sharing).
