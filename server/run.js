'use strict';

const Server = require('./server');

let server = new Server(9000);
async function run() {
  await server.start();
  console.log('Server started');
}

run();