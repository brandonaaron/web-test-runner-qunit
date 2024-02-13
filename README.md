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

### Provide unique names for Modules and Tests

Names (and assertion messages) are used as unique identifiers to build up the test results that @web/test-runner is expecting. Most of the actions to build this data structure are only appending new data. Take for example the following test code:

```
QUnit.module('Module A', () => {
  QUnit.test('test 1', assert => {
    assert.true(true, 'assertion 1')
  })
  QUnit.test('test 2', assert => {
    assert.true(true, 'assertion 2')
  })
})
QUnit.module('Module A', () => {
  QUnit.test('test 1', assert => {
    assert.true(true, 'assertion 3')
  })
})
```

This would result in the following summary output:

```
 Module A [Chrome]
  test 1 [Chrome]
    ✓ assertion 1
    ✓ assertion 3
  test 2 [Chrome]
    ✓ assertion 2
```

### Progress Reporting

Progress isn't reported per test but instead is per a test file. This currently appears to be a limitation of this type of custom runner for @web/test-runner.


### Assertions that occur after a test finished

This does not capture assertions that happen after the full test suite has finished running (the `runEnd` QUnit event). This could happen if there is an issue with an async test that triggers an assertion after the test suite has finished running. Perhaps a workaround could be to utilize [`assert.expect`](https://api.qunitjs.com/assert/expect/).
