import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, join } from 'path'
import * as fs from 'fs';

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
export default defineConfig({
    base: './',
    plugins: [react(), redirectToDir()],
    css: {
        preprocessorOptions: {
            less: {
                math: "always",
                relativeUrls: true,
                javascriptEnabled: true
            },
        },
    }
})