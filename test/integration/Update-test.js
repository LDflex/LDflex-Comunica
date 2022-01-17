"use strict";
/** @jest-environment setup-polly-jest/jest-environment-node */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const data_model_1 = require("@rdfjs/data-model");
const n3_1 = require("n3");
const ComunicaEngine_1 = __importDefault(require("../../src/ComunicaEngine"));
const { PathFactory } = require('ldflex');
// The JSON-LD context for resolving properties
const context = {
    '@context': {
        '@vocab': 'http://xmlns.com/foaf/0.1/',
        'friends': 'knows',
    },
};
const ALICE = (0, data_model_1.namedNode)('https://alice.org/profile/#me');
const KNOWS = (0, data_model_1.namedNode)('http://xmlns.com/foaf/0.1/knows');
const BOB = (0, data_model_1.namedNode)('https://bob.org/profile/#me');
describe('A ComunicaEngine instance with one default source', () => {
    let alice;
    let store;
    beforeEach(() => {
        store = new n3_1.Store();
        const path = new PathFactory({ context, queryEngine: new ComunicaEngine_1.default(store) });
        alice = path.create({ subject: ALICE });
    });
    it('supports .add handler', () => __awaiter(void 0, void 0, void 0, function* () {
        yield alice.friends.add(BOB);
        expect(store.has((0, data_model_1.quad)(ALICE, KNOWS, BOB))).toBe(true);
    }));
});
