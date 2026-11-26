#!/bin/sh
set -eu

# Wait up to ~60s for the database port (compose healthchecks cover this, plain `docker run` does not).
node -e '
const net = require("node:net");
const url = new URL(process.env.DATABASE_URL);
const target = { host: url.hostname.replace(/^\[|\]$/g, ""), port: Number(url.port || 5432) };
let attempts = 30;
(function connect() {
  const socket = net.connect(target);
  socket.setTimeout(2000, () => socket.destroy(new Error("timeout")));
  socket.once("connect", () => process.exit(0));
  socket.once("error", (error) => {
    if (--attempts === 0) {
      console.error(`database unreachable at ${target.host}:${target.port}: ${error.message}`);
      process.exit(1);
    }
    setTimeout(connect, 1000);
  });
})();
'

node dist/migrate.mjs
exec node server.js
