INSERT INTO vehicles (id, identifier, status, gps_lat, gps_lon, type, "createdAt", "updatedAt") 
VALUES 
  (gen_random_uuid(), 'AMB-NEAR', 'AVAILABLE', 10.3800000, 78.8200000, 'ALS', NOW(), NOW()), 
  (gen_random_uuid(), 'AMB-FAR', 'AVAILABLE', 10.5000000, 79.0000000, 'BLS', NOW(), NOW())
ON CONFLICT (identifier) DO UPDATE SET 
  status = 'AVAILABLE', 
  gps_lat = EXCLUDED.gps_lat, 
  gps_lon = EXCLUDED.gps_lon;
