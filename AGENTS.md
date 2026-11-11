# Project instructions

## Project scope

- Work from this computer and keep all project sources, archives, migration data, and reference files in this checkout.
- Use only `haein-church/haein-church-website` on GitHub, the existing Cloudflare `haein-church` Pages project and `haein-church.kr` domain, and the intended `haein-church-website` project in `haein-church's Org` on Supabase.
- Do not operate on unrelated accounts, repositories, Cloudflare projects, or Supabase projects, or move the work to another computer.
- The Supabase database region must be Seoul (`ap-northeast-2`).
- Do not publish, push changes that trigger deployment, or expose a preview to the Internet until the user explicitly requests Internet publication. Keep local preview bound to `127.0.0.1`; keep Cloudflare production and preview automatic deployments disabled.
- Preserve existing administrator page code when importing the Onmam archive into public-facing boards.
- Original Onmam materials are staged locally in `migration/onmam/`; keep archive files out of the public Git repository and deploy them only as part of an explicit publication task.

## Source and preview synchronization

- Save reviewed source changes to `haein-church/haein-church-website` before updating Cloudflare. Commit and push the working branch first, then deploy that exact commit to the existing authorized preview branch. Record the commit and deployment URL.
- The shared preview is `https://codex-preview-20261102.haein-church-9j8.pages.dev/`. Keep automatic production and preview deployments disabled. A preview update does not authorize publishing to the production domain.
- Keep `CLAUDE.md` current so another coding assistant can locate the working branch, source files, local archive requirements and preview workflow.
- Never commit original Onmam archives, environment files, service keys or generated private reports. Preserve hidden-record protection in both repository source and Pages deployment packages.

## Development commands

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
