/** @jest-environment setup-polly-jest/jest-environment-node */

import { Store, DataFactory } from 'n3';
import ComunicaEngine from '../../src/ComunicaEngine';
const { PathFactory } = require('ldflex');

const { namedNode, quad } = DataFactory;

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
  let alice: any;
  let store: any;

  beforeEach(() => {
    store = new Store([quad(ALICE, KNOWS, BOB)]);
    const path = new PathFactory({ context, queryEngine: new ComunicaEngine(store) });
    alice = path.create({ subject: ALICE });
  });

  it('testing basic path traversal', async () => {
    expect(`${await alice.friends}`).toEqual(BOB.value);
  });
});
