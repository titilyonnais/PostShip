// Fun, no-signup-required generated avatars — matches the existing
// "PostShipBot" user-agent theme (see src/lib/checks/shared.ts).
export function avatarUrl(seed: string, size = 64): string {
  return `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(seed)}&size=${size}&backgroundType=gradientLinear`;
}
