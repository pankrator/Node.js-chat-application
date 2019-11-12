'use strict';

const path = require('path');
const fs = require('fs');
const net = require('net');
const uuidv4 = require('uuid/v4');
const Networker = require('../shared/networker');
const Message = require('../shared/message');


function Server(port) {
  this.port = port;
  this.clients = new Map();
  this._serverSocket = null;
}

Server.prototype.start = function () {
  let server = net.createServer();

  server.on('connection', (socket) => this._onConnection(socket));
  server.on('error', (e) => {
    console.log(e);
  });

  this._serverSocket = server;

  return new Promise((resolve, reject) => {
    server.listen(this.port, () => {
      resolve();
    });
  });
}

Server.prototype.close = function () {
  this.clients.forEach(client => client.socket.end());
  this.clients.clear();
  this._serverSocket.close();
}

Server.prototype._onMessage = function (clientId, buffer) {
  console.log("Received buffer with length: ", buffer.length);
  this.broadcast(clientId, buffer);
}

Server.prototype._onConnection = function (socket) {
  console.log('new client arrived');
  socket.id = uuidv4();

  let networker = new Networker(socket, buffer => {
    let client = this.clients.get(socket.id);
    if (!client.name) {
      client.name = buffer.toString();
      this.clients.set(socket.id, client);
    } else {
      this._onMessage(socket.id, buffer);
    }
  });

  networker.init();
  this.clients.set(socket.id, { socket, networker });

  socket.on('end', () => {
    socket.end();
    console.log('socket end');
  });
  socket.on('close', () => {
    this.clients.delete(socket.id);
    console.log('socket close');
  });
  socket.on('error', (e) => {
    console.log(e);
  });
}

Server.prototype.sendToAll = function (message) {
  message = Message.buildText({ sender: "server", text: message });
  for (let [id, client] of this.clients) {
    client.networker.sendBuffer(message);
  }
}

Server.prototype.broadcast = function (senderId, data) {
  for (let [id, client] of this.clients) {
    if (id !== senderId) {
      client.networker.sendBuffer(data);
    }
  }
}

module.exports = Server;
