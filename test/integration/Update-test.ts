/** @jest-environment setup-polly-jest/jest-environment-node */

import { Store, DataFactory } from 'n3';
import ComunicaEngine from '../../src/ComunicaEngine';
const { PathFactory } = require('ldflex');

const { namedNode, quad, blankNode } = DataFactory;

// The JSON-LD context for resolving properties
const context = {
  '@context': {
    '@vocab': 'http://xmlns.com/foaf/0.1/',
    'friends': 'knows',
    'friends2': 'knows2',
  },
};

const ALICE = namedNode('https://alice.org/profile/#me');
const KNOWS = namedNode('http://xmlns.com/foaf/0.1/knows');
const KNOWS2 = namedNode('http://xmlns.com/foaf/0.1/knows2');
const BOB = namedNode('https://bob.org/profile/#me');
const BNode = blankNode('b');

describe('A ComunicaEngine instance with one default source', () => {
  let alice: any;
  let store: any;

  describe('#add', () => {
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

  describe('#delete retrieved value', () => {
    beforeEach(() => {
      store = new Store([
        quad(ALICE, KNOWS, BOB),
        quad(ALICE, KNOWS2, BNode),
      ]);
      const path = new PathFactory({ context, queryEngine: new ComunicaEngine([store]) });
      alice = path.create({ subject: ALICE });
    });

    it('with namedNode', async () => {
      const subject = await alice.friends;
      await alice.friends.delete(subject);

      expect(store.has(quad(ALICE, KNOWS, BOB))).toBe(false);
    });

    // Get this working in future
    // it('with bnode', async () => {
    //   const subject = await alice.friends2;
    //   await alice.friends.delete(subject);
    //   expect(store.has(quad(ALICE, KNOWS2, BNode))).toBe(false);
    // });
  });

  describe('#delete retrieved value on federated sources', () => {
    beforeEach(() => {
      store = new Store([
        quad(ALICE, KNOWS, BOB),
        quad(ALICE, KNOWS2, BNode),
      ]);
      const path = new PathFactory({ context, queryEngine: new ComunicaEngine([store, new Store()]) });
      alice = path.create({ subject: ALICE });
    });

    it('with namedNode', async () => {
      const subject = await alice.friends;
      await alice.friends.delete(subject);

      expect(store.has(quad(ALICE, KNOWS, BOB))).toBe(false);
    });

    // Get this working in future
    // it('with bnode', async () => {
    //   const subject = await alice.friends2;
    //   await alice.friends.delete(subject);
    //   expect(store.has(quad(ALICE, KNOWS2, BNode))).toBe(false);
    // });
  });
});

