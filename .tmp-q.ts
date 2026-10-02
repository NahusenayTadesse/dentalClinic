import 'dotenv/config';
import mysql from 'mysql2/promise';
const c = await mysql.createConnection({ uri: process.env.DATABASE_URL!, dateStrings: true });
console.log((await c.query(process.argv[2]))[0]);
await c.end();
