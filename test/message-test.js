'use strict';

const expect = require('chai').expect;
const Message = require('../shared/message');

describe('Message', function () {
  it('# read() plain text message without sender', () => {
    let buffer = Buffer.alloc(3);
    buffer[0] = 0b1;
    buffer.write('hi', 1);
    let message = Message.read(buffer);
    expect(message._isPlain).to.equal(1);
    expect(message._isFile).to.equal(0);
    expect(message._hasSender).to.equal(0);
    expect(message._text).to.equal('hi');
  });

  it('# read() plain text message with sender', () => {
    let buffer = Buffer.alloc(5);
    buffer[0] = 0b101;
    buffer.writeUInt8(1, 1, true);
    buffer.write('s', 2);
    buffer.write('hi', 3);
    let message = Message.read(buffer);
    expect(message._isPlain).to.equal(1);
    expect(message._isFile).to.equal(0);
    expect(message._hasSender).to.equal(4);
    expect(message._sender).to.equal('s');
    expect(message._text).to.equal('hi');
  });

  it('# read() file without sender', () => {
    let fileBuffer = Buffer.from('Hello file');
    let buffer = Buffer.alloc(9);
    buffer[0] = 0b010;
    buffer.writeUInt8(7, 1, true);
    buffer.write('tmp.txt', 2);
    buffer = Buffer.concat([buffer, fileBuffer]);
    let message = Message.read(buffer);
    
    expect(message._isPlain).to.equal(0);
    expect(message._isFile).to.equal(2);
    expect(message._hasSender).to.equal(0);
    expect(message._fileName).to.equal('tmp.txt');
    expect(message._fileBuffer.equals(fileBuffer)).to.be.true;
  });

  it('# read() file with sender', () => {
    let fileBuffer = Buffer.from('Hello file');
    let buffer = Buffer.alloc(11);
    buffer[0] = 0b110;
    buffer.writeUInt8(1, 1, true);
    buffer.write('s', 2);
    buffer.writeUInt8(7, 3, true);
    buffer.write('tmp.txt', 4);
    buffer = Buffer.concat([buffer, fileBuffer]);
    let message = Message.read(buffer);
    
    expect(message._isPlain).to.equal(0);
    expect(message._isFile).to.equal(2);
    expect(message._hasSender).to.equal(4);
    expect(message._sender).to.equal('s');
    expect(message._fileName).to.equal('tmp.txt');
    expect(message._fileBuffer.equals(fileBuffer)).to.be.true;
  });
});