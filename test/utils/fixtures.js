const fs = require('fs');
const path = require('path');

const dotPosPath = path.resolve('.pos');
let originalDotPos = null;

function writeDotPos(content) {
  // Save original if exists
  if (fs.existsSync(dotPosPath)) {
    originalDotPos = fs.readFileSync(dotPosPath, 'utf8');
  }
  fs.writeFileSync(dotPosPath, JSON.stringify(content, null, 2));
}

function removeDotPos() {
  if (originalDotPos != null) {
    fs.writeFileSync(dotPosPath, originalDotPos);
  } else if (fs.existsSync(dotPosPath)) {
    fs.unlinkSync(dotPosPath);
  }
  originalDotPos = null;
}

module.exports = { writeDotPos, removeDotPos };
