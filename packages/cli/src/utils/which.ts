/**
 * Cross-platform 'which' implementation
 */

import { join } from 'node:path';
import { platform } from 'node:os';

export const which = async (command: string): Promise<string | null> => {
  const isWindows = platform() === 'win32';
  const pathExt = process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD';
  const extensions = isWindows ? pathExt.split(';') : [''];
  
  const paths = (process.env.PATH || '').split(isWindows ? ';' : ':');
  
  for (const basePath of paths) {
    if (!basePath) continue;
    
    for (const ext of extensions) {
      const fullPath = join(basePath, command + ext);
      
      try {
        const file = Bun.file(fullPath);
        if (await file.exists()) {
          // For simplicity, if file exists in PATH, assume it's executable
          return fullPath;
        }
      } catch {
        // File doesn't exist or can't access it
        continue;
      }
    }
  }
  
  return null;
};