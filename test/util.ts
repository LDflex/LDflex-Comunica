/** @jest-environment setup-polly-jest/jest-environment-node */

import { resolve } from 'path';
import { Polly } from '@pollyjs/core';
import { setupPolly } from 'setup-polly-jest';
import FSPersister from '@pollyjs/persister-fs';
import NodeHttpAdapter from '@pollyjs/adapter-node-http';

const recordingsDir = resolve(__dirname, './assets/http');

Polly.register(FSPersister);
Polly.register(NodeHttpAdapter);

// Mocks HTTP requests using Polly.JS
export function mockHttp() {
  return setupPolly({
    adapters: [NodeHttpAdapter],
    persister: FSPersister,
    persisterOptions: { fs: { recordingsDir } },
    recordFailedRequests: true,
    mode: 'replay',
  });
}

export async function readAll<T>(asyncIterator: AsyncIterableIterator<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of asyncIterator)
    items.push(item);
  return items;
}
