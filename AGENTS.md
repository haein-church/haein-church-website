# Project instructions

## Project scope

- Work from this computer and keep all project sources, archives, migration data, and reference files in this checkout.
- Use only `haein-church/haein-church-website` on GitHub, the existing Cloudflare `haein-church` Pages project and `haein-church.kr` domain, and the intended `haein-church-website` project in `haein-church's Org` on Supabase.
- Do not operate on unrelated accounts, repositories, Cloudflare projects, or Supabase projects, or move the work to another computer.
- The Supabase database region must be Seoul (`ap-northeast-2`).
- Do not publish, push changes that trigger deployment, or expose a preview to the Internet until the user explicitly requests Internet publication. Keep local preview bound to `127.0.0.1`; keep Cloudflare production and preview automatic deployments disabled.
- Preserve existing administrator page code when importing the Onmam archive into public-facing boards.
- Original Onmam materials are staged locally in `migration/onmam/`; keep archive files out of the public Git repository and deploy them only as part of an explicit publication task.

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
