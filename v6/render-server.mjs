import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import app from '../build-v6/app.mjs';

const directory = process.env.EGE_DATA_DIR || '.ege-data';
mkdirSync(directory, {recursive:true});
const sqlite = new DatabaseSync(join(directory,'accounts.sqlite'));
sqlite.exec('PRAGMA journal_mode=WAL');
const schema = readFileSync(new URL('./drizzle/0000_accounts.sql',import.meta.url),'utf8');
sqlite.exec(schema.replace(/CREATE TABLE /gi,'CREATE TABLE IF NOT EXISTS '));

const DB = {
  prepare(sql) {
    const statement = sqlite.prepare(sql);
    return {bind(...values) {
      return {
        first: () => statement.get(...values) || null,
        run: () => ({meta:statement.run(...values)})
      };
    }};
  },
  batch(statements) {
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      const results = statements.map(statement => statement.run());
      sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  }
};

createServer(async (incoming,outgoing) => {
  try {
    if (incoming.url === '/api/health') {
      outgoing.writeHead(200,{'Content-Type':'application/json'});
      return outgoing.end(JSON.stringify({service:'Ege Envanter',version:6}));
    }
    const chunks = [];
    let length = 0;
    for await (const chunk of incoming) {
      length += chunk.length;
      if (length > 16384) { outgoing.writeHead(413); return outgoing.end(); }
      chunks.push(chunk);
    }
    const request = new Request('http://localhost'+incoming.url,{
      method:incoming.method,headers:incoming.headers,
      body:['GET','HEAD'].includes(incoming.method)?undefined:Buffer.concat(chunks)
    });
    const response = await app.fetch(request,{DB});
    outgoing.writeHead(response.status,Object.fromEntries(response.headers));
    outgoing.end(incoming.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error('V6 request failed',error.name);
    outgoing.writeHead(500); outgoing.end();
  }
}).listen(Number(process.env.PORT || 3000),'0.0.0.0',()=>console.log('Ege Envanter V6 hazır'));
