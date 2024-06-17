import compression from "compression";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runGameServer } from "./game-server";
import morgan from "morgan";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(compression());

app.disable("x-powered-by");

app.use(morgan("tiny"));

if (process.env.NODE_ENV === "production") {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    app.use("/assets", express.static("dist/client/assets", { immutable: true, maxAge: "1y" }));

    app.get("/", (_req, res) => {
        res.sendFile(path.join(__dirname, "../client/index.html"));
    });
}

app.listen(PORT, () => {
    console.log(`Express server is running on port ${PORT}`);

    runGameServer();
});
