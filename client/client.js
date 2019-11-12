'use strict';

const path = require('path');
const fs = require('fs');
const stream = require('stream');
const bootstrap = require('./bootstrap');
const Networker = require('../shared/networker');
const Message = require('../shared/message');

function Client(input) {
  this.username = null;
  this.socket = null;
  this.networker = null;
  this.input = input;

  this._currentFileSender = null;
  this._currentFileName = null;

  this._fileHandler = null;
  this._onMessageHandler = null;
}
module.exports = Client;

Client.prototype.start = async function (options) {
  if (!this._onMessageHandler) {
    throw new Error('Missing onMessage handler');
  }
  if (!this._fileHandler) {
    throw new Error('Missing file handler');
  }

  this.username = await bootstrap.getUsername(this.input);
  options.host = options.host || '127.0.0.1';
  this.socket = await bootstrap.connect(options.host, options.port);

  let networker = new Networker(this.socket, buffer => {
    this._processBuffer(buffer);
  });
  this.networker = networker;
  networker.init();
  networker.sendBuffer(Buffer.from(this.username));
}

Client.prototype._processBuffer = function(buffer) {
  if (Message.isFile(buffer)) {
    let fileMessage = Message.readFile(buffer);
    let isEnd = false;
    if (Message.isFileBegin(buffer)) {
      this._currentFileName = fileMessage._fileName;
      this._currentFileSender = fileMessage._sender;
      this._fileContent = Buffer.from(fileMessage._fileBuffer);
    } else if (Message.isFileEnd(buffer)) {
      isEnd = true;
    }
    this._fileHandler(this._currentFileSender, this._currentFileName, fileMessage._fileBuffer, isEnd);
  } else {
    let message = Message.read(buffer);
    this._onMessageHandler(message._sender, message._text);
  }
}

Client.prototype.close = function () {
  this.socket.destroy();
}

Client.prototype.onFile = function (fn) {
  this._fileHandler = fn;
}

Client.prototype.onMessage = function (fn) {
  this._onMessageHandler = fn;
}

Client.prototype.sendMessage = function (message) {
  let buffer = Message.buildText({ sender: this.username, text: message });
  this.networker.sendBuffer(buffer);
}

Client.prototype.sendFile = function (filePath, fileName) {
  let stats = fs.statSync(filePath);
  let fileSize = stats.size;
  let readBytes = 0;
  let fileStream = fs.createReadStream(filePath);
  let begin = true;
  let end = false;

  let client = this;
  let fileMessageStream = new stream.Readable({
    read(size) {
      const processFunc = () => {
        let data;
        while ((data = fileStream.read(size)) !== null) {
          // console.log('reading....');
          // console.log(">>>>>>", data.length);
          readBytes += data.length;
          console.log("readBytes=", readBytes);
          if (readBytes == fileSize) {
            console.log(">>>FILE END");
            begin = false;
            end = true;
          }
          let buffer;
          if (begin) {
            buffer = Message.buildFile({ sender: client.username, fileName: fileName, fileContent: data, fileBegin: true });
            begin = false;
          } else if (end) {
            buffer = Message.buildFile({ sender: client.username, fileName: fileName, fileContent: data, fileEnd: true });
          } else {
            buffer = Message.buildFile({ sender: client.username, fileName: fileName, fileContent: data });
          }
          this.push(buffer);
          if (readBytes == fileSize) {
            console.log(">>>PUSH END");
            this.push(null);
          }
        }
        if (!data) {
          console.log("No more data for size:", size);
        }
      }
      console.log(">>>>here");
      fileStream.once('readable', processFunc);
    }
  });

  this.networker.sendStream(fileMessageStream);
}
