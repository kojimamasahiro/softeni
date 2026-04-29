# AdInsight Static Site

This directory contains the static site intended for:

https://adinsight.softeni-pick.com/

Deploy it as a separate Cloudflare Pages project from the main Softeni Pick
site.

Recommended Cloudflare Pages settings:

- Project name: `adinsight`
- Build command: leave empty
- Build output directory: `adinsight-site`
- Custom domain: `adinsight.softeni-pick.com`

Routes provided by `_redirects`:

- `/privacy` -> `/privacy.html`
- `/terms` -> `/terms.html`
- `/account-delete` -> `/account-delete.html`
