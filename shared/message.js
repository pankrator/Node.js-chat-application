'use strict';

const TEXT_MESSAGE_MASK = 0b01;
const FILE_BEGIN_MASK = 0b110;
const FILE_MASK = 0b10;
const FILE_END_MASK = 0b1010;

function Message() {
  this._isFile = 0;
  this._isPlain = 0;

  this._offset = 0;

  this._sender = null;
  this._fileName = null;
  this._fileBuffer = null;
  this._text = null;
};

module.exports = Message;

Message.buildText = function ({ sender, text }) {
  if (!sender) {
    throw new Error('sender is missing');
  }
  if (!text) {
    throw new Error('text is missing');
  }

  const senderLength = Buffer.byteLength(sender);
  const textLength = Buffer.byteLength(text);
  let buffer = Buffer.alloc(1+1+senderLength+2+textLength);
  buffer[0] |= TEXT_MESSAGE_MASK;
  let offset = 1;
  buffer.writeUInt8(senderLength,offset);
  offset++;
  buffer.write(sender, offset, "utf8");
  offset+=senderLength;
  buffer.writeUInt16BE(textLength, offset);
  offset+=2;
  buffer.write(text, offset);

  return buffer;
}

Message.buildFile = function ({ sender, fileName, fileContent, fileBegin, fileEnd }) {
  let buffer;
  const fileContentLength = Buffer.byteLength(fileContent);
  let offset = 1;
  if (fileBegin) {
    const senderLength = Buffer.byteLength(sender);
    const fileNameLength = Buffer.byteLength(fileName);
    buffer = Buffer.alloc(1+1+senderLength+1+fileNameLength+2+fileContentLength);
    buffer[0] |= FILE_BEGIN_MASK;
    buffer.writeUInt8(senderLength,offset);
    offset++;
    buffer.write(sender, offset, "utf8");
    offset+=senderLength;
    buffer.writeUInt8(fileNameLength,offset);
    offset++;
    buffer.write(fileName, offset, "utf8");
    offset+=fileNameLength;
  } else {
    buffer = Buffer.alloc(1+2+fileContentLength);
    if (fileEnd) {
      buffer[0] |= FILE_END_MASK;
    } else {
      buffer[0] |= FILE_MASK;
    }
  }
  buffer.writeUInt16BE(fileContentLength, offset);
  offset += 2;
  fileContent.copy(buffer, offset, 0);

  return buffer;
}

Message.read = function (buffer) {
  let message = new Message();
  message._parseControlByte(buffer);

  message._readSender(buffer);

  if (message._isPlain) {
    message._offset += 2;
    message._text = buffer.toString('utf8', message._offset);
  }

  return message;
}

Message.prototype._readSender = function(buffer) {
  const senderLength = buffer.readUInt8(this._offset, true);
  this._offset++;
  this._sender = buffer.toString('utf8', this._offset, this._offset + senderLength);
  this._offset += senderLength;
}

Message.readFile = function (buffer) {
  let message = new Message();
  message._parseControlByte(buffer);


  if (Message.isFileBegin(buffer)) {
    message._readSender(buffer);
    const nameLength = buffer.readUInt8(message._offset, true);
    message._offset += 1;
    message._fileName = buffer.toString('utf8', message._offset, message._offset + nameLength);
    message._offset += nameLength;
  }

  let contentLength = buffer.readUInt16BE(message._offset);
  message._offset+=2;
  message._fileBuffer = buffer.slice(message._offset, message._offset + contentLength);

  return message;
}

Message.isFileBegin = function (buffer) {
  return buffer.slice(0, 1)[0] == FILE_BEGIN_MASK;
}

Message.isFileEnd = function (buffer) {
  return buffer.slice(0, 1)[0] == FILE_END_MASK;
}

Message.isFile = function (buffer) {
  let controlByte = buffer.slice(0, 1)[0];
  return controlByte == FILE_MASK || controlByte == FILE_BEGIN_MASK || controlByte == FILE_END_MASK;
}

Message.prototype._parseControlByte = function (buffer) {
  const controlByte = buffer.slice(0, 1);
  this._isPlain = controlByte[0] & 0b001;
  this._isFile = controlByte[0] & 0b010;
  this._offset++;
}
