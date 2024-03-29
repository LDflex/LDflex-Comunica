import ComunicaEngine from '../src/ComunicaEngine';

import { readAll } from './util';
import { QueryEngine as LocalFileEngine } from '@comunica/query-sparql-file';
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
      engine: new LocalFileEngine(),
      options: {
        baseIRI: 'http://example.org/',
      },
    },
  );

  it('yields results for a SELECT query', async () => {
    const result = await readAll(engine.execute(SELECT_TYPES));
    expect(result).toHaveLength(1);
    expect<string | undefined>(result[0].get('type')?.value).toEqual('http://example.org/Person');
  });

  it('yields results for a SELECT query with relative URIs', async () => {
    const result = await readAll(engine.execute('SELECT ?subject WHERE { ?subject a <http://example.org/Person> } '));
    expect(result).toHaveLength(1);
    expect<string | undefined>(result[0].get('subject')?.value).toEqual('http://example.org/Jesse');
  });
});
