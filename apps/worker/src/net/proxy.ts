// A local HTTP proxy that every browser request in a scan goes through (#5).
// It resolves each host once with `resolvePublic` and connects to that exact
// address, so a redirect, an iframe, a fetch, or a DNS record that changes
// after the first check can't reach a private address.
import { createServer, request, type IncomingHttpHeaders } from 'node:http';
import { connect, type AddressInfo, type Socket } from 'node:net';
import { resolvePublic, type GuardOptions } from './guard';
import { UnsafeUrlError } from '../errors';

/** Set on the proxy's own 403, so the scanner can tell a blocked page from a real one. */
export const BLOCKED_HEADER = 'x-curbcut-blocked';

export interface GuardProxy {
  /** For Playwright's `proxy.server`. */
  url: string;
  /** Hosts refused so far, for the scanner's error message. */
  blocked: string[];
  close(): Promise<void>;
}

/** Headers meant for the proxy, not the origin. */
function forwardHeaders(headers: IncomingHttpHeaders): IncomingHttpHeaders {
  const rest = { ...headers };
  delete rest['proxy-connection'];
  delete rest['proxy-authorization'];
  return rest;
}

export async function startGuardProxy(options: GuardOptions = {}): Promise<GuardProxy> {
  const blocked: string[] = [];
  // Tunnels outlive their requests, so track every socket to close them all.
  const sockets = new Set<Socket>();
  const track = (s: Socket) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  };
  const refuse = (host: string, err: unknown) => {
    if (err instanceof UnsafeUrlError) blocked.push(host);
    return err instanceof UnsafeUrlError;
  };

  const server = createServer((req, res) => {
    // A proxied plain-http request carries an absolute URL.
    let target: URL;
    try {
      target = new URL(req.url ?? '');
      if (target.protocol !== 'http:') throw new Error('not http');
    } catch {
      res.writeHead(400).end();
      return;
    }
    resolvePublic(target.hostname, options).then(
      ({ address }) => {
        const upstream = request(
          {
            host: address,
            port: target.port || 80,
            method: req.method,
            path: target.pathname + target.search,
            headers: forwardHeaders(req.headers),
            // No pooling: a connection lives as long as the request, and the proxy can close.
            agent: false,
          },
          (upstreamRes) => {
            res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
            upstreamRes.pipe(res);
          },
        );
        upstream.on('error', () => res.destroy());
        req.pipe(upstream);
      },
      (err: unknown) => {
        const status = refuse(target.hostname, err) ? 403 : 502;
        res.writeHead(status, { [BLOCKED_HEADER]: status === 403 ? '1' : '0' }).end();
      },
    );
  });

  // https and websockets tunnel through CONNECT. TLS stays end to end; the
  // proxy only picks the address.
  server.on('connect', (req, socket, head) => {
    let target: URL;
    try {
      target = new URL(`http://${req.url ?? ''}`);
    } catch {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      return;
    }
    socket.on('error', () => socket.destroy());
    resolvePublic(target.hostname, options).then(
      ({ address }) => {
        const upstream = connect(Number(target.port || 443), address, () => {
          socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          upstream.write(head);
          upstream.pipe(socket).pipe(upstream);
        });
        track(upstream);
        upstream.on('error', () => socket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n'));
        socket.on('close', () => upstream.destroy());
      },
      (err: unknown) => {
        const status = refuse(target.hostname, err) ? '403 Forbidden' : '502 Bad Gateway';
        socket.end(`HTTP/1.1 ${status}\r\n\r\n`);
      },
    );
  });

  server.on('connection', track);

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    blocked,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
        for (const s of sockets) s.destroy();
      }),
  };
}
