'use strict';

const net = require('net');

module.exports = {
  connect: (host, port) => {
    let socket = net.createConnection({ host, port });

    return new Promise((resolve, reject) => {
      socket.on('connect', () => {
        resolve(socket);
      });
    })
  },

  getUsername: input => {
    return new Promise((resolve, reject) => {
      input.question('Type in your username: ', answer => {
        resolve(answer);
      });
    });
  }
}

