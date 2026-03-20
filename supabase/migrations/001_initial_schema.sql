-- Customers
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete cascade,
  email text unique not null,
  first_name text,
  last_name text,
  business_name text,
  website_url text,
  business_type text,
  primary_service text,
  marketing_challenge text,
  current_channels text[],
  role text default 'customer',
  stripe_customer_id text,
  pinball_customer_id text,
  created_at timestamptz default now(),
  last_login timestamptz,
  updated_at timestamptz default now()
);

-- Purchases
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  product_type text not null,
  stripe_payment_id text,
  stripe_price_id text,
  pinball_order_id text,
  amount integer,
  created_at timestamptz default now()
);

-- Sessions
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  session_uuid text unique not null,
  phase integer default 1,
  message_history jsonb default '[]',
  icp_data jsonb,
  status text default 'not_started',
  started_at timestamptz,
  last_activity timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- Deliverables
create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete cascade,
  deliverable_type text not null,
  content jsonb,
  pdf_url text,
  status text default 'pending',
  generated_at timestamptz,
  created_at timestamptz default now()
);

-- Row Level Security
alter table public.customers enable row level security;
alter table public.purchases enable row level security;
alter table public.sessions enable row level security;
alter table public.deliverables enable row level security;

-- Customers can only see their own data
create policy "customers_own_data" on public.customers
  for all using (auth.uid() = auth_user_id);

create policy "purchases_own_data" on public.purchases
  for all using (
    customer_id in (
      select id from public.customers where auth_user_id = auth.uid()
    )
  );

create policy "sessions_own_data" on public.sessions
  for all using (
    customer_id in (
      select id from public.customers where auth_user_id = auth.uid()
    )
  );

create policy "deliverables_own_data" on public.deliverables
  for all using (
    customer_id in (
      select id from public.customers where auth_user_id = auth.uid()
    )
  );
