const path = require("path");
const fs = require("fs");

module.exports = function(dir) {
  const normalizedPath = path.join(__dirname, dir);

  let modules = {};
  fs.readdirSync(normalizedPath).forEach(function(file) {
    const name = path.parse(file).name;
    modules[name] = require(path.join(normalizedPath, name));
  });

  return modules;
};
