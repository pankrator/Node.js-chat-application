'use strict';

const buffer = require('buffer');
const crypto = require('crypto');
const debug = require('debug')('network');

const SLICE_SIZE = Math.pow(2, 15);
const CODE_SIZE = 32;

function Networker(socket, handler) {
  this.socket = socket;

  this._isFinal = false;
  this._isLongPayload = false;
  this._process = false;
  this._state = 'CONTROL_BYTE';
  this._payloadLength = 0;

  this._bufferedBytes = 0;
  this.queue = [];
  this._partiallyReceived = {};

  this.handler = handler;
}

Networker.prototype.init = function () {
  this.socket.on('data', (data) => {
    debug(data.length);
    this._bufferedBytes += data.length;
    this.queue.push(data);

    this._process = true;
    this._onData();
  });

  this.socket.on('served', this.handler);
};

Networker.prototype._hasEnough = function (size) {
  if (this._bufferedBytes >= size) {
    return true;
  }
  this._process = false;
  return false;
}

Networker.prototype._readBytes = function (size) {
  let result;
  this._bufferedBytes -= size;

  if (size === this.queue[0].length) {
    return this.queue.shift();
  }

  if (size < this.queue[0].length) {
    result = this.queue[0].slice(0, size);
    this.queue[0] = this.queue[0].slice(size);
    return result;
  }

  result = Buffer.allocUnsafe(size);
  let offset = 0;
  let length;

  while (size > 0) {
    length = this.queue[0].length;

    if (size >= length) {
      this.queue[0].copy(result, offset);
      offset += length;
      this.queue.shift();
    } else {
      this.queue[0].copy(result, offset, 0, size);
      this.queue[0] = this.queue[0].slice(size);
    }

    size -= length;
  }

  return result;
}

Networker.prototype._getControlByte = function () {
  if (this._hasEnough(1)) {
    let byte = this._readBytes(1);
    this._isLongPayload = byte[0] & 0b1; // Get first bit of the byte
    this._isFinal = byte[0] & 0b10;
    this._state = 'PAYLOAD_LENGTH';
  }
}

Networker.prototype._getPayloadLength = function () {
  if (this._isLongPayload && this._hasEnough(4)) {
    this._payloadLength = this._readBytes(4).readUInt32BE(0, true);
    this._state = 'PAYLOAD';
  } else if (this._hasEnough(2)) {
    this._payloadLength = this._readBytes(2).readUInt16BE(0, true);
    this._state = 'PAYLOAD';
  }
}

Networker.prototype._getPayload = function () {
  if (this._hasEnough(this._payloadLength)) {
    let received = this._readBytes(this._payloadLength);
    if (this._isFinal) {
      this.socket.emit('served', received);
    }

    this._state = 'CONTROL_BYTE';
  }
}

Networker.prototype._onData = function (data) {
  while (this._process) {
    switch (this._state) {
      case 'CONTROL_BYTE':
        this._getControlByte();
        break;
      case 'PAYLOAD_LENGTH':
        this._getPayloadLength();
        break;
      case 'PAYLOAD':
        this._getPayload();
        break;
    }
  }
}

Networker.prototype.sendStream = function (stream) {
  // const processChunk = () => {
  //   let chunk;
  //   while ((chunk = stream.read()) !== null) {
  //     let packet = { controlByte: 0 };
  //     packet.controlByte |= 0b10;
  //     if (chunk.length > 65000) {
  //       packet.controlByte |= 0b1;
  //     }
  //     packet.payloadLength = chunk.length;
  //     packet.payload = chunk;
  //     this._send(packet);
  //   }
  //   stream.once('readable', processChunk);
  // }
  // stream.once('readable', processChunk);

  stream.on('data', chunk => {
    // console.log('Sending...', chunk.length);
    let packet = { controlByte: 0 };
    packet.controlByte |= 0b10;
    if (chunk.length > 65000) {
      packet.controlByte |= 0b1;
    }
    packet.payloadLength = chunk.length;
    packet.payload = chunk;
    this._send(packet);
  });
}

Networker.prototype.sendBuffer = function (buffer) {
  let chunk = buffer;
  let packet = { controlByte: 0 };
  let final = true;

  if (buffer.length > SLICE_SIZE) {
    final = false;
    chunk = buffer.slice(0, SLICE_SIZE);
    buffer = buffer.slice(SLICE_SIZE);
    setTimeout(() => {
      this.sendBuffer(buffer);
    }, 1);
  }
  debug('Sending...', chunk.length);
  if (final) {
    packet.controlByte |= 0b10;
  }
  if (chunk.length > 65000) {
    packet.controlByte |= 0b1;
  }
  packet.payloadLength = chunk.length;
  packet.payload = chunk;
  this._send(packet);
}

Networker.prototype._send = function (packet) {
  let controlByte = Buffer.allocUnsafe(1);
  controlByte[0] = packet.controlByte;
  this.socket.write(controlByte);

  let payloadLength;
  if (controlByte[0] & 0b1 === 1) {
    payloadLength = Buffer.allocUnsafe(4);
    payloadLength.writeUInt32BE(packet.payloadLength, 0, true);
  } else {
    payloadLength = Buffer.allocUnsafe(2);
    payloadLength.writeUInt16BE(packet.payloadLength, 0, true);
  }
  this.socket.write(payloadLength);

  this.socket.write(packet.payload);
};

module.exports = Networker;
