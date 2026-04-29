async function test() {
  try {
    const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@audienceai.com',
        password: 'password123'
      })
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) throw new Error(JSON.stringify(loginData));

    const token = loginData.data.accessToken;
    console.log('Login successful');

    const res = await fetch('http://localhost:5000/api/v1/attendees', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));

    console.log('Attendees fetched successfully:', data.data.length);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
