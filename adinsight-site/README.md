# AdInsight Static Site

This directory contains the static site intended for:

https://adinsight.softeni-pick.com/

Deploy it as a separate Cloudflare Pages project from the main Softeni Pick
site.

Recommended Cloudflare Pages settings:

- Project name: `adinsight`
- Build command: `npm run build:adinsight`
- Build output directory: `out`
- Custom domain: `adinsight.softeni-pick.com`

Routes are provided as directory index pages to avoid clean URL redirect loops:

- `/privacy`
- `/terms`
- `/account-delete`
