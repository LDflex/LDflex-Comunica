import ComunicaEngine from '../src';

describe('The ComunicaEngine module', () => {
  it('exports a function', () => {
    expect(ComunicaEngine).toBeInstanceOf(Function);
  });
});
