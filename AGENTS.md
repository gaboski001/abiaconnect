# Architecture rules
- Thread and reply images are private storage objects; refresh their signed URLs under the viewer's session so private-group access remains protected.
- Do not delete composer uploads on unmount or post-success clearing; navigation and autosaved drafts can still reference them.
- Relationship plan mode is enforced through the database's central plan resolver, not client flags; preserve blocking, account standing, privacy, and abuse protection.