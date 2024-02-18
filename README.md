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

## Gotchas and/or Limitations

### Only shows the first assertion failure per test

@web/test-runner has a [specific data structure](https://github.com/modernweb-dev/web/blob/f7fcf29cb79e82ad5622665d76da3f6b23d0ef43/packages/test-runner-core/src/test-session/TestSession.ts#L27) it wants. Each `QUnit.module` maps to a `TestSuiteResult` and each `QUnit.test` maps to a `TestResult`. The `TestResult` has only one associated `TestResultError`. So only the first failed assertion is passed along as the `TestResultError`.

### Progress Reporting

Progress isn't reported per test but instead is per a test file. This currently appears to be a limitation of this type of custom runner for @web/test-runner.

### Assertions that occur after a test finished

This does not capture assertions that happen after the full test suite has finished running (the `runEnd` QUnit event). This could happen if there is an issue with an async test that triggers an assertion after the test suite has finished running. Perhaps a workaround could be to utilize [`assert.expect`](https://api.qunitjs.com/assert/expect/).
