QUnit.test('testing outside module', assert => {
  assert.strictEqual(true, true, 'this is fine')
})

QUnit.todo('testing todo', (assert) => {
  assert.strictEqual(true, false, 'this is fine')
})

QUnit.skip('testing skip')

QUnit.test('basic async test example', assert => {
  return new Promise((resolve) => {
    setTimeout(() => {
      assert.strictEqual(true, true, 'this is fine')
      resolve()
    }, 100)
  })
})

QUnit.module('Group A', hooks => {
  // It is valid to call the same hook methods more than once.
  hooks.beforeEach(assert => {
    assert.ok(true, 'beforeEach called')
  })

  hooks.afterEach(assert => {
    assert.ok(true, 'afterEach called')
  })

  QUnit.test('basic test example', assert => {
    assert.strictEqual(true, true, 'this is fine')
  })

  QUnit.test('basic test example 2', assert => {
    assert.true(true, 'this is also fine')
  })
})

QUnit.module('Group B', () => {
  QUnit.test('basic test example 3', assert => {
    assert.true(true, 'this is fine')
  })

  QUnit.test('basic test example 4', assert => {
    assert.true(true, 'this is also fine')
  })
})
