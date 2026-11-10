import { GET as handler, POST as postHandler } from '../ical/route';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = handler;
export const POST = postHandler;
