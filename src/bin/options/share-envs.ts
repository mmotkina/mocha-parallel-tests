import Mocha from '../../main/mocha';
import { supportsWorkerThreads } from "../../thread";

export default function applyShareEnvs(mocha: Mocha, shareEnvs?: boolean) {
  if (shareEnvs) {
    if (!supportsWorkerThreads()) {
      throw new Error("The share-envs option is available only on node 12 and up.");
    }
    mocha.setEnvs(true);
  }
}
