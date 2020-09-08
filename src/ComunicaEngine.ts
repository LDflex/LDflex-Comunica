// @ts-ignore
import DefaultEngine from '../lib/comunica-engine';
import { newEngine as LocalEngine } from '@comunica/actor-init-sparql-file'
import { NamedNode as RDFNamedNode, Term } from 'rdf-js'
import { ActorInitSparql } from '@comunica/actor-init-sparql/index-browser'
import { IActorQueryOperationOutput } from '@comunica/bus-query-operation'
import { BindingsStream } from '@comunica/bus-query-operation'

type RawSources = URL | NamedNode
type RawSourcesString = RawSources | string
type AllSources = RawSourcesString | RawSourcesString[]

type Source = {
  value: string;
  type: string | null;
  match?: Function;
}

type Sources = Source[]

interface NamedNode extends RDFNamedNode {
  match: Function
}

interface queryResult extends IActorQueryOperationOutput {
  bindingsStream?: BindingsStream
}

/**
 * Asynchronous iterator wrapper for the Comunica SPARQL query engine.
 */
export default class ComunicaEngine {
  private _sources: Promise<Sources>
  private DefaultEngine = DefaultEngine
  private _engine: Promise<ActorInitSparql> = this.DefaultEngine
  private LocalEngine = LocalEngine()
  private _allowEngineChange: boolean = true
  /**
   * Create a ComunicaEngine to query the given default source.
   *
   * The default source can be a single URL, an RDF/JS Datasource,
   * or an array with any of these.
   */
  constructor(defaultSource: Promise<RawSources>, engine?: () => ActorInitSparql) {
    // Preload sources but silence errors; they will be thrown during execution
    this._sources = this.parseSources(defaultSource);
    this._sources.catch(() => null);
    this._engine = this.setEngine(engine)
  }

  private async setEngine(engine?: () => ActorInitSparql) {
    if (engine) {
      this._allowEngineChange = false
      return engine();
    } else if ((await this._sources).length > 0 && (await this._sources).some(location => !isValidURL(location.value)))
      return this.LocalEngine;
    else
      return this.DefaultEngine;
  }

  private async getEngine(sources: Sources) {
    return await this._engine
    if (this._allowEngineChange) {
      return (sources.length > 0 && (sources.some(location => !isValidURL(location.value))))
        ? this.LocalEngine
        : this.DefaultEngine
    } else {
      return await this._engine
    }
  }

  /**
   * Creates an asynchronous iterable of results for the given SPARQL query.
   */
  async* execute(sparql: string, source: Promise<RawSources>): AsyncGenerator<Term, void, undefined> {
    // Load the sources if passed, the default sources otherwise    
    const sources = await (source ? this.parseSources(source) : this._sources);

    if ((/^\s*(?:INSERT|DELETE)/i).test(sparql))
      yield* this.executeUpdate(sparql, source);

    if (sources.length !== 0) {
      // Execute the query and yield the results
      const queryResult: queryResult = await (await this.getEngine(sources)).query(sparql, { sources });
      yield* this.streamToAsyncIterable(queryResult.bindingsStream as BindingsStream);
    }
  }

  /**
   * Creates an asynchronous iterable with the results of the SPARQL UPDATE query.
   */
  async* executeUpdate(sparql: string, source: Promise<AllSources> | AllSources) {
    throw new Error(`SPARQL UPDATE queries are unsupported, received: ${sparql}`);
  }

  /**
   * Parses the source(s) into an array of Comunica sources.
   */
  async parseSources(source: Promise<AllSources> | AllSources): Promise<Sources> {
    let sources: AllSources = await source;
    if (!sources)
      return [];

    // Transform URLs or terms into strings
    if (sources instanceof URL)
      sources = sources.href;
    else if (typeof sources === 'object' && 'termType' in sources && sources.termType === 'NamedNode')
      sources = sources.value;

    let allSources;
    // Strip the fragment off a URI
    if (typeof sources === 'string')
      allSources = [sources.replace(/#.*/, '')];
    // Flatten recursive calls to this function
    else if (Array.isArray(sources))
      allSources = await flattenAsync(sources.map(s => this.parseSources(s)));
    // Needs to be after the string check since those also have a match functions
    else if (typeof sources === 'object' && 'match' in sources && typeof sources.match === 'function')
      allSources = [Object.assign({ type: 'rdfjsSource' }, sources)];
    // Wrap a single source in an array
    else if (typeof source === 'object' && 'value' in source && typeof source.value === 'string')
      allSources = [sources];
    // Error on unsupported sources
    else
      throw new Error(`Unsupported source: ${source}`);

    // Add Comunica source details
    return (allSources as Array<string | NamedNode | Source>).map(src => ({
      value: (typeof src === 'object') ? (src.value ?? src) : src,
      type: (typeof src === 'object' && 'type' in src) ? src.type : null
    }));
  }

  /**
   * Transforms the readable into an asynchronously iterable object
   */
  streamToAsyncIterable(readable: BindingsStream): AsyncIterableIterator<Term> {
    // Track errors even when no next item is being requested
    let pendingError: Error | null;
    readable.once('error', error => pendingError = error);
    // Return a asynchronous iterable
    return {
      next: () => new Promise(readNext),
      [Symbol.asyncIterator]() { return this; },
    };

    // Reads the next item
    function readNext(resolve: (obj: IteratorResult<Term, any>) => void, reject: (err: Error) => void) {
      if (pendingError)
        return reject(pendingError);
      if (readable.ended)
        return resolve({ done: true, value: null });

      // Attach stream listeners
      readable.on('data', yieldValue);
      readable.on('end', finish);
      readable.on('error', finish);

      // Outputs the value through the iterable
      function yieldValue(value: Term) {
        finish(null, value, true);
      }
      // Clean up, and reflect the state in the iterable
      function finish(error: Error | null, value: Term, pending: boolean) {
        readable.removeListener('data', yieldValue);
        readable.removeListener('end', finish);
        readable.removeListener('error', finish);
        return error ? reject(error) : resolve({ value, done: !pending });
      }
    }
  }

  /**
   * Removes the given document (or all, if not specified) from the cache,
   * such that fresh results are obtained next time.
   */
  async clearCache(document: string) {
    await (await this._engine).invalidateHttpCache(document);
    await this.LocalEngine.invalidateHttpCache(document);
    await this.DefaultEngine.invalidateHttpCache(document);
  }
}

// Flattens the given array one level deep
async function flattenAsync<T = any>(array: Promise<T>[]): Promise<(T extends readonly (infer InnerArr)[] ? InnerArr : T)[]> {
  return (await Promise.all(array)).flat()
}

function isValidURL(location: string): boolean {
  try { new URL(location); return true }
  catch { return false }
}