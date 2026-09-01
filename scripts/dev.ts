const processes = [
  new Deno.Command(Deno.execPath(), {
    args: ['task', 'dev:api'],
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  }).spawn(),
  new Deno.Command(Deno.execPath(), {
    args: ['task', 'dev:web'],
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  }).spawn(),
];

const stop = () => {
  for (const process of processes) {
    try {
      process.kill('SIGTERM');
    } catch {
      continue;
    }
  }
};

Deno.addSignalListener('SIGINT', stop);
Deno.addSignalListener('SIGTERM', stop);

const result = await Promise.race(processes.map((process) => process.status));
stop();
Deno.exit(result.code);
