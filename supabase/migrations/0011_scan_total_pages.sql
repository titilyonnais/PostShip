-- Known at discovery time, lets the UI show a real "X/Y pages" progress bar
-- instead of just a running count with no denominator until the scan ends.
alter table public.site_scans
  add column total_pages integer not null default 0;
