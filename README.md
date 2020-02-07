# mocha-parallel-tests

[![Build Status](https://img.shields.io/travis/mocha-parallel/mocha-parallel-tests/master.svg?style=flat)](https://travis-ci.org/mocha-parallel/mocha-parallel-tests)

`mocha-parallel-tests` is a test runner for tests written with `mocha` testing framework which allows you to run them in parallel. `mocha-parallel-tests` executes **each of your test files in a separate process** while maintaining the output structure of `mocha`. Compared to the other tools which try to parallelize `mocha` tests execution, `mocha-parallel-tests` doesn't require you to write the code in a different way or use some specific APIs - just run your tests with `mocha-parallel-tests` instead of `mocha` and you will see the difference. Or if you prefer to use `mocha` programmatic API replace it with `mocha-parallel-tests` default export and you're done!

If you're using Node.JS >= 12 your tests execution will be even faster because `mocha-parallel-tests` supports running tests with Node.JS worker threads API: instead of creating fully fledged Node.JS processes `mocha-parallel-tests` runs your tests in lighter threads within the same process. This results in a faster tests processing and less memory consumption.

## Installation

`npm install --save-dev mocha mocha-parallel-tests`

**ATTENTION**: `mocha` is a peer dependency of `mocha-parallel-tests` so you also need to install `mocha`. Currently `mocha` versions 3, 4, 5 and 6 are supported.

## Usage

### CLI

```bash
# mocha example
$ mocha -R xunit --timeout 10000 --slow 1000 test/*.spec.js

# mocha-parallel-tests example
$ mocha-parallel-tests -R xunit --timeout 10000 --slow 1000 test/*.spec.js
```

Most of `mocha` CLI options are supported. If you're missing some of the options support you're welcome to submit a PR: all options are applied in a same simple way.

### Programmatic API

```javascript
// mocha example
import Mocha from 'mocha';
const mocha = new Mocha();
mocha.addFile(`${__dirname}/index.spec.js`);
mocha.run();

// mocha-parallel-tests example
// if you're using TypeScript you don't need to install @types/mocha-parallel-tests
// because package comes with typings in it
import Mocha from 'mocha-parallel-tests'; // or `const Mocha = require('mocha-parallel-tests').default` if you're using CommonJS
const mocha = new Mocha();
mocha.addFile(`${__dirname}/index.spec.js`);
mocha.run();
```

## Parallel limit

`mocha-parallel-tests` CLI executable has its own `--max-parallel` option which is the amount of tests executed at the same time. By default it's equal to the number of logical CPI cores (`os.cpus().length`) on your computer but you can also specify your own number or set it to 0, which means that all test files will be started executing at the same time. However this is not recommended especially on machines with low number of CPUs and big number of tests executed.

## Share Environment Variables

The option `--share-envs` indicates that the different processes should share read and write access to the same set of environment variables.

An example use case to this feature is to use `beforeEach` and `afterEach` to dynamically synchronize the workers (e.g. when working with outer services).


## Stream output

The option `--stream-output` indicates that the output of the workers will be streamed immediately to the console.
Note that using this option, mocha-parallel-tests will not group the outputs by the workers, therefore it might be messy.

## Differences with mocha

Main difference with `mocha` comes from the fact that all files are executed in separate processes/threads and don't share the scope. This means that even global variables values that you could've used to share the data between test suites will not be reliable. There's also some specific behaviour for some of the `mocha` CLI options like `--bail`: it's just applied to each test in its process. You can see the full list of differences [here](https://github.com/mocha-parallel/mocha-parallel-tests/wiki/Differences-with-mocha).

There's also a [list of limitations](https://github.com/mocha-parallel/mocha-parallel-tests/wiki/Limitations) that you can hit when you launch your tests with `mocha-parallel-tests`.

From the reporter perspective the main difference between tests executed with `mocha` and `mocha-parallel-tests` is another level of nesting which again comes from the fact that main process adds one more "suite" level and all tests results are merged into that:

**mocha**

<kbd>
  <img src="https://user-images.githubusercontent.com/73191/40331528-0b79999c-5d94-11e8-86ba-ca5213c9fe29.png" alt="mocha spec reporter output"/>
</kbd>

**mocha-parallel-tests**

<kbd>
  <img src="https://user-images.githubusercontent.com/73191/40331597-39f89b38-5d94-11e8-9388-c42a27b0da9b.png" alt="mocha-parallel-tests spec reporter output"/>
</kbd>

## Comparison with `mocha.parallel`

[mocha.parallel](https://github.com/danielstjules/mocha.parallel) is a tool which allows you to run mocha tests in parallel. While it seems pretty similar to `mocha-parallel-tests` there's a massive difference between them. Check [this page](https://github.com/mocha-parallel/mocha-parallel-tests/wiki/Comparison-with-mocha.parallel) for a full comparison.
