import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { authRouter } from './auth';
import { notesRouter } from './notes';
import { shareRouter } from './share';

const app = new Hono().basePath('/api');

app.route('/auth', authRouter);
app.route('/notes', notesRouter);
app.route('/share', shareRouter);

export const handleRequest = handle(app);
export default app;
export type AppType = typeof app;
