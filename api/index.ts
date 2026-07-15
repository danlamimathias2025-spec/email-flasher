import app from "../dist/server.cjs";
const handler = (app as any).default || app;
export default handler;
