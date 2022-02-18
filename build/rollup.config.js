const typescript = require('rollup-plugin-typescript2');

export default [
  {
    input: 'build/make.ts',
    output: [
      {
        file: 'ts-out/make.js',
        format: 'cjs',
        name: 'makeitso',
        sourcemap: true,
      }
    ],
    plugins: [
      typescript()
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
    ]
  }
];
