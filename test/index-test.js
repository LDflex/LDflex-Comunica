import ComunicaEngine from '../src';

describe('The main export', () => {
  it('is a function', () => {
    expect(ComunicaEngine).toBeInstanceOf(Function);
  });
});
