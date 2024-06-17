import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ isSsrBuild }) => ({
    plugins: [tsconfigPaths()],
    build: {
        target: isSsrBuild ? "ES2022" : "modules",
        outDir: isSsrBuild ? "./dist/server" : "./dist/client",
    },
}));
