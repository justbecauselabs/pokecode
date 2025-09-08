import { isTest } from '../config';

let consolePrettyEnabled: boolean = !isTest && Boolean(process.stdout.isTTY);

export function setConsolePrettyEnabled(enabled: boolean): void {
  consolePrettyEnabled = enabled;
}

export function isConsolePrettyEnabled(): boolean {
  return consolePrettyEnabled;
}
