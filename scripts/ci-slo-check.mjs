const wall = Number(process.env.CI_WALL_CLOCK_SECONDS ?? 0);
const queue = Number(process.env.CI_QUEUE_SECONDS ?? 0);
const critical = Number(process.env.CI_CRITICAL_PATH_SECONDS ?? wall);
const runnerMinutes = Number(process.env.CI_RUNNER_MINUTES ?? 0);

const limits = {
  wallClock: 25 * 60,
  queue: 2 * 60,
  criticalPath: 18 * 60,
  runnerMinutes: 1200,
};
const metrics = { wallClock, queue, criticalPath: critical, runnerMinutes };
const failures = Object.entries(metrics).filter(([key, value]) => value <= 0 || value > limits[key]);
console.log(JSON.stringify({ version: 1, limits, metrics, pass: failures.length === 0, failures }, null, 2));
if (failures.length) process.exit(1);
