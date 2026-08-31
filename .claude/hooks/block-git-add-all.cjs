let data = '';
process.stdin.on('data', (chunk) => { data += chunk; });
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(data || '{}');
  } catch {
    process.exit(0);
  }

  const command = (input.tool_input && input.tool_input.command) || '';
  const blocked = /\bgit\s+add\b[^\n]*(\s-[A-Za-z]*A[A-Za-z]*\b|\s--all\b|\s\.\s*($|&&|;|\|)|\s\.$)/.test(command);

  if (blocked) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'PostShip rule: stage files by name, not `git add -A` / `git add .` (see CLAUDE.md).',
      },
    }));
  }
  process.exit(0);
});
