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
  __wtr_qunit_identifier__: number
}
interface WTRQUnitTestEndResult {
  name: string,
  fullName: string[],
  suiteName?: string,
  status: WTRQUnitStatus,
  assertions: WTRQUnitTestEndResultAssertion[],
  errors: WTRQUnitTestEndResultAssertion[]
}
// for some reason the suite assertions do not include expected/action output
interface WTRQUnitSuiteTestAssertion {
  passed: boolean
  message: string
  stack: string
  todo: boolean
  __wtr_qunit_identifier__: number
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
interface WTRQunitTestResultError {
  name: string
  message: string
  stack: string
  expected: string
  actual: string
  __wtr_qunit_identifier__: number
}

const testResultErrors: WTRQunitTestResultError[] = []
let __wtr_qunit_identifier__ = 0

async function run () {
  await sessionStarted()
  const { testFile, testFrameworkConfig } = await getConfig()
  const qunitWTRConfig = testFrameworkConfig as WTRQUnitConfig

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

  ;(QUnit as any).on('testEnd', (qunitTestEndResult: WTRQUnitTestEndResult) => {
    const errors = collectErrors(qunitTestEndResult)
    testResultErrors.push(...errors)
  })
  ;(QUnit as any).on('runEnd', (qunitSuiteResults: WTRQUnitSuiteResult) => {
    const testResults = collectTestSuiteResults(qunitSuiteResults)
    sessionFinished({
      passed: testResultErrors.length === 0,
      errors: [],
      testResults
    }).catch((err) => console.error(err))
  })
}

function collectTestSuiteResults (qunitSuiteResults: WTRQUnitSuiteResult): TestSuiteResult {
  const testResults: TestResult[] = []
  qunitSuiteResults.tests.forEach((qunitSuiteResult) => {
    // special case for skipped tests
    if (qunitSuiteResult.status === 'skipped') {
      return testResults.push({
        name: qunitSuiteResult.name,
        passed: true,
        skipped: true,
        duration: qunitSuiteResult.runtime
      })
    }
    // special case for todo tests
    const todo = qunitSuiteResult.assertions.some((assertion: WTRQUnitSuiteTestAssertion) => assertion.todo)
    if (todo) {
      const testResult = {
        name: qunitSuiteResult.name,
        passed: qunitSuiteResult.status === 'todo',
        skipped: false,
        duration: qunitSuiteResult.runtime
      } as TestResult
      if (!testResult.passed) {
        testResult.error = {
          message: 'Expected at least one failure in TODO test but found none',
          name: qunitSuiteResult.name
        } as TestResultError
      }
      return testResults.push(testResult)
    }
    // add each assertion as a TestResult
    qunitSuiteResult.assertions.forEach((assertion: WTRQUnitSuiteTestAssertion) => {
      const testResult = {
        name: `${qunitSuiteResult.name} > ${assertion.message}`,
        passed: assertion.passed,
        skipped: false,
        // duration: do not have assertion level durations...
      } as TestResult

      if (!testResult.passed) {
        const testResultError = testResultErrors.find((testResultError) => testResultError.__wtr_qunit_identifier__ === assertion.__wtr_qunit_identifier__)
        testResult.error = testResultError
      }

      testResults.push(testResult)
    })
  })
  const suites: TestSuiteResult[] = qunitSuiteResults.childSuites.map(collectTestSuiteResults)
  const testSuiteResult: TestSuiteResult = {
    name: qunitSuiteResults.name,
    tests: testResults,
    suites
  }

  return testSuiteResult
}

function collectErrors (qunitTestEndResult: WTRQUnitTestEndResult): WTRQunitTestResultError[] {
  const name = qunitTestEndResult.fullName.join(' > ')
  const errors:WTRQunitTestResultError[] = []
  qunitTestEndResult.errors.forEach((error) => {
    if (error.todo) { return }
    // QUnit removes `expected` and `actual` from the suite results
    // We're going to re-establish this by mapping to a unique identifier
    error.__wtr_qunit_identifier__ = __wtr_qunit_identifier__++
    const testResultError: WTRQunitTestResultError = {
      name,
      message: error.message,
      stack: error.stack,
      expected: `${error.expected}`,
      actual: `${error.actual}`,
      __wtr_qunit_identifier__: error.__wtr_qunit_identifier__
    }
    errors.push(testResultError)
  })
  return errors
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
