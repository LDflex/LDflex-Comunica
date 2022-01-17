/** @jest-environment setup-polly-jest/jest-environment-node */


import { namedNode, quad } from '@rdfjs/data-model';
import { Store } from 'n3';
import ComunicaEngine from '../src/ComunicaEngine';
import { mockHttp, readAll } from './util';

const SELECT_TYPES = `
  SELECT ?subject ?type WHERE {
    ?subject a ?type.
  }
`;

describe('A ComunicaEngine instance without default source', () => {
  const engine = new ComunicaEngine();

  mockHttp();

  it('supports INSERT queries', async () => {
    const store = new Store();
    const result = engine.execute('INSERT DATA { <http://a> <http://b> <http://c> }', store);
    const data = await readAll(result);
    expect(data).toEqual([]);
    expect(store.has(quad(
      namedNode('http://a'),
      namedNode('http://b'),
      namedNode('http://c'),
    ))).toBe(true);
  });

  it('supports INSERT queries (multiple sources)', async () => {
    const store = new Store();
    const result = engine.execute('INSERT DATA { <http://a> <http://b> <http://c> }', [store, new Store()]);
    const data = await readAll(result);
    expect(data).toEqual([]);
    expect(store.has(quad(
      namedNode('http://a'),
      namedNode('http://b'),
      namedNode('http://c'),
    ))).toBe(true);
  });

  it('supports INSERT queries (no sources)', async () => {
    const result = engine.execute('INSERT DATA { <http://a> <http://b> <http://c> }');
    const data = await readAll(result);
    expect(data).toEqual([]);
  });

  it('supports DELETE queries', async () => {
    const store = new Store();
    const result = engine.execute(' delete data { <http://a> <http://b> <http://c> }', store);
    const data = await readAll(result);
    expect(data).toEqual([]);
    expect(store.has(quad(
      namedNode('http://a'),
      namedNode('http://b'),
      namedNode('http://c'),
    ))).toBe(false);
  });

  it('executeUpdate errors on SELECT query', async () => {
    const store = new Store();
    const result = engine.executeUpdate(SELECT_TYPES, store);
    await expect(readAll(result)).rejects.toThrow('Update query returned unexpected result type: bindings');
  });
});


describe('A ComunicaEngine instance with one default source', () => {
  let engine: ComunicaEngine;
  let store: Store;

  beforeEach(() => {
    store = new Store();
    engine = new ComunicaEngine(store);
  });

  it('supports INSERT queries', async () => {
    const result = engine.execute('INSERT DATA { <http://a> <http://b> <http://c> }');
    const data = await readAll(result);
    expect(data).toEqual([]);
    expect(store.has(quad(
      namedNode('http://a'),
      namedNode('http://b'),
      namedNode('http://c'),
    ))).toBe(true);
  });

  it('supports DELETE queries', async () => {
    const result = engine.execute(' delete data { <http://a> <http://b> <http://c> }');
    const data = await readAll(result);
    expect(data).toEqual([]);
    expect(store.has(quad(
      namedNode('http://a'),
      namedNode('http://b'),
      namedNode('http://c'),
    ))).toBe(false);
  });

  it('executeUpdate errors on SELECT query', async () => {
    const result = engine.executeUpdate(SELECT_TYPES);
    await expect(readAll(result)).rejects.toThrow('Update query returned unexpected result type: bindings');
  });
});


describe('A ComunicaEngine instance with one default source and different update source', () => {
  let engine: ComunicaEngine;
  let store: Store;
  let updateStore: Store;

  beforeEach(() => {
    store = new Store();
    updateStore = new Store();
    engine = new ComunicaEngine(store, {
      destination: updateStore,
    });
  });

  it('supports INSERT queries', async () => {
    const result = engine.execute('INSERT DATA { <http://a> <http://b> <http://c> }');
    const data = await readAll(result);
    expect(data).toEqual([]);
    expect(updateStore.has(quad(
      namedNode('http://a'),
      namedNode('http://b'),
      namedNode('http://c'),
    ))).toBe(true);
    expect(store.getQuads(null, null, null, null)).toEqual([]);
  });

  it('supports DELETE queries', async () => {
    const result = engine.execute(' delete data { <http://a> <http://b> <http://c> }');
    const data = await readAll(result);
    expect(data).toEqual([]);
    expect(updateStore.has(quad(
      namedNode('http://a'),
      namedNode('http://b'),
      namedNode('http://c'),
    ))).toBe(false);
    expect(store.getQuads(null, null, null, null)).toEqual([]);
  });

  it('executeUpdate errors on SELECT query', async () => {
    const result = engine.executeUpdate(SELECT_TYPES);
    await expect(readAll(result)).rejects.toThrow('Update query returned unexpected result type: bindings');
    expect(store.getQuads(null, null, null, null)).toEqual([]);
  });
});
