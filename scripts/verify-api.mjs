/**
 * API response verification script
 */
const BASE_URL = 'http://localhost:3000/api/dashboard';

async function verifyAPI() {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }); // YYYY-MM-DD
  const params = new URLSearchParams({
    startDate: today,
    endDate: today,
    source: 'ALL',
    channel: 'all'
  });

  console.log(`Checking Summary API: ${BASE_URL}/summary?${params}`);
  try {
    const res = await fetch(`${BASE_URL}/summary?${params}`);
    const json = await res.json();
    console.log('Summary API Result:', JSON.stringify(json, null, 2));

    const catRes = await fetch(`${BASE_URL}/categories?${params}`);
    const catJson = await catRes.json();
    console.log('Categories API Result:', JSON.stringify(catJson, null, 2));
  } catch (e) {
    console.error('API Verification failed. Is the server running?', e.message);
  }
}

verifyAPI();
