-- PostgreSQL schema used when DATABASE_URL points at Supabase/PostgreSQL.
create table if not exists model_skill_metrics (
  id bigserial primary key,
  provider varchar(40) not null,
  variable varchar(30) not null,
  location_key varchar(180) not null default 'INDIA',
  mae double precision not null check (mae >= 0),
  rmse double precision not null check (rmse >= 0),
  correlation double precision check (correlation between -1 and 1),
  bias double precision,
  sample_count integer not null default 0 check (sample_count >= 0),
  reference_name varchar(100) not null default '',
  updated_at timestamptz not null default now(),
  constraint uq_model_skill_scope unique (provider, variable, location_key)
);
create index if not exists ix_model_skill_metrics_provider on model_skill_metrics(provider);
create index if not exists ix_model_skill_metrics_variable on model_skill_metrics(variable);

create table if not exists weight_history (
  id bigserial primary key,
  provider varchar(40) not null,
  variable varchar(30) not null,
  location_key varchar(180) not null default 'INDIA',
  weight double precision not null check (weight >= 0 and weight <= 1),
  method varchar(100) not null,
  recorded_at timestamptz not null default now()
);
create index if not exists ix_weight_history_provider on weight_history(provider);
create index if not exists ix_weight_history_variable on weight_history(variable);
create index if not exists ix_weight_history_recorded_at on weight_history(recorded_at);

-- The backend connects directly with its server-side database role; deny anonymous Data API access.
alter table model_skill_metrics enable row level security;
alter table weight_history enable row level security;
revoke all on table model_skill_metrics, weight_history from public, anon, authenticated;
revoke all on sequence model_skill_metrics_id_seq, weight_history_id_seq from public, anon, authenticated;
