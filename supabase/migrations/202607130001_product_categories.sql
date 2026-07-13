create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, name)
);

create index product_categories_business_id_idx
on public.product_categories(business_id);

create trigger product_categories_set_updated_at before update on public.product_categories
for each row execute function public.set_updated_at();

insert into public.product_categories (business_id, name)
select distinct business_id, trim(category)
from public.products
where nullif(trim(category), '') is not null
on conflict (business_id, name) do nothing;

alter table public.product_categories enable row level security;

create policy "Members can read product categories"
on public.product_categories for select using (public.is_business_member(business_id));

create policy "Managers can add product categories"
on public.product_categories for insert with check (public.can_manage_business(business_id));

create policy "Managers can update product categories"
on public.product_categories for update using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

create policy "Managers can delete product categories"
on public.product_categories for delete using (public.can_manage_business(business_id));
