Rule 1: No silent assumptions. Before making any change, Claude must verify its understanding of the task. If something is ambiguous, it asks instead of guessing. This prevents the failure mode where Claude confidently builds the wrong thing for 20 minutes.

Rule 2: No over-engineering. The simplest solution that works is the correct solution. This prevents Claude from creating elaborate abstractions, utility functions, and design patterns when a straightforward implementation would do. The 50-line solution beats the 500-line one.

Rule 3: No orthogonal changes. If you ask Claude to fix a bug in the authentication flow, it should not also refactor the logging system it noticed along the way. Stay on task. This prevents scope creep that introduces new bugs in code you weren't looking at.

Rule 4: Explicit verification. After completing a change, Claude runs the relevant tests and verifies the output. No "I've made the changes, they should work." It checks.

Rule 5: I'm always open to ideas on better ways to do things. Please don't hesitate to suggest a better way, or one that has long lasting impact over a tactical change. (as a few examples)