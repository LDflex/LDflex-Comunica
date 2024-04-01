import { QueryEngine } from '@comunica/query-sparql-solid';
import type * as RDF from '@rdfjs/types';
import type { Bindings, SourceType } from '@comunica/types';

export type DataSource = URL | RDF.NamedNode | SourceType;
// Change over to this type once https://github.com/microsoft/TypeScript/issues/47208#issuecomment-1014128087 is resolved
// export type RawDataSources = DataSource | Promise<RawDataSources> | RawDataSources[];
export type MaybePromiseArray<T> = T | T[] | Promise<T>;
export type NestPromiseArray<T> = MaybePromiseArray<MaybePromiseArray<MaybePromiseArray<MaybePromiseArray<MaybePromiseArray<T>>>>>
export type RawDataSources = NestPromiseArray<DataSource>;

/**
 * Settings for the ldflex-comunica engine
 */
export interface EngineSettings {

  /**
   * The comunica engine to use
   * @default actor-init-sparql-solid
   */
  engine?: QueryEngine;

  /**
   * The destination to use
   * @default source The first source given
   */
  destination?: RawDataSources;

  /**
   * The context options to give to
   * the comunica engine
   * @default {}
   */
  options?: any;
}

/**
 * Asynchronous iterator wrapper for the Comunica SPARQL query engine.
 */
export default class ComunicaEngine {
  private sources: Promise<SourceType[]>;

  private engine: QueryEngine;

  private options: any;

  private destination: Promise<SourceType[]> | undefined;

  /**
   * Create a ComunicaEngine to query the given default source.
   *
   * The default source can be a single URL, an RDF/JS Datasource,
   * or an array with any of these.
   */
  constructor(defaultSource?: RawDataSources, settings: EngineSettings = {}) {
    this.engine = settings.engine ?? new QueryEngine();
    // Preload sources but silence errors; they will be thrown during execution
    this.sources = this.parseSourcesSilent(defaultSource);
    this.destination = settings.destination ? this.parseSourcesSilent(settings.destination) : undefined;
    this.options = settings.options ?? {};
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
    const sources = await this.parseSources(source, this.sources);

    if ((/^\s*(?:INSERT|DELETE)/i).test(sparql)) {
      yield* this.executeUpdate(sparql, source);
    }
    else if (sources.length !== 0) {
      // Execute the query and yield the results
      for await (const binding of await this.engine.queryBindings(sparql, { sources, ...this.options })) {
        yield new Proxy(binding, {
          get(target, name) {
            if (name === 'values')
              return () => toIterator(binding.values());
            // @ts-ignore
            return target[name];
          },
        });
      }
    }
  }

  /**
   * Creates an asynchronous iterable with the results of the SPARQL UPDATE query.
   */
  async* executeUpdate(sparql: string, source?: RawDataSources): AsyncIterableIterator<never> {
    let sources: SourceType[];
    // Need to await the destination
    const destination = await this.destination;

    // Set the appropriate destination
    if (!source && destination) {
      if (destination.length !== 1)
        throw new Error(`Destination must be a single source, not ${destination.length}`);

      sources = destination;
    }
    else {
      // Load the sources if passed, the default sources otherwise
      const _sources = await this.parseSources(source, this.sources);

      if (_sources.length === 0)
        throw new Error('At least one source must be specified: Updates are inserted into the first given data source if no destination is specified, or if using explicit sources for query');

      sources = [_sources[0]];
    }

    // Resolves when the update is complete
    return this.engine.queryVoid(sparql, { sources, ...this.options });
  }

  /**
   * Parses the source(s) into an array of Comunica sources.
   */
  private async parseSources(source?: RawDataSources, defaultSources: Promise<SourceType[]> | SourceType[] = []): Promise<SourceType[]> {
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
      return [sources];

    // Wrap a single source in an array
    if ('value' in sources && typeof sources.value === 'string')
      return [sources];

    // Error on unsupported sources
    throw new Error(`Unsupported source: ${sources}`);
  }

  /**
   * Removes the given document (or all, if not specified) from the cache,
   * such that fresh results are obtained next time.
   */
  async clearCache(document?: string) {
    await this.engine.invalidateHttpCache(document);
  }
}

function *toIterator<T>(iterable: Iterable<T>): Iterator<T> {
  for (const i of iterable)
    yield i;
}

// Flattens the given array one level deep
async function flattenAsync<T>(array: Promise<T[]>[]) {
  return ([] as T[]).concat(...(await Promise.all(array)));
}
