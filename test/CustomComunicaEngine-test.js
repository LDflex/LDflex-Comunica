import ComunicaEngine from '../src/ComunicaEngine';

import { readAll } from './util';
import { namedNode, quad } from '@rdfjs/data-model';
import { newEngine as localFileEngine } from '@comunica/actor-init-sparql-file';
import { newEngine as rdfjsFileEngine } from '@comunica/actor-init-sparql-rdfjs';
import { Store } from 'n3';
import path from 'path';

const SELECT_TYPES = `
  SELECT ?subject ?type WHERE {
    ?subject a ?type.
  }
`;

const PROFILE_URL = 'https://www.w3.org/People/Berners-Lee/card#i';

describe('An ComunicaEngine with local file engine configuration', () => {
  const engine = new ComunicaEngine(path.join(__dirname, 'data', 'berners-lee.ttl'), { engine: localFileEngine() });

  it('yields results for a SELECT query with a string URL', async () => {
    const result = engine.execute(SELECT_TYPES);
    expect(await readAll(result)).toHaveLength(6);
  });
});

describe('An ComunicaEngine with local file engine configuration & custom options', () => {
  const engine = new ComunicaEngine([], {
    engine: localFileEngine(),
    options: {
      sources: [path.join(__dirname, 'data', 'berners-lee.ttl')],
    },
  });

  it('yields results for a SELECT query with a string URL', async () => {
    // Need at least one source (not in options) so engine gets called
    const result = engine.execute(SELECT_TYPES, PROFILE_URL);
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

  const engine = new ComunicaEngine([], { engine: rdfjsFileEngine() });

  it('yields results for a SELECT query', async () => {
    const result = engine.execute(SELECT_TYPES, store);
    expect(await readAll(result)).toHaveLength(1);
  });
});
