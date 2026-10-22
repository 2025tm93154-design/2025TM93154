import fetch from 'node-fetch';

const base = 'http://localhost:11434';
const endpoint = '/api/tags';

console.log(`Fetching ${base}${endpoint}...`);

try {
  const response = await fetch(`${base}${endpoint}`);
  console.log('Response status:', response.status);
  console.log('Response ok:', response.ok);
  
  if (response.ok) {
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
  } else {
    console.log('Response text:', await response.text());
  }
} catch (error) {
  console.error('Fetch error:', error.message);
  console.error('Error details:', error);
}
