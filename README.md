# Comunica for LDflex
This library lets you use
the [Comunica](https://github.com/comunica/comunica/) query engine
with the [LDflex](https://github.com/RubenVerborgh/LDflex) language.

## Installation
```bash
npm install ldflex ldflex-comunica
```

## Usage
```JavaScript
const { PathFactory } = require('ldflex');
const { default: ComunicaEngine } = require('ldflex-comunica');

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

const ruben = paths.create({ subject: 'https://ruben.verborgh.org/profile/#me' });
showPerson(ruben);
```

## License
©2018–present [Ruben Verborgh](https://ruben.verborgh.org/),
[MIT License](https://github.com/RubenVerborgh/LDflex/blob/master/LICENSE.md).
