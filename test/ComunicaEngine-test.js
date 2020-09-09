import ComunicaEngine from '../src/ComunicaEngine';

import { mockHttp } from './util';
import { namedNode, defaultGraph } from '@rdfjs/data-model';
import { Readable } from 'stream';

const SELECT_TYPES = `
  SELECT ?subject ?type WHERE {
    ?subject a ?type.
  }
`;

const PROFILE_URL = 'https://www.w3.org/People/Berners-Lee/card#i';
const OTHER_PROFILE_URL = 'https://ruben.inrupt.net/profile/card';

describe('An ComunicaEngine instance without default source', () => {
  const engine = new ComunicaEngine();

  mockHttp();

  it('yields no results for a SELECT query', async () => {
    const result = engine.execute(SELECT_TYPES);
    expect(await readAll(result)).toHaveLength(0);
  });

  it('yields no results for a SELECT query with an empty source', async () => {
    const result = engine.execute(SELECT_TYPES, []);
    expect(await readAll(result)).toHaveLength(0);
  });

  it('yields results for a SELECT query with a string URL', async () => {
    // Check all items
    const result = engine.execute(SELECT_TYPES, PROFILE_URL);
    const items = await readAll(result);
    expect(items).toHaveLength(6);

    // Check individual result binding
    const person = items[4];
    expect(person).toHaveProperty('size', 2);
    expect(person.has('?subject')).toBe(true);
    expect(person.has('?type')).toBe(true);
    expect(person.get('?subject').equals(
      namedNode(PROFILE_URL))).toBe(true);
    expect(person.get('?type').equals(
      namedNode('http://xmlns.com/foaf/0.1/Person'))).toBe(true);
  });

  it('yields results for a SELECT query with a URL', async () => {
    const result = engine.execute(SELECT_TYPES, new URL(PROFILE_URL));
    const items = await readAll(result);
    expect(items).toHaveLength(6);
  });

  it('yields results for a SELECT query with a NamedNode', async () => {
    const result = engine.execute(SELECT_TYPES, namedNode(PROFILE_URL));
    const items = await readAll(result);
    expect(items).toHaveLength(6);
  });

  it('yields results for a SELECT query with a Comunica source', async () => {
    const source = { value: PROFILE_URL };
    const result = engine.execute(SELECT_TYPES, source);
    const items = await readAll(result);
    expect(items).toHaveLength(6);
  });

  it('yields results for a SELECT query with an array', async () => {
    const sources = [[[PROFILE_URL]], Promise.resolve(OTHER_PROFILE_URL)];
    const result = engine.execute(SELECT_TYPES, Promise.resolve(sources));
    const items = await readAll(result);
    expect(items).toHaveLength(9);
  });

  it('yields results for a SELECT query with an RDF/JS source', async () => {
    // Create source with specific result stream
    const stream = new Readable({ objectMode: true });
    stream.push({
      subject: namedNode(PROFILE_URL),
      predicate: namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      object: namedNode('http://xmlns.com/foaf/0.1/Person'),
      graph: defaultGraph,
    });
    stream.push({
      subject: namedNode(PROFILE_URL),
      predicate: namedNode('http://example.org/#custom'),
      object: namedNode('http://xmlns.com/foaf/0.1/Agent'),
      graph: defaultGraph,
    });
    stream.push(null);
    const source = { match: jest.fn(() => stream) };

    // Count query results
    const result = engine.execute(SELECT_TYPES, source);
    const items = await readAll(result);
    expect(items).toHaveLength(2);

    // Verify correct usage of source
    expect(source.match).toHaveBeenCalled();
    expect(source.match.mock.calls[0]).toHaveLength(4);
    expect(source.match.mock.calls[0][0]).toBe(undefined);
    expect(source.match.mock.calls[0][1]
      .equals(namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type')))
      .toBe(true);
    expect(source.match.mock.calls[0][2]).toBe(undefined);
    expect(source.match.mock.calls[0][3]
      .equals(defaultGraph()))
      .toBe(true);
  });

  it('throws an error with an unsupported source', async () => {
    const source = { toString: () => 'my source' };
    const result = engine.execute(SELECT_TYPES, source);
    await expect(readAll(result)).rejects
      .toThrow('Unsupported source: my source');
  });

  it('throws an error with an invalid query', async () => {
    const result = engine.execute('INVALID QUERY', PROFILE_URL);
    await expect(readAll(result)).rejects.toThrow('Parse error');
  });

  it('does not support INSERT queries', async () => {
    const result = engine.execute('INSERT DATA { <a> <b> <c> }', PROFILE_URL);
    await expect(readAll(result)).rejects
      .toThrow('SPARQL UPDATE queries are unsupported, received: INSERT DATA { <a> <b> <c> }');
  });

  it('does not support DELETE queries', async () => {
    const result = engine.execute(' delete data { <a> <b> <c> }', PROFILE_URL);
    await expect(readAll(result)).rejects
      .toThrow('SPARQL UPDATE queries are unsupported, received:  delete data { <a> <b> <c> }');
  });

  it('reads an ended stream', async () => {
    const stream = new Readable();
    stream.ended = true;
    const result = engine.streamToAsyncIterable(stream);
    expect(await readAll(result)).toHaveLength(0);
  });

  it('throws an error when the stream errors before reading starts', async () => {
    const stream = new Readable();
    stream._read = () => {};
    const result = engine.streamToAsyncIterable(stream);
    stream.emit('error', new Error('my error'));
    await expect(readAll(result)).rejects.toThrow('my error');
  });

  it('throws an error when the stream errors after reading has started', async () => {
    const stream = new Readable();
    stream._read = () => {};
    const result = engine.streamToAsyncIterable(stream);
    setImmediate(() => stream.emit('error', new Error('my error')));
    await expect(readAll(result)).rejects.toThrow('my error');
  });

  it('clears the cache for a given document', async () => {
    // set up mock
    const internalEngine = engine._engine;
    const invalidateHttpCache = jest.fn();
    engine._engine = { invalidateHttpCache };

    // check success call
    invalidateHttpCache.mockReturnValue(Promise.resolve('ignored'));
    await expect(engine.clearCache(PROFILE_URL)).resolves.toBeUndefined();
    expect(invalidateHttpCache).toHaveBeenCalledTimes(1);
    expect(invalidateHttpCache).toHaveBeenCalledWith(PROFILE_URL);

    // check error is awaited
    invalidateHttpCache.mockReturnValue(Promise.reject(new Error('my error')));
    await expect(engine.clearCache(PROFILE_URL)).rejects.toThrow('my error');

    // remove mock
    engine._engine = internalEngine;
  });
});

describe('An ComunicaEngine instance with a default source', () => {
  const engine = new ComunicaEngine(PROFILE_URL);

  mockHttp();

  it('yields results for a SELECT query with a string URL', async () => {
    const result = engine.execute(SELECT_TYPES, PROFILE_URL);
    expect(await readAll(result)).toHaveLength(6);
  });
});

describe('An ComunicaEngine instance with a default source that errors', () => {
  const engine = new ComunicaEngine(Promise.reject(new Error('my error')));

  it('throws the error upon execution', async () => {
    const result = engine.execute(SELECT_TYPES);
    await expect(readAll(result)).rejects.toThrow('my error');
  });
});

async function readAll(asyncIterator) {
  const items = [];
  for await (const item of asyncIterator)
    items.push(item);
  return items;
}
