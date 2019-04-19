#!/usr/bin/env node

import * as yargs from 'yargs';

import MochaWrapper from '../main/mocha';
import { setProcessExitListeners } from '../util';

import applyAsyncOnly from './options/async-only';
import applyBail from './options/bail';
import applyCheckLeaks from './options/check-leaks';
import applyCompilers from './options/compilers';
import applyDelay from './options/delay';
import applyExit from './options/exit';
import applyForbidOnly from './options/forbid-only';
import applyForbidPending from './options/forbid-pending';
import applyFullTrace from './options/full-trace';
import applyGrepPattern from './options/grep';
import applyMaxParallel from './options/max-parallel';
import applyNoTimeouts from './options/no-timeouts';
import applyReporter from './options/reporter';
import applyReporterOptions from './options/reporter-options';
import applyRequires from './options/require';
import getFilesList from './options/rest';
import applyRetries from './options/retries';
import applySlow from './options/slow';
import applyTimeout from './options/timeout';

setProcessExitListeners();

// mocha@6 introduced a new way to parse CLI arguments through yargs context
// this mechanism should be used if `loadOptions` is defined
const yargsOptionalArgs: object[] = [];

// starting from mocha@6 `--no-timeout` and `--no-timeouts` is the same thing
let newTimeoutsBehaviour = false;

try {
  // tslint:disable-next-line:no-var-requires
  const { loadOptions } = require('mocha/lib/cli/options');
  yargsOptionalArgs.push(loadOptions(process.argv));

  newTimeoutsBehaviour = true;
} catch (ex) {
  // tslint:disable-next-line:no-var-requires
  const getOptions = require('mocha/bin/options');

  // NB: legacy (mocha before version 6)
  // --opts changes process.argv so it should be executed first
  getOptions();
}

const mocha = new MochaWrapper();
const argv = yargs
  .option('async-only', {
    alias: 'A',
    boolean: true,
  })
  .option('bail', {
    alias: 'b',
    boolean: true,
  })
  .option('check-leaks', {
    boolean: true,
  })
  .option('compilers', {
    default: [],
  })
  .option('delay', {
    boolean: true,
  })
  .option('exit', {
    boolean: true,
  })
  .option('forbidOnly', {
    boolean: true,
  })
  .option('forbidPending', {
    boolean: true,
  })
  .option('full-trace', {
    boolean: true,
  })
  .option('max-parallel', {
    number: true,
  })
  .option('grep', {
    alias: 'g',
    string: true,
  })
  .option('recursive', {
    boolean: true,
  })
  .option('reporter', {
    alias: 'R',
    default: 'spec',
    string: true,
  })
  .option('reporter-options', {
    alias: 'O',
    string: true,
  })
  .option('retries', {
    number: true,
  })
  .option('require', {
    alias: 'r',
    default: [],
  })
  .option('slow', {
    alias: 's',
    number: true,
  })
  .option('timeout', {
    alias: 't',
    number: true,
  })
  .option('timeouts', {
    boolean: !newTimeoutsBehaviour,
    number: newTimeoutsBehaviour,
  })
  .parse(process.argv, ...yargsOptionalArgs);

// --async-only
applyAsyncOnly(mocha, argv['async-only']);

// --bail
applyBail(mocha, argv.bail);

// --check-leaks
applyCheckLeaks(mocha, argv['check-leaks']);

// --compilers
const { compilers, extensions } = applyCompilers(argv.compilers);
mocha.addCompilersForSubprocess(compilers);

// --delay
applyDelay(mocha, argv.delay);

// --exit
applyExit(mocha, argv.exit);

// --forbid-only
applyForbidOnly(mocha, argv.forbidOnly);

// --forbid-pending
applyForbidPending(mocha, argv.forbidPending);

// --full-trace
applyFullTrace(mocha, argv['full-trace']);

// --grep option
applyGrepPattern(mocha, argv.grep);

// --max-parallel
applyMaxParallel(mocha, argv['max-parallel']);

// --no-timeouts
if (newTimeoutsBehaviour) {
  const enableTimeouts = Boolean(argv.timeout || argv.timeouts);
  applyNoTimeouts(mocha, enableTimeouts);
} else {
  applyNoTimeouts(mocha, argv.timeouts as boolean);
}

// --r, --require
const requires = applyRequires(argv.require);
mocha.addRequiresForSubprocess(requires);

// --reporter-options
const reporterOptions = argv['reporter-options'] !== undefined
  ? applyReporterOptions(argv['reporter-options'])
  : {};

// --reporter
applyReporter(mocha, argv.reporter, reporterOptions);

// --retries
applyRetries(mocha, argv.retries);

// --slow
applySlow(mocha, argv.slow);

// --timeout
applyTimeout(mocha, argv.timeout);

// find files
const files = getFilesList(argv._.slice(2), extensions, argv.recursive || false);

if (!files.length) {
  // tslint:disable-next-line:no-console
  console.error('No test files found');
  process.exit(1);
}

for (const file of files) {
  mocha.addFile(file);
}

const isTypescriptRun = argv.$0.endsWith('.ts');
if (isTypescriptRun) {
  mocha.setTypescriptRunMode();
}

mocha.run((code) => {
  process.on('exit', function onExit() {
    process.exit(Math.min(code, 255));
  });
});
