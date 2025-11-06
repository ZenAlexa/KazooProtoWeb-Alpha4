---
description: Review all commits on current branch since diverging from main
---

Read the git history of the current branch and summarize:
1. What changes have been made (grouped by topic/feature)
2. Current implementation status
3. Any in-progress work or TODOs mentioned in recent commits

Use `git log main..HEAD --oneline` to get the commit list, then read key commits with `git show <commit-hash>` for context.

Keep the summary concise (under 500 words). Focus on architecture decisions and current state, not individual code changes.
