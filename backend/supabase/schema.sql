-- ============================================================
-- SuitesOps — Supabase (PostgreSQL) schema
-- Run this in Supabase → SQL Editor → New query → Run.
-- IDs are TEXT to preserve the original MongoDB _id values 1:1.
-- ============================================================

-- Clean slate (safe to re-run). Order matters for FKs.
drop table if exists activity_logs cascade;
drop table if exists payments cascade;
drop table if exists guests cascade;
drop table if exists inventory_items cascade;
drop table if exists rooms cascade;
drop table if exists users cascade;

-- ---------------- USERS ----------------
create table users (
  id            text primary key,
  name          text not null,
  email         text not null unique,
  password_hash text not null,
  role          text not null default 'frontdesk' check (role in ('manager','frontdesk')),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------- ROOMS ----------------
create table rooms (
  id          text primary key,
  number      text not null unique,
  type        text not null,
  daily_rate  numeric(12,2) not null check (daily_rate >= 0),
  status      text not null default 'available' check (status in ('available','occupied','maintenance')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------- GUESTS ----------------
create table guests (
  id                     text primary key,
  name                   text not null,
  id_number              text not null,
  phone                  text not null,
  room_id                text references rooms(id) on delete set null,
  room_number            text not null,
  daily_rate             numeric(12,2) not null check (daily_rate >= 0),
  check_in_date          timestamptz not null,
  expected_check_out_date timestamptz not null,
  actual_check_out_date  timestamptz,
  status                 text not null default 'checked-in' check (status in ('checked-in','checked-out')),
  total_charges          numeric(12,2) not null default 0,
  created_by             text references users(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index idx_guests_status on guests(status);
create index idx_guests_room_number on guests(room_number);
create index idx_guests_room_id on guests(room_id);
-- simple text search helper
create index idx_guests_name on guests(lower(name));

-- ---------------- PAYMENTS ----------------
create table payments (
  id          text primary key,
  guest_id    text not null references guests(id) on delete cascade,
  amount      numeric(12,2) not null check (amount > 0),
  date        timestamptz not null default now(),
  mode        text not null check (mode in ('cash','card','upi')),
  reference   text default '',
  recorded_by text references users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index idx_payments_guest on payments(guest_id);
create index idx_payments_date on payments(date);

-- ---------------- INVENTORY ----------------
create table inventory_items (
  id         text primary key,
  name       text not null,
  category   text not null default 'other' check (category in ('linen','toiletries','minibar','cleaning','other')),
  unit       text not null default 'unit',
  quantity   numeric(12,2) not null default 0 check (quantity >= 0),
  threshold  numeric(12,2) not null default 0 check (threshold >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_inventory_category on inventory_items(category);

-- ---------------- ACTIVITY LOG ----------------
create table activity_logs (
  id         text primary key,
  user_id    text references users(id) on delete set null,
  user_name  text,
  action     text not null,
  entity     text,
  entity_id  text,
  details    text default '',
  created_at timestamptz not null default now()
);
create index idx_activity_created on activity_logs(created_at desc);
create index idx_activity_action on activity_logs(action);

-- ============================================================
-- Atomic room claim — prevents the check-in double-booking race.
-- Returns the room row only if it was 'available' and is now claimed.
-- ============================================================
create or replace function claim_room(p_room_id text)
returns setof rooms
language sql
as $$
  update rooms
     set status = 'occupied', updated_at = now()
   where id = p_room_id and status = 'available'
  returning *;
$$;

-- Adjust stock atomically, clamped at 0. Returns the updated row.
create or replace function adjust_stock(p_item_id text, p_delta numeric)
returns setof inventory_items
language sql
as $$
  update inventory_items
     set quantity = greatest(0, quantity + p_delta), updated_at = now()
   where id = p_item_id
  returning *;
$$;

-- ============================================================
-- We use our own JWT auth with the service-role key on the server,
-- so Row Level Security is left OFF (the anon/public key is never
-- exposed to clients). Do NOT expose the service_role key to the browser.
-- ============================================================
