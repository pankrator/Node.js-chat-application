'use strict';

const path = require('path');
const fs = require('fs');
const bootstrap = require('./bootstrap');
const Networker = require('../shared/networker');
const Message = require('../shared/message');

function Client(input) {
  this.username = null;
  this.socket = null;
  this.networker = null;
  this.input = input;

  this._onMessage = null;
  this._queuedMessage = [];
}
module.exports = Client;

Client.prototype.start = async function (options) {
  this.username = await bootstrap.getUsername(this.input);
  options.host = options.host || '127.0.0.1';
  this.socket = await bootstrap.connect(options.host, options.port);

  let networker = new Networker(this.socket, buffer => {
    let message = Message.read(buffer);
    if (this._onMessage) {
      return this._onMessage(message);
    }
    this._queuedMessage.push(message);
  });
  this.networker = networker;
  networker.init();

  networker.sendBuffer(Buffer.from(this.username));
}

Client.prototype.close = function () {
  this.socket.destroy();
}

Client.prototype.onMessage = function (fn) {
  this._onMessage = fn;
  while (this._queuedMessage.length > 0) {
    let message = this._queuedMessage.shift();
    process.nextTick(() => this._onMessage(message));
  }
}

Client.prototype.sendMessage = function (message) {
  let buffer = Message.buildBuffer({ text: message });
  this.networker.sendBuffer(buffer);
}

Client.prototype.sendFile = function (filePath, fileName) {
  let fileBuffer = fs.readFileSync(filePath);
  let buffer = Message.buildBuffer({ fileName, fileBuffer });

  this.networker.sendBuffer(buffer);
}
