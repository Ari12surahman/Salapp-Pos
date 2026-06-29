const axios = require('axios');
const url = 'https://script.google.com/macros/s/AKfycbwd-rCsGLcW1C46oDGtQFF_tFa3fLFvSQlky7LvsBuel0yEw9xpHQPsVypqHoODDNWadQ/exec';
axios.get(url, { params: { action: 'getProduk' } })
  .then(res => console.log(JSON.stringify(res.data).substring(0, 200)))
  .catch(err => console.error(err.message));
