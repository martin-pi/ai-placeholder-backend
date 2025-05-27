import embed from "./embed.js";
import * as sqliteVec from "sqlite-vec";
import Database from "better-sqlite3";

const db = {
  sqlite: null,
  vecVersion: null,

  // Store some information in a collection.
  createHandler: async function(req, res) {
    const collection = req.params.collection;
    if (typeof collection != 'string' || collection.length < 1) return res.status(400).send('Invalid collection.');
    if (typeof content != 'string' || content.length < 1) return res.status(400).send('Invalid content.');

    try {
      await db._ingestContent(collection, content, source);
      return res.status(200).send();
    } catch(err) {
      console.error(err);
      return res.status(500).send('An error occurred.')
    }
  },

  // Query a collection for information.
  queryHandler: async function(req, res) {
    const collection = req.params.collection;
    if (typeof collection != 'string' || collection.length < 1) return res.status(400).send('Invalid collection.');
    const query = req.body?.query ?? req.params?.query ?? req.params?.q;
    if (typeof collection != 'string' || collection.length < 1) return res.status(400).send('Invalid query.');
    const k = req.body?.k ?? req.params ?.k ?? 3;
    if (typeof k != 'number' || k < 1) return res.status(400).send('Invalid k.');
    
    try {
      const results = await db._queryContent(collection, query, k);
      return res.status(200).json(results);
    } catch(err) {
      console.error(err);
      return res.status(500).send('An error occurred.');
    }
  },

  // Create a new collection to store information in.
  createCollectionHandler: async function(req, res) {
    const title = req.body?.title ?? req.body?.collection ?? req.params?.title ?? req.params?.collection;
    if (typeof title != 'string' || title.length < 1) return res.status(400).send('Invalid title.');
    
    try {
      await db._createCollection(title);
      return res.status(200).send();
    } catch(err) {
      console.error(err);
      return res.status(500).send('An error occurred.');
    }
  },

  listCollectionsHandler: async function(req, res) {
    try {
      const results = await db._listCollections();
      return res.status(200).json(results);
    } catch(err) {
      console.error(err);
      return res.status(500).send('An error occurred.');
    }
  },

  async _listCollections() {
    const query = `SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%';`;
    var result = db.sqlite.prepare(query).all();

    result.forEach((i) => {
      const rowQuery = `SELECT COUNT(*) AS count FROM ${i.name};`;
      var rowResult = db.sqlite.prepare(rowQuery).get();
      i.rows = rowResult.count;
    });

    result = result.map(i => { return { name: i.name, rows: i.rows }; });
    return result;
  },

  async _createCollection(title) {
    console.log(`Creating collection "${title}"...`);
    const query = `CREATE TABLE IF NOT EXISTS ${title} (
      createdAt TEXT NOT NULL,
      source TEXT,
      sourceIndex INT NOT NULL,
      chunkId TEXT UNIQUE,
      content TEXT,
      embedding float[${embed.maxChunk}]
    );`;

    const result = db.sqlite.prepare(query, (err) => {
      if (err) {
        console.error(`Could not create table: ${err.message}`);
        return false;
      }
      return true;
    }).run();

    return result;
  },

  async _queryContent(collection, content, k) {
    var embedding = await embed._embedOne(content);
    var array = new Float32Array(embedding);
    const query = `SELECT createdAt, source, sourceIndex, chunkId, content, vec_distance_cosine(embedding, ?) as distance FROM ${collection} ORDER BY distance DESC LIMIT ${k ?? 3};`;
    var response = db.sqlite.prepare(query).get(array);
    return response ?? [];
  },

  async _ingestContent(collection, content, source) {
    if (typeof collection != 'string') throw new Error('_ingestContent requires a collection to be specified.');
    if (typeof content != 'string') throw new Error('_ingestContent requires content to be a string.');

    // Make a timestamp for all potential chunks to reference.
    const timestamp = new Date().toISOString();
    const cleanTimestamp = timestamp.replaceAll(/[-:TZ.]/g, '');

    // Chunk the content, and create an embedding for each chunk.
    var chunks = await embed._embed(content);

    // Create a record for each chunk and store it.
    chunks.forEach(async (chunk, index) => {
      try {
        const record = {
          createdAt: timestamp,
          source: source ?? 'unknown',
          sourceIndex: index ?? 0,
          chunkId: `${source ?? 'unknown'}:${cleanTimestamp}:${index ?? 0}`,
          content: chunk.content,
          embedding: chunk.embedding
        }
        await db._createRecord(collection, record);
      } catch(err) {
        console.error(`Could not ingest chunk: ${chunk.content}\n${err.message}`);
      }
    });
    return true;
  },

  async _createRecord(collection, r) {
    if (typeof collection != 'string') throw new Error('_createRecord requires a collection to be specified.');
    // Wrap the embedding, which is passed in as an array of floats, in a Float32Array, which has a .buffer property for SQLite to work with.
    let array = new Float32Array(r.embedding);
    const query = `INSERT INTO ${collection} (createdAt, source, sourceIndex, chunkId, content, embedding) VALUES (?, ?, ?, ?, ?, ?);`;
    const result = db.sqlite.prepare(query).run(r.createdAt, r.source, r.sourceIndex, r.chunkId, r.content, array);
    return result;
  },

  initialize: async function() {
    console.log('Initializing SQLite...'); 
    const sqlite = new Database('./collections/collections.db');
    sqliteVec.load(sqlite);
    db.sqlite = sqlite;
    console.log('\tInitialized.');
    const { vecVersion } = sqlite.prepare('select vec_version() as vecVersion;').get();
    db.vecVersion = vecVersion;
    console.log(`\tSQLite Vec Version: ${db.vecVersion}`);

    console.log('Running SQLite Vec Validations...');
    await db._createCollection('test');
    await db._ingestContent('test', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.', 'loremipsum');
    var result = await db._queryContent('test', 'lorem ipsum', 3);
    if (Array.isArray(result) || result.length < 1) console.error('\tSomething went wrong.');
    else console.log('\tDone.');
    
  }

}

export default db;