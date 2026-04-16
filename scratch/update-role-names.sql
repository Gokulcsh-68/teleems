-- Migration Script: Sync Role Names to v4.0 Spec
-- This script updates the "roles" JSONB array for all users who have the old role names.

-- 1. Update Hospital ERCP Doctor -> Hospital ED Doctor (ERCP)
UPDATE "user"
SET roles = ARRAY_REPLACE(roles::text[], 'Hospital ERCP Doctor', 'Hospital ED Doctor (ERCP)')
WHERE 'Hospital ERCP Doctor' = ANY(roles::text[]);

-- 2. Update Ambulance Pilot -> Ambulance Pilot (Driver)
UPDATE "user"
SET roles = ARRAY_REPLACE(roles::text[], 'Ambulance Pilot', 'Ambulance Pilot (Driver)')
WHERE 'Ambulance Pilot' = ANY(roles::text[]);

-- 3. Update CCE -> Call Centre Executive (CCE)
UPDATE "user"
SET roles = ARRAY_REPLACE(roles::text[], 'CCE', 'Call Centre Executive (CCE)')
WHERE 'CCE' = ANY(roles::text[]);

-- 4. Verify updates
SELECT id, username, roles FROM "user" WHERE roles::text[] && ARRAY['Hospital ED Doctor (ERCP)', 'Ambulance Pilot (Driver)', 'Call Centre Executive (CCE)'];
