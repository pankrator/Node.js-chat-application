'use strict';

const buffer = require('buffer');
const crypto = require('crypto');
const debug = require('debug')('network');

function Networker(socket, handler) {
  this.socket = socket;

  this._isFinal = false;
  this._hasCode = false;
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
    this._hasCode = byte[0] & 0b100;
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
    // debug(`getPayload(): ${received.length}`);
    if (this._isFinal && !this._hasCode) {
      this.socket.emit('served', received);
    } else if (!this._isFinal && this._hasCode) {
      const code = received.slice(0, 5).toString('base64');
      if (this._partiallyReceived[code]) {
        this._partiallyReceived[code] = Buffer.concat([
          this._partiallyReceived[code],
          received.slice(5)
        ]);
      } else {
        this._partiallyReceived[code] = received.slice(5);
      }
    } else if (this._isFinal && this._hasCode) { // final with code
      const code = received.slice(0, 5).toString('base64');
      this.socket.emit('served', Buffer.concat([
        this._partiallyReceived[code],
        received.slice(5)
      ]));
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

const SLICE_IN = Math.pow(2, 22);

Networker.prototype.sendBuffer = function (buffer, code) {
  let chunk = buffer;
  let packet = { controlByte: 0 };
  let final = true;

  if (buffer.length > SLICE_IN) {
    final = false;
    if (!code) {
      code = crypto.randomBytes(5);
    }
    chunk = buffer.slice(0, SLICE_IN);
    buffer = buffer.slice(SLICE_IN);
    setTimeout(() => {
      this.sendBuffer(buffer, code);
    }, 1000);
  }

  packet.code = code;
  if (code) {
    packet.controlByte |= 0b100;
  }
  if (final) {
    packet.controlByte |= 0b10;
  }
  if (chunk.length > 65535) {
    packet.controlByte |= 0b1;
  }
  packet.payloadLength = chunk.length;
  packet.payload = chunk;
  this._send(packet);
}

Networker.prototype._send = function (packet) {
  // debug('Attempting to write...', packet.payloadLength);
  
  let controlByte = Buffer.allocUnsafe(1);
  controlByte[0] = packet.controlByte;
  this.socket.write(controlByte);

  if ((controlByte[0] & 0b100) > 0) {
    packet.payloadLength += 5; // TODO: Can lead to overflow of 2/4 bytes
  }

  let payloadLength;
  if (controlByte[0] & 0b1 === 1) {
    payloadLength = Buffer.allocUnsafe(4);
    payloadLength.writeUInt32BE(packet.payloadLength, 0, true);
  } else {
    payloadLength = Buffer.allocUnsafe(2);
    payloadLength.writeUInt16BE(packet.payloadLength, 0, true);
  }
  this.socket.write(payloadLength);

  // TODO: FIX FIX FIX THAAAAAT
  if ((controlByte[0] & 0b100) > 0) {
    this.socket.write(packet.code);
  }
  
  this.socket.write(packet.payload);
};

module.exports = Networker;
