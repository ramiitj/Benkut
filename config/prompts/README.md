# Server-only prompt registry

Prompt content is deliberately not bundled into the Vite application. Seed each agent's separate prompt through the trusted deployment job using `agent-definitions.seed.json`. Published versions are immutable. Store content, SHA-256 hash, agent and policy references, output schema, creator/reviewer/publisher identities, timestamps, reason, parent, evaluation results, and lifecycle status. Only the backend service account may read published content; consumers receive structured results, never prompts.
