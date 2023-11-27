# QUnit @web/test-runner

Use QUnit with the [@web/test-runner](https://www.npmjs.com/package/@web/test-runner).

## Quick Start

Install:

```
npm i -D @web/test-runner qunit web-test-runner-qunit
```

Add the following to your `web-test-runner.config.js`:

```js
export default {
  //...
  nodeResolve: true, // this is required
  testFramework: {
    path: './node_modules/web-test-runner-qunit/dist/autorun.js',
    config: {
      // QUnit config (see type WTRQunitConfig)
      // noglobals: true
    }
  }
  //...
}
```

Check the examples/minimal folder for a complete example.
