import redis from 'src/utils/redis';
import { promisify } from 'util';

export const client = redis.createClient(`redis://${process.env.REDIS_URL}`, { password: process.env.REDIS_PASSWORD });
export const getValue = promisify(client.get).bind(client);
export const getKey = promisify(client.keys).bind(client);
export const setValue = promisify(client.set).bind(client);
export const flushdb = promisify(client.flushdb).bind(client);
