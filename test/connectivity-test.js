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
        resolve();
      });
    });
  });

  it('second client should receive a file from first client', async () => {
    let client2 = new Client(createFakeInput('user2'));
    await client2.start({ port: 8000 });

    let expectedFileBuffer = fs.readFileSync('D:/Developer/net_test/bigFile.txt');
    client.sendFile('D:/Developer/net_test/bigFile.txt', 'poluchi.txt');

    return new Promise(resolve => {
      client2.onMessage((data) => {
        expect(data._sender).to.equal('test-user');
        expect(data._isPlain).to.equal(0);
        expect(data._isFile).to.equal(2);
        expect(data._fileBuffer.length).to.be.gt(45000);
        expect(data._fileBuffer.equals(expectedFileBuffer)).to.be.true;
        resolve();
      });
    });
  });


});
