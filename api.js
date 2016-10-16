'use strict';

import Mocha from 'mocha';
import Reporter from './lib/reporter';
import {createInstance as createRunnerInstance} from './lib/runner';
import {
    addTest,
    runTests,
    setOptions as setWatcherOptions
} from './lib/watcher';

class MochaParallelTests extends Mocha {
    constructor() {
        super();

        this._customRunner = createRunnerInstance();
        this._filesTotal = 0;
        this._reporterName = null;
        this._reporterOptions = null;

        // prevent uncaught exception listeners count warning
        process.setMaxListeners(0);
    }

    addFile(file) {
        addTest(file);
        this._filesTotal++;

        return this;
    }

    reporter(reporterName, reporterOptions) {
        if (reporterName === undefined) {
            return super.reporter.call(this, reporterName, reporterOptions);
        }

        this._reporterName = reporterName;
        this._reporterOptions = reporterOptions;

        return this;
    }

    setOwnOptions({maxParallel, retry}) {
        setWatcherOptions({
            maxParallelTests: maxParallel,
            retryCount: retry
        });
    }

    run(callback) {
        this._customRunner.on('end', failsOccured => {
            callback(failsOccured);
        });

        runTests({
            options: Object.assign({}, {
                reporterName: this._reporterName,
                reporterOptions: this._reporterOptions,
                reporter: Reporter,
                testsLength: this._filesTotal
            }),
            throttledCalls: this._throttledCalls
        });

        return this._customRunner;
    }
}

Object.keys(Mocha.prototype).forEach(key => {
    if (typeof Mocha.prototype[key] !== 'function') {
        return;
    }

    // we have our own implementations of these methods
    // other methods should be saved and re-applied during runTests()
    if (key === 'run' || key === 'addFile' || key === 'reporter') {
        return;
    }

    MochaParallelTests.prototype[key] = function (...args) {
        // mocha calls some of its methods inside constructor
        // so MochaParallelTests own constructor function can still be in progress here
        this._throttledCalls = this._throttledCalls || [];

        this._throttledCalls.push({
            args,
            method: key
        });

        return this;
    };
});

export default MochaParallelTests;
