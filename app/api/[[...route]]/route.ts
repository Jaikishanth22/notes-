import { handleRequest } from '../../../server';

export const runtime = 'nodejs'; // Use nodejs environment to support pg pool and bcryptjs

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const DELETE = handleRequest;
export const PATCH = handleRequest;
export const OPTIONS = handleRequest;
