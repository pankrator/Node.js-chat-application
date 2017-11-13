'use strict';

const fs = require('fs');
const expect = require('chai').expect;
const Client = require('../client/client');
const Server = require('../server/server');

function createFakeInput(answer) {
  return {
    question: (text, cb) => {
      setImmediate(() => cb(answer));
    }
  };
}

let server;
let client;

describe('Test connectivity', function () {
  server = new Server(8000);
  client = new Client(createFakeInput('test-user'));

  before(async () => {
    await server.start();
    await client.start({ port: 8000 });
  });

  after(() => {
    server.close();
    // client.close();
  });

  it('client should receive greetings from server', done => {
    server.sendToAll('Hello Clients!');
    client.onMessage((data) => {
      expect(data._text).to.equal('Hello Clients!');
      done();
    });
  });

  it('sever should have received 1 client', () => {
    expect(server.clients.size).to.equal(1);
  });

  it('server should receive message from client', done => {
    let originalHandler = server._onMessage;
    server._onMessage = (clientId, message) => {
      expect(message.toString()).to.equal('\u0001Hello Server');
      done();
      server._onMessage = originalHandler;
    }

    client.sendMessage('Hello Server');
  });

  it('second client should receive message from first client', async () => {
    let client2 = new Client(createFakeInput('user2'));
    await client2.start({ port: 8000 });

    client2.sendMessage('Hello from client1');
    return new Promise(resolve => {
      client.onMessage((data) => {
        expect(data._sender).to.equal('user2');
        expect(data._text).to.equal('Hello from client1');
        client2.close();
        resolve();
      });
    });
  });

  it('should be able to send segmented text message', async function() {
    let client2 = new Client(createFakeInput('user2'));
    await client2.start({ port: 8000 });

    let text = new Array(10500).join('*');
    client.sendMessage(text);

    return new Promise(resolve => {
      client2.onMessage((data) => {
        expect(data._sender).to.equal('test-user');
        expect(data._text).to.equal(text);
        client2.close();
        resolve();
      });
    });
  });

  // it('should be able to send message while receiving big one', async function() {
  //   this.timeout(5000);
  //   let client2 = new Client(createFakeInput('user2'));
  //   await client2.start({ port: 8000 });

  //   let text = new Array(10500).join('*');
  //   client.sendMessage(text);

  //   return new Promise(resolve => {
  //     client2.onMessage((data) => {
  //       expect(data._sender).to.equal('test-user');
  //       expect(data._text).to.equal(text);
  //       client2.close();
  //       resolve();
  //     });
  //   });
  // });

  it('second client should receive a file from first client', async () => {
    let client2 = new Client(createFakeInput('user2'));
    await client2.start({ port: 8000 });

    let expectedFileBuffer = fs.readFileSync(__dirname + '/resources/small.txt');
    client.sendFile(__dirname + '/resources/small.txt', 'poluchi.txt');

    return new Promise(resolve => {
      client2.onMessage((data) => {
        expect(data._sender).to.equal('test-user');
        expect(data._isPlain).to.equal(0);
        expect(data._isFile).to.equal(2);
        expect(data._fileBuffer.equals(expectedFileBuffer)).to.be.true;
        client2.close();
        resolve();
      });
    });
  });

  it('should send file bigger than 4MB', async function() {
    let client2 = new Client(createFakeInput('user2'));
    await client2.start({ port: 8000 });

    let expectedFileBuffer = fs.readFileSync(__dirname + '/resources/big.txt');
    client.sendFile(__dirname + '/resources/big.txt', 'poluchi.txt');

    return new Promise(resolve => {
      client2.onMessage((data) => {
        expect(data._sender).to.equal('test-user');
        expect(data._isPlain).to.equal(0);
        expect(data._isFile).to.equal(2);
        expect(data._fileBuffer.equals(expectedFileBuffer)).to.be.true;
        client2.close();
        resolve();
      });
    });
  });
});
