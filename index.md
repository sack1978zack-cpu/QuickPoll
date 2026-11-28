# QuickPoll

Create free online polls in seconds with custom expiration timers, scannable QR codes, instant social sharing, and live results. No account or signup required.

## Key Features

- **Poll Builder (`#create`)**: Enter a question (up to 180 chars), add 2 to 8 answers, enable single or multiple choice, pick an expiration timer (`15m`, `1h`, `6h`, `24h`, `3d`, `7d`, or custom date/time), and generate a shareable URL + QR code.
- **Templates (`#templates`)**: Load ready made templates across Friends, Food, Gaming, and Work in one click.
- **How to Use (`#how-to-use`)**: Step by step guide from creating a poll to sharing and tracking results.
- **Questions & Answers (`#qa`)**: Answers on voting rules, expiration locks, and browser storage.
- **Donations (`#donate`)**: 20% of every donation goes directly toward helping homeless people with food and essentials, backed by end of month video updates. Checkout via Stripe: https://buy.stripe.com/fZu6oB4LqgPVbJn8YqdQQ03

## Company, Legal & Contact

- **Website**: https://quickpollnow.com/
- **About**: https://quickpollnow.com/#about
- **Contact**: [contact@quickpollnow.com](mailto:contact@quickpollnow.com) (https://quickpollnow.com/#contact)
- **Privacy Policy**: https://quickpollnow.com/#privacy
- **Terms of Use**: https://quickpollnow.com/#terms

## Agent & API Resources

- `GET /llms.txt`: Site overview for language models and agents.
- `GET /.well-known/mcp/server-card.json`: MCP Server Card (SEP 1649).
- `GET /poll-api.php?action=ping`: Server availability check.
- `POST /poll-api.php?action=create`: Create a new poll (`q`, `opts`, `expiresAt`, `multi`).
- `GET /poll-api.php?action=get&id={pollId}`: Fetch poll state and vote tallies.
- `POST /poll-api.php?action=vote`: Submit vote choices (`id`, `choices`).
