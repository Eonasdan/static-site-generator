import copy from 'rollup-plugin-copy';

const typescript = require('@rollup/plugin-typescript');

export default [
  {
    input: 'build/make.ts',
    output: [
      {
        file: 'ts-out/make.js',
        format: 'cjs',
        name: 'makeitso',
        sourcemap: true,
      },
    ],
    plugins: [
      typescript(),
      copy({
        targets: {
          src: './server/mime-types.json',
          dest: './ts-out/mime-types.json',
        },
        overwrite: true,
      }),
    ],
    external: [
      'path',
      'http',
      'fs',
      'socket.io',
      'jsdom',
      'node:fs',
      'node:crypto',
      'node:events',
      'node:os',
      'node:path',
      'node:string_decoder',
      'hexoid',
      'once',
      'dezalgo',
      'node:stream',
      'util',
      'terser',
      'sass',
      'html-minifier-terser',
      'sharp',
      '@eonasdan/parvus-server',
    ],
  },
];
