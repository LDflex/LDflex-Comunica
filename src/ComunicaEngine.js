import { newEngine } from '@comunica/actor-init-sparql-solid';

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
  constructor(defaultSource, settings = {}) {
    this._engine = settings.engine ? settings.engine : newEngine();
    // Preload sources but silence errors; they will be thrown during execution
    this._sources = this.parseSourcesSilent(defaultSource);
    this._destination = settings.destination && this.parseSourcesSilent(settings.destination);
    this._options = settings.options ? settings.options : {};
  }

  parseSourcesSilent(sources) {
    const parsedSources = this.parseSources(sources);
    parsedSources.catch(() => null);
    return parsedSources;
  }

  /**
   * Creates an asynchronous iterable of results for the given SPARQL query.
   */
  async* execute(sparql, source) {
    // Load the sources if passed, the default sources otherwise
    const sources = await this.parseSources(source, this._sources);

    if ((/^\s*(?:INSERT|DELETE)/i).test(sparql)) {
      yield* this.executeUpdate(sparql, source);
    }
    else if (sources.length !== 0) {
      // Execute the query and yield the results
      const queryResult = await this._engine.query(sparql, { sources, ...this._options });
      yield* this.streamToAsyncIterable(queryResult.bindingsStream);
    }
  }

  /**
   * Creates an asynchronous iterable with the results of the SPARQL UPDATE query.
   */
  async* executeUpdate(sparql, source) {
    let sources;
    // Need to await the destination
    const destination = await this._destination;

    // Set the appropriate destination
    if (!source && destination) {
      if (destination.length !== 1)
        throw new Error(`Destination must be a single source, not ${destination.length}`);

      sources = destination;
    }
    else {
      // Load the sources if passed, the default sources otherwise
      const _sources = await this.parseSources(source, this._sources);

      if (_sources.length === 0)
        throw new Error('At least one source must be specified: Updates are inserted into the first given data source if no destination is specified, or if using explicit sources for query');

      sources = [_sources[0]];
    }

    // Execute the query and yield the results
    const queryResult = await this._engine.query(sparql, { sources, ...this._options });
    if (queryResult.type !== 'update')
      throw new Error(`Update query returned unexpected result type: ${queryResult.type}`);

    // Resolves when the update is complete
    return queryResult.updateResult;
  }

  /**
   * Parses the source(s) into an array of Comunica sources.
   */
  async parseSources(source, defaultSources = []) {
    let sources = await source;
    if (!sources)
      return defaultSources;

    // Transform URLs or terms into strings
    if (sources instanceof URL)
      sources = sources.href;
    else if (sources.termType === 'NamedNode')
      sources = sources.value;

    // Strip the fragment off a URI
    if (typeof sources === 'string')
      sources = [sources.replace(/#.*/, '')];
    // Flatten recursive calls to this function
    else if (Array.isArray(sources))
      sources = await flattenAsync(sources.map(s => this.parseSources(s)));
    // Needs to be after the string check since those also have a match functions
    else if (typeof sources.match === 'function')
      sources = [assign({ type: 'rdfjsSource' }, sources)];
    // Wrap a single source in an array
    else if (typeof source.value === 'string')
      sources = [sources];
    // Error on unsupported sources
    else
      throw new Error(`Unsupported source: ${source}`);

    // Add Comunica source details
    return sources.map(src => ({
      value: src.value || src,
      type: src.type,
    }));
  }

  /**
   * Transforms the readable into an asynchronously iterable object
   */
  streamToAsyncIterable(readable) {
    let done = false;
    let pendingError;
    let pendingPromise;

    readable.on('readable', settlePromise);
    readable.on('error', finish);
    readable.on('end', finish);

    return {
      next: () => new Promise(trackPromise),
      [Symbol.asyncIterator]() { return this; },
    };

    function trackPromise(resolve, reject) {
      pendingPromise = { resolve, reject };
      settlePromise();
    }

    function settlePromise() {
      // Finish if the stream errored or ended
      if (done || pendingError) {
        finish();
      }
      // Try to resolve the promise with a value
      else if (pendingPromise) {
        const value = readable.read();
        if (value !== null) {
          pendingPromise.resolve({ value });
          pendingPromise = null;
        }
      }
    }

    function finish(error) {
      // Finish with or without an error
      if (!pendingError) {
        done = true;
        pendingError = error;
      }
      // Try to emit the result
      if (pendingPromise) {
        if (!pendingError)
          pendingPromise.resolve({ done });
        else
          pendingPromise.reject(pendingError);
        pendingPromise = null;
      }
      // Detach listeners
      readable.on('readable', settlePromise);
      readable.on('error', finish);
      readable.on('end', finish);
    }
  }

  /**
   * Removes the given document (or all, if not specified) from the cache,
   * such that fresh results are obtained next time.
   */
  async clearCache(document) {
    await this._engine.invalidateHttpCache(document);
  }
}

/**
 * Extends Object.assign by also copying prototype methods
 * @param {Object} props To add to the object
 * @param {Object} orig Original Object
 * @returns Copy of original object with added props
 */
function assign(props, orig) {
  // https://stackoverflow.com/questions/41474986/how-to-clone-a-javascript-es6-class-instance
  return Object.assign(Object.create(orig), { ...orig, ...props });
}

// Flattens the given array one level deep
async function flattenAsync(array) {
  return [].concat(...(await Promise.all(array)));
}
