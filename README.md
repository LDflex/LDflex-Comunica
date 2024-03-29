# Comunica for LDflex
This library lets you use
the [Comunica](https://github.com/comunica/comunica/) query engine
with the [LDflex](https://github.com/LDflex/LDflex) language.

[![npm version](https://img.shields.io/npm/v/@ldflex/comunica.svg)](https://www.npmjs.com/package/@ldflex/comunica)
[![build](https://img.shields.io/github/workflow/status/LDflex/LDflex-Comunica/Push%20Checks)](https://github.com/LDflex/LDflex-Comunica/tree/master/)
[![Coverage Status](https://coveralls.io/repos/github/LDflex/LDflex-Comunica/badge.svg?branch=master)](https://coveralls.io/github/LDflex/LDflex-Comunica?branch=master)
[![Dependency Status](https://david-dm.org/LDflex/LDflex-Comunica.svg)](https://david-dm.org/LDflex/LDflex-Comunica)

## Installation
```bash
npm install ldflex @ldflex/comunica
```

## Usage
```JavaScript
const { PathFactory } = require('ldflex');
const { default: ComunicaEngine } = require('@ldflex/comunica');
const { namedNode } = require('@rdfjs/data-model');

// The JSON-LD context for resolving properties
const context = {
  "@context": {
    "@vocab": "http://xmlns.com/foaf/0.1/",
    "friends": "knows",
  }
};
// The query engine and its source
const queryEngine = new ComunicaEngine('https://ruben.verborgh.org/profile/');
// The object that can create new paths
const paths = new PathFactory({ context, queryEngine });

async function showPerson(person) {
  console.log(`This person is ${await person.name}`);

  console.log(`${await person.givenName} is friends with:`);
  for await (const name of person.friends.givenName)
    console.log(`- ${name}`);
}

const ruben = paths.create({
  subject: namedNode('https://ruben.verborgh.org/profile/#me'),
});
showPerson(ruben);
```

## Features

### Using a customised ComunicaEngine

This example uses the comunica engine for local file queries.

```JavaScript
const { PathFactory } = require('ldflex');
const { default: ComunicaEngine } = require('@ldflex/comunica');
const { namedNode } = require('@rdfjs/data-model');
const { newEngine: localFileEngine } = require('@comunica/actor-init-sparql-file');

// The JSON-LD context for resolving properties
const context = {
  "@context": {
    "@vocab": "http://xmlns.com/foaf/0.1/",
    "friends": "knows",
  }
};
// The query engine and its source
const queryEngine = new ComunicaEngine(
    path.join(__dirname, 'ruben-verborgh.ttl'),
    { engine: localFileEngine() }
  );
// The object that can create new paths
const paths = new PathFactory({ context, queryEngine });

async function showPerson(person) {
  console.log(`This person is ${await person.name}`);

  console.log(`${await person.givenName} is friends with:`);
  for await (const name of person.friends.givenName)
    console.log(`- ${name}`);
}

const ruben = paths.create({
  subject: namedNode('https://ruben.verborgh.org/profile/#me'),
});
showPerson(ruben);
```
### Adding custom options to the ComunicaEngine

Add [comunica context options](https://comunica.dev/docs/query/advanced/context/) which are passed to the Comunica Engine. 

```JavaScript
const { PathFactory } = require('ldflex');
const { default: ComunicaEngine } = require('@ldflex/comunica');
const { namedNode } = require('@rdfjs/data-model');

// The JSON-LD context for resolving properties
const context = {
  "@context": {
    "@vocab": "http://xmlns.com/foaf/0.1/",
    "friends": "knows",
  }
};

// The query engine and its source
const queryEngine = new ComunicaEngine(
    'https://ruben.verborgh.org/profile/',
    { options: {/* add options here */} },
  );

// The object that can create new paths
const paths = new PathFactory({ context, queryEngine });

async function showPerson(person) {
  console.log(`This person is ${await person.name}`);

  console.log(`${await person.givenName} is friends with:`);
  for await (const name of person.friends.givenName)
    console.log(`- ${name}`);
}

const ruben = paths.create({
  subject: namedNode('https://ruben.verborgh.org/profile/#me'),
});
showPerson(ruben);
```

### Updating data
By default the source given is also used as the destination for updates (if multiple sources are given, then the first one is chosen).

Optionally you can specify your own destination for updates as follows

```JavaScript
// The query engine and its source
const queryEngine = new ComunicaEngine(
    'https://ruben.verborgh.org/profile/',
    { destination: 'https://example.org/destination' },
  );
```

## License
©2018–present
[Ruben Verborgh](https://ruben.verborgh.org/), Joachim Van Herwegen, [Jesse Wright](https://github.com/jeswr/). [MIT License](https://github.com/LDflex/LDflex-Comunica/blob/master/LICENSE.md).
