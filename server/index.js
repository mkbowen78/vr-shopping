const express = require('express');
var app = express();
app.use(express.static(__dirname + '/../client/dist'));
app.listen(5000, () => {
  console.log(`listening on port 5000!`);
});