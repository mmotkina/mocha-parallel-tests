import CircularJSON from 'circular-json';
import debug from 'debug';
import Mocha from 'mocha';

import RunnerMain from './runner';
import TaskManager from './task-manager';
import { subprocessParseReviver } from './util';

import { SubprocessResult } from '../message-channel';
import { RetriedTest, Suite } from '../mocha';
import { getThread } from './thread';
import { ThreadOptions } from '../thread';
import { SUITE_OWN_OPTIONS } from '../config';

const debugLog = debug('mocha-parallel-tests');

export default class MochaWrapper extends Mocha {
  private isTypescriptRunMode = false;
  private maxParallel: number | undefined;
  private streamOutput: boolean;
  private env: boolean | undefined;
  private requires: string[] = [];
  private compilers: string[] = [];
  private exitImmediately = false;

  setTypescriptRunMode() {
    this.isTypescriptRunMode = true;
  }

  /**
   * All `--require` options should be applied for subprocesses
   */
  addRequiresForSubprocess(requires: string[]) {
    this.requires = requires;
  }

  /**
   * All `--compiler` options should be applied for subprocesses
   */
  addCompilersForSubprocess(compilers: string[]) {
    this.compilers = compilers;
  }

  setMaxParallel(maxParallel: number) {
    this.maxParallel = maxParallel;
  }

  setEnvs(env: boolean) {
    this.env = env;
  }

  setStreamOutput(streamOutput: boolean) {
    this.streamOutput = streamOutput;
  }

  enableExitMode() {
    this.exitImmediately = true;
    return this;
  }

  run(onComplete?: (failures: number) => void): RunnerMain {
    const {
      asyncOnly,
      ignoreLeaks,
      forbidOnly,
      forbidPending,
      fullStackTrace,
      hasOnly, // looks like a private mocha API
    } = this.options;

    const rootSuite = this.suite as Suite;

    const runner = new RunnerMain(rootSuite);
    runner.ignoreLeaks = ignoreLeaks !== false;
    runner.forbidOnly = forbidOnly;
    runner.forbidPending = forbidPending;
    runner.hasOnly = hasOnly;
    runner.fullStackTrace = fullStackTrace;
    runner.asyncOnly = asyncOnly;

    const taskManager = new TaskManager<SubprocessResult>(this.maxParallel);
    for (const file of this.files) {
      const task = () => this.runThread(file);
      taskManager.add(task);
    }

    this.options.files = this.files;

    // Refer to mocha lib/mocha.js run() method for more info here
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reporter = new (this as any)._reporter(
      runner,
      this.options,
    );

    // emit `start` and `suite` events
    // so that reporters can record the start time
    runner.emitStartEvents();
    taskManager.execute();

    taskManager
      .on('taskFinished', (testResults: SubprocessResult) => {
        const {
          code,
          execTime,
          events,
          file,
          syncedSubprocessData,
        } = testResults;

        debugLog(`File execution finished: ${file}`);
        debugLog(`Has synced data: ${Boolean(syncedSubprocessData)}, number of events: ${events.length}, execution time: ${execTime}`);

        const retriedTests: RetriedTest[] = [];

        if (syncedSubprocessData) {
          this.addSubprocessSuites(testResults);
          retriedTests.push(...this.extractSubprocessRetriedTests(testResults));
        }

        runner.reEmitSubprocessEvents(testResults, retriedTests);

        const hasEndEvent = events.find((event) => event.type === 'runner' && event.event === 'end');
        if (!hasEndEvent && code !== 0) {
          process.exit(code);
        }
      })
      .on('end', () => {
        debugLog('All tests finished processing');

        const done = (failures: number) => {
          if (reporter.done) {
            reporter.done(failures, onComplete);
          } else if (onComplete) {
            onComplete(failures);
          }
        };

        runner.emitFinishEvents(done);
      });

    return runner;
  }

  private addSubprocessSuites(testArtifacts: SubprocessResult): void {
    const rootSuite = this.suite;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const serialized = testArtifacts.syncedSubprocessData!;
    const { rootSuite: testRootSuite } = CircularJSON.parse(serialized.results, subprocessParseReviver);

    Object.assign(testRootSuite, {
      parent: rootSuite,
      root: false,
    });

    rootSuite.suites.push(testRootSuite);
  }

  private extractSubprocessRetriedTests(testArtifacts: SubprocessResult): RetriedTest[] {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const serialized = testArtifacts.syncedSubprocessData!;
    const { retriesTests } = CircularJSON.parse(serialized.retries, subprocessParseReviver);

    return retriesTests as RetriedTest[];
  }

  private async runThread(file: string): Promise<SubprocessResult> {
    const options = this.getThreadOptions();
    const thread = getThread(file, options);

    return await thread.run();
  }

  private getThreadOptions(): ThreadOptions {
    const options: ThreadOptions = {
      compilers: [],
      delay: false,
      exitImmediately: false,
      fullTrace: false,
      isTypescriptRunMode: this.isTypescriptRunMode,
      requires: [],
      env: this.env,
      streamOutput: this.streamOutput,
    };

    for (const requirePath of this.requires) {
      options.requires.push(requirePath);
    }

    for (const compilerPath of this.compilers) {
      options.compilers.push(compilerPath);
    }

    if (this.options.delay) {
      options.delay = true;
    }

    if (this.options.grep) {
      options.grep = this.options.grep.toString();
    }

    if (this.exitImmediately) {
      options.exitImmediately = true;
    }

    if (this.options.fullStackTrace) {
      options.fullTrace = true;
    }

    for (const option of SUITE_OWN_OPTIONS) {
      options[option] = this.suite[option]();
    }

    return options;
  }
}
