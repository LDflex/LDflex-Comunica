"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-ignore
const comunica_engine_1 = __importDefault(require("../lib/comunica-engine"));
const actor_init_sparql_1 = require("@comunica/actor-init-sparql");
/**
 * Asynchronous iterator wrapper for the Comunica SPARQL query engine.
 */
class ComunicaEngine {
    /**
     * Create a ComunicaEngine to query the given default source.
     *
     * The default source can be a single URL, an RDF/JS Datasource,
     * or an array with any of these.
     */
    constructor(defaultSource, engine) {
        this._engine = comunica_engine_1.default;
        // Preload sources but silence errors; they will be thrown during execution
        this._sources = this.parseSources(defaultSource);
        this._sources.catch(() => null);
    }
    async setEngine(engine) {
        if (engine)
            return engine();
        else if ((await this._sources).every(location => isValidURL(location.value)))
            return actor_init_sparql_1.newEngine();
        else
            return comunica_engine_1.default;
    }
    /**
     * Creates an asynchronous iterable of results for the given SPARQL query.
     */
    async *execute(sparql, source) {
        if ((/^\s*(?:INSERT|DELETE)/i).test(sparql))
            yield* this.executeUpdate(sparql, source);
        // Load the sources if passed, the default sources otherwise
        const sources = await (source ? this.parseSources(source) : this._sources);
        if (sources.length !== 0) {
            // Execute the query and yield the results
            const queryResult = await (await this._engine).query(sparql, { sources });
            yield* this.streamToAsyncIterable(queryResult.bindingsStream);
        }
    }
    /**
     * Creates an asynchronous iterable with the results of the SPARQL UPDATE query.
     */
    async *executeUpdate(sparql, source) {
        throw new Error(`SPARQL UPDATE queries are unsupported, received: ${sparql}`);
    }
    /**
     * Parses the source(s) into an array of Comunica sources.
     */
    async parseSources(source) {
        let sources = await source;
        if (!sources)
            return [];
        // Transform URLs or terms into strings
        if (sources instanceof URL)
            sources = sources.href;
        else if (typeof sources === 'object' && 'termType' in sources && sources.termType === 'NamedNode')
            sources = sources.value;
        const allSources = await (async () => {
            // Strip the fragment off a URI
            if (typeof sources === 'string')
                return [sources.replace(/#.*/, '')];
            // Flatten recursive calls to this function
            else if (Array.isArray(sources))
                return await flattenAsync(sources.map(s => this.parseSources(s)));
            // Needs to be after the string check since those also have a match functions
            else if (typeof sources === 'object' && 'match' in sources && typeof sources.match === 'function')
                return [Object.assign({ type: 'rdfjsSource' }, sources)];
            // Wrap a single source in an array
            else if (typeof source === 'object' && 'value' in source && typeof source.value === 'string')
                return [sources];
            // Error on unsupported sources
            else
                throw new Error(`Unsupported source: ${source}`);
        })();
        // Add Comunica source details
        return allSources.map(src => ({
            value: (typeof src === 'object') ? (src.value ?? src) : src,
            type: (typeof src === 'object' && 'type' in src) ? src.type : null
        }));
    }
    /**
     * Transforms the readable into an asynchronously iterable object
     */
    streamToAsyncIterable(readable) {
        // Track errors even when no next item is being requested
        let pendingError;
        readable.once('error', error => pendingError = error);
        // Return a asynchronous iterable
        return {
            next: () => new Promise(readNext),
            [Symbol.asyncIterator]() { return this; },
        };
        // Reads the next item
        function readNext(resolve, reject) {
            if (pendingError)
                return reject(pendingError);
            if (readable.ended)
                return resolve({ done: true, value: null });
            // Attach stream listeners
            readable.on('data', yieldValue);
            readable.on('end', finish);
            readable.on('error', finish);
            // Outputs the value through the iterable
            function yieldValue(value) {
                finish(null, value, true);
            }
            // Clean up, and reflect the state in the iterable
            function finish(error, value, pending) {
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
    async clearCache(document) {
        await (await this._engine).invalidateHttpCache(document);
    }
}
exports.default = ComunicaEngine;
// Flattens the given array one level deep
async function flattenAsync(array) {
    return (await Promise.all(array)).flat();
}
function isValidURL(location) {
    try {
        new URL(location);
        return true;
    }
    catch {
        return false;
    }
}
