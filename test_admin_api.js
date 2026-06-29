const axios = require('axios');
const url = 'https://script.google.com/macros/s/AKfycbySCGbNxmkRdsyI2RSbszpwC8mxwhfbQulQsiG_DfUU1tdje_BCn9Tz9tdk_ERFLLOA/exec';
axios.get(url, { params: { action: 'getDashboard' } })
  .then(res => console.log(JSON.stringify(res.data).substring(0, 200)))
  .catch(err => console.error(err.message));
