/* eslint-disable @typescript-eslint/no-var-requires */
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Parse command line arguments
const args = process.argv.slice(2);
const isWatch = args.includes('--watch');

// Load environment variables
const envConfig = dotenv.config({ path: path.resolve(__dirname, '..', '.env') }).parsed || {};

// Prepare define object for esbuild
const define = {};
for (const k in envConfig) {
  define[`process.env.${k}`] = JSON.stringify(envConfig[k]);
}

// Add NODE_ENV
const nodeEnv = process.env.NODE_ENV || (isWatch ? 'development' : 'production');
define['process.env.NODE_ENV'] = JSON.stringify(nodeEnv);

const isDev = nodeEnv === 'development';

const buildOptions = {
  entryPoints: [path.resolve(__dirname, '..', 'src', 'main', 'main.ts')],
  outfile: path.resolve(__dirname, '..', 'dist', 'main', 'main.js'),
  bundle: true,
  platform: 'node',
  target: 'node18', // Electron 28 uses Node 18
  external: ['electron', 'bytenode', 'original-fs'], // Externalize electron and bytenode
  define: define,
  minify: !isDev,
  sourcemap: isDev ? 'inline' : false,
  loader: { '.ts': 'ts' },
};

async function build() {
  if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('Watching for changes in main process...');
  } else {
    await esbuild.build(buildOptions);
    console.log('Main process built successfully');
  }
}

build().catch((err) => {
  console.error('Main process build failed:', err);
  process.exit(1);
});
