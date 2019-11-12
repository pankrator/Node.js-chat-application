'use strict';

const fs = require('fs');
const readline = require('readline');
const path = require('path');
const Client = require('./client');
const commander = require('./commander');

const DOWNLOAD_FOLDER = "downloads";

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

const onMessage = (sender, message) => {
  console.log(sender, '-->', message);
}

const fileHandler = (fileSender, fileName, fileContent, final) => {
  let filePath = path.join(process.cwd(), DOWNLOAD_FOLDER, fileSender+"_"+fileName);
  if (fileContent.length > 0) {
    // console.log(">>>>>>received file data<<<<<<", fileContent.length);
    fs.appendFile(filePath, fileContent, err => {
      if (err) {
        throw err;
      }
      if (final) {
        console.log("Received file:", fileName);
      }
    });
  }
}

async function run() {
  const host = await getHost(input);

  let client = new Client(input);
  client.onMessage(onMessage);
  client.onFile(fileHandler);
  client.start({ host, port: 9000 });

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
