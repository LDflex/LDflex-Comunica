import { newEngine } from '@comunica/actor-init-sparql';

/**
 * Asynchronous iterator wrapper for the Comunica SPARQL query engine.
 */
export default class ComunicaEngine {
  /**
   * Create a ComunicaEngine to query the given subject.
   */
  constructor(subject) {
    this._subject = subject;
    this._engine = newEngine();
  }

  /**
   * Creates an asynchronous iterator
   * of results for the given SPARQL query.
   */
  execute(sparql) {
    // Create an iterator function that reads the next binding
    let bindings;
    const next = async () => {
      if (!bindings) {
        // Determine the document to query from the subject
        const document = (await this._subject).replace(/#.*/, '');
        const sources = [{ type: 'file', value: document }];

        // Execute the query and retrieve the bindings
        const queryResult = await this._engine.query(sparql, { sources });
        bindings = queryResult.bindingsStream;
      }
      return new Promise(readNextBinding);
    };
    return { next };

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
}
