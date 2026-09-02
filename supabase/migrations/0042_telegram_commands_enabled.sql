-- M3b (menu backlog): lets the Bot page show "commandes activées" without
-- ever reading telegram_webhook_secret itself.
alter table public.projects
  add column if not exists telegram_commands_enabled boolean
    generated always as (telegram_webhook_secret is not null) stored;

grant select (telegram_commands_enabled) on public.projects to authenticated;
