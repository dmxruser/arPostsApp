import { deletePosts } from '../Server/Cron/DeletePosts';

export default async function handler(_req: any, res: any) {
  try {
    await deletePosts();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('cron error', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: String(err) }));
  }
}
