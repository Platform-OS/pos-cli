import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import alias from '@rollup/plugin-alias';
import livereload from 'rollup-plugin-livereload';
import { terser } from 'rollup-plugin-terser';
import copy from 'rollup-plugin-copy';
import postcss from 'rollup-plugin-postcss';
import path from 'path';
import del from 'del';

const staticDir = 'static';
const distDir = 'dist';
const buildDir = `${distDir}/build`;
const production = !process.env.ROLLUP_WATCH;
const bundling = process.env.BUNDLING || production ? 'dynamic' : 'bundle';
const shouldPrerender = typeof process.env.PRERENDER !== 'undefined' ? process.env.PRERENDER : !!production;

del.sync(distDir + '/**');

function createConfig({ output, inlineDynamicImports, plugins = [] }) {
  const transform = inlineDynamicImports ? bundledTransform : dynamicTransform;

  return {
    inlineDynamicImports,
    input: `src/main.js`,
    output: {
      name: 'app',
      ...output,
    },
    plugins: [
      postcss({
        extract: true,
        plugins: [],
      }),
      alias({
        entries: [{ find: '@', replacement: path.resolve('src') }],
      }),
      copy({
        targets: [
          { src: [staticDir + '/*', '!*/(__index.html)'], dest: distDir },
          { src: `${staticDir}/__index.html`, dest: distDir, rename: '__app.html', transform },
        ],
        copyOnce: true,
        flatten: false,
      }),
      svelte({
        dev: !production,
        hydratable: true,
      }),

      resolve({
        browser: true,
        dedupe: (importee) => importee === 'svelte' || importee.startsWith('svelte/'),
      }),
      commonjs(),

      production && terser(),

      ...plugins,
    ],
    watch: {
      clearScreen: false,
    },
  };
}

const bundledConfig = {
  inlineDynamicImports: true,
  output: {
    format: 'iife',
    file: `${buildDir}/bundle.js`,
  },
  plugins: [!production && serve(), !production && livereload(distDir)],
};

const dynamicConfig = {
  inlineDynamicImports: false,
  output: {
    format: 'esm',
    dir: buildDir,
  },
  plugins: [!production && livereload(distDir)],
};

const configs = [createConfig(bundledConfig)];
if (bundling === 'dynamic') configs.push(createConfig(dynamicConfig));
if (shouldPrerender) [...configs].pop().plugins.push(prerender());
export default configs;

function serve() {
  let started = false;
  return {
    writeBundle() {
      if (!started) {
        started = true;
        require('child_process').spawn('npm', ['run', 'serve'], {
          stdio: ['ignore', 'inherit', 'inherit'],
          shell: true,
        });
      }
    },
  };
}

function prerender() {
  return {
    writeBundle() {
      if (shouldPrerender) {
        require('child_process').spawn('npm', ['run', 'export'], {
          stdio: ['ignore', 'inherit', 'inherit'],
          shell: true,
        });
      }
    },
  };
}

function bundledTransform(contents) {
  return contents.toString().replace(
    '__SCRIPT__',
    `<script defer src="/build/bundle.js"></script>`
  );
}

function dynamicTransform(contents) {
  return contents.toString().replace(
    '__SCRIPT__',
    `<script type="module" defer src="/build/main.js"></script>`
  );
}
