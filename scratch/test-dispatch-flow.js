const { Client } = require('pg');

async function testDispatch() {
  const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'teleems',
    port: 5433,
    // Password might be needed depending on local setup, 
    // assuming empty based on app config but explicitly setting to string
    password: '', 
  });

  try {
    await client.connect();
    console.log("Connected to DB");

    // 1. Seed Vehicles
    await client.query(`
      INSERT INTO vehicles (id, identifier, status, gps_lat, gps_lon, type, "createdAt", "updatedAt") 
      VALUES 
        ('550e8400-e29b-41d4-a716-446655440000', 'AMB-CLOSE', 'AVAILABLE', 10.380, 78.820, 'ALS', NOW(), NOW()), 
        ('550e8400-e29b-41d4-a716-446655440001', 'AMB-FAR', 'AVAILABLE', 10.500, 79.000, 'BLS', NOW(), NOW())
      ON CONFLICT (identifier) DO UPDATE SET 
        status = 'AVAILABLE', 
        gps_lat = EXCLUDED.gps_lat, 
        gps_lon = EXCLUDED.gps_lon;
    `);
    console.log("✅ Vehicles seeded (AMB-CLOSE and AMB-FAR)");

    // 2. Login
    console.log("Logging in...");
    const loginRes = await fetch("http://localhost:3000/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@teleems.com", password: "Admin@123!" })
    });
    const { data: { access_token } } = await loginRes.json();
    console.log("✅ Logged in");

    // 3. Create Incident (Near AMB-CLOSE)
    console.log("Creating incident...");
    const incidentRes = await fetch("http://localhost:3000/v1/incidents", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${access_token}`
      },
      body: JSON.stringify({
        category: "MEDICAL",
        severity: "CRITICAL",
        gps_lat: 10.370,
        gps_lon: 78.820,
        address: "Test Location",
        patients: [{ name: "Test User", age: 30, symptoms: ["fever"] }]
      })
    });
    const incident = await incidentRes.json();
    const incidentId = incident.data.id;
    console.log(`✅ Incident created: ${incidentId}`);

    // 4. Dispatch (Auto-Assign)
    console.log("Triggering Auto-Dispatch...");
    const dispatchRes = await fetch(`http://localhost:3000/v1/incidents/${incidentId}/dispatch`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${access_token}`
      },
      body: JSON.stringify({})
    });
    const dispatchResult = await dispatchRes.json();
    console.log("Dispatch Response:", JSON.stringify(dispatchResult, null, 2));

    // 5. Verification
    const assignedVehicle = dispatchResult.vehicle.id;
    if (assignedVehicle === 'AMB-CLOSE') {
      console.log("🚀 SUCCESS: System assigned 'AMB-CLOSE' as expected!");
    } else {
      console.log(`❌ FAILURE: System assigned '${assignedVehicle}' but expected 'AMB-CLOSE'`);
    }

    // Check Vehicle Status in DB
    const vehicleCheck = await client.query("SELECT status FROM vehicles WHERE identifier = 'AMB-CLOSE'");
    console.log(`Vehicle AMB-CLOSE status in DB: ${vehicleCheck.rows[0].status} (Expected: BUSY)`);

  } catch (err) {
    console.error("❌ Test failed:", err);
  } finally {
    await client.end();
  }
}

testDispatch();
