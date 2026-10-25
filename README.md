# Chatil Store

Responsive Arabic RTL storefront for Chatil Accessories, tailored for customers in Egypt.

## Implemented
- Mobile-friendly Arabic storefront and client-side cart.
- Catalog reads active products from Supabase (with a local fallback).
- Prices in Egyptian pounds (EGP).
- Guest checkout with cash on delivery and Egyptian governorate/address fields.
- Orders and line items saved in Supabase; server-side product prices are used to calculate totals.
- Row Level Security enabled. Public visitors can read active products only; order tables are not publicly readable.
- Supabase Edge Function validates checkout input and restricts browser origins to the store domains.
- Vercel production deployment on the free Hobby tier.

## Current limitations
- Product names and prices seeded in the database are starter/demo values. Replace them with Chatil's actual catalogue and prices before promoting the store.
- Payment is cash on delivery only. No online payment gateway is configured.
- No admin dashboard, delivery-company integration, order notifications, or persisted newsletter signup yet.
- The checkout endpoint has basic validation and a honeypot; add stronger abuse protection/CAPTCHA before a large public campaign.
- Custom domain not connected.

## Project details
- Supabase project: `jqifcdgfdbxespfuztzn`
- Supabase region: Mumbai (`ap-south-1`)
- Vercel project: `chatil-store`
- Storefront URL: `https://chatil-store.vercel.app`
- GitHub: `https://github.com/chatilaccessories-cmyk/chatil-store`

No service-role key or other secret is committed to this repository. The Supabase publishable key used by the storefront is intended for public clients; access is controlled by RLS and database grants.
