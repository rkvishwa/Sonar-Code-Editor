const fs = require('fs');
const path = require('path');

const Y_MONACO_JS = path.join(__dirname, 'node_modules', 'y-monaco', 'src', 'y-monaco.js');
const Y_MONACO_CJS = path.join(__dirname, 'node_modules', 'y-monaco', 'dist', 'y-monaco.cjs');

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if already patched
    if (content.includes('requestAnimationFrame(this._rerenderDecorations)')) {
      console.log(`Already patched: ${filePath}`);
      return;
    }
    
    // Replace the specific line causing the recursion issue
    const searchString = `awareness.on('change', this._rerenderDecorations)`;
    const replacementString = `awareness.on('change', () => requestAnimationFrame(this._rerenderDecorations))`;
    
    // Try single quote first
    if (content.includes(searchString)) {
        content = content.replace(searchString, replacementString);
    } else {
        // Fallback for minified/dist files that might have different escaping or quotes
        const searchStringDist = `awareness.on("change",this._rerenderDecorations)`;
        const replacementStringDist = `awareness.on("change",()=>requestAnimationFrame(this._rerenderDecorations))`;
        
        if (content.includes(searchStringDist)) {
            content = content.replace(searchStringDist, replacementStringDist);
        } else {
            // Regex approach for robustness
            content = content.replace(/awareness\.on\(['"]change['"]\s*,\s*this\._rerenderDecorations\)/g, 
                `awareness.on('change', () => requestAnimationFrame(this._rerenderDecorations))`);
        }
    }
    
    fs.writeFileSync(filePath, content);
    console.log(`Successfully patched: ${filePath}`);
  } catch (error) {
    console.error(`Error patching ${filePath}:`, error);
  }
}

console.log("Applying y-monaco deltaDecorations recursion patch...");
patchFile(Y_MONACO_JS);
patchFile(Y_MONACO_CJS);
console.log("Done.");
