/** @jest-environment setup-polly-jest/jest-environment-node */

import { namedNode, quad } from '@rdfjs/data-model';
import { Store } from 'n3';
import ComunicaEngine from '../../src/ComunicaEngine';
const { PathFactory } = require('ldflex');

// The JSON-LD context for resolving properties
const context = {
  '@context': {
    '@vocab': 'http://xmlns.com/foaf/0.1/',
    'friends': 'knows',
  },
};

const ALICE = namedNode('https://alice.org/profile/#me');
const KNOWS = namedNode('http://xmlns.com/foaf/0.1/knows');
const BOB = namedNode('https://bob.org/profile/#me');

describe('A ComunicaEngine instance with one default source', () => {
  let alice;
  let store;

  beforeEach(() => {
    store = new Store();
    const path = new PathFactory({ context, queryEngine: new ComunicaEngine(store) });
    alice = path.create({ subject: ALICE });
  });

  it('supports .add handler', async () => {
    await alice.friends.add(BOB);
    expect(store.has(quad(ALICE, KNOWS, BOB))).toBe(true);
  });
});
