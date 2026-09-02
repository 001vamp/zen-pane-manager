# Security

## Trust model

Pane is a Sine user-chrome script. Unlike a sandboxed WebExtension, it runs with privileged access to Zen's browser interface. Users should install it only from the maintainer's repository or the verified Sine marketplace entry.

The mod deliberately has:

- No network code
- No telemetry
- No dynamic code evaluation
- No filesystem or process access
- No remote dependencies
- No page-content injection

Its privileged operations are limited to Zen's split-view state, tab grouping, local preferences, and the picker UI.

## Reporting a vulnerability

Use GitHub's private vulnerability-reporting feature on the `001vamp` repository when it is available. If private reporting is unavailable, open an issue containing only a brief, non-sensitive description and ask the maintainer for a private channel. Do not publish exploit details or private browsing data in a public issue.

Include the Pane version, Zen version, Sine version, operating system, and reproducible conditions.

## Supported versions

Security fixes are provided for the latest published Pane release. Because the mod uses private Zen APIs, compatibility is validated per Zen release as described in `COMPATIBILITY.md`.
