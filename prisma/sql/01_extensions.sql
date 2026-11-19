-- Run ONCE in the Supabase SQL editor BEFORE `npm run db:migrate`.
create extension if not exists vector;
create extension if not exists pgcrypto;
