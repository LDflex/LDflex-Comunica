/** @jest-environment setup-polly-jest/jest-environment-node */


import ComunicaEngine from '../src/ComunicaEngine';

import { mockHttp, readAll } from './util';
import { Store, DataFactory } from 'n3';
const { namedNode, quad } = DataFactory;

const SELECT_TYPES = `
  SELECT ?subject ?type WHERE {
    ?subject a ?type.
  }
`;

const PROFILE_URL = 'https://www.w3.org/People/Berners-Lee/card#i';
const OTHER_PROFILE_URL = 'https://ruben.verborgh.org/#me';

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
    expect(person.has('subject')).toBe(true);
    expect(person.has('type')).toBe(true);
    expect<boolean | undefined>(person.get('subject')?.equals(
      namedNode(PROFILE_URL))).toBe(true);
    expect<boolean | undefined>(person.get('type')?.equals(
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
    expect(items).toHaveLength(30);
  });

  it('yields results for a SELECT query with an RDF/JS source', async () => {
    const source = new Store([
      quad(
        namedNode(PROFILE_URL),
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://xmlns.com/foaf/0.1/Person'),
      ),
      quad(
        namedNode(PROFILE_URL),
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://xmlns.com/foaf/0.1/Agent'),
      ),
    ]);

    jest.spyOn(source, 'match');

    // Count query results
    const result = engine.execute(SELECT_TYPES, source);
    const items = await readAll(result);
    expect(items).toHaveLength(2);

    // Verify correct usage of source
    expect(source.match).toHaveBeenCalledWith(undefined, expect.objectContaining({ termType: 'NamedNode', value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' }), undefined, expect.objectContaining({ termType: 'DefaultGraph', value: '' }));
    expect(source.match).toHaveBeenCalledTimes(1);
  });

  it('throws an error with an unsupported source', async () => {
    const source = { toString: () => 'my source' };
    // @ts-expect-error
    const result = engine.execute(SELECT_TYPES, source);
    await expect(readAll(result)).rejects
      .toThrow('Unsupported source: my source');
  });

  it('throws an error with an invalid query', async () => {
    const result = engine.execute('INVALID QUERY', PROFILE_URL);
    await expect(readAll(result)).rejects.toThrow('Parse error');
  });

  it('clears the cache for a given document', async () => {
    // @ts-ignore set up mock
    const internalEngine = engine.engine;
    const invalidateHttpCache = jest.fn();
    // @ts-ignore
    engine.engine = { invalidateHttpCache };

    // check success call
    invalidateHttpCache.mockReturnValue(Promise.resolve('ignored'));
    await expect(engine.clearCache(PROFILE_URL)).resolves.toBeUndefined();
    expect(invalidateHttpCache).toHaveBeenCalledTimes(1);
    expect(invalidateHttpCache).toHaveBeenCalledWith(PROFILE_URL);

    // check error is awaited
    invalidateHttpCache.mockReturnValue(Promise.reject(new Error('my error')));
    await expect(engine.clearCache(PROFILE_URL)).rejects.toThrow('my error');

    // @ts-ignore remove mock
    engine.engine = internalEngine;
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

describe('A ComunicaEngine instance with an rdfjs source (in list)', () => {
  const store = new Store([
    quad(
      namedNode('http://example.org/Jesse'),
      namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      namedNode('http://xmlns.com/foaf/0.1/Person'),
    ),
  ]);

  const engine = new ComunicaEngine([store]);

  it('yields results for a SELECT query', async () => {
    const result = engine.execute(SELECT_TYPES);
    expect(await readAll(result)).toHaveLength(1);
  });
});

describe('A ComunicaEngine instance with an rdfjs source', () => {
  const store = new Store([
    quad(
      namedNode('http://example.org/Jesse'),
      namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      namedNode('http://xmlns.com/foaf/0.1/Person'),
    ),
  ]);

  const engine = new ComunicaEngine(store);

  it('yields results for a SELECT query', async () => {
    const result = engine.execute(SELECT_TYPES);
    expect(await readAll(result)).toHaveLength(1);
  });
});

describe('A ComunicaEngine instance with an rdfjs source (as input to execute)', () => {
  const store = new Store([
    quad(
      namedNode('http://example.org/Jesse'),
      namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      namedNode('http://xmlns.com/foaf/0.1/Person'),
    ),
  ]);

  const engine = new ComunicaEngine();

  it('yields results for a SELECT query', async () => {
    const result = engine.execute(SELECT_TYPES, store);
    expect(await readAll(result)).toHaveLength(1);
  });
});

describe('An ComunicaEngine instance with a default source that errors', () => {
  const engine = new ComunicaEngine(Promise.reject(new Error('my error')));

  it('throws the error upon execution', async () => {
    const result = engine.execute(SELECT_TYPES);
    await expect(readAll(result)).rejects.toThrow('my error');
  });
});

describe('Erroring on unsupported query types', () => {
  const engine = new ComunicaEngine();

  it('throws the error upon execution', async () => {
    const result = engine.execute('CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }', PROFILE_URL);
    await expect(readAll(result)).rejects.toThrow("Query result type 'bindings' was expected, while 'quads' was found.");
  });
});
