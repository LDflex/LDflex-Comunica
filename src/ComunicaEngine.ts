import { newEngine } from '@comunica/actor-init-sparql-solid';
import type { ActorInitSparql } from '@comunica/actor-init-sparql';
import type { DataSources, IDataSource } from '@comunica/bus-rdf-resolve-quad-pattern';
import type * as RDF from '@rdfjs/types';
import type { BindingsStream, Bindings } from '@comunica/types';

export type DataSource = URL | RDF.NamedNode | IDataSource;

// Change over to this type once https://github.com/microsoft/TypeScript/issues/47208#issuecomment-1014128087 is resolved
// export type RawDataSources = DataSource | Promise<RawDataSources> | RawDataSources[];
export type MaybePromiseArray<T> = T | T[] | Promise<T>;
export type NestPromiseArray<T> = MaybePromiseArray<MaybePromiseArray<MaybePromiseArray<MaybePromiseArray<MaybePromiseArray<T>>>>>
export type RawDataSources = NestPromiseArray<DataSource>;

export interface IEngineSettings {
  engine?: ActorInitSparql;
  destination?: RawDataSources;
  options?: any;
}

/**
 * Asynchronous iterator wrapper for the Comunica SPARQL query engine.
 */
export default class ComunicaEngine {
  private _sources: Promise<DataSources>;

  private _engine: ActorInitSparql;

  private _options: any;

  private _destination: Promise<DataSources> | undefined;

  /**
   * Create a ComunicaEngine to query the given default source.
   *
   * The default source can be a single URL, an RDF/JS Datasource,
   * or an array with any of these.
   */
  constructor(defaultSource?: RawDataSources, settings: IEngineSettings = {}) {
    this._engine = settings.engine ?? newEngine();
    // Preload sources but silence errors; they will be thrown during execution
    this._sources = this.parseSourcesSilent(defaultSource);
    this._destination = settings.destination ? this.parseSourcesSilent(settings.destination) : undefined;
    this._options = settings.options ?? {};
  }

  parseSourcesSilent(sources?: RawDataSources) {
    const parsedSources = this.parseSources(sources);
    parsedSources.catch(() => null);
    return parsedSources;
  }

  /**
   * Creates an asynchronous iterable of results for the given SPARQL query.
   */
  async* execute(sparql: string, source?: RawDataSources): AsyncIterableIterator<Bindings> {
    // Load the sources if passed, the default sources otherwise
    const sources = await this.parseSources(source, this._sources);

    if ((/^\s*(?:INSERT|DELETE)/i).test(sparql)) {
      yield* this.executeUpdate(sparql, source);
    }
    else if (sources.length !== 0) {
      // Execute the query and yield the results
      const queryResult = await this._engine.query(sparql, { sources, ...this._options });
      if (queryResult.type !== 'bindings')
        throw new Error(`Query returned unexpected result type: ${queryResult.type}`);

      yield* this.streamToAsyncIterable(queryResult.bindingsStream);
    }
  }

  /**
   * Creates an asynchronous iterable with the results of the SPARQL UPDATE query.
   */
  async* executeUpdate(sparql: string, source?: RawDataSources): AsyncIterableIterator<never> {
    let sources: DataSources;
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
  private async parseSources(source?: RawDataSources, defaultSources: Promise<DataSources> | DataSources = []): Promise<DataSources> {
    const sources = await source;
    if (!sources)
      return defaultSources;

    // Flatten recursive calls to this function
    if (Array.isArray(sources))
      return flattenAsync(sources.map(s => this.parseSources(s)));

    // Strip the fragment off a URI
    if (typeof sources === 'string')
      return [{ value: sources.replace(/#.*/, '') }];

    // Transform URLs or terms into strings
    if (sources instanceof URL)
      return [{ value: sources.href.replace(/#.*/, '') }];
    if ('termType' in sources && sources.termType === 'NamedNode')
      return [{ value: sources.value.replace(/#.*/, '') }];

    // Needs to be after the string check since those also have a match functions
    if ('match' in sources && typeof sources.match === 'function')
      return [{ value: sources, type: 'rdfjsSource' }];

    // Wrap a single source in an array
    if ('value' in sources && typeof sources.value === 'string')
      return [sources];

    // Error on unsupported sources
    throw new Error(`Unsupported source: ${sources}`);
  }

  /**
   * Transforms the readable into an asynchronously iterable object
   */
  private streamToAsyncIterable(readable: BindingsStream): AsyncIterableIterator<Bindings> {
    let done = false;
    let pendingError: Error | undefined;
    let pendingPromise: { resolve: (bindings: IteratorResult<Bindings>) => void, reject: (err: Error) => void } | null;

    readable.on('readable', settlePromise);
    readable.on('error', finish);
    readable.on('end', finish);

    return {
      next: () => new Promise(trackPromise),
      [Symbol.asyncIterator]() { return this; },
    };

    function trackPromise(resolve: (bindings: IteratorResult<Bindings>) => void, reject: (err: Error) => void) {
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

    function finish(error?: Error) {
      // Finish with or without an error
      if (!pendingError) {
        done = true;
        pendingError = error;
      }
      // Try to emit the result
      if (pendingPromise) {
        if (!pendingError)
          // @ts-ignore
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
  async clearCache(document: string) {
    await this._engine.invalidateHttpCache(document);
  }
}

// Flattens the given array one level deep
async function flattenAsync<T>(array: Promise<T[]>[]) {
  return ([] as T[]).concat(...(await Promise.all(array)));
}
