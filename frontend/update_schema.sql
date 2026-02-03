-- Run this script in your Supabase SQL Editor to add the missing columns to the 'viagens' table.
-- This fixes the "Could not find the 'tolls' column" error and others.

-- Core Cost Columns
ALTER TABLE viagens ADD COLUMN IF NOT EXISTS tolls numeric DEFAULT 0;
ALTER TABLE viagens ADD COLUMN IF NOT EXISTS freight_value numeric DEFAULT 0;
ALTER TABLE viagens ADD COLUMN IF NOT EXISTS other_costs numeric DEFAULT 0;
ALTER TABLE viagens ADD COLUMN IF NOT EXISTS maintenance_cost numeric DEFAULT 0;
ALTER TABLE viagens ADD COLUMN IF NOT EXISTS driver_daily numeric DEFAULT 0;

-- Trip Details Columns
ALTER TABLE viagens ADD COLUMN IF NOT EXISTS cargo_qty text;
ALTER TABLE viagens ADD COLUMN IF NOT EXISTS trip_type text DEFAULT 'one_way';
ALTER TABLE viagens ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE viagens ADD COLUMN IF NOT EXISTS origin text;
ALTER TABLE viagens ADD COLUMN IF NOT EXISTS requester text;
ALTER TABLE viagens ADD COLUMN IF NOT EXISTS service_type text;

-- Planned Values Columns
ALTER TABLE viagens ADD COLUMN IF NOT EXISTS planned_km numeric DEFAULT 0;
ALTER TABLE viagens ADD COLUMN IF NOT EXISTS planned_duration text;
ALTER TABLE viagens ADD COLUMN IF NOT EXISTS planned_fuel_liters numeric DEFAULT 0;
ALTER TABLE viagens ADD COLUMN IF NOT EXISTS planned_toll_cost numeric DEFAULT 0;
ALTER TABLE viagens ADD COLUMN IF NOT EXISTS planned_driver_cost numeric DEFAULT 0;
ALTER TABLE viagens ADD COLUMN IF NOT EXISTS planned_maintenance numeric DEFAULT 0;
ALTER TABLE viagens ADD COLUMN IF NOT EXISTS planned_total_cost numeric DEFAULT 0;
