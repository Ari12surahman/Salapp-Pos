const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbwd-rCsGLcW1C46oDGtQFF_tFa3fLFvSQlky7LvsBuel0yEw9xpHQPsVypqHoODDNWadQ/exec";

async function run() {
  console.log("Fetching getTransaksi...");
  const body = `action=getTransaksi`;
  const response = await fetch(GAS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body
  });
  const data = await response.json();
  if (data.data && data.data.length > 0) {
    console.log("Headers detected (keys of first item):", Object.keys(data.data[0]));
    console.log("First item:", data.data[0]);
  } else {
    console.log(data);
  }
}

run();
