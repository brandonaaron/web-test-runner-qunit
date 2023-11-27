/* eslint-env node */
import { fileURLToPath } from 'node:url'
import { esbuildPlugin } from '@web/dev-server-esbuild'
import { defaultReporter, summaryReporter } from '@web/test-runner'

export default {
  // debug: true,
  testFramework: {
    path: './src/autorun.ts',
    config: {
      noglobals: true
    }
  },
  middleware: [
    // rewrite .js extensions to .ts extensions from import statements
    function rewriteJSToTS(context, next) {
      if (/\/src\/.+.js/.test(context.url)) {
        context.url = context.url.replace('.js', '.ts')
      }
      return next()
    },
  ],
  nodeResolve: true,
  reporters: [defaultReporter(), summaryReporter()],
  plugins: [esbuildPlugin({
    // use typescript esbuild loader for all js and ts files
    loaders: { '.js': 'ts', '.ts': 'ts' },
    tsconfig: fileURLToPath(new URL('./tsconfig.json', import.meta.url))
  })]
}
