import ComunicaEngine from '../src/ComunicaEngine';

import { readAll } from './util';
import { namedNode, quad } from '@rdfjs/data-model';
import { newEngine as localFileEngine } from '@comunica/actor-init-sparql-file';
import { newEngine as rdfjsFileEngine } from '@comunica/actor-init-sparql-rdfjs';
import { Store } from 'n3';
import path from 'path';
import http from 'http';
import { ProxyHandlerStatic } from "@comunica/actor-http-proxy";

const SELECT_TYPES = `
  SELECT ?subject ?type WHERE {
    ?subject a ?type.
  }
`;

// describe('Testing proxy', () => {
//   function requestListener(req, res) {
//     console.log('request recieved')
//     res.writeHead(200);
//     res.end('Hello, World!');
//   }

//   const requestListenerSpy = jest.s

//   const server = http.createServer(requestListenerSpy);
//   beforeEach(() => {
//     server.listen(8080);
//   });

//   afterEach(() => {
//     server.close();
//   });

//   const engine = new ComunicaEngine(
//     'https://www.w3.org/People/Berners-Lee/card#i',
//     {
//       options: {
//         httpProxyHandler: new ProxyHandlerStatic('http://localhost:8080/'),
//       },
//     },
//   );

//   it('yields results for a SELECT query with a string URL', async () => {
//     const result = engine.execute(SELECT_TYPES);
//     expect(requestListenerSpy).toHaveBeenCalled();
//     expect(await readAll(result)).toHaveLength(6);
//   });
// });

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
