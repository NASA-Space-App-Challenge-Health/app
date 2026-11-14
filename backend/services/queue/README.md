# Queue service

The default queue service is Redis. API workers should use the internal address
`redis://queue:6379/0`; do not use the host-mapped port for container-to-container
connections. Redis is not host-published by default; add a local-only mapping in
`../../docker/compose.local.yaml` when inspection from the host is necessary.

The crew-health API does not enqueue work yet. Redis stays in the stack for
later alert or sync jobs. Do not store health readings only in Redis.
