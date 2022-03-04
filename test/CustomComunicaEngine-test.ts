import ComunicaEngine from '../src/ComunicaEngine';

import { readAll } from './util';
import { QueryEngine as LocalFileEngine } from '@comunica/query-sparql-file';
import { QueryEngine as RdfjsFileEngine } from '@comunica/query-sparql-rdfjs';
import { Store, DataFactory } from 'n3';
const { namedNode, quad } = DataFactory;
import path from 'path';

const SELECT_TYPES = `
  SELECT ?subject ?type WHERE {
    ?subject a ?type.
  }
`;

describe('An ComunicaEngine with local file engine configuration', () => {
  const engine = new ComunicaEngine(path.join(__dirname, 'data', 'berners-lee.ttl'), { engine: new LocalFileEngine() });

  it('yields results for a SELECT query with a string URL', async () => {
    const result = engine.execute(SELECT_TYPES);
    expect(await readAll(result)).toHaveLength(6);
  });
});

describe('An ComunicaEngine with local file engine configuration & custom options', () => {
  const engine = new ComunicaEngine([], {
    engine: new LocalFileEngine(),
    options: {
      sources: [path.join(__dirname, 'data', 'berners-lee.ttl')],
    },
  });

  it('yields results for a SELECT query with a string URL', async () => {
    // Need at least one source (not in options) so engine gets called
    const result = engine.execute(SELECT_TYPES, 'http://example.org');
    expect(await readAll(result)).toHaveLength(6);
  });
});

describe('A ComunicaEngine instance with a custom rdfjs engine', () => {
  const store = new Store([
    quad(
      namedNode('http://example.org/Jesse'),
      namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      namedNode('http://xmlns.com/foaf/0.1/Person'),
    ),
  ]);

  const engine = new ComunicaEngine([], { engine: new RdfjsFileEngine() });

  it('yields results for a SELECT query', async () => {
    const result = engine.execute(SELECT_TYPES, store);
    expect(await readAll(result)).toHaveLength(1);
  });
});
