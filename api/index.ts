import app from "../server";
const handler = (app as any).default || app;
export default handler;
