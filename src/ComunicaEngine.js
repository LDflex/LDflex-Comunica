const DefaultEngine = require('../lib/comunica-engine');

/**
 * Asynchronous iterator wrapper for the Comunica SPARQL query engine.
 */
export default class ComunicaEngine {
  /**
   * Create a ComunicaEngine to query the given default source.
   *
   * The default source can be a single URL, an RDF/JS Datasource,
   * or an array with any of these.
   */
  constructor(defaultSource) {
    this._engine = DefaultEngine;
    this._sources = this.toComunicaSources(defaultSource);
  }

  /**
   * Creates an asynchronous iterable of results for the given SPARQL query.
   */
  execute(sparql, source) {
    // Comunica does not support SPARQL UPDATE queries yet,
    // so we temporarily throw an error for them.
    if (sparql.startsWith('INSERT') || sparql.startsWith('DELETE'))
      return this.executeUpdate(sparql);

    // Create an iterator function that reads the next binding
    let bindings;
    const next = async () => {
      if (!bindings) {
        // Execute the query and retrieve the bindings
        const sources = await (source ? this.toComunicaSources(source) : this._sources);
        const queryResult = await this._engine.query(sparql, { sources });
        bindings = queryResult.bindingsStream;
      }
      return new Promise(readNextBinding);
    };
    return {
      next,
      [Symbol.asyncIterator]() { return this; },
    };

    // Reads the next binding
    function readNextBinding(resolve) {
      const done = () => resolve({ done: true });
      // Mark the iterator as done when the source has ended
      if (bindings.ended) {
        done();
      }
      else {
        // Wait for either the data or the end event
        bindings.once('data', data => {
          resolve({ value: data });
          bindings.removeListener('end', done);
        });
        bindings.on('end', done);
      }
    }
  }

  /**
   * Creates an asynchronous iterable with the results of the SPARQL UPDATE query.
   */
  executeUpdate(sparql, source) {
    throw new Error(`Comunica does not support SPARQL UPDATE queries, received: ${sparql}`);
  }

  /**
   * Parses the source(s) into an array of Comunica sources.
   */
  async toComunicaSources(source) {
    let sources = await source;
    if (!sources)
      return null;
    // Strip the fragment of a URI
    if (typeof sources.value === 'string')
      sources = sources.value;
    if (typeof sources === 'string')
      sources = [sources.replace(/#.*/, '')];
    // Await multiple promises in an array
    else if (Array.isArray(sources))
      sources = await Promise.all(sources);
    // Wrap a single source in an array
    else
      sources = [sources];
    // Add Comunica source details
    return sources.map(value => ({
      value,
      type: typeof value === 'string' ? 'file' : 'rdfjsSource',
    }));
  }
}
