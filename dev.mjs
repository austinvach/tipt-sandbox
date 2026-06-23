import net from "node:net";
import process from "node:process";
import { spawn } from "node:child_process";

const pnpmEntrypoint = process.env.npm_execpath;
const apiHost = "127.0.0.1";
const preferredApiPort = 5000;

function prefixStream(stream, prefix) {
  let buffered = "";

  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffered += chunk;
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() ?? "";

    for (const line of lines) {
      if (!line) {
        process.stdout.write("\n");
        continue;
      }
      process.stdout.write(`${prefix}${line}\n`);
    }
  });

  stream.on("end", () => {
    if (buffered) {
      process.stdout.write(`${prefix}${buffered}\n`);
      buffered = "";
    }
  });
}

function spawnPnpm(args, env, label) {
  const command = pnpmEntrypoint
    ? process.execPath
    : process.platform === "win32"
      ? "pnpm.cmd"
      : "pnpm";
  const commandArgs = pnpmEntrypoint ? [pnpmEntrypoint, ...args] : args;

  const child = spawn(command, commandArgs, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: ["inherit", "pipe", "pipe"],
  });

  if (child.stdout) {
    prefixStream(child.stdout, `[${label}] `);
  }
  if (child.stderr) {
    prefixStream(child.stderr, `[${label}] `);
  }

  child.on("error", (error) => {
    console.error(`[${label}] failed to start`, error);
  });

  return child;
}

async function isApiResponsive(port) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(`http://${apiHost}:${port}/api/healthz`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, apiHost);
  });
}

async function findFreePort(startPort, attempts = 20) {
  for (let offset = 0; offset < attempts; offset += 1) {
    const candidate = startPort + offset;
    if (await isPortFree(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Unable to find a free port starting at ${startPort}`);
}

async function resolveApiPlan() {
  if (await isApiResponsive(preferredApiPort)) {
    return {
      apiBaseUrl: `http://${apiHost}:${preferredApiPort}`,
      startApi: false,
      port: preferredApiPort,
      reason: "reusing existing API server",
    };
  }

  if (await isPortFree(preferredApiPort)) {
    return {
      apiBaseUrl: `http://${apiHost}:${preferredApiPort}`,
      startApi: true,
      port: preferredApiPort,
      reason: "starting API server on default port",
    };
  }

  const port = await findFreePort(preferredApiPort + 1);
  return {
    apiBaseUrl: `http://${apiHost}:${port}`,
    startApi: true,
    port,
    reason: "default API port is busy; starting API server on a fallback port",
  };
}

const children = [];

function shutdown(exitCode = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
  process.exit(exitCode);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const apiPlan = await resolveApiPlan();
console.log(`[dev] ${apiPlan.reason}: ${apiPlan.apiBaseUrl}`);

if (apiPlan.startApi) {
  const apiChild = spawnPnpm(
    ["--filter", "./artifacts/server", "run", "dev"],
    { PORT: String(apiPlan.port), NODE_ENV: "development" },
    "api",
  );
  children.push(apiChild);

  apiChild.on("exit", (code) => {
    if (code && code !== 0) {
      shutdown(code);
    }
  });
}

const webChild = spawnPnpm(
  ["--filter", "@workspace/client", "run", "dev"],
  { API_BASE_URL: apiPlan.apiBaseUrl },
  "web",
);
children.push(webChild);

webChild.on("exit", (code) => {
  shutdown(code ?? 0);
});