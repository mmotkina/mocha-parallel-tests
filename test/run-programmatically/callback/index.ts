#!/usr/bin/env node

'use strict';

const assert = require('assert');
const MochaParallelTests = require('../../../dist/api.js');

const STREAMS = ['stdout', 'stderr'];
const originalWrites = {};
const mocha = new MochaParallelTests;

let failuresTotal;
let jsonResult;
let globalException;

const patchStreams = () => {
    for (let streamName of STREAMS) {
        const stream = process[streamName];
        originalWrites[streamName] = stream.write.bind(stream);

        // mute standard streams
        // also replace process.stdout.write with process.stderr.write
        // because this is current mocha behaviour
        stream.write = () => {
            return stream;
        };
    }
};

const restoreOriginalStreams = () => {
    for (let streamName of STREAMS) {
        const stream = process[streamName];
        stream.write = originalWrites[streamName];
    }
};

process.on('exit', () => {
    restoreOriginalStreams();

    assert(globalException === undefined, `Failed running mocha-parallel-tests: ${globalException && globalException.stack}`);

    assert(failuresTotal !== undefined, 'Run() callback was not executed');
    assert.strictEqual(failuresTotal, 0, `Run() callback argument is wrong: ${failuresTotal}`);

    assert(jsonResult !== undefined, '"end" event was not fired');
    assert(jsonResult !== null && typeof jsonResult === 'object', `Reporter output is not valid JSON: ${jsonResult}`);
    assert.strictEqual(jsonResult.stats.suites, 200);
    assert.strictEqual(jsonResult.stats.tests, 200);
    assert.strictEqual(jsonResult.stats.passes, 200);
    assert(jsonResult.stats.duration < 6000, `Duration is too long: ${jsonResult.stats.duration}`);
});

// patch streams so that stdout is muted
patchStreams();

try {
    mocha
        .reporter('json')
        .addFile(`${__dirname}/../_spec/parallel1.js`)
        .addFile(`${__dirname}/../_spec/parallel2.js`)
        .slow(8000)
        .timeout(10000)
        .run(failures => {
            failuresTotal = failures;
        }).on('end', function () {
            jsonResult = this.testResults || null;
        });
} catch (ex) {
    globalException = ex;
}
