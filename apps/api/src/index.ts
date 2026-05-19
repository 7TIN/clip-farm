import { Hono } from "hono";

console.log("Hello via Bun!");


const app = new Hono();

app.get("/", (c) => c.text("hello"));


Bun.serve({
    port : 3001,
    fetch : app.fetch
})