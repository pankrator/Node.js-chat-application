'use strict';

const fs = require('fs');
const readline = require('readline');
const path = require('path');
const Client = require('./client');
const commander = require('./commander');

const input = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: ''
});

const getHost = async input => new Promise(resolve =>
  input.question('Type in hostname: ', answer => {
    resolve(answer);
  })
);

const onMessage = message => {
  if (message._isFile) {
    readline.cursorTo(process.stdout, 0, 0);
    input.question(`${message._sender} sent you a file ${message._fileName}. Do you want it (y/n)`, answer => {
      if (answer === 'y') {
        const savePath = path.join(__dirname, 'received', message._fileName);
        fs.writeFileSync(savePath, message._fileBuffer);
      }
    });
  } else {
    console.log(message._sender, '-->', message._text);
  }
}

async function run() {
  const host = await getHost(input);
  
  let client = new Client(input);
  client.start({ host, port: 9000 });
  client.onMessage(onMessage);

  input.prompt();
  input.on('line', line => {
    let parsed = commander(line);
    if (!parsed) {
      return;
    }
    if (parsed.isFile) {
      client.sendFile(parsed.filePath, parsed.fileName);
    } else {
      client.sendMessage(parsed.line);
    }
  });
}

run();
