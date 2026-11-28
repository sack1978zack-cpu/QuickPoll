# QuickPoll

Single-page poll generator featuring custom gradients (Gold, Black, Blue, Purple, Red), Fredoka typography with white main text and black stroke, transparent custom logo and icon slots, live preview, expiration countdown timers, and unique shareable poll links.

## Files Included

- `index.html` — Main single-page application
- `styles.css` — Multi-gradient theme, Fredoka typography with black stroke, responsive layout
- `app.js` — Live poll builder, URL-encoded unique poll generator, countdown timer, saved polls
- `poll-api.php` — Optional Hostinger PHP endpoint for live cross-device vote sync
- `embed.html` — Self-contained single-file HTML embed version (all CSS, JS, and transparent PNG icons inlined)
- `assets/` — Transparent-background logo and UI icons (`logo.png`, `icon-poll.png`, `icon-timer.png`, `icon-share.png`, `icon-vote.png`)

## Deploying on Hostinger via GitHub

1. Connect your Hostinger website to this GitHub repository (`sack1978zack-cpu/QuickPoll`).
2. Set the deployment branch (merge the pull request into `main` or select the branch directly in Hostinger Git settings) and deploy to `public_html`.
3. Visit your domain. If your Hostinger plan runs PHP, `poll-api.php` automatically activates `Live Server Sync` so friends' votes sync across devices. On static-only hosting, QuickPoll automatically runs in `Static Link Mode`.

## Custom Icon Slots

Search for `data-icon-slot` in `index.html` to swap or add custom transparent PNG or SVG icons anywhere in the interface.
