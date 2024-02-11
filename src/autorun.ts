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
}

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
    // using a setTimeout here to try and help capture any out of sync assertions prior to calling sessionFinished
    setTimeout(() => {
      sessionFinished({
        passed: qunitSuiteResults.status === 'passed',
        errors: testResultErrors,
        testResults: testSuite
      }).catch((err) => console.error(err))
    }, 1)
  })
}

function addToTestSuiteResults (qunitTestEndResult: WTRQUnitTestEndResult) {
  const testSuiteResult = qunitTestEndResult.fullName.reduce((testSuiteInstance: TestSuiteResult, name: string) => {
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

  const todo = qunitTestEndResult.assertions.some((assertion: WTRQUnitSuiteTestAssertion) => assertion.todo)
  if (todo) {
    testSuiteResult.tests = [convertTodoToTestResult(qunitTestEndResult)]
  } else {
    const baseTestResult = {
      name: qunitTestEndResult.name,
      passed: qunitTestEndResult.status === 'passed',
      skipped: qunitTestEndResult.status === 'skipped'
    } as TestResult
    testSuiteResult.tests = collectAssertionsAsTestResults(baseTestResult, qunitTestEndResult.assertions)
  }
}

function collectAssertionsAsTestResults (baseTestResult: TestResult, assertions: WTRQUnitTestEndResultAssertion[]): TestResult[] {
  return assertions.map((assertion) => {
    const testResult = { ...baseTestResult }
    if (assertion.message) { testResult.name = assertion.message }
    if (!testResult.passed) {
      const testResultError = {
        message: assertion.message,
        stack: assertion.stack,
        expected: JSON.stringify(assertion.expected, null, 2),
        actual: JSON.stringify(assertion.actual, null, 2)
      } as TestResultError
      testResult.error = testResultError
    }
    return testResult
  })
}

function convertTodoToTestResult (qunitTestEndResult: WTRQUnitTestEndResult): TestResult {
  const { passing, failing } = qunitTestEndResult.assertions.reduce((counts, assertion) => {
    counts[assertion.passed ? 'passing' : 'failing']++
    return counts
  }, { passing: 0, failing: 0 })
  const name = `TODO with ${passing} passing and ${failing} failing assertions`
  const testResult = {
    name: name,
    passed: qunitTestEndResult.status === 'todo',
    skipped: false
  } as TestResult
  if (!testResult.passed) {
    testResult.error = {
      message: 'Expected at least one failure in TODO test but found none',
      name: qunitTestEndResult.name
    } as TestResultError
  }
  return testResult
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
