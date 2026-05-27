import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import IstanbulPlugin from 'vite-plugin-istanbul';
import { join } from 'path'
import * as fs from 'fs';

function createApiProxy(target: string): ProxyOptions {
    const targetOrigin = new URL(target).origin;

    const getForwardedProto = (req: { socket: { encrypted?: boolean } }) =>
        req.socket.encrypted ? "https" : "http";

    const rewriteLocationHeader = (location: string, localOrigin: string) => {
        if (location.startsWith(targetOrigin)) {
            return location.replace(targetOrigin, localOrigin);
        }

        try {
            const redirectUrl = new URL(location);
            let changed = false;

            for (const param of ["post_logout_redirect_uri", "return_url"]) {
                const value = redirectUrl.searchParams.get(param);
                if (value?.startsWith(targetOrigin)) {
                    redirectUrl.searchParams.set(
                        param,
                        value.replace(targetOrigin, localOrigin)
                    );
                    changed = true;
                }
            }

            return changed ? redirectUrl.toString() : location;
        } catch {
            return location;
        }
    };

    return {
        target: targetOrigin,
        changeOrigin: true,
        secure: true,
        cookieDomainRewrite: { "*": "" },
        autoRewrite: true,
        protocolRewrite: "http",
        configure(proxy) {
            proxy.on("proxyReq", (proxyReq, req) => {
                const host = req.headers.host || "localhost:5173";
                const forwardedProto = getForwardedProto(req);
                const forwardedPort = host.includes(":") ? host.split(":").pop() : forwardedProto === "https" ? "443" : "80";

                proxyReq.setHeader("X-Forwarded-Host", host);
                proxyReq.setHeader("X-Forwarded-Proto", forwardedProto);
                proxyReq.setHeader("X-Forwarded-Port", forwardedPort || "");
            });

            proxy.on("proxyRes", (proxyRes, req) => {
                const host = req.headers.host || "localhost:5173";
                const forwardedProto = getForwardedProto(req);
                const localOrigin = `${forwardedProto}://${host}`;
                const location = proxyRes.headers.location;

                if (typeof location === "string") {
                    proxyRes.headers.location = rewriteLocationHeader(location, localOrigin);
                }

                const cookies = proxyRes.headers["set-cookie"];
                if (!cookies || forwardedProto === "https") return;

                proxyRes.headers["set-cookie"] = cookies.map((cookie) =>
                    cookie.replace(/;\s*secure/gi, "")
                );
            });
        },
    };
}

const redirectToDir = (root = "public") => ({
    name: 'redirect-to-dir',
    configureServer(server) {
        server.middlewares.use((req, res, next) => {
            const filePath = join(root, req.url);
            fs.stat(filePath, (err, stats) => {
                if (!err && stats.isDirectory() && !req.url.endsWith('/')) {
                    res.statusCode = 302;
                    res.setHeader('Location', req.url + "/index.html");
                    res.setHeader('Content-Length', '0');
                    res.end();
                    return;
                }
                next();
            });
        })
    },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const apiProxyTarget =
        env.VITE_API_PROXY_TARGET ||
        env.API_PROXY_TARGET ||
        "https://openai.ki.fh-swf.de";
    const apiProxy = createApiProxy(apiProxyTarget);

    return {
        base: './',
        build: {
            rollupOptions: {
                output: {
                    manualChunks: (id) => {
                        if (id.includes('node_modules')) {
                            const parts = id.split('node_modules/');
                            const name = parts[1].split('/')[0];
                            return `vendor/${name}`;
                        }
                    }
                }
            },
            sourcemap: true,
        },
        server: {
            host: "localhost",
            port: 5173,
            strictPort: true,
            proxy: {
                "/api": apiProxy,
            },
        },
        preview: {
            host: "localhost",
            port: 5173,
            strictPort: true,
            proxy: {
                "/api": apiProxy,
            },
        },
        plugins: [react(), redirectToDir(), IstanbulPlugin({ include: 'src/*' })],
        css: {
            preprocessorOptions: {
                less: {
                    math: "always",
                    relativeUrls: true,
                    javascriptEnabled: true
                },
            },
        }
    };
})
