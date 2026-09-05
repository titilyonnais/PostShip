-- The operator console gets its own identity realm, deliberately separate
-- from customer auth.
--
-- Why not a flag on a customer account: the two have different threat
-- models. A customer session is long-lived, rides a cookie readable by
-- every page of the app, and is issued by a flow with self-service signup,
-- OAuth providers and password reset. An operator session should share
-- none of that surface — an account takeover anywhere in the customer app
-- must not become an account takeover of the console.
--
-- Nothing here is reachable from PostgREST: RLS is on with no policy at
-- all, and every grant is revoked, so only the service role (server-side,
-- never in a browser) can read or write these tables.

create table public.admin_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  -- scrypt$N$r$p$salt$hash — the parameters travel with the hash so they
  -- can be raised later without invalidating existing passwords.
  password_hash text not null,
  -- base32, RFC 4648. Null until the operator enrols an authenticator,
  -- which the login flow forces before granting a first session.
  totp_secret text,
  totp_enrolled_at timestamptz,
  -- Highest TOTP time-step already accepted. A valid code stays valid for
  -- its whole 30s window, so without this a code observed in transit (or
  -- over someone's shoulder) can be replayed within that window.
  totp_last_step bigint,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.admin_accounts(id) on delete cascade,
  -- The cookie carries an opaque random token; only its SHA-256 is stored,
  -- so a dump of this table does not hand anyone a working session.
  token_hash text not null unique,
  ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  -- Idle timeout is measured from here, absolute expiry from expires_at:
  -- one bounds an unattended screen, the other bounds a stolen cookie.
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index admin_sessions_account_idx on public.admin_sessions (account_id);
create index admin_sessions_expiry_idx on public.admin_sessions (expires_at);

-- Every privileged action and every login attempt, successful or not.
-- An operator console without a trail is an alibi machine.
create table public.admin_audit_log (
  id bigserial primary key,
  account_id uuid references public.admin_accounts(id) on delete set null,
  username text,
  action text not null,
  target text,
  detail jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

alter table public.admin_accounts enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.admin_audit_log enable row level security;

-- No policies are defined on purpose: with RLS enabled and no policy, every
-- role except the service role (which bypasses RLS) sees zero rows. The
-- explicit revokes below close the table-level grants Supabase's default
-- schema setup hands to anon/authenticated, the same lesson as migration
-- 0026 — a policy alone would not have been enough.
revoke all on public.admin_accounts from anon, authenticated;
revoke all on public.admin_sessions from anon, authenticated;
revoke all on public.admin_audit_log from anon, authenticated;
revoke all on sequence public.admin_audit_log_id_seq from anon, authenticated;
