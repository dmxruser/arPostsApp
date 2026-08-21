import { handleRequest } from '../../main';

export default async function handler(req: any, res: any) {
  return handleRequest(req, res);
}
