# yt-space-news — Claude Operating Notes

## Remotion deployment is your responsibility — never ask the user

The Remotion site at `helpers/ui/remotion/remotion-test-2` and the Lambda function it runs on must be kept in sync with the code. Whenever you change anything that affects what Lambda renders, you assess and deploy without asking. Do not surface "you need to redeploy" as a manual step in your reply — just deploy.

### When the SITE must be (re)deployed

Anything that changes the bundle Lambda fetches from `REMOTION_SERVE_URL`:

- Edit/add/remove any file under `helpers/ui/remotion/remotion-test-2/remotion/**` (compositions, components, defaults, schema).
- Edit/add/remove a composition registration in `remotion/Root.tsx` or composition props.
- Add/remove npm deps in `helpers/ui/remotion/remotion-test-2/package.json` that the bundle imports (e.g. `@remotion/media-utils`, fonts, icon sets).
- Change Tailwind config or `index.css` in that project.
- Change `remotion.config.ts`.

Run:
```
cd helpers/ui/remotion/remotion-test-2 && AWS_REGION=us-west-2 npm run deploy:site
```

Then if `REMOTION_SERVE_URL` printed by the deploy differs from `.env.local`, update `.env.local`.

### When the LAMBDA FUNCTION must be (re)deployed

- The installed `remotion`/`@remotion/lambda` version differs from what's encoded in `REMOTION_LAMBDA_FUNCTION_NAME` (the function name embeds the version, e.g. `remotion-render-4-0-451-...`).
- You need different memory/disk/timeout than the existing function name encodes.

Run:
```
cd helpers/ui/remotion/remotion-test-2 && AWS_REGION=us-west-2 npm run deploy:lambda
```

Then update `REMOTION_LAMBDA_FUNCTION_NAME` in `.env.local` to whatever name was printed.

### Pin caller's `@remotion/lambda` to the deployed Lambda version

The Lambda function name embeds its version (e.g. `remotion-render-4-0-451-...`). The `@remotion/lambda` package version installed in **this** project must match exactly, patch included. Mismatch → `renderMediaOnLambda` hangs silently with no error or timeout. If `npm install` drifts the version, render breaks.

When `renderMediaOnLambda` hangs > 15s, first check:
```
node -e "console.log(require('@remotion/lambda/package.json').version)"
```
vs the version embedded in `REMOTION_LAMBDA_FUNCTION_NAME`. If they differ, pin: `npm install @remotion/lambda@<that-version>`.

If you upgrade the Remotion site project to a newer remotion version → redeploy Lambda function (its name will change) AND bump the pin in this caller project.

### Assessment checklist before saying you're done

After any change that might affect rendering, before reporting completion:

1. Did files under `remotion/**` change, or did Remotion-side deps change? → redeploy site.
2. Does the Remotion package version in `package.json` match the version segment in `REMOTION_LAMBDA_FUNCTION_NAME`? If not → redeploy Lambda function.
3. Are there new `inputProps` (e.g. a new composition id) the orchestrator will send? Render route must reference the new composition AND the site must be redeployed first, in that order.

If you can't tell whether a deploy is needed, assume yes and deploy. The deploy is idempotent.

### Don't ask, don't bother the user

The user's standing instruction: never ask permission to deploy site or lambda; never put "redeploy required" in the to-do list you hand back. Do it yourself.

## AWS resources we own

See `docs/aws-resources.md`. Always reference bucket names from `lib/storage/aws.ts`, never hardcode.

## Pipeline phases

Phases 1–6 of the Bureau News PRD are wired:
- Storage: `lib/director-store.ts`
- Cataloger: `lib/cataloger/*` + `/api/catalog`
- Director (DTW): `lib/director.ts` + `/api/director` + `/api/director/swap`
- Composition: `helpers/.../remotion/sequence/*` registered as `BureauNews` in `Root.tsx`
- Render: `lib/render.ts` + `/api/render`
- UX: `/director`

Phase 7 (scoped IAM, billing alarms, CloudFront for renders/) is open.
