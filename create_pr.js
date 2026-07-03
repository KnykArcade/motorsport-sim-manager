const fs = require('fs');
const https = require('https');

const remoteUrl = fs.readFileSync('.git/config', 'utf8');
const match = remoteUrl.match(/:\/\/([^@]+)@github\.com/);
const token = match ? match[1] : process.env.GITHUB_TOKEN;

if (!token) {
  console.error('Could not extract token from git remote');
  process.exit(1);
}

const body = fs.readFileSync('pr_body.txt', 'utf8');
const payload = JSON.stringify({
  title: 'Polish F1 roster enforcement and signing validation',
  head: 'fix-f1-roster-enforcement-polish',
  base: 'main',
  body: body,
});

const options = {
  hostname: 'api.github.com',
  path: '/repos/KnykArcade/motorsport-sim-manager/pulls',
  method: 'POST',
  headers: {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'User-Agent': 'node-script',
  },
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const result = JSON.parse(data);
    if (result.html_url) {
      console.log('PR created:', result.html_url);
    } else {
      console.error('Error:', data);
    }
  });
});

req.on('error', (e) => { console.error('Request error:', e.message); });
req.write(payload);
req.end();
