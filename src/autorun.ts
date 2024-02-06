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
      errors: testResultErrors,
      testResults
    }).catch((err) => console.error(err))
  })
}

function collectTestSuiteResults (qunitSuiteResults: WTRQUnitSuiteResult): TestSuiteResult {
  const tests: TestResult[] = qunitSuiteResults.tests.map((qunitTestResult) => {
    // In QUnit land a status of "todo" is passing if there is at least one error
    let passed = qunitTestResult.status === 'passed'
    if (qunitTestResult.status === 'todo') { passed = qunitTestResult.errors.length > 0 }
    return {
      name: qunitTestResult.name,
      passed,
      skipped: qunitTestResult.status === 'skipped',
      duration: qunitTestResult.runtime
    }
  })
  const suites: TestSuiteResult[] = qunitSuiteResults.childSuites.map(collectTestSuiteResults)
  const testSuiteResult: TestSuiteResult = {
    name: qunitSuiteResults.name,
    tests,
    suites
  }

  return testSuiteResult
}

function collectErrors (qunitTestEndResult: WTRQUnitTestEndResult): TestResultError[] {
  const name = qunitTestEndResult.fullName.join(' > ')
  const errors:TestResultError[] = []
  qunitTestEndResult.errors.forEach((error) => {
    if (error.todo) { return }
    let message = `\nExpected: ${JSON.stringify(error.expected, null, 4)}\n`
	  message += `Actual: ${JSON.stringify(error.actual, null, 4)}`
	  message = message.split('\n').join('\n      ')
    // expected and actual are not contained in web test runner output
    // there exists a formatError function here
    // https://github.com/modernweb-dev/web/blob/master/packages/test-runner/src/reporter/reportTestsErrors.ts#L36
    // but it is not called, probably building the message on our own is not
    // the proper way to fix this.
    const testResultError: TestResultError = {
      name,
      message: message,
      stack: error.stack,
      expected: `${error.expected}`,
      actual: `${error.actual}`
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
