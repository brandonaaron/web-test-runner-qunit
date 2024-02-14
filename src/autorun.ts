import { TestResult, TestResultError, TestSuiteResult } from '@web/test-runner'
import {
  getConfig,
  sessionStarted,
  sessionFinished,
  sessionFailed
} from '@web/test-runner-core/browser/session.js'

export interface WTRQUnitConfig {
  qunitBasePath?: string
  // What follows is the typical Qunit Config except for autorun, testTimeout, and urlConfig
  altertitle?: boolean
  collapse?: boolean
  current?: any
  failOnZeroTests?: boolean
  filter?: string | RegExp
  fixture?: string
  hidepassed?: boolean
  maxDepth?: number
  module?: string
  moduleId?: string[]
  noglobals?: boolean
  notrycatch?: boolean
  reorder?: boolean
  requireExpects?: boolean
  scrolltop?: boolean
  seed?: string
  testId?: string[]
}
type WTRQUnitStatus = 'passed' | 'failed' | 'skipped' | 'todo'
interface WTRQUnitTestEndResultAssertion {
  passed: boolean
  actual: unknown
  expected: unknown
  message: string
  stack: string
  todo: boolean
}
interface WTRQUnitTestEndResult {
  name: string
  fullName: string[]
  runtime: number
  suiteName?: string
  status: WTRQUnitStatus
  assertions: WTRQUnitTestEndResultAssertion[]
  errors: WTRQUnitTestEndResultAssertion[]
}
// for some reason the suite assertions do not include expected/action output
interface WTRQUnitSuiteTestAssertion {
  passed: boolean
  message: string
  stack: string
  todo: boolean
}
interface WTRQUnitSuiteTestResult {
  name: string
  suiteName?: string
  fullName: string[]
  runtime: number
  status: WTRQUnitStatus
  errors: WTRQUnitSuiteTestAssertion[]
  assertions: WTRQUnitSuiteTestAssertion[]
}
interface WTRQunitTestCounts {
  passed: number
  failed: number
  skipped: number
  todo: number
  total: number
}
interface WTRQUnitSuiteResult {
  name: string
  fullName: string[]
  tests: WTRQUnitSuiteTestResult[]
  runtime: number
  status: 'passed' | 'failed'
  testCounts: WTRQunitTestCounts
  childSuites: WTRQUnitSuiteResult[]
}

const testResultErrors: TestResultError[] = []
const testSuite = {
  name: '',
  tests: [],
  suites: []
} as TestSuiteResult

async function run () {
  await sessionStarted()
  const { testFile, testFrameworkConfig } = await getConfig()
  const qunitWTRConfig = testFrameworkConfig as WTRQUnitConfig

  testSuite.name = testFile

  ;(globalThis as any).QUnit = {
    config: {
      ...(qunitWTRConfig ?? {}),
      autostart: false
    }
  }

  await setupQUnit(qunitWTRConfig.qunitBasePath ?? '/node_modules/qunit/qunit/')

  const testFilePath = new URL(testFile, document.baseURI).href
  await import(testFilePath).catch((error) => { failed(error) })

  QUnit.start()
}

async function setupQUnit (qunitBasePath: string) {
  const style = document.createElement('link')
  style.rel = 'stylesheet'
  style.type = 'text/css'
  style.href = `${qunitBasePath}qunit.css`

  const qunitDiv = document.createElement('div')
  qunitDiv.id = 'qunit'

  const qunitFixtureDiv = document.createElement('div')
  qunitFixtureDiv.id = 'qunit-fixture'

  document.body.append(style, qunitDiv, qunitFixtureDiv)

  const qunitJSPath = `${qunitBasePath}qunit.js`
  await import(qunitJSPath)

  ;(QUnit as any).on('error', (error: any) => {
    testResultErrors.push({
      message: error?.message,
      stack: error?.stack
    })
  })
  ;(QUnit as any).on('testEnd', (qunitTestEndResult: WTRQUnitTestEndResult) => {
    addToTestSuiteResults(qunitTestEndResult)
  })
  ;(QUnit as any).on('runEnd', (qunitSuiteResults: WTRQUnitSuiteResult) => {
    sessionFinished({
      passed: qunitSuiteResults.status === 'passed',
      errors: testResultErrors,
      testResults: testSuite
    }).catch((err) => console.error(err))
  })
}

