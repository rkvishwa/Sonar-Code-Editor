const path = require('path');
const fs = require('fs');
const v8 = require('v8');

v8.setFlagsFromString('--no-lazy');

const bytenode = require('bytenode');

const mainDistDir = path.join(__dirname, '..', 'dist', 'main');

function compileDirectory(dir) {
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      compileDirectory(fullPath);
    } else if (file.endsWith('.js') && !file.endsWith('bytenode.js') && !file.endsWith('build-attestation.json')) {
      const jscPath = fullPath.replace(/\.js$/, '.jsc');
      
      console.log(`Compiling ${fullPath} to ${jscPath}`);
      try {
        bytenode.compileFile({
          filename: fullPath,
          output: jscPath,
          compileAsModule: true
        });
        
        // Replace original JS with loader stub
        const loaderCode = `require('bytenode');\nrequire('./${file.replace(/\.js$/, '.jsc')}');\n`;
        fs.writeFileSync(fullPath, loaderCode, 'utf8');
      } catch (err) {
        console.error(`Failed to compile ${fullPath}:`, err);
      }
    }
  }
}

console.log('Starting bytecode compilation...');
compileDirectory(mainDistDir);
console.log('Bytecode compilation finished.');
