'use strict';

const path = require('path');

module.exports = command => {
  let result = {};
  if (!command) {
    return null;
  }
  if (command.startsWith('file: ')) {
    const filePath = command.substr(6);
    const fileName = path.basename(filePath);
    result = { filePath, fileName };
    result.isFile = true;
  } else {
    result.line = command;
  }

  return result;
}
