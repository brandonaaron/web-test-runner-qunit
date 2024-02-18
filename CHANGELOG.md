# Changelog

## [2.0.0] - 2024-02-18

A special thanks to @rnixx and @Krinkle for helping shape this update.

- BREAKING: Only one failed assertion per a test is reported. This is due to being only able to map one `error` to an @web/test-runner `TestResult`.
- Reporting of actual/expected diffs on a failed assertion.
- Errors reported via QUnit's error event are now included as @web/test-runner `TestSession.errors`.
- Updated dev dependencies


## [1.0.0] - 2023-11-27

Initial release
