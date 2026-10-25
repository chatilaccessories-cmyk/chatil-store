grant select on public.products to anon, authenticated;

insert into public.products (slug, name_ar, description_ar, price_egp, category, is_active)
values
 ('everyday-earrings', 'حلق يومي', 'لمسة بسيطة لكل يوم', 280, 'earrings', true),
 ('classic-necklace', 'سلسلة كلاسيك', 'تفاصيل ناعمة وأنيقة', 390, 'necklaces', true),
 ('minimal-bracelet', 'إسورة مينيمال', 'تكمّل إطلالتك بسهولة', 320, 'bracelets', true),
 ('style-ring', 'خاتم ستايل', 'قطعة صغيرة بتأثير كبير', 250, 'rings', true)
on conflict (slug) do update set
 name_ar = excluded.name_ar,
 description_ar = excluded.description_ar,
 price_egp = excluded.price_egp,
 category = excluded.category,
 is_active = excluded.is_active,
 updated_at = now();

create or replace function public.create_guest_order(
  p_customer_name text,
  p_phone text,
  p_governorate text,
  p_address text,
  p_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_total integer := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
begin
  if length(trim(coalesce(p_customer_name, ''))) < 2 or length(coalesce(p_customer_name, '')) > 100 then
    raise exception 'invalid_customer_name';
  end if;
  if p_phone is null or p_phone !~ '^[0-9+()[:space:]-]{8,20}$' then
    raise exception 'invalid_phone';
  end if;
  if length(trim(coalesce(p_governorate, ''))) < 2 or length(coalesce(p_governorate, '')) > 80 then
    raise exception 'invalid_governorate';
  end if;
  if length(trim(coalesce(p_address, ''))) < 5 or length(coalesce(p_address, '')) > 500 then
    raise exception 'invalid_address';
  end if;
  if length(coalesce(p_notes, '')) > 500 then
    raise exception 'invalid_notes';
  end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'invalid_items';
  end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 20 then
    raise exception 'invalid_items';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or coalesce(v_item->>'slug','') = ''
       or coalesce(v_item->>'quantity','') !~ '^[0-9]{1,2}$' then
      raise exception 'invalid_item';
    end if;
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity < 1 or v_quantity > 20 then raise exception 'invalid_quantity'; end if;
    select * into v_product from public.products
      where slug = v_item->>'slug' and is_active = true;
    if not found then raise exception 'product_unavailable'; end if;
    v_total := v_total + (v_product.price_egp * v_quantity);
    if v_total > 1000000 then raise exception 'order_total_too_large'; end if;
  end loop;

  insert into public.orders (customer_name, phone, governorate, address, notes, total_egp)
  values (trim(p_customer_name), trim(p_phone), trim(p_governorate), trim(p_address), nullif(trim(coalesce(p_notes,'')),''), v_total)
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    select * into v_product from public.products
      where slug = v_item->>'slug' and is_active = true;
    insert into public.order_items (order_id, product_id, product_name_snapshot, unit_price_egp, quantity)
    values (v_order_id, v_product.id, v_product.name_ar, v_product.price_egp, v_quantity);
  end loop;

  return jsonb_build_object('order_id', v_order_id, 'total_egp', v_total, 'status', 'pending');
end;
$$;
revoke all on function public.create_guest_order(text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_guest_order(text, text, text, text, text, jsonb) to service_role;

drop policy if exists "No public access to orders" on public.orders;
create policy "No public access to orders" on public.orders
  for all to anon, authenticated using (false) with check (false);
drop policy if exists "No public access to order items" on public.order_items;
create policy "No public access to order items" on public.order_items
  for all to anon, authenticated using (false) with check (false);
