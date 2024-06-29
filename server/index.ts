import compression from "compression";
import express from "express";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runGameServer } from "./game-server";

const app = express();
const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 8080;

app.use(compression());
app.use(morgan("tiny"));
app.disable("x-powered-by");

if (process.env.NODE_ENV === "production") {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    app.use("/assets", express.static("dist/client/assets", { immutable: true, maxAge: "1y" }));

    app.get("/", (_req, res) => {
        res.sendFile(path.join(__dirname, "../client/index.html"));
    });
}

app.listen(PORT, () => {
    console.log(`HTTP server is running on http://localhost:${PORT}`);
    runGameServer(+WS_PORT);
});
