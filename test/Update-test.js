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

  it('throws error on INSERT queries when no sources are provided', async () => {
    const result = engine.execute('INSERT DATA { <http://a> <http://b> <http://c> }');
    await expect(() => readAll(result)).rejects.toThrowError('At least one source must be specified: Updates are inserted into the first given data source if no destination is specified, or if using explicit sources for query');
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
  let engine;
  let store;

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
  let engine;
  let store;
  let updateStore;

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
    expect(store.getQuads()).toEqual([]);
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
    expect(store.getQuads()).toEqual([]);
  });

  it('executeUpdate errors on SELECT query', async () => {
    const result = engine.executeUpdate(SELECT_TYPES);
    await expect(readAll(result)).rejects.toThrow('Update query returned unexpected result type: bindings');
    expect(store.getQuads()).toEqual([]);
  });
});

describe('A ComunicaEngine instance with one default source and an empty destination', () => {
  let engine;
  let store;
  let updateStore;

  beforeEach(() => {
    store = new Store();
    updateStore = new Store();
    engine = new ComunicaEngine(store, {
      destination: [],
    });
  });

  it('supports INSERT queries when explicit source is provided', async () => {
    const result = engine.execute('INSERT DATA { <http://a> <http://b> <http://c> }', [updateStore]);
    const data = await readAll(result);
    expect(data).toEqual([]);
    expect(updateStore.has(quad(
      namedNode('http://a'),
      namedNode('http://b'),
      namedNode('http://c'),
    ))).toBe(true);
    expect(store.getQuads()).toEqual([]);
  });

  it('supports DELETE queries when explicit source is provided', async () => {
    const result = engine.execute(' delete data { <http://a> <http://b> <http://c> }', [updateStore]);
    const data = await readAll(result);
    expect(data).toEqual([]);
    expect(updateStore.has(quad(
      namedNode('http://a'),
      namedNode('http://b'),
      namedNode('http://c'),
    ))).toBe(false);
    expect(store.getQuads()).toEqual([]);
  });

  it('errors on INSERT queries when no explicit source is provided', async () => {
    const result = engine.execute(' delete data { <http://a> <http://b> <http://c> }');
    await expect(() => readAll(result)).rejects.toThrowError('Destination must be a single source, not 0');
  });

  it('executeUpdate errors on SELECT query', async () => {
    const result = engine.executeUpdate(SELECT_TYPES);
    await expect(() => readAll(result)).rejects.toThrow('Destination must be a single source, not 0');
  });
});


describe('A ComunicaEngine instance with one default source and 2 destinations', () => {
  let engine;
  let store;
  let updateStore;

  beforeEach(() => {
    store = new Store();
    updateStore = new Store();
    engine = new ComunicaEngine(store, {
      destination: [new Store(), new Store()],
    });
  });

  it('supports INSERT queries when explicit source is provided', async () => {
    const result = engine.execute('INSERT DATA { <http://a> <http://b> <http://c> }', [updateStore]);
    const data = await readAll(result);
    expect(data).toEqual([]);
    expect(updateStore.has(quad(
      namedNode('http://a'),
      namedNode('http://b'),
      namedNode('http://c'),
    ))).toBe(true);
    expect(store.getQuads()).toEqual([]);
  });

  it('supports DELETE queries when explicit source is provided', async () => {
    const result = engine.execute(' delete data { <http://a> <http://b> <http://c> }', [updateStore]);
    const data = await readAll(result);
    expect(data).toEqual([]);
    expect(updateStore.has(quad(
      namedNode('http://a'),
      namedNode('http://b'),
      namedNode('http://c'),
    ))).toBe(false);
    expect(store.getQuads()).toEqual([]);
  });

  it('errors on INSERT queries when no explicit source is provided', async () => {
    const result = engine.execute(' delete data { <http://a> <http://b> <http://c> }');
    await expect(() => readAll(result)).rejects.toThrowError('Destination must be a single source, not 2');
  });

  it('executeUpdate errors on SELECT query', async () => {
    const result = engine.executeUpdate(SELECT_TYPES);
    await expect(() => readAll(result)).rejects.toThrow('Destination must be a single source, not 2');
  });
});

