import { SubprocessResult, SubprocessOutputMessage, SubprocessRunnerMessage } from './message-channel';

export type ListenerMessage = (message: Buffer) => void;
export type ListenerStandardStream = (message: Buffer) => void;
export type ExitCode = number;

export interface ThreadOptions {
  bail?: boolean;
  compilers: string[];
  delay: boolean;
  enableTimeouts?: boolean;
  exitImmediately: boolean;
  fullTrace: boolean;
  grep?: string;
  isTypescriptRunMode: boolean;
  requires: string[];
  retries?: number;
  slow?: boolean;
  timeout?: number;
  env?: boolean;
  streamOutput?: boolean;
}

export interface Thread {
  run(): Promise<SubprocessResult>;
}

export type SubprocessMessage = SubprocessOutputMessage | SubprocessRunnerMessage;

export function supportsWorkerThreads(): boolean {
  try {
    require('worker_threads');
    return true;
  } catch (ex) {
    return false;
  }
}
