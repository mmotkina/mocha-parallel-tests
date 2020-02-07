import { Debugger } from 'debug';
import { Worker } from 'worker_threads';
import { resolve } from 'path';

import { SubprocessMessage, Thread, ThreadOptions } from '../../thread';
import { SubprocessResult, SubprocessSyncedData, SubprocessRunnerMessage, SubprocessOutputMessage, InterProcessMessage, isSyncSnapshot, isOverwrittenStandardStreamMessage } from '../../message-channel';
import { removeDebugArgs } from '../util';

export interface WorkerData {
  file: string;
  options: ThreadOptions;
}

export class WorkerThread implements Thread {
  private file: string;
  private log: Debugger;
  private options: ThreadOptions;
  private events: SubprocessMessage[] = [];
  private startedAt: number | undefined;
  private syncedSubprocessData: SubprocessSyncedData | undefined;

  constructor(file: string, log: Debugger, options: ThreadOptions) {
    this.file = file;
    this.log = log;
    this.options = options;
  }

  run() {
    const workerFilename = this.options.isTypescriptRunMode ? 'worker.development.js' : 'worker.js';
    const workerPath = resolve(__dirname, `../../subprocess/thread/${workerFilename}`);

    this.startedAt = Date.now();

    return new Promise<SubprocessResult>((resolve, reject) => {
      const worker = new Worker(workerPath, {
        execArgv: process.execArgv.filter(removeDebugArgs),
        stderr: true,
        stdout: true,
        workerData: this.buildWorkerData(),
        // @ts-ignore
        env: this.options.env && require('worker_threads').SHARE_ENV,
      });

      // it's unsafe to listen to stderr/stdout messages from the worker thread
      // because they are asynchronous (process.stdout.isTTY = False)
      // worker.stderr.on('data', this.onStderr);
      // worker.stdout.on('data', this.onStdout);

      worker.on('message', this.onMessage);
      worker.on('error', this.onError(reject));
      worker.on('exit', this.onExit(resolve));
    });
  }

  private buildWorkerData(): WorkerData {
    return {
      file: resolve(this.file),
      options: this.options,
    };
  }

  private onMessage = (message: InterProcessMessage) => {
    if (isOverwrittenStandardStreamMessage(message)) {
      const { data, stream } = message;

      if (stream === 'stdout') {
        this.onStdout(Buffer.from(data));
      } else if (stream === 'stderr') {
        this.onStderr(Buffer.from(data));
      }

      return;
    }

    if (isSyncSnapshot(message)) {
      this.syncedSubprocessData = message.data;
    } else {
      const runnerEvent: SubprocessRunnerMessage = {
        data: message.data,
        event: message.event,
        type: 'runner',
      };

      this.events.push(runnerEvent);
    }
  }

  private onStdout = (data: Buffer) => {
    if (this.options.streamOutput) {
      console.info(data.toString());
    } else {
      const outputEvent: SubprocessOutputMessage = {
        data,
        type: 'stdout',
      };

      this.events.push(outputEvent);
    }
  }

  private onStderr = (data: Buffer) => {
    if (this.options.streamOutput) {
      console.error(data.toString());
    } else {
      const outputEvent: SubprocessOutputMessage = {
        data,
        type: 'stderr',
      };

      this.events.push(outputEvent);
    }
  }

  private onError = (reject: (err: Error) => void) => (err: Error) => {
    this.log(`Error occured in subprocess: ${err.stack}`);
    reject(err);
  }

  private onExit = (resolve: (data: SubprocessResult) => void) => (code: number) => {
    this.log(`Process for ${this.file} exited with code ${code}`);

    if (!this.startedAt) {
      throw new Error('Attempt to close a thread which hasn\'t been started yet');
    }

    resolve({
      code,
      events: this.events,
      execTime: Date.now() - this.startedAt,
      file: this.file,
      syncedSubprocessData: this.syncedSubprocessData,
    });
  }
}
