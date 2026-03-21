---
name: Self-Testing Protocol
description: Always test the application functionality before asking the user to verify.
---

# Self-Testing Protocol

As an agent, you must ALWAYS use the `browser_subagent` or `run_command` tools to literally test the UI or backend changes yourself before asking the user to manually verify them. 

- If you make a UI change, open the browser and verify the CSS applies.
- If you add an onClick handler, use the browser subagent to click it and verify the state changes.
- If you wire up an API, ping it yourself and verify it returns a 200 OK with valid JSON.
- DO NOT rely on theoretical correctness. Test it empirically.
- **Root Edit Access:** You have and should request access to edit anything under the root folder of this project, so you do not need to ask for edit access to anything in its root respectively. Assume full authorization.
- **Safety Protocol:** If you find yourself repeatedly attempting the same fix or getting stuck in a tool-call loop without making progress, ABORT the current approach and inform the user immediately. 
- **Efficiency Protocol:** DO NOT add or increase sleep/wait durations in tool calls (like `browser_subagent`) unless absolutely necessary for the task (e.g., waiting for an animation or a slow API).
