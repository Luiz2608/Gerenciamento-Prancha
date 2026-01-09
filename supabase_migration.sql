-- Rode este comando no SQL Editor do seu projeto Supabase para adicionar a coluna faltante
ALTER TABLE motoristas ADD COLUMN IF NOT EXISTS cnh_number text;