/**
 * Builds up an @web/test-runner TestSuite. Each `QUnit.module` maps to a "suite" (`TestSuiteResult`).
 * Each `QUnit.test` maps to a "test" (`TestResult`). Only the first failed assertion/error is passed
 * to the `TestResult`.
 *
 * Example:
 * QUnit.test('testing 1', assert => { assert.true(true, 'assertion 1') })
 * QUnit.skip('skip', assert => { assert.true(true) })
 * QUnit.todo('todo', assert => { assert.false(true) })
 * QUnit.module('module 1', () => {
 *   QUnit.test('testing 2', assert => { assert.true(true, 'assertion 2') })
 * })
 *
 * Resulting `TestSession.testResults`:
 * {
 *   "name": "/tests/test.ts?wtr-session-id=3B2Kwt-43pSJo7FpPBIvh",
 *   "tests": [
 *     {
 *       "name": "testing 1",
 *       "passed": true,
 *       "skipped": false,
 *       "duration": 1
 *     },
 *     {
 *       "name": "skip",
 *       "passed": true,
 *       "skipped": true,
 *       "duration": 0
 *     },
 *     {
 *       "name": "todo",
 *       "passed": true,
 *       "skipped": false,
 *       "duration": 1
 *     }
 *   ],
 *   "suites": [
 *     {
 *       "name": "module 1",
 *       "suites": [],
 *       "tests": [
 *         {
 *           "name": "testing 2",
 *           "passed": true,
 *           "skipped": false,
 *           "duration": 0
 *         }
 *       ]
 *     }
 *   ]
 * }
 *
 * `TestSession`, `TestSuiteResult`, `TestResult`: https://github.com/modernweb-dev/web/blob/f7fcf29cb79e82ad5622665d76da3f6b23d0ef43/packages/test-runner-core/src/test-session/TestSession.ts
 */
function addToTestSuiteResults (qunitTestEndResult: WTRQUnitTestEndResult) {
  const modules = qunitTestEndResult.fullName.slice(0, -1)
  const testSuiteResult = modules.reduce((testSuiteInstance: TestSuiteResult, name: string) => {
    let suite = testSuiteInstance.suites.find((nestedTestSuite: TestSuiteResult) => nestedTestSuite.name === name)
    if (!suite) {
      suite = {
        name,
        suites: [],
        tests: []
      } as TestSuiteResult
      testSuiteInstance.suites.push(suite)
    }
    return suite
  }, testSuite)

  const testResult = {
    name: qunitTestEndResult.name,
    passed: qunitTestEndResult.status !== 'failed',
    skipped: qunitTestEndResult.status === 'skipped',
    duration: qunitTestEndResult.runtime
  } as TestResult

  if (!testResult.passed) {
    const todo = qunitTestEndResult.assertions.some((assertion: WTRQUnitSuiteTestAssertion) => assertion.todo)
    const firstError = qunitTestEndResult.errors[0]
    if (todo) {
      testResult.error = {
        message: 'TODO test should have at least one failing assertion',
        expected: '1',
        actual: '0'
      }
    } else if (firstError) {
      testResult.error = {
        message: firstError.message,
        expected: JSON.stringify(firstError.expected, null, 2),
        actual: JSON.stringify(firstError.actual, null, 2),
        stack: firstError.stack
      }
    }
  }

  testSuiteResult.tests.push(testResult)
}

function failed (error: any) {
  sessionFailed({
    message: error?.message,
    stack: error?.stack
  }).catch((err) => console.error(err))
}

run().catch((err) => {
  console.error(err)
})
