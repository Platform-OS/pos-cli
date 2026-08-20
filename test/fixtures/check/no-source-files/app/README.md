A project root with no source files.

`app/` makes this directory a platformOS project root, and this file is deliberately NOT one of
the source extensions the linter reads (.liquid, .yml, .graphql) — so the check finds a valid
project and zero files to check.

A `.pos` marker would have been the more obvious way to declare the root, but `.pos` is in this
repository's .gitignore, so the fixture would not survive a clone and the test would fail on CI.
