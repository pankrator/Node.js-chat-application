'use strict';

function Message() {
  this._isFile = 0;
  this._isPlain = 0;
  this._hasSender = 0;

  this._sender = null;
  this._fileName = null;
  this._fileBuffer = null;
  this._text = null;
};
module.exports = Message;

Message.buildBuffer = function ({ sender, text, fileName, fileBuffer }) {
  let buffer = Buffer.alloc(1);

  if (sender) {
    buffer[0] |= 0b100;
    const senderLength = Buffer.byteLength(sender);
    let senderBuffer = Buffer.allocUnsafe(1 + senderLength);
    senderBuffer.writeUInt8(senderLength);
    senderBuffer.write(sender, 1);
    buffer = Buffer.concat([buffer, senderBuffer]);
  }

  if (text) {
    buffer[0] |= 0b001;
    buffer = Buffer.concat([buffer, Buffer.from(text)]);
  } else if (fileBuffer) {
    buffer[0] |= 0b010;
    const nameLength = Buffer.byteLength(fileName);
    let nameBuffer = Buffer.allocUnsafe(1 + nameLength);
    nameBuffer.writeUInt8(nameLength);
    nameBuffer.write(fileName, 1);
    buffer = Buffer.concat([buffer, nameBuffer, fileBuffer]);
  }

  return buffer;
}

Message.updateSender = function (sender, buffer) {
  const senderLength = Buffer.byteLength(sender);
  const hasSender = buffer[0] & 0b100;
  let remainingBuffer;
  if (hasSender) {
    remainingBuffer = buffer.slice(2 + buffer.readUInt8(1, true));
  } else {
    remainingBuffer = buffer.slice(1);
  }
  let resultBuffer = Buffer.allocUnsafe(2 + senderLength);
  
  resultBuffer[0] = buffer[0];
  resultBuffer[0] |= 0b100;
  resultBuffer.writeUInt8(senderLength, 1, true);
  resultBuffer.write(sender, 2);
  resultBuffer = Buffer.concat([resultBuffer, remainingBuffer]);
  
  return resultBuffer;
}

Message.read = function (buffer) {
  let message = new Message();
  message._firstByte(buffer);
  let offset = 1;

  if (message._hasSender) {
    const senderLength = buffer.readUInt8(offset, true);
    offset += 1;
    message._sender = buffer.slice(offset, offset + senderLength).toString();
    offset += senderLength;
  }
  
  if (message._isPlain) {
    message._text = buffer.slice(offset).toString();
  }
  
  if (message._isFile) {
    const nameLength = buffer.readUInt8(offset, true);
    offset += 1;
    message._fileName = buffer.slice(offset, offset + nameLength).toString();
    offset += nameLength;
    message._fileBuffer = buffer.slice(offset);
  }
  
  return message;
}

Message.prototype._firstByte = function (buffer) {
  const firstByte = buffer.slice(0, 1);
  this._isPlain = firstByte[0] & 0b001;
  this._isFile = firstByte[0] & 0b010;
  this._hasSender = firstByte[0] & 0b100;
}
