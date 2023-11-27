export default {
  nodeResolve: true,
  testFramework: {
    path: './node_modules/web-test-runner-qunit/dist/autorun.js',
    config: {
      noglobals: true
    }
  }
}
