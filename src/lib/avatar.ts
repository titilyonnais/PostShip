// Fun, no-signup-required generated avatars — matches the existing
// "PostShipBot" user-agent theme (see src/lib/checks/shared.ts). Fallback
// for anyone without a real photo (magic link / password accounts, or an
// OAuth provider that didn't share one).
export function avatarUrl(seed: string, size = 64): string {
  return `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(seed)}&size=${size}&backgroundType=gradientLinear`;
}

// Prefer the real photo GitHub/Google handed us at sign-in
// (profiles.avatar_url — see src/app/auth/callback/route.ts) over the
// generated one everywhere an avatar is rendered.
export function resolveAvatarUrl(
  profile: { avatar_url?: string | null; avatar_seed?: string | null } | null | undefined,
  fallbackSeed: string,
  size = 64,
): string {
  return profile?.avatar_url || avatarUrl(profile?.avatar_seed ?? fallbackSeed, size);
}
