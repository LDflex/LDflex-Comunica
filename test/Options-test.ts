import ComunicaEngine from '../src/ComunicaEngine';

import { readAll } from './util';
import { newEngine as localFileEngine } from '@comunica/actor-init-sparql-file';
import path from 'path';

const SELECT_TYPES = `
  SELECT ?subject ?type WHERE {
    ?subject a ?type.
  }
`;

describe('An ComunicaEngine with local file engine configuration', () => {
  const engine = new ComunicaEngine(
    path.join(__dirname, 'data', 'jesse.ttl'),
    {
      engine: localFileEngine(),
      options: {
        baseIRI: 'http://example.org/',
      },
    },
  );

  it('yields results for a SELECT query', async () => {
    const result = await readAll(engine.execute(SELECT_TYPES));
    expect(result).toHaveLength(1);
    expect(result[0].get('?type').value).toEqual('http://example.org/Person');
  });

  it('yields results for a SELECT query with relative URIs', async () => {
    const result = await readAll(engine.execute('SELECT ?subject WHERE { ?subject a <Person> } '));
    expect(result).toHaveLength(1);
    expect(result[0].get('?subject').value).toEqual('http://example.org/Jesse');
  });
});
