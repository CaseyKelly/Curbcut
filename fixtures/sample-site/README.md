# Sample broken site

A small React app with deliberate accessibility bugs (#10). It is the demo target and the test repo for repo mode.

- `issues.manifest.json` lists each seeded issue: the expected axe rule, file, and component.
- A few correct patterns are included that must **not** be "fixed".

This folder is excluded from ESLint on purpose, so the seeded bugs stay in place.
