-- Migration: Add receipt customization and thermal printer settings to businesses table
-- Description: Enables shop owners to customize receipt headers (slogan, MoMo merchant details),
-- footers (return policy, thank you note), and default thermal printer paper width (58mm vs 80mm).

alter table public.businesses
  add column if not exists slogan text,
  add column if not exists momo_details text,
  add column if not exists return_policy text default 'Goods sold in good condition are not returnable after 3 days.',
  add column if not exists receipt_width text default '58mm',
  add column if not exists receipt_footer text default 'Thank you for your patronage! Visit again.';

-- Comment on columns for documentation
comment on column public.businesses.slogan is 'Store slogan or tagline printed under business name on receipts';
comment on column public.businesses.momo_details is 'Mobile Money merchant number / payment details displayed on receipts';
comment on column public.businesses.return_policy is 'Shop return or exchange terms printed at bottom of receipts';
comment on column public.businesses.receipt_width is 'Preferred thermal printer paper width: 58mm or 80mm';
comment on column public.businesses.receipt_footer is 'Closing thank-you message on receipts';
