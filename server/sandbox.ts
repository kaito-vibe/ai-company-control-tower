import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const SANDBOX_DIR = path.join(process.cwd(), 'data', 'sandbox');

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  files: string[];
  duration: number;
}

export async function executeSandboxedCode(
  code: string,
  language: 'javascript' | 'python' | 'bash',
  taskId: number,
  timeout: number = 30000
): Promise<SandboxResult> {
  const taskDir = path.join(SANDBOX_DIR, `task-${taskId}`);
  fs.mkdirSync(taskDir, { recursive: true });

  const filename = language === 'python' ? 'script.py' :
                   language === 'bash' ? 'script.sh' : 'script.js';
  const filePath = path.join(taskDir, filename);
  fs.writeFileSync(filePath, code);

  const cmd = language === 'python' ? `python3 ${filePath}` :
              language === 'bash' ? `bash ${filePath}` :
              `node ${filePath}`;

  const start = Date.now();
  try {
    const stdout = execSync(cmd, {
      timeout,
      cwd: taskDir,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, HOME: taskDir },
    }).toString();
    return {
      stdout,
      stderr: '',
      exitCode: 0,
      files: fs.readdirSync(taskDir),
      duration: Date.now() - start,
    };
  } catch (err: any) {
    return {
      stdout: err.stdout?.toString() || '',
      stderr: err.stderr?.toString() || err.message,
      exitCode: err.status || 1,
      files: fs.readdirSync(taskDir),
      duration: Date.now() - start,
    };
  }
}
