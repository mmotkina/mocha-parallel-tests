import Mocha from '../../main/mocha';

export default function applyStreamOutput(mocha: Mocha, streamOutput?: boolean) {
  mocha.setStreamOutput(streamOutput || false);
}
