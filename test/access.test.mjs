// HTTP 路由先过 DSH 自己的访问检查（connection.requestRejection），拿不到这个服务就一律拒绝。
// 用一个假的 DSH 上下文走 apply()，钉住的是真实的接线，而不只是帮手函数。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { apply, inject, dshAccessCheck } from '../index.mjs';

function fakeContext(connection) {
  const routes = [];
  const disposers = [];
  const ctx = {
    logger: () => ({ info() {}, warn() {}, error() {} }),
    webServer: { register(route) { routes.push(route); return () => {}; } },
    tools: { register() {} },
    effect(fn) { const dispose = fn(); if (typeof dispose === 'function') disposers.push(dispose); },
    get(name) { return name === 'connection' ? connection : undefined; },
  };
  return { ctx, routes, dispose: () => disposers.forEach(fn => fn()) };
}

function call(handler, { method = 'GET', url = '/sansheng-liubu/state', headers = {}, body = '' } = {}) {
  return new Promise(resolve => {
    const res = {
      status: 0, text: '',
      writeHead(code) { this.status = code; },
      end(text) { this.text = text || ''; resolve(this); },
    };
    const req = {
      method, url, headers: { host: 'localhost:7000', ...headers },
      on(event, cb) { if (event === 'data' && body) cb(Buffer.from(body)); if (event === 'end') cb(); },
    };
    handler(req, res);
  });
}

const dataDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'access-data-'));

test('the plugin asks DSH for its connection service', () => {
  assert.ok(inject.includes('connection'));
});

test('every route goes through DSH\'s own access check first, reads included', async () => {
  const seen = [];
  const connection = { requestRejection: req => { seen.push(req.headers.cookie || ''); return req.headers.cookie === 'session=ok' ? undefined : 401; } };
  const { ctx, routes, dispose } = fakeContext(connection);
  apply(ctx, { dataDir: dataDir() });
  assert.equal(routes.length, 1);
  const handler = routes[0].handler;

  const denied = await call(handler);
  assert.equal(denied.status, 401, 'a GET without DSH\'s approval is refused');
  const deniedWrite = await call(handler, { method: 'POST', url: '/sansheng-liubu/edicts', headers: { 'content-type': 'application/json' }, body: '{"brief":"x"}' });
  assert.equal(deniedWrite.status, 401);

  const allowed = await call(handler, { headers: { cookie: 'session=ok' } });
  assert.equal(allowed.status, 200);
  assert.ok(JSON.parse(allowed.text).agents, 'state comes back once DSH lets the request through');
  // 放行之后仍过插件自己的检查：改状态只收 JSON
  const form = await call(handler, { method: 'POST', url: '/sansheng-liubu/probe-all', headers: { cookie: 'session=ok', 'content-type': 'text/plain' } });
  assert.equal(form.status, 403);
  assert.deepEqual(seen.slice(0, 2), ['', '']);
  dispose();
});

test('without the connection service every request is refused (fail closed)', async () => {
  const { ctx, routes, dispose } = fakeContext(undefined);
  apply(ctx, { dataDir: dataDir() });
  const res = await call(routes[0].handler);
  assert.equal(res.status, 403);
  dispose();
  // 检查本身抛错也按拒绝处理
  const broken = dshAccessCheck({ get: () => ({ requestRejection() { throw new Error('boom'); } }) });
  assert.equal(broken({ headers: {} }), 403);
  assert.equal(dshAccessCheck({ connection: { requestRejection: () => undefined } })({ headers: {} }), undefined, 'ctx.connection works when ctx.get is missing');
});
