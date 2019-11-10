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
      return this.executeUpdate(sparql, source);

    // Create an iterator function that reads the next binding
    let bindings;
    const errors = [];
    const next = async () => {
      if (!bindings) {
        // Execute the query and retrieve the bindings
        const sources = await (source ? this.toComunicaSources(source) : this._sources);
        const queryResult = await this._engine.query(sparql, { sources });
        bindings = queryResult.bindingsStream;
        bindings.on('error', error => errors.push(error));
      }
      return new Promise(readNextBinding);
    };
    return {
      next,
      [Symbol.asyncIterator]() { return this; },
    };

    // Reads the next binding
    function readNextBinding(resolve, reject) {
      if (errors.length > 0)
        return reject(errors.shift());

      // Mark the iterator as done when the source has ended
      const done = () => resolve({ done: true });
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
    if (sources instanceof URL)
      sources = sources.href;
    else if (sources.termType === 'NamedNode')
      sources = sources.value;

    if (typeof sources === 'string')
      sources = [sources.replace(/#.*/, '')];
    // Flatten recursive calls to this function
    else if (Array.isArray(sources))
      sources = flatten(await Promise.all(sources.map(this.toComunicaSources)));
    // Needs to be after the string check since those also have a match functions
    else if (sources.match)
      sources = [Object.assign({ type: 'rdfjsSource' }, sources)];
    // Wrap a single source in an array
    else
      sources = [sources];

    // Add Comunica source details
    return sources.map(src => ({
      value: src.value || src,
      type: src.type,
    }));
  }
}

// Flattens the given array one level deep
function flatten(array) {
  return [].concat(...array);
}
